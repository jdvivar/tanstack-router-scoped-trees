#!/usr/bin/env node
import path from "node:path";
import { cac } from "cac";
import { CONFIG_FILE_NAME, ConfigError, loadConfig } from "./config.js";
import { CLI_NAME, formatCheckReport, hasFindings, type CheckFindings } from "./cli-report.js";
import { ensureConfig, writeDetectedConfig } from "./ensure-config.js";
import {
  appRouterConfig,
  generateFullTree,
  generateScopedTrees,
  isFullTreeStale,
  UncoveredRoutesError,
} from "./generate.js";
import { assertSingleGenerator } from "./generator-versions.js";
import { findParityDifferences } from "./parity.js";

type CommandOptions = { root?: string; check?: boolean };

function resolveRoot(options: CommandOptions): string {
  return path.resolve(options.root ?? process.cwd());
}

async function init(options: CommandOptions): Promise<void> {
  const root = resolveRoot(options);

  assertSingleGenerator(root);

  const configFile = await writeDetectedConfig(root);

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

async function collectFindings(root: string): Promise<CheckFindings> {
  const config = await loadConfig(root);

  if (config === undefined) {
    throw new ConfigError(
      `No ${CONFIG_FILE_NAME} found in ${root}. Run "npx ${CLI_NAME} init" to create one.`,
    );
  }

  const findings: CheckFindings = {
    root,
    configFile: config.configFile,
    outputDirectory: path.resolve(root, config.outputDirectory),
    changed: [],
    stale: [],
    parity: [],
  };

  if (await isFullTreeStale({ root, config })) {
    findings.fullTree = path.relative(root, appRouterConfig(root, config).generatedRouteTree);
  }

  try {
    const result = await generateScopedTrees({ root, config, mode: "check" });

    findings.changed = result.changed;
    findings.stale = result.stale;
  } catch (error) {
    if (!(error instanceof UncoveredRoutesError)) {
      throw error;
    }

    findings.uncoveredMessage = error.message;

    return findings;
  }

  findings.parity = await findParityDifferences(config);

  return findings;
}

async function check(root: string): Promise<void> {
  const findings = await collectFindings(root);

  if (!hasFindings(findings)) {
    console.log("Scoped route trees are up to date.");

    return;
  }

  console.error(formatCheckReport(findings));
  process.exitCode = 1;
}

async function generate(options: CommandOptions): Promise<void> {
  const root = resolveRoot(options);

  assertSingleGenerator(root);

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
  .option("--root <dir>", "Project root (default: current directory)")
  .action(guarded(init));

cli
  .command("generate", "Generate the full route tree and one scoped tree per section")
  .option("--root <dir>", "Project root (default: current directory)")
  .option("--check", "Exit 1 when anything is stale, uncovered or out of parity, without writing")
  .action(guarded(generate));

cli.help();

async function main(): Promise<void> {
  cli.parse(process.argv, { run: false });

  if (cli.options.help === true) {
    return;
  }

  if (cli.matchedCommand === undefined) {
    const [unknown] = cli.args;

    if (unknown !== undefined) {
      console.error(`Unknown command "${unknown}".\n`);
    }

    cli.outputHelp();
    process.exitCode = 1;

    return;
  }

  await cli.runMatchedCommand();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
