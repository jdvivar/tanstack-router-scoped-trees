import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { format, Generator } from "@tanstack/router-generator";
import { describe, expect, it } from "vitest";
import { inMemoryOutputFs } from "../src/generator-fs.js";
import { resolveRouterConfig } from "../src/router-config.js";
import { fixturePath } from "./helpers/fixture.js";

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
