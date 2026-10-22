import { expect, it } from "vitest";

it("resolves the package entry", async () => {
  await expect(import("../src/index.js")).resolves.toBeDefined();
});
