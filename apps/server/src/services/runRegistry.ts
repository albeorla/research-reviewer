import path from "node:path";
import os from "node:os";
import { fileStore } from "./fileStore.js";

const REGISTRY_DIR = path.join(os.homedir(), ".config", "rcc");
const REGISTRY_PATH = path.join(REGISTRY_DIR, "runs-index.json");

interface RegistryEntry {
  id: string;
  runDir: string;
  outputRoot: string;
}

interface RegistryFile {
  schemaVersion: 1;
  entries: RegistryEntry[];
}

class RunRegistry {
  private cache: RegistryEntry[] | null = null;

  async load(): Promise<RegistryEntry[]> {
    if (this.cache) return this.cache;
    if (!(await fileStore.exists(REGISTRY_PATH))) {
      this.cache = [];
      return this.cache;
    }
    try {
      const data = await fileStore.readJson<RegistryFile>(REGISTRY_PATH);
      this.cache = data.entries ?? [];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  async add(entry: RegistryEntry): Promise<void> {
    const entries = await this.load();
    const next = entries.filter((e) => e.id !== entry.id).concat(entry);
    this.cache = next;
    await fileStore.ensureDir(REGISTRY_DIR);
    await fileStore.writeJson(REGISTRY_PATH, {
      schemaVersion: 1,
      entries: next,
    } satisfies RegistryFile);
  }

  async remove(id: string): Promise<void> {
    const entries = await this.load();
    const next = entries.filter((e) => e.id !== id);
    if (next.length === entries.length) return;
    this.cache = next;
    await fileStore.writeJson(REGISTRY_PATH, {
      schemaVersion: 1,
      entries: next,
    } satisfies RegistryFile);
  }
}

export const runRegistry = new RunRegistry();
