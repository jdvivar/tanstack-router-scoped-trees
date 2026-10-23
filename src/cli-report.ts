import path from "node:path";
import { formatParityDifferences, type ParityDifference } from "./parity.js";

export const CLI_NAME = "tanstack-router-scoped-trees";
export const ISSUES_URL = "https://github.com/jdvivar/tanstack-router-scoped-trees/issues";

export type CheckFindings = {
  root: string;
  configFile: string;
  outputDirectory: string;
  fullTree?: string;
  changed: string[];
  stale: string[];
  uncoveredMessage?: string;
  parity: ParityDifference[];
};

function sectionNames(fileNames: string[]): string[] {
  return [...new Set(fileNames.map((name) => name.replace(/\.gen\.(js|d\.ts)$/, "")))];
}

function staleLines(findings: CheckFindings): string[] {
  const lines: string[] = [];
  const outputDirectory = path.relative(findings.root, findings.outputDirectory);

  if (findings.fullTree !== undefined) {
    lines.push(`The full route tree is out of date: ${findings.fullTree}`);
  }

  if (findings.changed.length > 0) {
    lines.push(`Scoped trees out of date in ${outputDirectory}:`);
    lines.push(...sectionNames(findings.changed).map((name) => `  ${name}`));
  }

  if (findings.stale.length > 0) {
    lines.push(`Scoped trees in ${outputDirectory} that match no section any more:`);
    lines.push(...sectionNames(findings.stale).map((name) => `  ${name}`));
  }

  return lines;
}

function parityHint(parity: ParityDifference[]): string {
  const sections = [...new Set(parity.map((difference) => difference.section))]
    .filter((name) => name !== "")
    .sort();

  return `Regenerating will not fix the parity differences above (section: ${sections.join(", ")}). The scoped tree differs from what TanStack generates for the same files. Please report it at ${ISSUES_URL}`;
}

export function hasFindings(findings: CheckFindings): boolean {
  return (
    findings.fullTree !== undefined ||
    findings.changed.length > 0 ||
    findings.stale.length > 0 ||
    findings.uncoveredMessage !== undefined ||
    findings.parity.length > 0
  );
}

export function formatCheckReport(findings: CheckFindings): string {
  const stale = staleLines(findings);
  const blocks: string[] = [];

  if (findings.uncoveredMessage !== undefined) {
    blocks.push(findings.uncoveredMessage);
  }

  blocks.push(...stale);

  if (findings.parity.length > 0) {
    blocks.push(formatParityDifferences(findings.parity));
  }

  if (findings.uncoveredMessage !== undefined) {
    blocks.push(
      `Add the lines above to ${findings.configFile}, then run: npx ${CLI_NAME} generate`,
    );
  } else if (stale.length > 0) {
    blocks.push(`Run: npx ${CLI_NAME} generate`);
  }

  if (findings.parity.length > 0) {
    blocks.push(parityHint(findings.parity));
  }

  return blocks.join("\n");
}
