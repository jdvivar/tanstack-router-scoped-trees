import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const RUNS = 5;
const VARIANTS = ["full", "scoped"] as const;

type Variant = (typeof VARIANTS)[number];
type Sample = { wallMs: number; runMs: number };
type JsonReport = {
  startTime: number;
  testResults: Array<{ endTime: number }>;
};

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

async function runOnce(variant: Variant, outputDirectory: string, run: number): Promise<Sample> {
  const outputFile = path.join(outputDirectory, `${variant}-${run}.json`);
  const started = performance.now();
  const result = spawnSync(
    "npx",
    ["vitest", "run", "--project", variant, "--reporter=json", `--outputFile=${outputFile}`],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  const wallMs = performance.now() - started;

  if (result.status !== 0) {
    throw new Error(`vitest run --project ${variant} exited with ${result.status}`);
  }

  const report = JSON.parse(await readFile(outputFile, "utf8")) as JsonReport;
  const [file] = report.testResults;

  return { wallMs, runMs: file.endTime - report.startTime };
}

async function main(): Promise<void> {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "scoped-trees-bench-"));
  const samples: Record<Variant, Sample[]> = { full: [], scoped: [] };

  try {
    for (let run = 1; run <= RUNS; run += 1) {
      for (const variant of VARIANTS) {
        samples[variant].push(await runOnce(variant, outputDirectory, run));
      }
    }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }

  console.log(`Median of ${RUNS} runs per variant`);
  console.log("variant  process wall (ms)  run start to file done (ms)");

  for (const variant of VARIANTS) {
    const wall = median(samples[variant].map((sample) => sample.wallMs));
    const run = median(samples[variant].map((sample) => sample.runMs));

    console.log(
      `${variant.padEnd(7)}  ${wall.toFixed(0).padStart(17)}  ${run.toFixed(0).padStart(27)}`,
    );
  }
}

await main();
