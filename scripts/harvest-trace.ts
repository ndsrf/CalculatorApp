import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dump as dumpYaml } from 'js-yaml';
import {
  LEAKED_SELECTOR_PATTERNS,
  OTEL_ATTRS,
  type SerializedSpanRecord,
} from '../src/observability/tracer.ts';

interface CliOptions {
  traceId: string;
  filePath: string;
  dryRun: boolean;
}

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_TRACE_FILE = join(REPO_ROOT, 'traces', 'runs.jsonl');
const GOLDEN_DATASET_PATH = join(REPO_ROOT, 'evals', 'golden-dataset.yaml');

function readFlagValue(
  argv: string[],
  index: number,
  flag: string,
): { value: string; nextIndex: number } {
  const arg = argv[index];
  if (arg === flag) {
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`);
    }
    return { value: next, nextIndex: index + 1 };
  }
  const value = arg.slice(flag.length + 1);
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return { value, nextIndex: index };
}

function parseArgs(argv: string[]): CliOptions {
  let traceId = '';
  let filePath = DEFAULT_TRACE_FILE;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--trace-id' || arg.startsWith('--trace-id=')) {
      const parsed = readFlagValue(argv, i, '--trace-id');
      traceId = parsed.value;
      i = parsed.nextIndex;
    } else if (arg === '--file' || arg.startsWith('--file=')) {
      const parsed = readFlagValue(argv, i, '--file');
      filePath = resolve(REPO_ROOT, parsed.value);
      i = parsed.nextIndex;
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  if (!traceId) {
    throw new Error(
      'Usage: tsx scripts/harvest-trace.ts --trace-id <id> [--file traces/runs.jsonl] [--dry-run]',
    );
  }

  return { traceId, filePath, dryRun };
}

function findSpanByTraceId(filePath: string, traceId: string): SerializedSpanRecord {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const record = JSON.parse(line) as SerializedSpanRecord;
    if (record.traceId === traceId) {
      return record;
    }
  }

  throw new Error(`No span found with traceId '${traceId}' in ${filePath}`);
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegressionCaseYaml(span: SerializedSpanRecord): string {
  const attrs = span.attributes;
  const userRequest = String(
    attrs[OTEL_ATTRS.APP_USER_REQUEST] ?? 'Verify calculator flow captured from production trace.',
  );
  const toolArgs = String(attrs[OTEL_ATTRS.TOOL_ARGS] ?? 'press ac --snapshot');
  const promptSha = String(attrs[OTEL_ATTRS.PROMPT_SHA] ?? 'unknown');
  const leakedSelector = Boolean(attrs[OTEL_ATTRS.OUTCOME_LEAKED_SELECTOR]);
  const circuitBreakerTripped = Boolean(attrs[OTEL_ATTRS.OUTCOME_CIRCUIT_BREAKER_TRIPPED]);
  const outcomeStatus = String(attrs[OTEL_ATTRS.OUTCOME_STATUS] ?? 'error');

  const reasons: string[] = [];
  if (leakedSelector) {
    reasons.push('leaked_selector');
  }
  if (circuitBreakerTripped) {
    reasons.push('circuit_breaker_tripped');
  }
  if (outcomeStatus === 'error' && reasons.length === 0) {
    reasons.push('outcome.status=error');
  }
  const failureReason = reasons.join(', ') || 'trace-regression';

  const assertions: Array<{ type: string; value: string }> = [
    {
      type: 'regex',
      value: `Tool Call:\\s*calc-verify ${escapeRegexLiteral(toolArgs)}`,
    },
  ];

  if (leakedSelector) {
    for (const pattern of LEAKED_SELECTOR_PATTERNS) {
      assertions.push({
        type: 'not-contains',
        value: pattern,
      });
    }
  }

  assertions.push({
    type: 'llm-rubric',
    value: `Addresses the user scenario in plain language for @persona:casual-user without repeating the harvested failure (${failureReason}).`,
  });

  const yamlBody = dumpYaml(
    [
      {
        description: `Regression (${span.traceId}): ${failureReason}`,
        vars: {
          scenario: userRequest,
          observed_behavior: `Harvested failing trace (${failureReason}) for calc-verify ${toolArgs}.`,
        },
        assert: assertions,
      },
    ],
    { lineWidth: -1, noRefs: true },
  );

  return [
    '',
    `# Harvested regression from traceId=${span.traceId} (prompt.sha=${promptSha}, reason=${failureReason})`,
    yamlBody.trimEnd(),
    '',
  ].join('\n');
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const span = findSpanByTraceId(options.filePath, options.traceId);
  const yamlBlock = buildRegressionCaseYaml(span);

  if (options.dryRun) {
    console.log('--- DRY RUN: regression test case to append to evals/golden-dataset.yaml ---');
    console.log(yamlBlock);
    return;
  }

  const existing = readFileSync(GOLDEN_DATASET_PATH, 'utf-8');
  const alreadyHarvested =
    existing.includes(`traceId=${span.traceId}`) ||
    existing.includes(`Regression (${span.traceId})`);
  if (alreadyHarvested) {
    console.log(
      `Trace '${span.traceId}' already exists in evals/golden-dataset.yaml; skipping duplicate entry (idempotent no-op).`,
    );
    process.exit(0);
  }

  const normalizedExisting = existing.endsWith('\n') ? existing : `${existing}\n`;
  writeFileSync(GOLDEN_DATASET_PATH, `${normalizedExisting}${yamlBlock}`, 'utf-8');
  console.log(
    `Appended regression test case for traceId='${span.traceId}' (prompt.sha=${String(span.attributes[OTEL_ATTRS.PROMPT_SHA] ?? 'unknown')}) to evals/golden-dataset.yaml.`,
  );
}

main();
