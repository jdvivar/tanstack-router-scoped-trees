import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

export type ScopedTreesConfig = {
  sections: Record<string, string[]>;
  commonRoutes?: string[];
  outputDirectory?: string;
  autoSectionUncovered?: boolean;
  routesDirectory?: string;
  generatedRouteTree?: string;
};

export type ResolvedScopedTreesConfig = Required<
  Omit<ScopedTreesConfig, "routesDirectory" | "generatedRouteTree">
> &
  Pick<ScopedTreesConfig, "routesDirectory" | "generatedRouteTree"> & {
    root: string;
    configFile: string;
  };

export const CONFIG_FILE_NAME = "scoped-route-trees.config.ts";
export const DEFAULT_OUTPUT_DIRECTORY = "src/test/route-trees";

const SECTION_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function defineConfig(config: ScopedTreesConfig): ScopedTreesConfig {
  return config;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateSections(raw: Record<string, unknown>, configFile: string): void {
  const fileName = path.basename(configFile);
  const sections = raw.sections;

  if (!isRecord(sections) || Object.keys(sections).length === 0) {
    throw new ConfigError(
      `${fileName} must define a non-empty "sections" object mapping section names to URL prefixes. ` +
        `Add one, or delete ${fileName} and run "init" to recreate it (${configFile}).`,
    );
  }

  for (const [name, prefixes] of Object.entries(sections)) {
    if (!SECTION_NAME_PATTERN.test(name)) {
      throw new ConfigError(
        `Invalid section name "${name}" in ${fileName}: section names become file names and must match ${SECTION_NAME_PATTERN}.`,
      );
    }

    if (!isStringArray(prefixes) || prefixes.length === 0) {
      throw new ConfigError(
        `Section "${name}" in ${fileName} must be a non-empty array of URL prefixes.`,
      );
    }

    for (const prefix of prefixes) {
      if (!prefix.startsWith("/")) {
        throw new ConfigError(
          `Section "${name}" in ${fileName} has prefix "${prefix}": prefixes must start with "/".`,
        );
      }
    }
  }
}

function validateOptionalFields(raw: Record<string, unknown>, fileName: string): void {
  const { commonRoutes, outputDirectory, autoSectionUncovered } = raw;

  if (commonRoutes !== undefined && !isStringArray(commonRoutes)) {
    throw new ConfigError(`"commonRoutes" in ${fileName} must be an array of URL paths.`);
  }

  if (outputDirectory !== undefined && typeof outputDirectory !== "string") {
    throw new ConfigError(`"outputDirectory" in ${fileName} must be a string.`);
  }

  if (autoSectionUncovered !== undefined && typeof autoSectionUncovered !== "boolean") {
    throw new ConfigError(`"autoSectionUncovered" in ${fileName} must be a boolean.`);
  }

  for (const key of ["routesDirectory", "generatedRouteTree"]) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") {
      throw new ConfigError(`"${key}" in ${fileName} must be a string.`);
    }
  }
}

export function validateConfig(raw: unknown, configFile: string): ScopedTreesConfig {
  const fileName = path.basename(configFile);

  if (!isRecord(raw)) {
    throw new ConfigError(
      `${fileName} must default-export a config object, e.g. export default defineConfig({ sections: {...} }).`,
    );
  }

  validateSections(raw, configFile);
  validateOptionalFields(raw, fileName);

  return raw as ScopedTreesConfig;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);

    return true;
  } catch {
    return false;
  }
}

function ownEntryPoint(): string {
  const extension = path.extname(fileURLToPath(import.meta.url));

  return fileURLToPath(new URL(`./index${extension}`, import.meta.url));
}

export async function loadConfig(root: string): Promise<ResolvedScopedTreesConfig | undefined> {
  const absoluteRoot = path.resolve(root);
  const configFile = path.join(absoluteRoot, CONFIG_FILE_NAME);

  if (!(await exists(configFile))) {
    return undefined;
  }

  const jiti = createJiti(import.meta.url, {
    alias: { "tanstack-router-scoped-trees": ownEntryPoint() },
    moduleCache: false,
    fsCache: false,
  });
  const raw = await jiti.import(configFile, { default: true });
  const config = validateConfig(raw, configFile);

  return {
    ...config,
    commonRoutes: config.commonRoutes ?? [],
    outputDirectory: config.outputDirectory ?? DEFAULT_OUTPUT_DIRECTORY,
    autoSectionUncovered: config.autoSectionUncovered ?? false,
    root: absoluteRoot,
    configFile,
  };
}

function renderSections(sections: Record<string, string[]>): string {
  return Object.entries(sections)
    .map(([name, prefixes]) => {
      const key = /^[a-z_$][\w$]*$/i.test(name) ? name : JSON.stringify(name);
      const list = prefixes.map((prefix) => JSON.stringify(prefix)).join(", ");
      const line = `    ${key}: [${list}],`;

      if (line.length <= 100) {
        return line;
      }

      const items = prefixes.map((prefix) => `      ${JSON.stringify(prefix)},`).join("\n");

      return `    ${key}: [\n${items}\n    ],`;
    })
    .join("\n");
}

export async function writeInitialConfig(
  root: string,
  sections: Record<string, string[]>,
): Promise<string> {
  const configFile = path.join(path.resolve(root), CONFIG_FILE_NAME);

  if (await exists(configFile)) {
    throw new ConfigError(`${CONFIG_FILE_NAME} already exists at ${configFile}; not overwriting.`);
  }

  const contents = [
    `import { defineConfig } from "tanstack-router-scoped-trees";`,
    ``,
    `export default defineConfig({`,
    `  // How sections work: docs/sections.md`,
    `  sections: {`,
    renderSections(sections),
    `  },`,
    `});`,
    ``,
  ].join("\n");

  await writeFile(configFile, contents, { flag: "wx" });

  return configFile;
}
