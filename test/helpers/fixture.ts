import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
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

async function writeManifest(directory: string, manifest: Record<string, unknown>) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "package.json"), JSON.stringify(manifest));
}

export async function fakeRouterPlugin(root: string, generatorVersion: string): Promise<void> {
  const plugin = path.join(root, "node_modules/@tanstack/router-plugin");

  await writeManifest(plugin, { name: "@tanstack/router-plugin", version: "1.0.0" });
  await writeManifest(path.join(plugin, "node_modules/@tanstack/router-generator"), {
    name: "@tanstack/router-generator",
    version: generatorVersion,
  });
}
