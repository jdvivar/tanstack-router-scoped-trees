import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError } from "../src/config.js";
import { resolveRouterConfig, UnsupportedVirtualRoutesError } from "../src/router-config.js";
import { scanRoutes } from "../src/scan.js";
import { copyFixture, fixturePath } from "./helpers/fixture.js";

const copies: string[] = [];

afterEach(async () => {
  await Promise.all(copies.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function copy(name: string) {
  const dir = await copyFixture(name);

  copies.push(dir);

  return dir;
}

async function snapshot(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const lines = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(entry.parentPath, entry.name);
      const stats = await stat(fullPath);

      return `${path.relative(dir, fullPath)} ${stats.mtimeMs}`;
    }),
  );

  return lines.sort();
}

async function scanFixture(root: string) {
  return scanRoutes(resolveRouterConfig(root), root);
}

describe("scanRoutes", () => {
  it("returns every route with TanStack's id, URL and parent", async () => {
    const { routes } = await scanFixture(fixturePath("basic"));

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "billing/invoices.tsx",
          routeId: "/billing/invoices",
          fullPath: "/billing/invoices",
          parentFilePath: "billing/route.tsx",
        }),
        expect.objectContaining({
          filePath: "settings.profile.tsx",
          routeId: "/settings/profile",
          fullPath: "/settings/profile",
          parentFilePath: "settings.tsx",
        }),
        expect.objectContaining({
          filePath: "billing/route.tsx",
          routeId: "/billing",
          fullPath: "/billing",
          parentFilePath: null,
          fsRouteType: "layout",
        }),
        expect.objectContaining({
          filePath: "billing/index.tsx",
          routeId: "/billing/",
          fullPath: "/billing/",
          parentFilePath: "billing/route.tsx",
        }),
        expect.objectContaining({ filePath: "index.tsx", fullPath: "/", parentFilePath: null }),
      ]),
    );
    expect(routes.map((route) => route.filePath).sort()).toEqual([
      "about.tsx",
      "billing/index.tsx",
      "billing/invoices.tsx",
      "billing/route.tsx",
      "index.tsx",
      "settings.profile.tsx",
      "settings.tsx",
    ]);
  });

  it("keeps pathless layouts in the route id but not in the URL", async () => {
    const { routes } = await scanFixture(fixturePath("layouts"));

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "_auth/dashboard.tsx",
          routeId: "/_auth/dashboard",
          fullPath: "/dashboard",
          parentFilePath: "_auth.tsx",
        }),
        expect.objectContaining({
          filePath: "_auth.tsx",
          routeId: "/_auth",
          parentFilePath: null,
          fsRouteType: "pathless_layout",
        }),
        expect.objectContaining({
          filePath: "reports/summary.tsx",
          fullPath: "/reports/summary",
          parentFilePath: null,
        }),
      ]),
    );
  });

  it("attaches lazy and other companion files to the route they belong to", async () => {
    const { routes } = await scanFixture(fixturePath("naming-rules"));
    const companionsOf = (filePath: string) =>
      routes.find((route) => route.filePath === filePath)?.companionFilePaths;

    expect(companionsOf("reports.tsx")).toEqual(["reports.lazy.tsx"]);
    expect(companionsOf("stats.tsx")).toEqual(["stats.component.tsx"]);
    expect(companionsOf("posts.tsx")).toEqual([]);
    expect(routes.some((route) => route.filePath === "reports.lazy.tsx")).toBe(false);
  });

  it("returns the generated full tree", async () => {
    const { generatedTree } = await scanFixture(fixturePath("basic"));

    expect(generatedTree).toContain("BillingInvoicesRoute");
  });

  it("writes nothing to disk", async () => {
    const root = fixturePath("basic");
    const before = await snapshot(root);

    await scanFixture(root);

    expect(await snapshot(root)).toEqual(before);
  });

  it("returns the tree even when the generated tree file already exists", async () => {
    const root = await copy("basic");
    const first = await scanFixture(root);

    await writeFile(path.join(root, "src/routeTree.gen.ts"), first.generatedTree);

    const second = await scanFixture(root);

    expect(second.generatedTree).toEqual(first.generatedTree);
  });

  it("rejects apps whose routing uses virtualRouteConfig", () => {
    expect(() => resolveRouterConfig(fixturePath("virtual-config"))).toThrow(
      UnsupportedVirtualRoutesError,
    );
    expect(() => resolveRouterConfig(fixturePath("virtual-config"))).toThrow(/virtualRouteConfig/);
  });

  it("names the missing routes directory and how to set it", async () => {
    const root = await copy("basic");

    await rm(path.join(root, "src/routes"), { recursive: true });

    const run = () => resolveRouterConfig(root);

    expect(run).toThrow(ConfigError);
    expect(run).toThrow(path.join(root, "src/routes"));
    expect(run).toThrow("tsr.config.json");
    expect(run).toThrow("scoped-route-trees.config.ts");
    expect(run).toThrow("scopedRouteTrees({ router })");
  });

  it("never writes into the routes directory even when a createFileRoute literal is wrong", async () => {
    const root = await copy("basic");
    const routeFile = path.join(root, "src/routes/about.tsx");
    const wrong =
      'import { createFileRoute } from "@tanstack/react-router";\n\nexport const Route = createFileRoute("/wrong")({});\n';

    await writeFile(routeFile, wrong);
    await scanFixture(root);

    expect(await readFile(routeFile, "utf8")).toBe(wrong);
  });

  it("leaves no staging files in the default tmp directory", async () => {
    const root = await copy("basic");

    await scanFixture(root);

    await expect(stat(path.join(root, ".tanstack"))).rejects.toThrow();
    await expect(stat(path.join(process.cwd(), ".tanstack"))).rejects.toThrow();
  });
});
