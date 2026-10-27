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
  droppedRouteFiles: string[];
};

type GenerateMode = "write" | "check";

const SCOPED_TREE_PLACEHOLDER = "scoped-route-tree.gen.js";
const TREE_SUFFIX = ".gen.js";
const DECLARATION_SUFFIX = ".gen.d.ts";

export class UncoveredRoutesError extends Error {
  readonly uncovered: ScannedRoute[];

  constructor(uncovered: ScannedRoute[], configFile: string, sectionNames: string[] = []) {
    super(formatUncoveredError(uncovered, configFile, sectionNames));
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

const FRAMEWORK_PACKAGES: Record<Config["target"], string> = {
  react: "@tanstack/react-router",
  solid: "@tanstack/solid-router",
  vue: "@tanstack/vue-router",
};

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

const OWN_DECLARATIONS = new Set(Object.values(FRAMEWORK_PACKAGES).map(declarationFor));

async function isOwnTree(outputDirectory: string, declarationName: string): Promise<boolean> {
  const declaration = await readIfExists(path.join(outputDirectory, declarationName));

  return declaration !== undefined && OWN_DECLARATIONS.has(declaration);
}

async function existingGeneratedFiles(outputDirectory: string): Promise<string[]> {
  let names: string[];

  try {
    names = await readdir(outputDirectory);
  } catch {
    return [];
  }

  const owned: string[] = [];

  for (const name of names.filter((entry) => entry.endsWith(DECLARATION_SUFFIX))) {
    if (await isOwnTree(outputDirectory, name)) {
      const tree = name.slice(0, -DECLARATION_SUFFIX.length) + TREE_SUFFIX;

      owned.push(name, ...(names.includes(tree) ? [tree] : []));
    }
  }

  return owned;
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
  target: Config["target"],
  crawl: RouteCrawl,
  sections: Record<string, string[]>,
  commonRoutes: string[],
): Promise<Map<string, string>> {
  const declaration = declarationFor(FRAMEWORK_PACKAGES[target]);
  const files = new Map<string, string>();

  for (const [name, prefixes] of Object.entries(sections)) {
    const selected = selectSection(crawl.routes, prefixes, commonRoutes);
    const tree = await buildSectionTree(crawl, selected);

    files.set(`${name}${TREE_SUFFIX}`, tree.content);
    files.set(`${name}${DECLARATION_SUFFIX}`, declaration);
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
}): Promise<{ droppedRouteFiles: string[] }> {
  const root = path.resolve(opts.root);
  const config = appRouterConfig(root, opts.config);
  const droppedRouteFiles: string[] = [];
  const outputDirectory = path.dirname(path.resolve(root, config.generatedRouteTree));

  await mkdir(outputDirectory, { recursive: true });

  const tmpDir = await mkdtemp(path.join(outputDirectory, ".scoped-trees-tmp-"));

  try {
    await new Generator({
      config: { ...config, tmpDir },
      root,
      fs: readOnlyRoutesFs(config.routesDirectory, (file) => droppedRouteFiles.push(file)),
    }).run();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  return { droppedRouteFiles };
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

  assertPrefixesMatch(routes, opts.config, opts.config.configFile);

  const uncovered = findUncovered(routes, opts.config);

  if (uncovered.length > 0 && !opts.config.autoSectionUncovered) {
    throw new UncoveredRoutesError(
      uncovered,
      opts.config.configFile,
      Object.keys(opts.config.sections),
    );
  }

  const { sections } = applyAutoSections(routes, opts.config);

  const files = await renderTrees(routerConfig.target, crawl, sections, opts.config.commonRoutes);
  const changed = await changedFiles(outputDirectory, files);
  const stale = (await existingGeneratedFiles(outputDirectory))
    .filter((name) => !files.has(name))
    .sort();

  if (opts.mode === "write") {
    await writeTrees(outputDirectory, files, changed, stale);
  }

  return {
    sections: Object.keys(sections),
    changed,
    stale,
    uncovered,
    droppedRouteFiles: crawl.droppedRouteFiles,
  };
}

export async function isFullTreeStale(opts: {
  root: string;
  config: ResolvedScopedTreesConfig;
}): Promise<boolean> {
  const root = path.resolve(opts.root);
  const config = appRouterConfig(root, opts.config);
  const { generatedTree } = await crawlRoutes(config, root);

  return (await readIfExists(path.resolve(root, config.generatedRouteTree))) !== generatedTree;
}
