import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { rootPathId, type Config } from "@tanstack/router-generator";
import {
  CONFIG_FILE_NAME,
  ConfigError,
  loadConfig,
  type ResolvedScopedTreesConfig,
} from "./config.js";
import { appRouterConfig } from "./generate.js";
import { crawlRoutes, type RouteCrawl, type ScannedRoute } from "./scan.js";
import { buildSectionTree } from "./section-tree.js";
import {
  applyAutoSections,
  assertPrefixesMatch,
  findUncovered,
  selectSection,
} from "./sections.js";

type ComparedField = "routeId" | "fullPath" | "path" | "parent" | "fsRouteType" | "companions";

export type ParityDifference = {
  section: string;
  filePath: string;
  field: "missing" | "extra" | "uncovered" | "tree" | ComparedField;
  expected?: string | null;
  actual?: string | null;
};

const COMPARED_FIELDS: Array<[ComparedField, (route: ScannedRoute) => string | null]> = [
  ["routeId", (route) => route.routeId],
  ["fullPath", (route) => route.fullPath],
  ["path", (route) => route.cleanedPath],
  ["parent", (route) => route.parentFilePath],
  ["fsRouteType", (route) => route.fsRouteType],
  ["companions", (route) => route.companionFilePaths.join(", ") || null],
];

function compareSection(
  section: string,
  expected: ScannedRoute[],
  actual: ScannedRoute[],
): ParityDifference[] {
  const actualByFile = new Map(actual.map((route) => [route.filePath, route]));
  const expectedFiles = new Set(expected.map((route) => route.filePath));
  const differences: ParityDifference[] = [];

  for (const route of expected) {
    const scoped = actualByFile.get(route.filePath);

    if (scoped === undefined) {
      differences.push({ section, filePath: route.filePath, field: "missing" });
      continue;
    }

    for (const [field, read] of COMPARED_FIELDS) {
      if (read(route) !== read(scoped)) {
        differences.push({
          section,
          filePath: route.filePath,
          field,
          expected: read(route),
          actual: read(scoped),
        });
      }
    }
  }

  for (const route of actual) {
    if (!expectedFiles.has(route.filePath)) {
      differences.push({ section, filePath: route.filePath, field: "extra" });
    }
  }

  return differences;
}

function uncoveredDifferences(
  routes: ScannedRoute[],
  config: ResolvedScopedTreesConfig,
): ParityDifference[] {
  if (config.autoSectionUncovered) {
    return [];
  }

  return findUncovered(routes, config)
    .map((route) => ({
      section: "",
      filePath: route.filePath,
      field: "uncovered" as const,
      actual: route.fullPath,
    }))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));
}

function commonAncestor(directory: string, other: string): string {
  let base = directory;

  while (path.relative(base, other).startsWith("..")) {
    base = path.dirname(base);
  }

  return base;
}

function sectionFiles(crawl: RouteCrawl, expected: ScannedRoute[]): string[] {
  const rootPieces = Object.values(crawl.crawl.acc.routePiecesByPath[`/${rootPathId}`] ?? {});
  const files = [
    crawl.crawl.rootRouteNode.filePath,
    ...rootPieces.flatMap((piece) => (piece === undefined ? [] : [piece.filePath])),
    ...expected.flatMap((route) => [route.filePath, ...route.companionFilePaths]),
  ];

  return [...new Set(files.filter((file) => file !== ""))];
}

async function rederiveSectionTree(
  routerConfig: Config,
  crawl: RouteCrawl,
  expected: ScannedRoute[],
): Promise<string> {
  const { routesDirectory, generatedRouteTree } = routerConfig;
  const base = commonAncestor(routesDirectory, path.dirname(generatedRouteTree));
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "scoped-trees-parity-"));
  const mirror = (filePath: string) => path.join(tmpRoot, path.relative(base, filePath));

  try {
    for (const file of sectionFiles(crawl, expected)) {
      const target = path.join(mirror(routesDirectory), file);

      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(routesDirectory, file), target);
    }

    const reduced = await crawlRoutes(
      {
        ...routerConfig,
        routesDirectory: mirror(routesDirectory),
        generatedRouteTree: mirror(generatedRouteTree),
      },
      tmpRoot,
    );

    return reduced.generatedTree;
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

export async function findParityDifferences(
  config: ResolvedScopedTreesConfig,
  router?: Partial<Config>,
): Promise<ParityDifference[]> {
  const root = path.resolve(config.root);
  const routerConfig = {
    ...appRouterConfig(root, config, router),
    importRoutesUsingAbsolutePaths: false,
  };
  const crawl = await crawlRoutes(routerConfig, root);
  const { routes } = crawl;
  const { sections } = applyAutoSections(routes, config);
  const differences = uncoveredDifferences(routes, config);

  assertPrefixesMatch(routes, { sections });

  for (const [section, prefixes] of Object.entries(sections)) {
    const selected = selectSection(routes, prefixes, config.commonRoutes);
    const scoped = await buildSectionTree(crawl, selected);
    const expected = routes.filter((route) => selected.has(route.filePath));

    differences.push(...compareSection(section, expected, scoped.routes));

    if ((await rederiveSectionTree(routerConfig, crawl, expected)) !== scoped.content) {
      differences.push({ section, filePath: "", field: "tree" });
    }
  }

  return differences;
}

export async function checkScopedRouteTrees(
  opts: { root?: string; router?: Partial<Config> } = {},
): Promise<ParityDifference[]> {
  const root = path.resolve(opts.root ?? process.cwd());
  const config = await loadConfig(root);

  if (config === undefined) {
    throw new ConfigError(
      `No ${CONFIG_FILE_NAME} found in ${root}. Run "tanstack-router-scoped-trees init" to create one, or start the dev server with the scopedRouteTrees() Vite plugin, which creates it.`,
    );
  }

  return findParityDifferences(config, opts.router);
}

function describeValue(value: string | null | undefined): string {
  return value === null || value === undefined ? "none" : JSON.stringify(value);
}

function formatDifference(difference: ParityDifference): string {
  const { section, filePath, field } = difference;

  switch (field) {
    case "uncovered":
      return `${filePath} (${difference.actual}) is in no section`;
    case "tree":
      return `${section}: the scoped tree differs from the tree TanStack generates from the section's own files`;
    case "missing":
      return `${section}: ${filePath} is in the section but missing from the scoped tree`;
    case "extra":
      return `${section}: ${filePath} is in the scoped tree but not in the section`;
    default:
      return `${section}: ${filePath} ${field}: expected ${describeValue(difference.expected)}, got ${describeValue(difference.actual)}`;
  }
}

export function formatParityDifferences(differences: ParityDifference[]): string {
  return differences.map(formatDifference).join("\n");
}
