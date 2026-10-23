import { mkdir, mkdtemp, readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Generator, type Config } from "@tanstack/router-generator";
import { ConfigError, type ResolvedScopedTreesConfig } from "./config.js";
import { readOnlyRoutesFs } from "./generator-fs.js";
import { resolveRouterConfig } from "./router-config.js";
import { crawlRoutes, type RouteCrawl, type ScannedRoute } from "./scan.js";
import { buildSectionTree } from "./section-tree.js";
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

const SCOPED_TREE_PLACEHOLDER = "scoped-route-tree.gen.js";
const GENERATED_FILE_PATTERN = /\.gen\.(js|d\.ts)$/;

export class UncoveredRoutesError extends Error {
  readonly uncovered: ScannedRoute[];

  constructor(uncovered: ScannedRoute[], configFile: string) {
    super(formatUncoveredError(uncovered, configFile));
    this.name = "UncoveredRoutesError";
    this.uncovered = uncovered;
  }
}

export function appRouterConfig(
  root: string,
  config: ResolvedScopedTreesConfig,
  router?: Partial<Config>,
): Config {
  const resolveAgainstRoot = (value: string | undefined) =>
    value === undefined ? undefined : path.resolve(root, value);

  return resolveRouterConfig(root, {
    inline: router,
    routesDirectory: resolveAgainstRoot(config.routesDirectory),
    generatedRouteTree: resolveAgainstRoot(config.generatedRouteTree),
  });
}

function isInside(directory: string, candidate: string): boolean {
  const relative = path.relative(directory, candidate);

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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

async function crawlForOutput(
  root: string,
  routerConfig: Config,
  outputDirectory: string,
): Promise<RouteCrawl> {
  const firstCreated = firstMissingDirectory(outputDirectory);

  try {
    return await crawlRoutes(
      {
        ...routerConfig,
        disableTypes: true,
        generatedRouteTree: path.join(outputDirectory, SCOPED_TREE_PLACEHOLDER),
      },
      root,
    );
  } finally {
    await removeEmptyDirectories(outputDirectory, firstCreated);
  }
}

async function renderTrees(
  root: string,
  crawl: RouteCrawl,
  sections: Record<string, string[]>,
  commonRoutes: string[],
): Promise<Map<string, string>> {
  const declaration = declarationFor(await frameworkPackage(root));
  const files = new Map<string, string>();

  for (const [name, prefixes] of Object.entries(sections)) {
    const selected = selectSection(crawl.routes, prefixes, commonRoutes);
    const tree = await buildSectionTree(crawl, selected);

    files.set(`${name}.gen.js`, tree.content);
    files.set(`${name}.gen.d.ts`, declaration);
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
  router?: Partial<Config>;
}): Promise<GenerateResult> {
  const root = path.resolve(opts.root);
  const routerConfig = appRouterConfig(root, opts.config, opts.router);
  const outputDirectory = path.resolve(root, opts.config.outputDirectory);

  if (isInside(path.resolve(routerConfig.routesDirectory), outputDirectory)) {
    throw new ConfigError(
      `outputDirectory "${opts.config.outputDirectory}" is inside the routes directory (${routerConfig.routesDirectory}). Generated trees must live outside it.`,
    );
  }

  const crawl = await crawlForOutput(root, routerConfig, outputDirectory);
  const { routes } = crawl;
  const uncovered = findUncovered(routes, opts.config);

  if (uncovered.length > 0 && !opts.config.autoSectionUncovered) {
    throw new UncoveredRoutesError(uncovered, opts.config.configFile);
  }

  const { sections } = applyAutoSections(routes, opts.config);

  assertPrefixesMatch(routes, { sections });

  const files = await renderTrees(root, crawl, sections, opts.config.commonRoutes);
  const changed = await changedFiles(outputDirectory, files);
  const stale = (await existingGeneratedFiles(outputDirectory))
    .filter((name) => !files.has(name))
    .sort();

  if (opts.mode === "write") {
    await writeTrees(outputDirectory, files, changed, stale);
  }

  return { sections: Object.keys(sections), changed, stale, uncovered };
}
