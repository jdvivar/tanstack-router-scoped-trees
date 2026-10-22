import {
  index,
  layout,
  rootRoute,
  route,
  type VirtualRootRoute,
  type VirtualRouteNode,
} from "@tanstack/virtual-file-routes";
import type { ScannedRoute } from "./scan.js";

const PATHLESS_LAYOUT = "pathless_layout";

function nearestSelectedParent(
  scanned: ScannedRoute,
  byFilePath: Map<string, ScannedRoute>,
  selected: Set<string>,
): ScannedRoute | undefined {
  let parentFilePath = scanned.parentFilePath;

  while (parentFilePath !== null && !selected.has(parentFilePath)) {
    parentFilePath = byFilePath.get(parentFilePath)?.parentFilePath ?? null;
  }

  return parentFilePath === null ? undefined : byFilePath.get(parentFilePath);
}

function relativeId(scanned: ScannedRoute, parent: ScannedRoute | undefined): string {
  const parentId = parent?.routeId ?? "";

  if (!scanned.routeId.startsWith(`${parentId}/`)) {
    throw new Error(
      `Route ${scanned.filePath} has id "${scanned.routeId}", which is not under its parent's id "${parentId}".`,
    );
  }

  return scanned.routeId.slice(parentId.length);
}

function toVirtualNode(
  scanned: ScannedRoute,
  parent: ScannedRoute | undefined,
  children: VirtualRouteNode[],
): VirtualRouteNode {
  const path = relativeId(scanned, parent);

  if (path === "/") {
    return index(scanned.filePath);
  }

  if (scanned.fsRouteType === PATHLESS_LAYOUT) {
    return layout(path.slice(1), scanned.filePath, children);
  }

  return children.length === 0
    ? route(path, scanned.filePath)
    : route(path, scanned.filePath, children);
}

export function createSectionRouteConfig(
  routes: ScannedRoute[],
  selected: Set<string>,
  rootFile: string,
): VirtualRootRoute {
  const byFilePath = new Map(routes.map((scanned) => [scanned.filePath, scanned]));
  const selectedRoutes = routes.filter((scanned) => selected.has(scanned.filePath));
  const childrenOf = new Map<string | null, ScannedRoute[]>();

  for (const scanned of selectedRoutes) {
    const parentFilePath = nearestSelectedParent(scanned, byFilePath, selected)?.filePath ?? null;

    childrenOf.set(parentFilePath, [...(childrenOf.get(parentFilePath) ?? []), scanned]);
  }

  const build = (parent: ScannedRoute | undefined): VirtualRouteNode[] =>
    (childrenOf.get(parent?.filePath ?? null) ?? []).map((child) =>
      toVirtualNode(child, parent, build(child)),
    );

  return rootRoute(rootFile, build(undefined));
}
