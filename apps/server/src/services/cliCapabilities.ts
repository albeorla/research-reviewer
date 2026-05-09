import { execa } from "execa";
import type { CliProvider } from "@rcc/shared";

export interface CliCapabilities {
  provider: CliProvider;
  binaryPath: string | null;
  available: boolean;
  flags: Set<string>;
  version: string | null;
  helpExcerpt: string;
  detectedAt: string;
}

class CliCapabilityCache {
  private readonly cache = new Map<CliProvider, CliCapabilities>();

  async get(provider: CliProvider, force = false): Promise<CliCapabilities> {
    if (!force) {
      const cached = this.cache.get(provider);
      if (cached) return cached;
    }
    const detected = await this.detect(provider);
    this.cache.set(provider, detected);
    return detected;
  }

  private async detect(provider: CliProvider): Promise<CliCapabilities> {
    const detectedAt = new Date().toISOString();
    const binaryPath = await whichSafe(provider);
    if (!binaryPath) {
      return {
        provider,
        binaryPath: null,
        available: false,
        flags: new Set(),
        version: null,
        helpExcerpt: "",
        detectedAt,
      };
    }

    let helpText = "";
    try {
      const helpResult = await execa(provider, ["--help"], {
        timeout: 10_000,
        reject: false,
      });
      helpText = `${helpResult.stdout}\n${helpResult.stderr}`;
    } catch {
      // Treat as available but with no flag info if help fails.
    }

    let version: string | null = null;
    try {
      const v = await execa(provider, ["--version"], {
        timeout: 10_000,
        reject: false,
      });
      version = (v.stdout || v.stderr).trim().split("\n")[0] ?? null;
    } catch {
      version = null;
    }

    return {
      provider,
      binaryPath,
      available: true,
      flags: extractFlags(helpText),
      version,
      helpExcerpt: helpText.slice(0, 4000),
      detectedAt,
    };
  }
}

async function whichSafe(name: string): Promise<string | null> {
  try {
    const result = await execa("which", [name], { reject: false });
    if (result.exitCode === 0) {
      const path = result.stdout.trim();
      return path || null;
    }
    return null;
  } catch {
    return null;
  }
}

function extractFlags(helpText: string): Set<string> {
  const flags = new Set<string>();
  for (const line of helpText.split("\n")) {
    for (const m of line.matchAll(/(--?[a-zA-Z][\w-]*)/g)) {
      const f = m[1];
      if (!f) continue;
      if (f === "-" || f === "--") continue;
      flags.add(f);
    }
  }
  return flags;
}

export const cliCapabilities = new CliCapabilityCache();
