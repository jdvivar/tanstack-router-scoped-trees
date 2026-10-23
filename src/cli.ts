#!/usr/bin/env node
import path from "node:path";
import { cac } from "cac";
import { CONFIG_FILE_NAME, ConfigError, loadConfig, writeInitialConfig } from "./config.js";
import { ensureConfig } from "./ensure-config.js";
import {
  appRouterConfig,
  generateFullTree,
  generateScopedTrees,
  isFullTreeStale,
  UncoveredRoutesError,
} from "./generate.js";
import { findParityDifferences, formatParityDifferences } from "./parity.js";
import { resolveRouterConfig } from "./router-config.js";
import { scanRoutes } from "./scan.js";
import { detectSections } from "./sections.js";

const CLI_NAME = "tanstack-router-scoped-trees";
const FIX_HINT = `Run: npx ${CLI_NAME} generate`;

type CommandOptions = { root?: string; check?: boolean };

function resolveRoot(options: CommandOptions): string {
  return path.resolve(options.root ?? process.cwd());
}

async function init(options: CommandOptions): Promise<void> {
  const root = resolveRoot(options);
  const routerConfig = resolveRouterConfig(root);
  const { routes } = await scanRoutes({ ...routerConfig, disableTypes: true }, root);
  const configFile = await writeInitialConfig(root, detectSections(routes));

  console.log(`Created ${CONFIG_FILE_NAME} at ${configFile}. Review the sections it detected.`);
}

async function write(root: string): Promise<void> {
  const { config, createdFile } = await ensureConfig(root);

  if (config === undefined) {
    throw new ConfigError(`Could not load ${CONFIG_FILE_NAME} in ${root}.`);
  }

  if (createdFile !== undefined) {
    console.log(`Created ${CONFIG_FILE_NAME} at ${createdFile}. Review the sections it detected.`);
  }

  await generateFullTree({ root, config });

  const result = await generateScopedTrees({ root, config, mode: "write" });

  console.log(
    `Generated ${result.sections.length} scoped tree(s): ${result.sections.join(", ")} (${result.changed.length} file(s) changed).`,
  );
}

async function collectProblems(root: string): Promise<string[]> {
  const config = await loadConfig(root);

  if (config === undefined) {
    throw new ConfigError(
      `No ${CONFIG_FILE_NAME} found in ${root}. Run "${CLI_NAME} init" to create one.`,
    );
  }

  const problems: string[] = [];

  if (await isFullTreeStale({ root, config })) {
    const fullTree = appRouterConfig(root, config).generatedRouteTree;

    problems.push(`The full route tree is out of date: ${path.relative(root, fullTree)}`);
  }

  try {
    const result = await generateScopedTrees({ root, config, mode: "check" });

    for (const name of result.changed) {
      problems.push(`Scoped tree is out of date: ${name}`);
    }

    for (const name of result.stale) {
      problems.push(`Scoped tree has no section any more: ${name}`);
    }
  } catch (error) {
    if (!(error instanceof UncoveredRoutesError)) {
      throw error;
    }

    problems.push(error.message);

    return problems;
  }

  const differences = await findParityDifferences(config);

  if (differences.length > 0) {
    problems.push(formatParityDifferences(differences));
  }

  return problems;
}

async function check(root: string): Promise<void> {
  const problems = await collectProblems(root);

  if (problems.length === 0) {
    console.log("Scoped route trees are up to date.");

    return;
  }

  console.error([...problems, FIX_HINT].join("\n"));
  process.exitCode = 1;
}

async function generate(options: CommandOptions): Promise<void> {
  const root = resolveRoot(options);

  if (options.check === true) {
    await check(root);

    return;
  }

  await write(root);
}

function guarded<Args extends unknown[]>(action: (...args: Args) => Promise<void>) {
  return async (...args: Args): Promise<void> => {
    try {
      await action(...args);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  };
}

const cli = cac(CLI_NAME);

cli
  .command("init", "Write the initial scoped-route-trees config from the detected sections")
  .option("--root <dir>", "Project root", { default: process.cwd() })
  .action(guarded(init));

cli
  .command("generate", "Generate the full route tree and one scoped tree per section")
  .option("--root <dir>", "Project root", { default: process.cwd() })
  .option("--check", "Exit 1 when anything is stale, uncovered or out of parity, without writing")
  .action(guarded(generate));

cli.help();

try {
  cli.parse();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
