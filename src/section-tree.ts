import { format, type HandleNodeAccumulator, type RouteNode } from "@tanstack/router-generator";
import { scannedRoutesFrom, type RouteCrawl, type ScannedRoute } from "./scan.js";

export type SectionTree = {
  content: string;
  routes: ScannedRoute[];
};

function copySelectedNodes(
  acc: HandleNodeAccumulator,
  selected: Set<string>,
): Map<RouteNode, RouteNode> {
  const copies = new Map<RouteNode, RouteNode>();

  for (const node of acc.routeNodes) {
    if (selected.has(node.filePath)) {
      copies.set(node, { ...node });
    }
  }

  for (const copy of copies.values()) {
    const children = (copy.children ?? []).flatMap((child) => copies.get(child) ?? []);

    copy.parent = copy.parent === undefined ? undefined : copies.get(copy.parent);
    copy.children = children.length === 0 ? undefined : children;
  }

  return copies;
}

function keep(nodes: RouteNode[], copies: Map<RouteNode, RouteNode>): RouteNode[] {
  return nodes.flatMap((node) => copies.get(node) ?? []);
}

export function sectionAccumulator(
  acc: HandleNodeAccumulator,
  selected: Set<string>,
): HandleNodeAccumulator {
  const copies = copySelectedNodes(acc, selected);
  const keptPaths = new Set([...copies.values()].map((node) => node.routePath));

  return {
    routeNodes: keep(acc.routeNodes, copies),
    routeTree: keep(acc.routeTree, copies),
    routePiecesByPath: Object.fromEntries(
      Object.entries(acc.routePiecesByPath).filter(([routePath]) => keptPaths.has(routePath)),
    ),
    routeNodesByPath: new Map(
      [...acc.routeNodesByPath].flatMap(([routePath, node]) => {
        const copy = copies.get(node);

        return copy === undefined ? [] : [[routePath, copy] as const];
      }),
    ),
  };
}

export async function buildSectionTree(
  { generator, crawl }: Pick<RouteCrawl, "generator" | "crawl">,
  selected: Set<string>,
): Promise<SectionTree> {
  const acc = sectionAccumulator(crawl.acc, selected);
  const keptPaths = new Set(acc.routeNodes.map((node) => node.routePath));
  const { routeTreeContent } = generator.buildRouteTree({
    rootRouteNode: crawl.rootRouteNode,
    acc,
    routeFileResult: crawl.routeFileResult.filter((node) => keptPaths.has(node.routePath)),
  });
  const content = generator.config.enableRouteTreeFormatting
    ? await format(routeTreeContent, generator.config)
    : routeTreeContent;

  return { content, routes: scannedRoutesFrom(acc) };
}
