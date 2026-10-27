import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertSingleGenerator,
  findGeneratorMismatch,
  GeneratorMismatchError,
} from "../src/generator-versions.js";
import { fakeRouterPlugin } from "./helpers/fixture.js";

let root: string;
let ownModule: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "scoped-trees-versions-"));

  const ours = path.join(root, "node_modules/tanstack-router-scoped-trees");
  const ownGenerator = path.join(ours, "node_modules/@tanstack/router-generator");

  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "app" }));
  await mkdir(path.join(ours, "dist"), { recursive: true });
  await mkdir(ownGenerator, { recursive: true });
  await writeFile(
    path.join(ownGenerator, "package.json"),
    JSON.stringify({ name: "@tanstack/router-generator", version: "1.167.46" }),
  );
  ownModule = pathToFileURL(path.join(ours, "dist/index.js")).href;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("findGeneratorMismatch", () => {
  it("names both versions and the fix when router-plugin uses another generator", async () => {
    await fakeRouterPlugin(root, "1.167.44");

    const mismatch = findGeneratorMismatch(root, ownModule);

    expect(mismatch).toMatchObject({ ours: "1.167.46", plugin: "1.167.44" });
    expect(mismatch?.message).toContain("1.167.46");
    expect(mismatch?.message).toContain("npm i -D @tanstack/router-generator@1.167.44");
    expect(mismatch?.message).toContain("npm ls @tanstack/router-generator");
  });

  it("finds nothing when both use the same version", async () => {
    await fakeRouterPlugin(root, "1.167.46");

    expect(findGeneratorMismatch(root, ownModule)).toBeUndefined();
  });

  it("finds nothing when router-plugin is not installed", () => {
    expect(findGeneratorMismatch(root, ownModule)).toBeUndefined();
  });
});

describe("assertSingleGenerator", () => {
  it("throws a GeneratorMismatchError on a mismatch", async () => {
    await fakeRouterPlugin(root, "1.0.0");

    expect(() => assertSingleGenerator(root, ownModule)).toThrow(GeneratorMismatchError);
  });
});
