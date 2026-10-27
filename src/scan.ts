import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  Generator,
  inferFullPath,
  type Config,
  type HandleNodeAccumulator,
  type RouteNode,
} from "@tanstack/router-generator";
import { inMemoryOutputFs } from "./generator-fs.js";

export type ScannedRoute = {
  filePath: string;
  routeId: string;
  fullPath: string;
  parentFilePath: string | null;
  fsRouteType: string;
  cleanedPath: string;
  companionFilePaths: string[];
};

export type CrawlingResult = {
  rootRouteNode: RouteNode;
  routeFileResult: RouteNode[];
  acc: HandleNodeAccumulator;
};

export type RouteCrawl = {
  generator: Generator;
  crawl: CrawlingResult;
  routes: ScannedRoute[];
  generatedTree: string;
  droppedRouteFiles: string[];
};

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function isRoot(node: RouteNode): boolean {
  return node._fsRouteType === "__root";
}

function nearestParentFile(node: RouteNode): string | null {
  let parent = node.parent;

  while (parent !== undefined && !isRoot(parent) && !parent.filePath) {
    parent = parent.parent;
  }

  if (parent === undefined || isRoot(parent)) {
    return null;
  }

  return toPosix(parent.filePath);
}

function companions(node: RouteNode, acc: HandleNodeAccumulator): string[] {
  const pieces = node.routePath === undefined ? undefined : acc.routePiecesByPath[node.routePath];

  return Object.values(pieces ?? {})
    .filter((piece): piece is RouteNode => piece !== undefined && piece !== node)
    .map((piece) => toPosix(piece.filePath))
    .sort();
}

function toScannedRoute(node: RouteNode, acc: HandleNodeAccumulator): ScannedRoute {
  return {
    filePath: toPosix(node.filePath),
    routeId: node.routePath ?? "",
    fullPath: inferFullPath(node),
    parentFilePath: nearestParentFile(node),
    fsRouteType: node._fsRouteType,
    cleanedPath: node.cleanedPath ?? "",
    companionFilePaths: companions(node, acc),
  };
}

export function scannedRoutesFrom(acc: HandleNodeAccumulator): ScannedRoute[] {
  return acc.routeNodes.filter((node) => !isRoot(node)).map((node) => toScannedRoute(node, acc));
}

export async function crawlRoutes(config: Config, root: string): Promise<RouteCrawl> {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "scoped-trees-generator-"));
  const droppedRouteFiles: string[] = [];
  const { fs, output } = inMemoryOutputFs(
    config.routesDirectory,
    config.generatedRouteTree,
    (file) => droppedRouteFiles.push(file),
  );
  const generator = new Generator({ config: { ...config, tmpDir }, root, fs });

  try {
    await generator.run();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  const crawl = await generator.getCrawlingResult();
  const generatedTree = output();

  if (crawl === undefined || generatedTree === undefined) {
    throw new Error("TanStack's generator finished without producing a route tree.");
  }

  return {
    generator,
    crawl,
    routes: scannedRoutesFrom(crawl.acc),
    generatedTree,
    droppedRouteFiles,
  };
}

export async function scanRoutes(
  config: Config,
  root: string,
): Promise<{ routes: ScannedRoute[]; generatedTree: string }> {
  const { routes, generatedTree } = await crawlRoutes(config, root);

  return { routes, generatedTree };
}
