import { chmod, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { index, layout, rootRoute, route } from "@tanstack/virtual-file-routes";
import { afterEach, describe, expect, it } from "vitest";
import type { ResolvedScopedTreesConfig } from "../src/config.js";
import { generateFullTree, generateScopedTrees, UncoveredRoutesError } from "../src/generate.js";
import { resolveRouterConfig } from "../src/router-config.js";
import { scanRoutes } from "../src/scan.js";
import { createSectionRouteConfig } from "../src/section-route-config.js";
import { selectSection } from "../src/sections.js";
import { copyFixture, fixturePath } from "./helpers/fixture.js";

const OUTPUT_DIRECTORY = "src/test/route-trees";
const copies: string[] = [];

afterEach(async () => {
  await Promise.all(copies.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function copy(name: string) {
  const dir = await copyFixture(name);

  copies.push(dir);

  return dir;
}

function configFor(
  root: string,
  sections: Record<string, string[]>,
  overrides: Partial<ResolvedScopedTreesConfig> = {},
): ResolvedScopedTreesConfig {
  return {
    sections,
    commonRoutes: [],
    outputDirectory: OUTPUT_DIRECTORY,
    autoSectionUncovered: false,
    root,
    configFile: path.join(root, "scoped-route-trees.config.ts"),
    ...overrides,
  };
}

const basicSections = { billing: ["/billing"], settings: ["/settings"], about: ["/about"] };

function outputFile(root: string, name: string) {
  return path.join(root, OUTPUT_DIRECTORY, name);
}

async function listOutput(root: string) {
  return (await readdir(path.join(root, OUTPUT_DIRECTORY))).sort();
}

async function snapshot(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const lines = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fullPath = path.join(entry.parentPath, entry.name);
        const stats = await stat(fullPath);
        const content = await readFile(fullPath, "utf8");

        return `${path.relative(dir, fullPath)} ${stats.mtimeMs} ${content}`;
      }),
  );

  return lines.sort();
}

const refundsRoute = [
  `import { createFileRoute } from "@tanstack/react-router";`,
  ``,
  `export const Route = createFileRoute("/billing/refunds")({});`,
  ``,
].join("\n");

describe("createSectionRouteConfig", () => {
  it("nests the selected routes by TanStack's parent, with ids relative to the parent", async () => {
    const root = fixturePath("basic");
    const { routes } = await scanRoutes(resolveRouterConfig(root), root);
    const selected = selectSection(routes, ["/billing"], []);

    expect(createSectionRouteConfig(routes, selected, "__root.tsx")).toEqual(
      rootRoute("__root.tsx", [
        route("/billing", "billing/route.tsx", [
          route("/invoices", "billing/invoices.tsx"),
          index("billing/index.tsx"),
        ]),
      ]),
    );
  });

  it("maps pathless layouts to layout() and directories without route files to full ids", async () => {
    const root = fixturePath("layouts");
    const { routes } = await scanRoutes(resolveRouterConfig(root), root);
    const selected = selectSection(routes, ["/dashboard", "/reports"], []);

    expect(createSectionRouteConfig(routes, selected, "__root.tsx")).toEqual(
      rootRoute("__root.tsx", [
        layout("_auth", "_auth.tsx", [route("/dashboard", "_auth/dashboard.tsx")]),
        route("/reports/summary", "reports/summary.tsx"),
      ]),
    );
  });
});

describe("generateScopedTrees", () => {
  it("writes one tree per section", async () => {
    const root = await copy("basic");

    const result = await generateScopedTrees({
      root,
      config: configFor(root, basicSections),
      mode: "write",
    });

    expect(result.sections).toEqual(["billing", "settings", "about"]);
    expect(await listOutput(root)).toEqual([
      "about.gen.d.ts",
      "about.gen.js",
      "billing.gen.d.ts",
      "billing.gen.js",
      "settings.gen.d.ts",
      "settings.gen.js",
    ]);

    const billing = await readFile(outputFile(root, "billing.gen.js"), "utf8");

    expect(billing).toContain("from './../../routes/billing/invoices'");
    expect(billing).not.toMatch(/routes\/settings'/);
    expect(billing).toContain("export const routeTree");
    expect(await readFile(outputFile(root, "billing.gen.d.ts"), "utf8")).toBe(
      `import type { AnyRoute } from "@tanstack/react-router";\nexport declare const routeTree: AnyRoute;\n`,
    );
  });

  it("types the trees with @tanstack/solid-router when the app depends on it", async () => {
    const root = await copy("basic");

    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "@tanstack/solid-router": "^1.0.0" } }),
    );
    await generateScopedTrees({ root, config: configFor(root, basicSections), mode: "write" });

    expect(await readFile(outputFile(root, "billing.gen.d.ts"), "utf8")).toContain(
      `from "@tanstack/solid-router"`,
    );
  });

  it("check mode reports nothing after a write", async () => {
    const root = await copy("basic");
    const config = configFor(root, basicSections);

    await generateScopedTrees({ root, config, mode: "write" });

    expect(await generateScopedTrees({ root, config, mode: "check" })).toMatchObject({
      changed: [],
      stale: [],
    });
  });

  it("check mode reports a changed tree after a route is added", async () => {
    const root = await copy("basic");
    const config = configFor(root, basicSections);

    await generateScopedTrees({ root, config, mode: "write" });

    const before = await readFile(outputFile(root, "billing.gen.js"), "utf8");

    await writeFile(path.join(root, "src/routes/billing/refunds.tsx"), refundsRoute);

    const result = await generateScopedTrees({ root, config, mode: "check" });

    expect(result.changed).toEqual(["billing.gen.js"]);
    expect(await readFile(outputFile(root, "billing.gen.js"), "utf8")).toBe(before);
  });

  it("check mode writes nothing when no trees exist yet", async () => {
    const root = await copy("basic");

    const result = await generateScopedTrees({
      root,
      config: configFor(root, basicSections),
      mode: "check",
    });

    expect(result.changed).toContain("billing.gen.js");
    await expect(stat(path.join(root, OUTPUT_DIRECTORY))).rejects.toThrow();
  });

  it("prunes the tree of a removed section", async () => {
    const root = await copy("basic");

    await generateScopedTrees({ root, config: configFor(root, basicSections), mode: "write" });
    await rm(path.join(root, "src/routes/about.tsx"));

    const remaining = { billing: basicSections.billing, settings: basicSections.settings };
    const result = await generateScopedTrees({
      root,
      config: configFor(root, remaining),
      mode: "write",
    });

    expect(result.stale).toEqual(["about.gen.d.ts", "about.gen.js"]);
    expect(await listOutput(root)).toEqual([
      "billing.gen.d.ts",
      "billing.gen.js",
      "settings.gen.d.ts",
      "settings.gen.js",
    ]);
  });

  it("fails with the uncovered-routes message when a route has no section", async () => {
    const root = await copy("basic");
    const config = configFor(root, { billing: ["/billing"], settings: ["/settings"] });

    const error = await generateScopedTrees({ root, config, mode: "write" }).catch((e) => e);

    expect(error).toBeInstanceOf(UncoveredRoutesError);
    expect(error.message).toContain("Some routes are not in any section");
    expect(error.message).toContain("/about  (about.tsx)");
    expect(error.message).toContain(config.configFile);
  });

  it("puts uncovered routes in their own section when autoSectionUncovered is on", async () => {
    const root = await copy("basic");
    const config = configFor(
      root,
      { billing: ["/billing"], settings: ["/settings"] },
      { autoSectionUncovered: true },
    );

    const result = await generateScopedTrees({ root, config, mode: "write" });

    expect(result.uncovered.map((r) => r.filePath)).toEqual(["about.tsx"]);
    expect(result.sections).toEqual(["billing", "settings", "about"]);
    expect(await listOutput(root)).toContain("about.gen.js");
  });

  it("keeps previous trees when generation throws", async () => {
    const root = await copy("basic");
    const config = configFor(root, basicSections);
    const invoices = path.join(root, "src/routes/billing/invoices.tsx");

    await generateScopedTrees({ root, config, mode: "write" });

    const before = await snapshot(path.join(root, OUTPUT_DIRECTORY));

    await writeFile(path.join(root, "src/routes/billing/refunds.tsx"), refundsRoute);
    await chmod(invoices, 0o000);

    try {
      await expect(generateScopedTrees({ root, config, mode: "write" })).rejects.toThrow();
    } finally {
      await chmod(invoices, 0o644);
    }

    expect(await snapshot(path.join(root, OUTPUT_DIRECTORY))).toEqual(before);
  });

  it("does not modify the routes directory", async () => {
    const root = await copy("basic");
    const routesDirectory = path.join(root, "src/routes");
    const config = configFor(root, basicSections);
    const settings = path.join(routesDirectory, "settings.tsx");

    await writeFile(settings, (await readFile(settings, "utf8")).replace("/settings", "/wrong"));

    const before = await snapshot(routesDirectory);

    await generateScopedTrees({ root, config, mode: "write" });
    await generateScopedTrees({ root, config, mode: "check" });

    expect(await snapshot(routesDirectory)).toEqual(before);
  });

  it("refuses an output directory inside the routes directory", async () => {
    const root = await copy("basic");
    const config = configFor(root, basicSections, { outputDirectory: "src/routes/trees" });

    await expect(generateScopedTrees({ root, config, mode: "write" })).rejects.toThrow(
      /inside the routes directory/,
    );
  });
});

describe("generateFullTree", () => {
  it("writes the app's full route tree without touching the routes directory", async () => {
    const root = await copy("basic");
    const routesDirectory = path.join(root, "src/routes");
    const settings = path.join(routesDirectory, "settings.tsx");

    await writeFile(settings, (await readFile(settings, "utf8")).replace("/settings", "/wrong"));

    const before = await snapshot(routesDirectory);

    await generateFullTree({ root, config: configFor(root, basicSections) });

    const tree = await readFile(path.join(root, "src/routeTree.gen.ts"), "utf8");

    expect(tree).toContain("routes/settings.profile");
    expect(tree).toContain("routes/billing/invoices");
    expect(await readdir(path.join(root, "src"))).toEqual(["routeTree.gen.ts", "routes"]);
    await expect(stat(path.join(root, ".tanstack"))).rejects.toThrow();
    await expect(stat(path.join(process.cwd(), ".tanstack"))).rejects.toThrow();
    expect(await snapshot(routesDirectory)).toEqual(before);
  });
});
