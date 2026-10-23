import { existsSync } from "node:fs";
import { getConfig, type Config } from "@tanstack/router-generator";
import { CONFIG_FILE_NAME, ConfigError } from "./config.js";

export class UnsupportedVirtualRoutesError extends Error {
  constructor(root: string) {
    super(
      `The TanStack Router config in ${root} sets "virtualRouteConfig". tanstack-router-scoped-trees v1 does not support virtualRouteConfig; it only works with file-based routes.`,
    );
    this.name = "UnsupportedVirtualRoutesError";
  }
}

export type RouterConfigOverrides = {
  routesDirectory?: string;
  generatedRouteTree?: string;
  inline?: Partial<Config>;
};

export function resolveRouterConfig(root: string, overrides: RouterConfigOverrides = {}): Config {
  const config = getConfig(
    {
      ...overrides.inline,
      ...(overrides.routesDirectory === undefined
        ? {}
        : { routesDirectory: overrides.routesDirectory }),
      ...(overrides.generatedRouteTree === undefined
        ? {}
        : { generatedRouteTree: overrides.generatedRouteTree }),
      disableLogging: true,
    },
    root,
  );

  if (config.virtualRouteConfig !== undefined) {
    throw new UnsupportedVirtualRoutesError(root);
  }

  if (!existsSync(config.routesDirectory)) {
    throw new ConfigError(
      `Routes directory not found: ${config.routesDirectory}. Create it, or set "routesDirectory" to your routes folder in tsr.config.json, in ${CONFIG_FILE_NAME}, or in scopedRouteTrees({ router }) in vite.config.ts.`,
    );
  }

  return config;
}
