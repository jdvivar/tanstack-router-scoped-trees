import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfigError, type ResolvedScopedTreesConfig } from "../src/config.js";
import {
  checkScopedRouteTrees,
  findParityDifferences,
  formatParityDifferences,
} from "../src/parity.js";
import { copyFixture, fixturePath } from "./helpers/fixture.js";

const mapping = vi.hoisted(() => ({ dropBillingLayout: false }));

vi.mock("../src/sections.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/sections.js")>();

  return {
    ...actual,
    selectSection: (...args: Parameters<typeof actual.selectSection>) => {
      const selected = actual.selectSection(...args);

      if (mapping.dropBillingLayout) {
        selected.delete("billing/route.tsx");
      }

      return selected;
    },
  };
});

const copies: string[] = [];

afterEach(async () => {
  mapping.dropBillingLayout = false;

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
    outputDirectory: "src/test/route-trees",
    autoSectionUncovered: false,
    root,
    configFile: path.join(root, "scoped-route-trees.config.ts"),
    ...overrides,
  };
}

async function writeConfig(root: string, sections: Record<string, string[]>) {
  await writeFile(
    path.join(root, "scoped-route-trees.config.ts"),
    `export default { sections: ${JSON.stringify(sections)} };\n`,
  );
}

const basicSections = { billing: ["/billing"], settings: ["/settings"], about: ["/about"] };

const namingRules: Array<[rule: string, prefix: string]> = [
  ["pathless layout (_auth.tsx + _auth.dashboard.tsx)", "/dashboard"],
  ["non-nested route (posts_.$postId.edit.tsx) beside posts.tsx + posts.index.tsx", "/posts"],
  ["route group ((marketing)/pricing.tsx)", "/pricing"],
  ["splat (files/$.tsx)", "/files"],
  ["optional param (shop.{-$category}.tsx)", "/shop"],
  ["escaped dot (script[.]js.tsx)", "/script.js"],
  ["lazy companion (reports.tsx + reports.lazy.tsx)", "/reports"],
  ["deprecated component piece (stats.tsx + stats.component.tsx)", "/stats"],
  ["directory with route.tsx (docs/route.tsx + docs/intro.tsx)", "/docs"],
  ["directory without route.tsx (guides/setup.tsx)", "/guides"],
  ["flat dots (a.b.c.tsx)", "/a"],
  ["index without a parent file (articles.index.tsx)", "/articles"],
  ["multi-segment pathless prefix (org/team/_guard.tsx)", "/org"],
  ["$param pathless prefix ($org/_guard.tsx)", "/$org"],
];

describe("checkScopedRouteTrees", () => {
  it("passes on the basic fixture", async () => {
    const root = await copy("basic");

    await writeConfig(root, basicSections);

    expect(await checkScopedRouteTrees({ root })).toEqual([]);
  });

  it("throws a ConfigError telling how to create a config when there is none", async () => {
    const root = await copy("basic");
    const error = await checkScopedRouteTrees({ root }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConfigError);
    expect((error as Error).message).toMatch(/init/);
    expect((error as Error).message).toMatch(/dev server/);
  });
});

describe.each([
  ["default config", false],
  ["autoCodeSplitting", true],
])("findParityDifferences on every naming rule (%s)", (_label, autoCodeSplitting) => {
  let root: string;

  beforeAll(async () => {
    root = await copyFixture("naming-rules");

    if (autoCodeSplitting) {
      await writeFile(path.join(root, "tsr.config.json"), '{ "autoCodeSplitting": true }\n');
    }
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each(namingRules)("passes on %s", async (_rule, prefix) => {
    const differences = await findParityDifferences(configFor(root, { rule: [prefix] }));
    const sectionDifferences = differences.filter(({ field }) => field !== "uncovered");

    expect(formatParityDifferences(sectionDifferences)).toBe("");
  });

  it("passes with every rule in one section", async () => {
    const config = configFor(root, { all: namingRules.map(([, prefix]) => prefix) });

    expect(await findParityDifferences(config)).toEqual([]);
  });
});

describe("findParityDifferences", () => {
  it("reports a route generated under the wrong parent", async () => {
    mapping.dropBillingLayout = true;

    const root = fixturePath("basic");
    const differences = await findParityDifferences(configFor(root, { billing: ["/billing"] }));

    expect(differences).toContainEqual({
      section: "billing",
      filePath: "billing/invoices.tsx",
      field: "parent",
      expected: "billing/route.tsx",
      actual: null,
    });
  });

  it("reports uncovered routes", async () => {
    const root = fixturePath("basic");
    const differences = await findParityDifferences(configFor(root, { billing: ["/billing"] }));

    expect(differences.filter((difference) => difference.field === "uncovered")).toEqual([
      expect.objectContaining({ filePath: "about.tsx", actual: "/about" }),
      expect.objectContaining({ filePath: "settings.profile.tsx", actual: "/settings/profile" }),
      expect.objectContaining({ filePath: "settings.tsx", actual: "/settings" }),
    ]);
  });
});

describe("formatParityDifferences", () => {
  it("writes one line per difference naming section, file, field, expected and actual", () => {
    expect(
      formatParityDifferences([
        {
          section: "billing",
          filePath: "billing/invoices.tsx",
          field: "parent",
          expected: "billing/route.tsx",
          actual: null,
        },
        { section: "billing", filePath: "billing/extra.tsx", field: "extra" },
        { section: "", filePath: "about.tsx", field: "uncovered", actual: "/about" },
      ]),
    ).toBe(
      [
        'billing: billing/invoices.tsx parent: expected "billing/route.tsx", got none',
        "billing: billing/extra.tsx is in the scoped tree but not in the section",
        "about.tsx (/about) is in no section",
      ].join("\n"),
    );
  });
});
