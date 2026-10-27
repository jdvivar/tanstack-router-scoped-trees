import { expect, it } from "vitest";

it("exports only the documented surface", async () => {
  const entry = await import("../src/index.js");

  expect(Object.keys(entry).sort()).toEqual([
    "ConfigError",
    "checkScopedRouteTrees",
    "defineConfig",
    "formatParityDifferences",
  ]);
});
