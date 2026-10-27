import path from "node:path";
import type { Config } from "@tanstack/router-generator";
import {
  CONFIG_FILE_NAME,
  ConfigError,
  loadConfig,
  writeInitialConfig,
  type ResolvedScopedTreesConfig,
} from "./config.js";
import { resolveRouterConfig } from "./router-config.js";
import { scanRoutes } from "./scan.js";
import { detectSections } from "./sections.js";

export type EnsuredConfig = {
  config: ResolvedScopedTreesConfig | undefined;
  createdFile: string | undefined;
};

export class NoSectionsDetectedError extends ConfigError {
  constructor(routesDirectory: string, configFile: string) {
    super(
      [
        `No sections detected: ${routesDirectory} has no routes besides "/".`,
        `${CONFIG_FILE_NAME} is created once routes beyond "/" exist. To write it by hand, create ${configFile} with:`,
        ``,
        `  import { defineConfig } from "tanstack-router-scoped-trees";`,
        ``,
        `  export default defineConfig({`,
        `    sections: { billing: ["/billing"] },`,
        `  });`,
      ].join("\n"),
    );
    this.name = "NoSectionsDetectedError";
  }
}

export async function writeDetectedConfig(root: string, router?: Partial<Config>): Promise<string> {
  const routerConfig = resolveRouterConfig(root, { inline: router });
  const { routes } = await scanRoutes({ ...routerConfig, disableTypes: true }, root);
  const sections = detectSections(routes);

  if (Object.keys(sections).length === 0) {
    throw new NoSectionsDetectedError(
      routerConfig.routesDirectory,
      path.join(path.resolve(root), CONFIG_FILE_NAME),
    );
  }

  return writeInitialConfig(root, sections);
}

export async function ensureConfig(root: string, router?: Partial<Config>): Promise<EnsuredConfig> {
  const existing = await loadConfig(root);

  if (existing !== undefined) {
    return { config: existing, createdFile: undefined };
  }

  const createdFile = await writeDetectedConfig(root, router);

  return { config: await loadConfig(root), createdFile };
}
