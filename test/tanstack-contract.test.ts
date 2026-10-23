import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { format, Generator } from "@tanstack/router-generator";
import { describe, expect, it } from "vitest";
import { inMemoryOutputFs } from "../src/generator-fs.js";
import { resolveRouterConfig } from "../src/router-config.js";
import { fixturePath } from "./helpers/fixture.js";

function isRouteNode(value: unknown): boolean {
  return typeof value === "object" && value !== null && "_fsRouteType" in value;
}

async function crawlNamingRules() {
  const root = fixturePath("naming-rules");
  const config = resolveRouterConfig(root);
  const { fs, output } = inMemoryOutputFs(config.routesDirectory, config.generatedRouteTree);
  const tmpDir = await mkdtemp(path.join(tmpdir(), "scoped-trees-contract-"));
  const generator = new Generator({ config: { ...config, tmpDir }, root, fs });

  try {
    await generator.run();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  return { generator, crawl: await generator.getCrawlingResult(), output: output() };
}

describe("TanStack generator contract", () => {
  it("exposes the crawl result with the accumulator shape scoped trees filter", async () => {
    const { crawl } = await crawlNamingRules();

    expect(crawl).toBeDefined();
    expect(crawl?.rootRouteNode._fsRouteType).toBe("__root");
    expect(Array.isArray(crawl?.routeFileResult)).toBe(true);
    expect(Array.isArray(crawl?.acc.routeNodes)).toBe(true);
    expect(Array.isArray(crawl?.acc.routeTree)).toBe(true);
    expect(crawl?.acc.routeNodesByPath).toBeInstanceOf(Map);
    expect(crawl?.acc.routePiecesByPath["/reports"]?.lazy?.filePath).toBe("reports.lazy.tsx");
    expect(crawl?.acc.routeNodesByPath.get("/posts/")?.parent?.filePath).toBe("posts.tsx");
    expect(Object.keys(crawl?.acc ?? {}).sort()).toEqual([
      "routeNodes",
      "routeNodesByPath",
      "routePiecesByPath",
      "routeTree",
    ]);
  });

  it("links route nodes to other route nodes only through parent and children", async () => {
    const { crawl } = await crawlNamingRules();
    const linkedKeys = new Set<string>();

    for (const node of crawl?.acc.routeNodes ?? []) {
      for (const [key, value] of Object.entries(node)) {
        const values: unknown[] = Array.isArray(value) ? value : [value];

        if (values.some(isRouteNode)) {
          linkedKeys.add(key);
        }
      }
    }

    expect([...linkedKeys].sort()).toEqual(["children", "parent"]);
  });

  it("builds from an accumulator exactly what run() writes", async () => {
    const { generator, crawl, output } = await crawlNamingRules();

    if (crawl === undefined) {
      throw new Error("Generator.getCrawlingResult() returned nothing after run().");
    }

    const { routeTreeContent, routeNodes } = generator.buildRouteTree(crawl);

    expect(routeNodes).toBe(crawl.acc.routeNodes);
    expect(await format(routeTreeContent, generator.config)).toBe(output);
  });
});
