import { execa } from "execa";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import type { CliProvider } from "@rcc/shared";
import { cliCapabilities } from "./cliCapabilities.js";
import { internal } from "../utils/errors.js";

export interface CliInvocation {
  provider: CliProvider;
  prompt: string;
  outputFile: string;
  cwd?: string;
  timeoutMs?: number;
  model?: string;
  systemPrompt?: string;
  abortSignal?: AbortSignal;
  /** Optional handler that receives stdout/stderr chunks for live streaming. */
  onStream?: (
    stream: "stdout" | "stderr",
    text: string,
  ) => void;
}

export interface CliResult {
  exitCode: number;
  durationMs: number;
  stdoutBytes: number;
  stderrTail: string;
  command: string;
  args: string[];
  model?: string;
}

const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const STDERR_TAIL_BYTES = 2048;

export const cliRunner = {
  async invoke(inv: CliInvocation): Promise<CliResult> {
    const caps = await cliCapabilities.get(inv.provider);
    if (!caps.available) {
      throw internal(
        `CLI '${inv.provider}' not found on PATH. Install it or update RCC_PATH.`,
      );
    }
    const { command, args } = buildCommand(inv, caps.flags);
    await fs.mkdir(path.dirname(inv.outputFile), { recursive: true });
    const outStream = createWriteStream(inv.outputFile, { flags: "w" });
    const start = Date.now();

    const subprocess = execa(command, args, {
      input: inv.prompt,
      cwd: inv.cwd,
      timeout: inv.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      cancelSignal: inv.abortSignal,
      reject: false,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    let stdoutBytes = 0;
    let stderrBuffer = "";

    subprocess.stdout?.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      const text = chunk.toString("utf8");
      outStream.write(chunk);
      inv.onStream?.("stdout", text);
    });

    subprocess.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderrBuffer += text;
      if (stderrBuffer.length > STDERR_TAIL_BYTES * 2) {
        stderrBuffer = stderrBuffer.slice(-STDERR_TAIL_BYTES);
      }
      inv.onStream?.("stderr", text);
    });

    const result = await subprocess;
    outStream.end();
    await new Promise<void>((resolve) => outStream.on("close", resolve));

    const durationMs = Date.now() - start;
    return {
      exitCode: result.exitCode ?? -1,
      durationMs,
      stdoutBytes,
      stderrTail: stderrBuffer.slice(-STDERR_TAIL_BYTES),
      command,
      args,
      model: inv.model,
    };
  },
};

function buildCommand(
  inv: CliInvocation,
  flags: Set<string>,
): { command: string; args: string[] } {
  if (inv.provider === "claude") {
    const args: string[] = [];
    args.push(flags.has("--print") ? "--print" : "-p");
    if (flags.has("--output-format")) args.push("--output-format", "text");
    // --bare requires ANTHROPIC_API_KEY; we keep OAuth/keychain auth working
    // by skipping it. To still get a clean run we disable tools and slash
    // commands so the model just answers the prompt.
    if (flags.has("--tools")) args.push("--tools", "");
    if (flags.has("--disable-slash-commands")) args.push("--disable-slash-commands");
    if (inv.model && flags.has("--model")) args.push("--model", inv.model);
    if (inv.systemPrompt) {
      if (flags.has("--system-prompt")) {
        args.push("--system-prompt", inv.systemPrompt);
      } else if (flags.has("--append-system-prompt")) {
        args.push("--append-system-prompt", inv.systemPrompt);
      }
    }
    return { command: "claude", args };
  }
  if (inv.provider === "codex") {
    const args = ["exec"];
    if (flags.has("--ephemeral")) args.push("--ephemeral");
    if (flags.has("--ignore-user-config")) args.push("--ignore-user-config");
    if (flags.has("--skip-git-repo-check")) args.push("--skip-git-repo-check");
    if (inv.model && flags.has("--model")) args.push("--model", inv.model);
    return { command: "codex", args };
  }
  throw internal(`Unknown CLI provider: ${inv.provider}`);
}
