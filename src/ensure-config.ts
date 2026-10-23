import type { Config } from "@tanstack/router-generator";
import { loadConfig, writeInitialConfig, type ResolvedScopedTreesConfig } from "./config.js";
import { resolveRouterConfig } from "./router-config.js";
import { scanRoutes } from "./scan.js";
import { detectSections } from "./sections.js";

export type EnsuredConfig = {
  config: ResolvedScopedTreesConfig | undefined;
  createdFile: string | undefined;
};

export async function ensureConfig(root: string, router?: Partial<Config>): Promise<EnsuredConfig> {
  const existing = await loadConfig(root);

  if (existing !== undefined) {
    return { config: existing, createdFile: undefined };
  }

  const routerConfig = resolveRouterConfig(root, { inline: router });
  const { routes } = await scanRoutes({ ...routerConfig, disableTypes: true }, root);
  const createdFile = await writeInitialConfig(root, detectSections(routes));

  return { config: await loadConfig(root), createdFile };
}
