import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG_FILE_NAME } from "../src/config.js";
import { scopedRouteTrees } from "../src/vite.js";
import { copyFixture, fakeRouterPlugin } from "./helpers/fixture.js";

const OUTPUT_DIRECTORY = "src/test/route-trees";
const copies: string[] = [];

beforeEach(() => {
  vi.stubEnv("VITEST", undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();

  await Promise.all(copies.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function copy(name: string) {
  const dir = await copyFixture(name);

  copies.push(dir);

  return dir;
}

function stubContext() {
  return { info: vi.fn(), warn: vi.fn() };
}

type Hooks = {
  buildStart: (this: ReturnType<typeof stubContext>) => Promise<void>;
  watchChange: (this: ReturnType<typeof stubContext>, id: string) => Promise<void>;
};

function hooksOf(plugin: unknown): Hooks {
  return plugin as Hooks;
}

async function listOutput(root: string) {
  return (await readdir(path.join(root, OUTPUT_DIRECTORY))).sort();
}

describe("scopedRouteTrees", () => {
  it("is a serve-only plugin with a stable name", () => {
    const plugin = scopedRouteTrees();

    expect(plugin.name).toBe("tanstack-router-scoped-trees");
    expect(plugin.apply).toBe("serve");
  });

  it("writes an initial config on first start and generates trees", async () => {
    const root = await copy("basic");
    const context = stubContext();

    await hooksOf(scopedRouteTrees({ root })).buildStart.call(context);

    expect(existsSync(path.join(root, CONFIG_FILE_NAME))).toBe(true);
    expect(context.info).toHaveBeenCalledWith(expect.stringContaining(CONFIG_FILE_NAME));
    expect(context.warn).not.toHaveBeenCalled();
    expect(await listOutput(root)).toContain("billing.gen.js");
  });

  it("leaves an existing config untouched", async () => {
    const root = await copy("basic");
    const contents = `import { defineConfig } from "tanstack-router-scoped-trees";\nexport default defineConfig({ sections: { everything: ["/billing", "/settings", "/about"] } });\n`;
    const context = stubContext();

    await writeFile(path.join(root, CONFIG_FILE_NAME), contents);
    await hooksOf(scopedRouteTrees({ root })).buildStart.call(context);

    expect(context.info).not.toHaveBeenCalled();
    expect(context.warn).not.toHaveBeenCalled();
    expect(await listOutput(root)).toEqual(["everything.gen.d.ts", "everything.gen.js"]);
  });

  it("regenerates when the full tree changes and ignores its own output", async () => {
    const root = await copy("basic");
    const context = stubContext();
    const plugin = hooksOf(scopedRouteTrees({ root }));
    const fullTree = path.join(root, "src/routeTree.gen.ts");
    const scopedTree = path.join(root, OUTPUT_DIRECTORY, "billing.gen.js");

    await plugin.buildStart.call(context);
    await rm(path.join(root, OUTPUT_DIRECTORY), { recursive: true });

    await plugin.watchChange.call(context, scopedTree);
    expect(existsSync(path.join(root, OUTPUT_DIRECTORY))).toBe(false);

    await plugin.watchChange.call(context, fullTree);
    expect(await listOutput(root)).toContain("billing.gen.js");
  });

  it("warns about a route file TanStack wanted to rewrite", async () => {
    const root = await copy("basic");
    const context = stubContext();

    await writeFile(
      path.join(root, "src/routes/about.tsx"),
      `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/wrong")({});\n`,
    );
    await hooksOf(scopedRouteTrees({ root })).buildStart.call(context);

    expect(context.warn).toHaveBeenCalledWith(expect.stringContaining("about.tsx"));
    expect(context.warn).toHaveBeenCalledWith(
      expect.stringContaining("TanStack wanted to update this file"),
    );
    expect(context.warn).toHaveBeenCalledWith(
      expect.stringContaining("TanStack's router plugin applies the update"),
    );
    expect(context.warn).not.toHaveBeenCalledWith(expect.stringContaining("start the dev server"));
  });

  it("does nothing under Vitest", async () => {
    const root = await copy("basic");
    const context = stubContext();
    const plugin = hooksOf(scopedRouteTrees({ root }));

    vi.stubEnv("VITEST", "true");
    await plugin.buildStart.call(context);
    await plugin.watchChange.call(context, path.join(root, "src/routeTree.gen.ts"));

    expect(existsSync(path.join(root, CONFIG_FILE_NAME))).toBe(false);
    expect(existsSync(path.join(root, OUTPUT_DIRECTORY))).toBe(false);
  });

  it("regenerates when the scoped-route-trees config changes", async () => {
    const root = await copy("basic");
    const context = stubContext();
    const plugin = hooksOf(scopedRouteTrees({ root }));
    const configFile = path.join(root, CONFIG_FILE_NAME);

    await writeFile(
      configFile,
      `export default { sections: { everything: ["/billing", "/settings", "/about"] } };\n`,
    );
    await plugin.buildStart.call(context);
    await writeFile(
      configFile,
      `export default { sections: { billing: ["/billing"], rest: ["/settings", "/about"] } };\n`,
    );
    await plugin.watchChange.call(context, configFile);

    expect(context.warn).not.toHaveBeenCalled();
    expect(await listOutput(root)).toEqual([
      "billing.gen.d.ts",
      "billing.gen.js",
      "rest.gen.d.ts",
      "rest.gen.js",
    ]);
  });

  it("warns with the uncovered-routes message instead of throwing", async () => {
    const root = await copy("basic");
    const context = stubContext();
    const contents = `import { defineConfig } from "tanstack-router-scoped-trees";\nexport default defineConfig({ sections: { billing: ["/billing"] } });\n`;

    await writeFile(path.join(root, CONFIG_FILE_NAME), contents);
    await hooksOf(scopedRouteTrees({ root })).buildStart.call(context);

    expect(context.warn).toHaveBeenCalledTimes(1);
    expect(context.warn.mock.calls[0]?.[0]).toContain("/settings");
  });

  it("writes no config for an app with only the root index, and says why", async () => {
    const root = await copy("basic");
    const context = stubContext();

    for (const file of ["about.tsx", "settings.tsx", "settings.profile.tsx", "billing"]) {
      await rm(path.join(root, "src/routes", file), { recursive: true });
    }

    await hooksOf(scopedRouteTrees({ root })).buildStart.call(context);

    expect(existsSync(path.join(root, CONFIG_FILE_NAME))).toBe(false);
    expect(context.info).toHaveBeenCalledWith(
      expect.stringContaining('created once routes beyond "/" exist'),
    );
    expect(context.warn).not.toHaveBeenCalled();
  });

  it("warns when router-plugin uses another generator version", async () => {
    const root = await copy("basic");
    const context = stubContext();

    await fakeRouterPlugin(root, "1.0.0-test");
    await hooksOf(scopedRouteTrees({ root })).buildStart.call(context);

    expect(context.warn).toHaveBeenCalledWith(
      expect.stringContaining("npm i -D @tanstack/router-generator@1.0.0-test"),
    );
  });

  it("uses inline router options passed to it", async () => {
    const root = await copy("basic");
    const context = stubContext();

    await mkdir(path.join(root, "app"), { recursive: true });
    await cp(path.join(root, "src/routes"), path.join(root, "app/pages"), { recursive: true });
    await rm(path.join(root, "src"), { recursive: true });

    await hooksOf(
      scopedRouteTrees({ root, router: { routesDirectory: "app/pages" } }),
    ).buildStart.call(context);

    expect(context.warn).not.toHaveBeenCalled();
    expect(await listOutput(root)).toContain("billing.gen.js");
  });
});
