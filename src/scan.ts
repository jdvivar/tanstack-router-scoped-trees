import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  Generator,
  inferFullPath,
  type Config,
  type GeneratorPlugin,
  type RouteNode,
} from "@tanstack/router-generator";
import { inMemoryOutputFs } from "./generator-fs.js";

export type ScannedRoute = {
  filePath: string;
  routeId: string;
  fullPath: string;
  parentFilePath: string | null;
  fsRouteType: string;
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

function toScannedRoute(node: RouteNode): ScannedRoute {
  return {
    filePath: toPosix(node.filePath),
    routeId: node.routePath ?? "",
    fullPath: inferFullPath(node),
    parentFilePath: nearestParentFile(node),
    fsRouteType: node._fsRouteType,
  };
}

export async function scanRoutes(
  config: Config,
  root: string,
): Promise<{ routes: ScannedRoute[]; generatedTree: string }> {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "scoped-trees-generator-"));
  const { fs, output } = inMemoryOutputFs(config.routesDirectory, config.generatedRouteTree);
  let routes: ScannedRoute[] | undefined;

  const collector: GeneratorPlugin = {
    name: "tanstack-router-scoped-trees:collector",
    onRouteTreeChanged: ({ routeNodes }) => {
      routes = routeNodes.filter((node) => !isRoot(node)).map(toScannedRoute);
    },
  };

  try {
    await new Generator({
      config: { ...config, tmpDir, plugins: [collector] },
      root,
      fs,
    }).run();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  const generatedTree = output();

  if (routes === undefined || generatedTree === undefined) {
    throw new Error("TanStack's generator finished without producing a route tree.");
  }

  return { routes, generatedTree };
}
