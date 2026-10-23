import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CONFIG_FILE_NAME,
  ConfigError,
  loadConfig,
  validateConfig,
  writeInitialConfig,
} from "../src/config.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "scoped-trees-config-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeConfig(body: string) {
  await writeFile(
    path.join(root, CONFIG_FILE_NAME),
    `import { defineConfig } from "tanstack-router-scoped-trees";\nexport default defineConfig(${body});\n`,
  );
}

describe("loadConfig", () => {
  it("loads a config and fills defaults", async () => {
    await writeConfig(`{ sections: { billing: ["/billing"] } }`);

    const config = await loadConfig(root);

    expect(config).toEqual({
      sections: { billing: ["/billing"] },
      commonRoutes: [],
      outputDirectory: "src/test/route-trees",
      autoSectionUncovered: false,
      root,
      configFile: path.join(root, CONFIG_FILE_NAME),
    });
  });

  it("returns undefined when no config file exists", async () => {
    await expect(loadConfig(root)).resolves.toBeUndefined();
  });

  it("rejects a config without sections", async () => {
    await writeConfig(`{}`);

    const error = await loadConfig(root).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConfigError);
    expect((error as Error).message).toContain("sections");
    expect((error as Error).message).toContain("scoped-route-trees.config.ts");
  });

  it("rejects an empty sections object", async () => {
    await writeConfig(`{ sections: {} }`);

    const error = await loadConfig(root).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConfigError);
    expect((error as Error).message).toContain("sections");
    expect((error as Error).message).toContain("scoped-route-trees.config.ts");
  });
});

describe("validateConfig", () => {
  const file = "/x/scoped-route-trees.config.ts";

  it.each(["My Section", "../x"])("rejects a section name that is not a file name: %s", (name) => {
    const run = () => validateConfig({ sections: { [name]: ["/a"] } }, file);

    expect(run).toThrow(ConfigError);
    expect(run).toThrow(name);
    expect(run).toThrow("/^[a-z0-9][a-z0-9-]*$/");
  });

  it("rejects a prefix that does not start with a slash", () => {
    const run = () => validateConfig({ sections: { billing: ["billing"] } }, file);

    expect(run).toThrow(ConfigError);
    expect(run).toThrow('"billing"');
    expect(run).toThrow('start with "/"');
  });

  it("rejects an unknown key, naming it and the valid keys", () => {
    const run = () => validateConfig({ sections: { a: ["/a"] }, comonRoutes: ["/x"] }, file);

    expect(run).toThrow(ConfigError);
    expect(run).toThrow('"comonRoutes"');
    expect(run).toThrow("commonRoutes, outputDirectory");
  });

  it("rejects a common route that does not start with a slash", () => {
    const run = () =>
      validateConfig({ sections: { a: ["/a"] }, commonRoutes: ["forbidden"] }, file);

    expect(run).toThrow(ConfigError);
    expect(run).toThrow('"forbidden"');
    expect(run).toThrow('start with "/"');
  });

  it('rejects "/" as a section prefix', () => {
    const run = () => validateConfig({ sections: { everything: ["/"] } }, file);

    expect(run).toThrow(ConfigError);
    expect(run).toThrow('"everything"');
    expect(run).toThrow("specific prefixes");
  });
});

describe("writeInitialConfig", () => {
  it("writes a file loadConfig reads back with the same sections", async () => {
    const sections = { billing: ["/billing", "/invoices"], "user-admin": ["/users"] };

    const written = await writeInitialConfig(root, sections);
    const config = await loadConfig(root);

    expect(written).toBe(path.join(root, CONFIG_FILE_NAME));
    expect(config?.sections).toEqual(sections);
  });

  it("validates the sections before writing anything", async () => {
    await expect(writeInitialConfig(root, {})).rejects.toThrow(ConfigError);
    await expect(loadConfig(root)).resolves.toBeUndefined();
  });

  it("refuses to overwrite an existing config", async () => {
    await writeConfig(`{ sections: { a: ["/a"] } }`);

    await expect(writeInitialConfig(root, { b: ["/b"] })).rejects.toThrow(ConfigError);
  });
});
