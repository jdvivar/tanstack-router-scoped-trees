import { ConfigError, type ScopedTreesConfig } from "./config.js";
import type { ScannedRoute } from "./scan.js";

const PATHLESS_LAYOUT = "pathless_layout";

function isPathless(route: ScannedRoute): boolean {
  return route.fsRouteType === PATHLESS_LAYOUT;
}

function normalizePath(urlPath: string): string {
  return urlPath.replace(/\/+$/, "");
}

function firstSegment(fullPath: string): string | undefined {
  return normalizePath(fullPath).split("/")[1];
}

function matchesPrefix(route: ScannedRoute, prefix: string): boolean {
  const fullPath = normalizePath(route.fullPath);
  const normalizedPrefix = normalizePath(prefix);

  return fullPath === normalizedPrefix || fullPath.startsWith(`${normalizedPrefix}/`);
}

function isCommon(route: ScannedRoute, commonRoutes: string[]): boolean {
  const fullPath = normalizePath(route.fullPath);

  return commonRoutes.some((common) => normalizePath(common) === fullPath);
}

function toSectionName(segment: string): string {
  const name = segment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return name === "" ? "section" : name;
}

function uniqueName(base: string, taken: Set<string>): string {
  let name = base;
  let counter = 2;

  while (taken.has(name)) {
    name = `${base}-${counter}`;
    counter += 1;
  }

  return name;
}

function urlRoutes(routes: ScannedRoute[]): ScannedRoute[] {
  return routes.filter((route) => !isPathless(route));
}

export function detectSections(routes: ScannedRoute[]): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  const taken = new Set<string>();
  const seenSegments = new Set<string>();

  for (const route of urlRoutes(routes)) {
    const segment = firstSegment(route.fullPath);

    if (segment === undefined || segment === "" || seenSegments.has(segment)) {
      continue;
    }

    const name = uniqueName(toSectionName(segment), taken);

    seenSegments.add(segment);
    taken.add(name);
    sections[name] = [`/${segment}`];
  }

  return sections;
}

export function selectSection(
  routes: ScannedRoute[],
  prefixes: string[],
  commonRoutes: string[],
): Set<string> {
  const byFilePath = new Map(routes.map((route) => [route.filePath, route]));
  const selectedIds = new Set<string>();
  const selected = new Set<string>();

  for (const route of urlRoutes(routes)) {
    if (prefixes.some((prefix) => matchesPrefix(route, prefix)) || isCommon(route, commonRoutes)) {
      selected.add(route.filePath);
    }
  }

  for (const filePath of [...selected]) {
    let parent = byFilePath.get(filePath)?.parentFilePath ?? null;

    while (parent !== null && !selected.has(parent)) {
      selected.add(parent);
      parent = byFilePath.get(parent)?.parentFilePath ?? null;
    }
  }

  for (const route of routes) {
    if (selected.has(route.filePath)) {
      selectedIds.add(route.routeId);
    }
  }

  for (const route of routes) {
    if (selectedIds.has(route.routeId)) {
      selected.add(route.filePath);
    }
  }

  return selected;
}

function isRootIndex(route: ScannedRoute): boolean {
  return normalizePath(route.fullPath) === "";
}

export function findUncovered(routes: ScannedRoute[], config: ScopedTreesConfig): ScannedRoute[] {
  const prefixes = Object.values(config.sections).flat();
  const commonRoutes = config.commonRoutes ?? [];

  return urlRoutes(routes).filter(
    (route) =>
      !isRootIndex(route) &&
      !isCommon(route, commonRoutes) &&
      !prefixes.some((prefix) => matchesPrefix(route, prefix)),
  );
}

export function formatUncoveredError(uncovered: ScannedRoute[], configFile: string): string {
  const routeLines = uncovered.map((route) => `  ${route.fullPath}  (${route.filePath})`);
  const snippet = Object.entries(detectSections(uncovered)).map(
    ([name, prefixes]) => `    ${name}: ${JSON.stringify(prefixes)},`,
  );

  return [
    "Some routes are not in any section (file paths are relative to your routes directory):",
    "",
    ...routeLines,
    "",
    "Add them to a section under `sections` in your config, for example:",
    "",
    ...snippet,
    "",
    `Config file: ${configFile}`,
  ].join("\n");
}

export function assertPrefixesMatch(routes: ScannedRoute[], config: ScopedTreesConfig): void {
  const candidates = urlRoutes(routes);

  for (const [name, prefixes] of Object.entries(config.sections)) {
    for (const prefix of prefixes) {
      if (!candidates.some((route) => matchesPrefix(route, prefix))) {
        throw new ConfigError(
          `Section "${name}" has the prefix "${prefix}", which matches no route. Check it for typos.`,
        );
      }
    }
  }
}

export function applyAutoSections(
  routes: ScannedRoute[],
  config: ScopedTreesConfig,
): ScopedTreesConfig {
  if (config.autoSectionUncovered !== true) {
    return config;
  }

  const sections = { ...config.sections };
  const taken = new Set(Object.keys(sections));

  for (const [name, prefixes] of Object.entries(detectSections(findUncovered(routes, config)))) {
    const unique = uniqueName(name, taken);

    taken.add(unique);
    sections[unique] = prefixes;
  }

  return { ...config, sections };
}
