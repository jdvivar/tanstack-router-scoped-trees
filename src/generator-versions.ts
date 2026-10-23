import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const GENERATOR_MANIFEST = "@tanstack/router-generator/package.json";
const PLUGIN_MANIFEST = "@tanstack/router-plugin/package.json";

export type GeneratorMismatch = {
  ours: string;
  plugin: string;
  message: string;
};

export class GeneratorMismatchError extends Error {
  readonly mismatch: GeneratorMismatch;

  constructor(mismatch: GeneratorMismatch) {
    super(mismatch.message);
    this.name = "GeneratorMismatchError";
    this.mismatch = mismatch;
  }
}

function versionAt(manifestPath: string): string {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: unknown };

  return String(manifest.version);
}

function resolveFrom(fromFile: string, request: string): string | undefined {
  try {
    return createRequire(fromFile).resolve(request);
  } catch {
    return undefined;
  }
}

function pluginGeneratorVersion(root: string): string | undefined {
  const pluginManifest = resolveFrom(
    path.join(path.resolve(root), "package.json"),
    PLUGIN_MANIFEST,
  );
  const generatorManifest =
    pluginManifest === undefined ? undefined : resolveFrom(pluginManifest, GENERATOR_MANIFEST);

  return generatorManifest === undefined ? undefined : versionAt(generatorManifest);
}

export function formatGeneratorMismatch(ours: string, plugin: string): string {
  return [
    `Two versions of @tanstack/router-generator are installed: ${ours} (used by tanstack-router-scoped-trees) and ${plugin} (used by @tanstack/router-plugin).`,
    `They can generate different route trees, so the scoped trees would not match what the dev server generates.`,
    `Fix: npm i -D @tanstack/router-generator@${plugin}, then check that "npm ls @tanstack/router-generator" shows one version.`,
  ].join("\n");
}

export function findGeneratorMismatch(
  root: string,
  ownModule: string = import.meta.url,
): GeneratorMismatch | undefined {
  const ownManifest = resolveFrom(ownModule, GENERATOR_MANIFEST);
  const plugin = pluginGeneratorVersion(root);

  if (ownManifest === undefined || plugin === undefined) {
    return undefined;
  }

  const ours = versionAt(ownManifest);

  return ours === plugin
    ? undefined
    : { ours, plugin, message: formatGeneratorMismatch(ours, plugin) };
}

export function assertSingleGenerator(root: string, ownModule?: string): void {
  const mismatch = findGeneratorMismatch(root, ownModule);

  if (mismatch !== undefined) {
    throw new GeneratorMismatchError(mismatch);
  }
}
