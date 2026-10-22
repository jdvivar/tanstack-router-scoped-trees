import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDirectory = fileURLToPath(new URL("../fixtures/", import.meta.url));

export function fixturePath(name: string): string {
  return path.join(fixturesDirectory, name);
}

export async function copyFixture(name: string): Promise<string> {
  const target = await mkdtemp(path.join(tmpdir(), `scoped-trees-${name}-`));

  await cp(fixturePath(name), target, { recursive: true });

  return target;
}
