import { spawnSync } from "node:child_process";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { copyFixture } from "./helpers/fixture.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repoRoot, "dist/cli.js");
const copies: string[] = [];

beforeAll(() => {
  const build = spawnSync("npm", ["run", "build"], { cwd: repoRoot, encoding: "utf8" });

  expect(build.status, build.stdout + build.stderr).toBe(0);
}, 120_000);

afterEach(async () => {
  await Promise.all(copies.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function basic() {
  const dir = await copyFixture("basic");

  copies.push(dir);

  return dir;
}

function run(root: string, ...args: string[]) {
  const result = spawnSync("node", [cli, ...args, "--root", root], { encoding: "utf8" });

  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

async function exists(file: string) {
  return access(file).then(
    () => true,
    () => false,
  );
}

describe("init", () => {
  it("writes the config", async () => {
    const root = await basic();
    const result = run(root, "init");
    const config = await readFile(path.join(root, "scoped-route-trees.config.ts"), "utf8");

    expect(result.status).toBe(0);
    expect(config).toContain('"/billing"');
  });

  it("refuses when a config exists", async () => {
    const root = await basic();

    run(root, "init");

    const result = run(root, "init");

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/already exists/);
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });
});

describe("generate", () => {
  it("writes trees and creates the config when there is none", async () => {
    const root = await basic();
    const result = run(root, "generate");

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Created scoped-route-trees\.config\.ts/);
    expect(await exists(path.join(root, "src/test/route-trees/billing.gen.js"))).toBe(true);
    expect(await exists(path.join(root, "src/routeTree.gen.ts"))).toBe(true);
  });

  it("--check exits 0 when up to date", async () => {
    const root = await basic();

    run(root, "generate");

    const result = run(root, "generate", "--check");

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/up to date/);
  });

  it("--check exits 1 and names the stale tree after a route is added", async () => {
    const root = await basic();

    run(root, "generate");
    await writeFile(
      path.join(root, "src/routes/billing/receipts.tsx"),
      'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/billing/receipts")({});\n',
    );

    const result = run(root, "generate", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/routeTree\.gen\.ts/);
    expect(result.stderr).toMatch(/billing\.gen\.js/);
    expect(result.stderr).toMatch(/Run: npx tanstack-router-scoped-trees generate/);
  });

  it("--check exits 1 and lists uncovered routes with the lines to add", async () => {
    const root = await basic();

    run(root, "generate");
    await writeFile(
      path.join(root, "src/routes/reports.tsx"),
      'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/reports")({});\n',
    );

    const result = run(root, "generate", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/reports\.tsx/);
    expect(result.stderr).toMatch(/"\/reports"/);
    expect(result.stderr).toMatch(/Run: npx tanstack-router-scoped-trees generate/);
  });
});
