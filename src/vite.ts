import path from "node:path";
import type { Config } from "@tanstack/router-generator";
import type { Plugin } from "vite";
import { CONFIG_FILE_NAME, loadConfig } from "./config.js";
import { ensureConfig, NoSectionsDetectedError } from "./ensure-config.js";
import { appRouterConfig, generateScopedTrees } from "./generate.js";
import { findGeneratorMismatch } from "./generator-versions.js";
import { resolveRouterConfig } from "./router-config.js";

export type ScopedRouteTreesOptions = {
  root?: string;
  router?: Partial<Config>;
};

type PluginContext = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

async function ensureConfigWithNotice(
  root: string,
  router: Partial<Config> | undefined,
  context: PluginContext,
) {
  const { config, createdFile } = await ensureConfig(root, router);

  if (createdFile !== undefined) {
    context.info(`Created ${CONFIG_FILE_NAME} at ${createdFile}. Review the sections it detected.`);
  }

  return config;
}

async function regenerate(
  root: string,
  router: Partial<Config> | undefined,
  context: PluginContext,
) {
  try {
    const mismatch = findGeneratorMismatch(root);

    if (mismatch !== undefined) {
      context.warn(mismatch.message);
    }

    const config = await ensureConfigWithNotice(root, router, context);

    if (config === undefined) {
      return;
    }

    await generateScopedTrees({ root, config, mode: "write", router });
  } catch (error) {
    if (error instanceof NoSectionsDetectedError) {
      context.info(error.message);

      return;
    }

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

function underVitest(): boolean {
  return Boolean(process.env.VITEST);
}

async function isWatchedFile(id: string, root: string, router: Partial<Config> | undefined) {
  const file = path.resolve(id);

  return file === path.join(root, CONFIG_FILE_NAME) || file === (await fullTreePath(root, router));
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
      if (underVitest()) {
        return;
      }

      await regenerate(rootOrCwd(), options.router, this);
    },
    async watchChange(id) {
      if (underVitest()) {
        return;
      }

      try {
        if (!(await isWatchedFile(id, rootOrCwd(), options.router))) {
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
