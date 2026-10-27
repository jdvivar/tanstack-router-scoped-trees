import { chmod, chown, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type FileStat = { mtimeMs: bigint; mode: number; uid: number; gid: number };

export type GeneratorFs = {
  stat: (filePath: string) => Promise<FileStat>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  readFile: (
    filePath: string,
  ) => Promise<{ stat: { mtimeMs: bigint }; fileContent: string } | "file-not-existing">;
  chmod: (filePath: string, mode: number) => Promise<void>;
  chown: (filePath: string, uid: number, gid: number) => Promise<void>;
};

export type OnDroppedWrite = (filePath: string) => void;

const APPLY_FROM_CLI = "start the dev server or run `tsr generate`";
export const APPLY_IN_DEV_SERVER =
  "TanStack's router plugin applies the update, so commit the file";

export function formatSkippedRouteUpdate(
  root: string,
  filePath: string,
  nextStep: string = APPLY_FROM_CLI,
): string {
  return `${path.relative(root, filePath)} was not changed. TanStack wanted to update this file; ${nextStep}.`;
}

function isInside(directory: string, filePath: string): boolean {
  return path.resolve(filePath).startsWith(path.resolve(directory) + path.sep);
}

async function diskStat(filePath: string): Promise<FileStat> {
  const stats = await stat(filePath, { bigint: true });

  return {
    mtimeMs: stats.mtimeMs,
    mode: Number(stats.mode),
    uid: Number(stats.uid),
    gid: Number(stats.gid),
  };
}

async function diskReadFile(filePath: string): ReturnType<GeneratorFs["readFile"]> {
  try {
    const fileContent = await readFile(filePath, "utf8");
    const stats = await stat(filePath, { bigint: true });

    return { stat: { mtimeMs: stats.mtimeMs }, fileContent };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "file-not-existing";
    }

    throw error;
  }
}

export function readOnlyRoutesFs(
  routesDirectory: string,
  onDropped: OnDroppedWrite = () => {},
): GeneratorFs {
  return {
    rename: async (oldPath, newPath) => {
      if (isInside(routesDirectory, newPath)) {
        await rm(oldPath, { force: true });
        onDropped(path.resolve(newPath));

        return;
      }

      await rename(oldPath, newPath);
    },
    stat: diskStat,
    writeFile: (filePath, content) => writeFile(filePath, content),
    readFile: diskReadFile,
    chmod: (filePath, mode) => chmod(filePath, mode),
    chown: (filePath, uid, gid) => chown(filePath, uid, gid),
  };
}

const MEMORY_STAT: FileStat = { mtimeMs: 0n, mode: 0o644, uid: 0, gid: 0 };

export function inMemoryOutputFs(
  routesDirectory: string,
  outputPath: string,
  onDropped: OnDroppedWrite = () => {},
): { fs: GeneratorFs; output: () => string | undefined } {
  const staged = new Map<string, string>();
  const target = path.resolve(outputPath);
  let output: string | undefined;

  const isMemoryPath = (filePath: string) =>
    path.resolve(filePath) === target || staged.has(path.resolve(filePath));

  const fs: GeneratorFs = {
    writeFile: async (filePath, content) => {
      staged.set(path.resolve(filePath), content);
    },
    rename: async (oldPath, newPath) => {
      const key = path.resolve(oldPath);
      const content = staged.get(key);

      staged.delete(key);

      if (path.resolve(newPath) === target) {
        output = content;

        return;
      }

      if (isInside(routesDirectory, newPath)) {
        onDropped(path.resolve(newPath));

        return;
      }

      throw new Error(`Unexpected generator write to ${newPath}`);
    },
    stat: async (filePath) => (isMemoryPath(filePath) ? MEMORY_STAT : diskStat(filePath)),
    readFile: async (filePath) => {
      if (path.resolve(filePath) === target) {
        return { stat: { mtimeMs: MEMORY_STAT.mtimeMs }, fileContent: output ?? "" };
      }

      return diskReadFile(filePath);
    },
    chmod: async () => {},
    chown: async () => {},
  };

  return { fs, output: () => output };
}
