import fs from "fs-extra";
import path from "node:path";

export const fileStore = {
  async ensureDir(dir: string): Promise<void> {
    await fs.ensureDir(dir);
  },

  async writeText(filePath: string, content: string): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, "utf8");
  },

  async readText(filePath: string): Promise<string> {
    return fs.readFile(filePath, "utf8");
  },

  async exists(p: string): Promise<boolean> {
    return fs.pathExists(p);
  },

  async writeJson(filePath: string, data: unknown): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  },

  async readJson<T>(filePath: string): Promise<T> {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  },

  async listDir(dir: string): Promise<string[]> {
    if (!(await fs.pathExists(dir))) return [];
    return fs.readdir(dir);
  },

  async isWritable(dir: string): Promise<boolean> {
    try {
      await fs.ensureDir(dir);
      const testFile = path.join(dir, `.rcc-write-test-${Date.now()}`);
      await fs.writeFile(testFile, "");
      await fs.remove(testFile);
      return true;
    } catch {
      return false;
    }
  },
};
