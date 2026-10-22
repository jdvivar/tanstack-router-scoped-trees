import { mkdir, mkdtemp, readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Generator, type Config } from "@tanstack/router-generator";
import { ConfigError, type ResolvedScopedTreesConfig } from "./config.js";
import { inMemoryOutputFs, readOnlyRoutesFs } from "./generator-fs.js";
import { resolveRouterConfig } from "./router-config.js";
import { scanRoutes, type ScannedRoute } from "./scan.js";
import { createSectionRouteConfig } from "./section-route-config.js";
import {
  applyAutoSections,
  assertPrefixesMatch,
  findUncovered,
  formatUncoveredError,
  selectSection,
} from "./sections.js";

export type GenerateResult = {
  sections: string[];
  changed: string[];
  stale: string[];
  uncovered: ScannedRoute[];
};

type GenerateMode = "write" | "check";

const ROOT_ROUTE_NAME = "__root";
const GENERATED_FILE_PATTERN = /\.gen\.(js|d\.ts)$/;

export class UncoveredRoutesError extends Error {
  readonly uncovered: ScannedRoute[];

  constructor(uncovered: ScannedRoute[], configFile: string) {
    super(formatUncoveredError(uncovered, configFile));
    this.name = "UncoveredRoutesError";
    this.uncovered = uncovered;
  }
}

function appRouterConfig(root: string, config: ResolvedScopedTreesConfig): Config {
  const resolveAgainstRoot = (value: string | undefined) =>
    value === undefined ? undefined : path.resolve(root, value);

  return resolveRouterConfig(root, {
    routesDirectory: resolveAgainstRoot(config.routesDirectory),
    generatedRouteTree: resolveAgainstRoot(config.generatedRouteTree),
  });
}

function isInside(directory: string, candidate: string): boolean {
  const relative = path.relative(directory, candidate);

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function findRootFile(routesDirectory: string): Promise<string> {
  const entries = await readdir(routesDirectory, { withFileTypes: true });
  const rootFile = entries.find(
    (entry) => entry.isFile() && path.parse(entry.name).name === ROOT_ROUTE_NAME,
  );

  if (rootFile === undefined) {
    throw new Error(`No ${ROOT_ROUTE_NAME} route file found in ${routesDirectory}.`);
  }

  return rootFile.name;
}

async function frameworkPackage(root: string): Promise<string> {
  try {
    const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };

    return "@tanstack/solid-router" in dependencies
      ? "@tanstack/solid-router"
      : "@tanstack/react-router";
  } catch {
    return "@tanstack/react-router";
  }
}

function declarationFor(framework: string): string {
  return `import type { AnyRoute } from "${framework}";\nexport declare const routeTree: AnyRoute;\n`;
}

async function generateInMemory(config: Config, root: string): Promise<string> {
  const { fs, output } = inMemoryOutputFs(config.routesDirectory, config.generatedRouteTree);

  await new Generator({ config, root, fs }).run();

  const tree = output();

  if (tree === undefined) {
    throw new Error(
      `TanStack's generator produced no route tree for ${config.generatedRouteTree}.`,
    );
  }

  return tree;
}

async function readIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function existingGeneratedFiles(outputDirectory: string): Promise<string[]> {
  try {
    return (await readdir(outputDirectory)).filter((name) => GENERATED_FILE_PATTERN.test(name));
  } catch {
    return [];
  }
}

function firstMissingDirectory(directory: string): string | undefined {
  let missing: string | undefined;
  let current = directory;

  while (!existsSync(current)) {
    missing = current;
    current = path.dirname(current);
  }

  return missing;
}

async function removeEmptyDirectories(from: string, upTo: string | undefined): Promise<void> {
  if (upTo === undefined) {
    return;
  }

  let current = from;

  while (isInside(upTo, current)) {
    try {
      await rmdir(current);
    } catch {
      return;
    }

    current = path.dirname(current);
  }
}

