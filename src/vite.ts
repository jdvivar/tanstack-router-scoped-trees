import path from "node:path";
import type { Config } from "@tanstack/router-generator";
import type { Plugin } from "vite";
import { CONFIG_FILE_NAME, loadConfig, writeInitialConfig } from "./config.js";
import { appRouterConfig, generateScopedTrees } from "./generate.js";
import { resolveRouterConfig } from "./router-config.js";
import { detectSections } from "./sections.js";
import { scanRoutes } from "./scan.js";

export type ScopedRouteTreesOptions = {
  root?: string;
  router?: Partial<Config>;
};

type PluginContext = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

async function ensureConfig(
  root: string,
  router: Partial<Config> | undefined,
  context: PluginContext,
) {
  const existing = await loadConfig(root);

  if (existing !== undefined) {
    return existing;
  }

  const routerConfig = resolveRouterConfig(root, { inline: router });
  const { routes } = await scanRoutes({ ...routerConfig, disableTypes: true }, root);
  const configFile = await writeInitialConfig(root, detectSections(routes));

  context.info(`Created ${CONFIG_FILE_NAME} at ${configFile}. Review the sections it detected.`);

  return loadConfig(root);
}

async function regenerate(
  root: string,
  router: Partial<Config> | undefined,
  context: PluginContext,
) {
  try {
    const config = await ensureConfig(root, router, context);

    if (config === undefined) {
      return;
    }

    await generateScopedTrees({ root, config, mode: "write", router });
  } catch (error) {
    context.warn(error instanceof Error ? error.message : String(error));
  }
}

async function fullTreePath(root: string, router: Partial<Config> | undefined) {
  const config = await loadConfig(root);

  if (config === undefined) {
    return path.resolve(resolveRouterConfig(root, { inline: router }).generatedRouteTree);
  }

  return path.resolve(appRouterConfig(root, config, router).generatedRouteTree);
}

export function scopedRouteTrees(options: ScopedRouteTreesOptions = {}): Plugin {
  let root = options.root === undefined ? undefined : path.resolve(options.root);

  const rootOrCwd = () => root ?? process.cwd();

  return {
    name: "tanstack-router-scoped-trees",
    apply: "serve",
    configResolved(resolved) {
      root ??= resolved.root;
    },
    async buildStart() {
      await regenerate(rootOrCwd(), options.router, this);
    },
    async watchChange(id) {
      try {
        if (path.resolve(id) !== (await fullTreePath(rootOrCwd(), options.router))) {
          return;
        }
      } catch (error) {
        this.warn(error instanceof Error ? error.message : String(error));

        return;
      }

      await regenerate(rootOrCwd(), options.router, this);
    },
  };
}
