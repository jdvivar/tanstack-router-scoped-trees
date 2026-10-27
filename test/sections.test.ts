import { describe, expect, it } from "vitest";
import { ConfigError, type ScopedTreesConfig } from "../src/config.js";
import type { ScannedRoute } from "../src/scan.js";
import {
  applyAutoSections,
  assertPrefixesMatch,
  detectSections,
  findUncovered,
  formatUncoveredError,
  selectSection,
} from "../src/sections.js";

function route(
  filePath: string,
  fullPath: string,
  parentFilePath: string | null = null,
  fsRouteType = "static",
  routeId = fullPath,
): ScannedRoute {
  return {
    filePath,
    routeId,
    fullPath,
    parentFilePath,
    fsRouteType,
    cleanedPath: fullPath,
    companionFilePaths: [],
  };
}

const routes: ScannedRoute[] = [
  route("index.tsx", "/"),
  route("_auth.tsx", "/", null, "pathless_layout", "/_auth"),
  route("dashboard.tsx", "/dashboard", "_auth.tsx", "static", "/_auth/dashboard"),
  route("billing/route.tsx", "/billing", null, "layout"),
  route("billing/index.tsx", "/billing/", "billing/route.tsx"),
  route("billing/invoices.tsx", "/billing/invoices", "billing/route.tsx"),
  route("reports.tsx", "/reports"),
  route("$orgId.tsx", "/$orgId"),
];

const config: ScopedTreesConfig = {
  sections: { billing: ["/billing"], dashboard: ["/dashboard"] },
  commonRoutes: ["/"],
};

describe("detectSections", () => {
  it("detects one section per first URL segment, looking through pathless layouts", () => {
    const sections = detectSections(routes);

    expect(sections.dashboard).toEqual(["/dashboard"]);
    expect(sections.billing).toEqual(["/billing"]);
    expect(sections.orgid).toEqual(["/$orgId"]);
    expect(Object.keys(sections).some((name) => name.includes("auth"))).toBe(false);
    expect(Object.keys(sections)).not.toContain("");
  });

  it("suffixes colliding names", () => {
    const sections = detectSections([route("a.tsx", "/$org"), route("b.tsx", "/org")]);

    expect(sections).toEqual({ org: ["/$org"], "org-2": ["/org"] });
  });
});

describe("selectSection", () => {
  it("selects a section's routes plus their layouts", () => {
    const selected = selectSection(routes, ["/billing"], []);

    expect(selected).toEqual(
      new Set(["billing/route.tsx", "billing/index.tsx", "billing/invoices.tsx"]),
    );
    expect(selected.has("__root.tsx")).toBe(false);
  });

  it("includes a pathless wrapper above a selected route", () => {
    const selected = selectSection(routes, ["/dashboard"], []);

    expect(selected).toEqual(new Set(["dashboard.tsx", "_auth.tsx"]));
  });

  it("respects prefix boundaries", () => {
    expect(selectSection(routes, ["/bill"], []).size).toBe(0);
    expect(selectSection(routes, ["/billing"], []).has("billing/invoices.tsx")).toBe(true);
  });

  it("allows two sections to share a route", () => {
    const first = selectSection(routes, ["/billing"], []);
    const second = selectSection(routes, ["/billing/invoices"], []);

    expect(first.has("billing/invoices.tsx")).toBe(true);
    expect(second.has("billing/invoices.tsx")).toBe(true);
  });

  it("adds common routes to every section", () => {
    const selected = selectSection(routes, ["/reports"], ["/", "/dashboard"]);

    expect(selected).toEqual(new Set(["reports.tsx", "index.tsx", "dashboard.tsx", "_auth.tsx"]));
  });

  it("adds companion files sharing a route id", () => {
    const withCompanion = [
      route("x.tsx", "/x", null, "static", "/x"),
      route("x.lazy.tsx", "/x", null, "lazy", "/x"),
    ];

    expect(selectSection(withCompanion, ["/x"], [])).toEqual(new Set(["x.tsx", "x.lazy.tsx"]));
  });
});

describe("selectSection ancestor companions", () => {
  it("includes the companion of a selected route's layout", () => {
    const tree = [
      route("a/route.tsx", "/a", null, "layout", "/a"),
      route("a/route.lazy.tsx", "/a", null, "lazy", "/a"),
      route("a/b.tsx", "/a/b", "a/route.tsx"),
    ];

    expect(selectSection(tree, ["/a/b"], [])).toEqual(
      new Set(["a/b.tsx", "a/route.tsx", "a/route.lazy.tsx"]),
    );
  });
});

describe("findUncovered", () => {
  it("returns routes in no section, ignoring root index and pathless layouts", () => {
    const uncovered = findUncovered(routes, config).map((r) => r.filePath);

    expect(uncovered).toEqual(["reports.tsx", "$orgId.tsx"]);
  });
});

describe("formatUncoveredError", () => {
  it("reports uncovered routes with URL, file and the lines to add", () => {
    const message = formatUncoveredError(
      [route("reports.tsx", "/reports"), route("reports/daily.tsx", "/reports/daily")],
      "/app/scoped-route-trees.config.ts",
    );

    expect(message).toContain("/reports");
    expect(message).toContain("reports.tsx");
    expect(message).toContain('reports: ["/reports"],');
    expect(message).toContain("/app/scoped-route-trees.config.ts");
  });

  it("suggests names that do not clash with existing sections", () => {
    const message = formatUncoveredError(
      [route("reports.tsx", "/reports")],
      "/app/scoped-route-trees.config.ts",
      ["reports"],
    );

    expect(message).toContain('"reports-2": ["/reports"],');
  });

  it("quotes suggested names that are not identifiers", () => {
    const message = formatUncoveredError(
      [route("user-admin.tsx", "/user-admin")],
      "/app/scoped-route-trees.config.ts",
    );

    expect(message).toContain('"user-admin": ["/user-admin"],');
  });

  it("shows index routes without the trailing slash", () => {
    const message = formatUncoveredError(
      [route("billing/index.tsx", "/billing/")],
      "/app/scoped-route-trees.config.ts",
    );

    expect(message).toContain("  /billing  (billing/index.tsx)");
  });
});

describe("assertPrefixesMatch", () => {
  it("rejects a prefix that matches no route", () => {
    const bad: ScopedTreesConfig = { sections: { billing: ["/biling"] } };

    const file = "/app/scoped-route-trees.config.ts";

    expect(() => assertPrefixesMatch(routes, bad, file)).toThrow(ConfigError);
    expect(() => assertPrefixesMatch(routes, bad, file)).toThrow(/billing.*"\/biling"/);
    expect(() => assertPrefixesMatch(routes, bad, file)).toThrow(file);
    expect(() => assertPrefixesMatch(routes, bad, file)).toThrow(
      "fix the typo, or remove it if the routes were deleted",
    );
  });

  it("accepts prefixes that match", () => {
    expect(() => assertPrefixesMatch(routes, config, "/app/x.ts")).not.toThrow();
  });
});

describe("applyAutoSections", () => {
  it("auto-sections uncovered routes when enabled", () => {
    const result = applyAutoSections(routes, { ...config, autoSectionUncovered: true });

    expect(result.sections.reports).toEqual(["/reports"]);
    expect(result.sections.orgid).toEqual(["/$orgId"]);
    expect(result.sections.billing).toEqual(["/billing"]);
  });

  it("leaves the config alone when disabled", () => {
    expect(applyAutoSections(routes, config)).toBe(config);
  });
});
