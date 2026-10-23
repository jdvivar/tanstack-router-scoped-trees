import { checkScopedRouteTrees, formatParityDifferences } from "tanstack-router-scoped-trees";
import { expect, it } from "vitest";

it("keeps every scoped tree in parity with the full route tree", async () => {
  expect(formatParityDifferences(await checkScopedRouteTrees())).toBe("");
});
