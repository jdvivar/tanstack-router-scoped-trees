import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, copyFile, readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { formatCheckReport } from "../src/cli-report.js";
import { copyFixture, fakeRouterPlugin } from "./helpers/fixture.js";

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

function spawnCli(...args: string[]) {
  const result = spawnSync("node", [cli, ...args], { encoding: "utf8" });

  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

async function snapshot(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  const lines = await Promise.all(
    files.map(async (entry) => {
      const file = path.join(entry.parentPath, entry.name);
      const hash = createHash("sha1")
        .update(await readFile(file))
        .digest("hex");

      return `${path.relative(root, file)} ${hash}`;
    }),
  );

  return lines.sort();
}

const routeStub = (route: string) =>
  `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("${route}")({});\n`;

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
    expect(result.stderr).toMatch(/^ {2}billing$/m);
    expect(result.stderr).not.toMatch(/\.d\.ts/);
    expect(result.stderr.trimEnd().split("\n").at(-1)).toBe(
      "Run: npx tanstack-router-scoped-trees generate",
    );
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
    expect(result.stderr.trimEnd().split("\n").at(-1)).toBe(
      `Add the lines above to ${path.join(root, "scoped-route-trees.config.ts")}, then run: npx tanstack-router-scoped-trees generate`,
    );
  });

  it("--check lists uncovered routes first when trees are stale too", async () => {
    const root = await basic();

    run(root, "generate");
    await writeFile(path.join(root, "src/routes/reports.tsx"), routeStub("/reports"));

    const { stderr } = run(root, "generate", "--check");

    expect(stderr.indexOf("not in any section")).toBeLessThan(stderr.indexOf("out of date"));
  });

  it("--check exits 1 when only the full tree is stale", async () => {
    const root = await basic();

    run(root, "generate");
    await unlink(path.join(root, "src/routeTree.gen.ts"));

    const result = run(root, "generate", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/full route tree is out of date: src\/routeTree\.gen\.ts/);
    expect(result.stderr).not.toMatch(/Scoped trees out of date/);
    expect(result.stderr.trimEnd().split("\n").at(-1)).toBe(
      "Run: npx tanstack-router-scoped-trees generate",
    );
  });

  it("--check exits 1 and names a tree left over from a removed section", async () => {
    const root = await basic();

    run(root, "generate");
    await writeFile(path.join(root, "src/test/route-trees/old.gen.js"), "export {};\n");
    await copyFile(
      path.join(root, "src/test/route-trees/billing.gen.d.ts"),
      path.join(root, "src/test/route-trees/old.gen.d.ts"),
    );

    const result = run(root, "generate", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/match no section any more/);
    expect(result.stderr).toMatch(/^ {2}old$/m);
    expect(result.stderr.trimEnd().split("\n").at(-1)).toBe(
      "Run: npx tanstack-router-scoped-trees generate",
    );
  });

  it("--check leaves the filesystem untouched", async () => {
    const root = await basic();

    run(root, "generate");
    await writeFile(
      path.join(root, "src/routes/billing/receipts.tsx"),
      routeStub("/billing/receipts"),
    );

    const before = await snapshot(root);

    run(root, "generate", "--check");

    expect(await snapshot(root)).toEqual(before);
  });

  it("--check without a config exits 1 with the init hint and writes nothing", async () => {
    const root = await basic();
    const before = await snapshot(root);
    const result = run(root, "generate", "--check");

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/npx tanstack-router-scoped-trees init/);
    expect(await snapshot(root)).toEqual(before);
  });
});

describe("a route file TanStack wants to rewrite", () => {
  it("is left alone and named in a warning", async () => {
    const root = await basic();
    const routeFile = path.join(root, "src/routes/about.tsx");

    await writeFile(routeFile, routeStub("/wrong"));

    const result = run(root, "generate");

    expect(result.status).toBe(0);
    expect(await readFile(routeFile, "utf8")).toBe(routeStub("/wrong"));
    expect(result.stderr).toContain(path.join("src", "routes", "about.tsx"));
    expect(result.stderr).toContain(
      "TanStack wanted to update this file; start the dev server or run `tsr generate`",
    );
    expect(result.stderr.match(/about\.tsx/g)).toHaveLength(1);
  });
});

describe("an app with only the root index", () => {
  it.each(["init", "generate"])(
    "%s writes no config and explains when one appears",
    async (command) => {
      const root = await basic();

      for (const file of ["about.tsx", "settings.tsx", "settings.profile.tsx", "billing"]) {
        await rm(path.join(root, "src/routes", file), { recursive: true });
      }

      const result = run(root, command);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('created once routes beyond "/" exist');
      expect(result.stderr).toContain("sections:");
      expect(await exists(path.join(root, "scoped-route-trees.config.ts"))).toBe(false);
    },
  );
});

describe("a missing routes directory", () => {
  it("names the directory it looked at", async () => {
    const root = await basic();

    await rm(path.join(root, "src/routes"), { recursive: true });

    const result = run(root, "generate");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(path.join(root, "src/routes"));
    expect(result.stderr).toContain("routesDirectory");
    expect(result.stderr).not.toMatch(/ENOENT/);
  });
});

describe("a second generator copy", () => {
  it.each(["init", "generate", "generate --check"])(
    "%s exits 1 naming both versions and the fix",
    async (command) => {
      const root = await basic();

      await fakeRouterPlugin(root, "1.0.0-test");

      const result = run(root, ...command.split(" "));

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Two versions of @tanstack\/router-generator/);
      expect(result.stderr).toContain("npm i -D @tanstack/router-generator@1.0.0-test");
      expect(result.stderr).toContain("npm ls @tanstack/router-generator");
    },
  );
});

describe("parity report", () => {
  it("says regenerating will not help, names the section and points to the issues page", () => {
    const report = formatCheckReport({
      root: "/p",
      configFile: "/p/scoped-route-trees.config.ts",
      outputDirectory: "/p/src/test/route-trees",
      changed: [],
      stale: [],
      parity: [{ section: "billing", filePath: "billing/index.tsx", field: "missing" }],
    });
    const lastLine = report.trimEnd().split("\n").at(-1);

    expect(report).toMatch(/billing\/index\.tsx is in the section but missing/);
    expect(lastLine).toMatch(/Regenerating will not fix .*\(section: billing\)/);
    expect(lastLine).toMatch(
      /https:\/\/github\.com\/jdvivar\/tanstack-router-scoped-trees\/issues$/,
    );
    expect(report).not.toMatch(/Run: npx/);
  });
});

describe("command line", () => {
  it("rejects an unknown command with help and exit 1", () => {
    const result = spawnCli("generat");

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Unknown command "generat"/);
    expect(result.stdout).toMatch(/Usage:/);
  });

  it("prints help and exits 1 when no command is given", () => {
    const result = spawnCli();

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/Usage:/);
  });

  it("prints the package version for --version", async () => {
    const { version } = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
    const result = spawnCli("--version");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(version);
  });

  it("prints help and exits 0 for --help", () => {
    expect(spawnCli("--help").status).toBe(0);
  });
});
