import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inMemoryOutputFs, readOnlyRoutesFs } from "../src/generator-fs.js";

let root: string;
let routesDirectory: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "scoped-trees-fs-"));
  routesDirectory = path.join(root, "src/routes");
  await mkdir(routesDirectory, { recursive: true });
  await writeFile(path.join(routesDirectory, "about.tsx"), "original");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("readOnlyRoutesFs", () => {
  it("drops renames into the routes directory and removes the staged file", async () => {
    const fs = readOnlyRoutesFs(routesDirectory);
    const staged = path.join(root, "staged");

    await fs.writeFile(staged, "rewritten");
    await fs.rename(staged, path.join(routesDirectory, "about.tsx"));

    expect(await readFile(path.join(routesDirectory, "about.tsx"), "utf8")).toBe("original");
    await expect(stat(staged)).rejects.toThrow();
  });

  it("reports each dropped rename into the routes directory", async () => {
    const dropped: string[] = [];
    const fs = readOnlyRoutesFs(routesDirectory, (file) => dropped.push(file));
    const staged = path.join(root, "staged");

    await fs.writeFile(staged, "rewritten");
    await fs.rename(staged, path.join(routesDirectory, "about.tsx"));

    expect(dropped).toEqual([path.join(routesDirectory, "about.tsx")]);
  });

  it("lets renames outside the routes directory through", async () => {
    const fs = readOnlyRoutesFs(routesDirectory);
    const staged = path.join(root, "staged");
    const target = path.join(root, "src/routeTree.gen.ts");

    await fs.writeFile(staged, "tree");
    await fs.rename(staged, target);

    expect(await readFile(target, "utf8")).toBe("tree");
  });
});

describe("inMemoryOutputFs", () => {
  it("keeps the output in memory and writes nothing", async () => {
    const outputPath = path.join(root, "src/routeTree.gen.ts");
    const { fs, output } = inMemoryOutputFs(routesDirectory, outputPath);
    const staged = path.join(root, "staged");

    await fs.writeFile(staged, "tree");
    await fs.rename(staged, outputPath);

    expect(output()).toBe("tree");
    await expect(stat(staged)).rejects.toThrow();
    await expect(stat(outputPath)).rejects.toThrow();
  });

  it("never writes into the routes directory, and reports what it dropped", async () => {
    const dropped: string[] = [];
    const { fs } = inMemoryOutputFs(
      routesDirectory,
      path.join(root, "src/routeTree.gen.ts"),
      (file) => dropped.push(file),
    );
    const staged = path.join(root, "staged");

    await fs.writeFile(staged, "rewritten");
    await fs.rename(staged, path.join(routesDirectory, "about.tsx"));

    expect(await readFile(path.join(routesDirectory, "about.tsx"), "utf8")).toBe("original");
    expect(dropped).toEqual([path.join(routesDirectory, "about.tsx")]);
  });
});
