import path from "node:path";
import {
  CONFIG_FILE_NAME,
  ConfigError,
  loadConfig,
  type ResolvedScopedTreesConfig,
} from "./config.js";
import { appRouterConfig } from "./generate.js";
import { crawlRoutes, type ScannedRoute } from "./scan.js";
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
  field: "missing" | "extra" | "uncovered" | ComparedField;
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

export async function findParityDifferences(
  config: ResolvedScopedTreesConfig,
): Promise<ParityDifference[]> {
  const root = path.resolve(config.root);
  const routerConfig = appRouterConfig(root, config);
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
  }

  return differences;
}

export async function checkScopedRouteTrees(
  opts: { root?: string } = {},
): Promise<ParityDifference[]> {
  const root = path.resolve(opts.root ?? process.cwd());
  const config = await loadConfig(root);

  if (config === undefined) {
    throw new ConfigError(
      `No ${CONFIG_FILE_NAME} found in ${root}. Run "tanstack-router-scoped-trees init" to create one, or start the dev server with the scopedRouteTrees() Vite plugin, which creates it.`,
    );
  }

  return findParityDifferences(config);
}

function describeValue(value: string | null | undefined): string {
  return value === null || value === undefined ? "none" : JSON.stringify(value);
}

function formatDifference(difference: ParityDifference): string {
  const { section, filePath, field } = difference;

  switch (field) {
    case "uncovered":
      return `${filePath} (${difference.actual}) is in no section`;
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