async function renderTrees(
  root: string,
  routerConfig: Config,
  sections: Record<string, string[]>,
  routes: ScannedRoute[],
  commonRoutes: string[],
  outputDirectory: string,
): Promise<Map<string, string>> {
  const rootFile = await findRootFile(routerConfig.routesDirectory);
  const declaration = declarationFor(await frameworkPackage(root));
  const tmpDir = await mkdtemp(path.join(tmpdir(), "scoped-trees-generator-"));
  const firstCreated = firstMissingDirectory(outputDirectory);
  const files = new Map<string, string>();

  try {
    for (const [name, prefixes] of Object.entries(sections)) {
      const selected = selectSection(routes, prefixes, commonRoutes);
      const tree = await generateInMemory(
        {
          ...routerConfig,
          virtualRouteConfig: createSectionRouteConfig(routes, selected, rootFile),
          disableTypes: true,
          generatedRouteTree: path.join(outputDirectory, `${name}.gen.js`),
          disableLogging: true,
          tmpDir,
        },
        root,
      );

      files.set(`${name}.gen.js`, tree);
      files.set(`${name}.gen.d.ts`, declaration);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });

    await removeEmptyDirectories(outputDirectory, firstCreated);
  }

  return files;
}

async function changedFiles(outputDirectory: string, files: Map<string, string>) {
  const changed: string[] = [];

  for (const [name, content] of files) {
    if ((await readIfExists(path.join(outputDirectory, name))) !== content) {
      changed.push(name);
    }
  }

  return changed;
}

async function writeTrees(
  outputDirectory: string,
  files: Map<string, string>,
  changed: string[],
  stale: string[],
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });

  for (const name of changed) {
    await writeFile(path.join(outputDirectory, name), files.get(name) ?? "");
  }

  for (const name of stale) {
    await rm(path.join(outputDirectory, name), { force: true });
  }
}

export async function generateFullTree(opts: {
  root: string;
  config: ResolvedScopedTreesConfig;
}): Promise<void> {
  const root = path.resolve(opts.root);
  const config = appRouterConfig(root, opts.config);
  const outputDirectory = path.dirname(path.resolve(root, config.generatedRouteTree));

  await mkdir(outputDirectory, { recursive: true });

  const tmpDir = await mkdtemp(path.join(outputDirectory, ".scoped-trees-tmp-"));

  try {
    await new Generator({
      config: { ...config, tmpDir },
      root,
      fs: readOnlyRoutesFs(config.routesDirectory),
    }).run();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function generateScopedTrees(opts: {
  root: string;
  config: ResolvedScopedTreesConfig;
  mode: GenerateMode;
}): Promise<GenerateResult> {
  const root = path.resolve(opts.root);
  const routerConfig = appRouterConfig(root, opts.config);
  const outputDirectory = path.resolve(root, opts.config.outputDirectory);

  if (isInside(path.resolve(routerConfig.routesDirectory), outputDirectory)) {
    throw new ConfigError(
      `outputDirectory "${opts.config.outputDirectory}" is inside the routes directory (${routerConfig.routesDirectory}). Generated trees must live outside it.`,
    );
  }

  const { routes } = await scanRoutes(routerConfig, root);
  const uncovered = findUncovered(routes, opts.config);

  if (uncovered.length > 0 && !opts.config.autoSectionUncovered) {
    throw new UncoveredRoutesError(uncovered, opts.config.configFile);
  }

  const { sections } = applyAutoSections(routes, opts.config);

  assertPrefixesMatch(routes, { sections });

  const files = await renderTrees(
    root,
    routerConfig,
    sections,
    routes,
    opts.config.commonRoutes,
    outputDirectory,
  );
  const changed = await changedFiles(outputDirectory, files);
  const stale = (await existingGeneratedFiles(outputDirectory))
    .filter((name) => !files.has(name))
    .sort();

  if (opts.mode === "write") {
    await writeTrees(outputDirectory, files, changed, stale);
  }

  return { sections: Object.keys(sections), changed, stale, uncovered };
}
