import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dump as dumpYaml, load as parseYaml } from 'js-yaml';
import { OTEL_ATTRS, type SerializedSpanRecord } from '../src/observability/tracer.ts';

interface CliOptions {
  traceId?: string;
  filePath: string;
  dryRun: boolean;
  list: boolean;
}

interface GoldenCase {
  vars?: { question?: string };
}

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_TRACE_FILE = join(REPO_ROOT, 'traces', 'runs.jsonl');
const GOLDEN_DATASET_PATH = join(REPO_ROOT, 'evals', 'golden-dataset.yaml');
const USAGE =
  'Usage: npm run harvest:trace -- (--list | --trace-id <id> [--dry-run]) [--file traces/runs.jsonl]';

function readFlagValue(argv: string[], index: number, flag: string) {
  const arg = argv[index];
  const value = arg === flag ? argv[index + 1] : arg.slice(flag.length + 1);
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return { value, nextIndex: arg === flag ? index + 1 : index };
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { filePath: DEFAULT_TRACE_FILE, dryRun: false, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--trace-id' || arg.startsWith('--trace-id=')) {
      const parsed = readFlagValue(argv, i, '--trace-id');
      options.traceId = parsed.value;
      i = parsed.nextIndex;
    } else if (arg === '--file' || arg.startsWith('--file=')) {
      const parsed = readFlagValue(argv, i, '--file');
      options.filePath = resolve(REPO_ROOT, parsed.value);
      i = parsed.nextIndex;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--list') {
      options.list = true;
    }
  }
  if (!options.list && !options.traceId) {
    throw new Error(USAGE);
  }
  return options;
}

function readSpans(filePath: string): SerializedSpanRecord[] {
  return readFileSync(filePath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SerializedSpanRecord);
}

function attr(span: SerializedSpanRecord, key: string): string {
  return String(span.attributes[key] ?? '');
}

function isHarvestable(span: SerializedSpanRecord): boolean {
  return (
    attr(span, OTEL_ATTRS.OUTCOME_STATUS) === 'error' ||
    span.attributes[OTEL_ATTRS.OUTCOME_RETRIED] === true
  );
}

function normalizeQuestion(question: string): string {
  return question.toLowerCase().replace(/\s+/g, ' ').trim();
}

function listHarvestable(spans: SerializedSpanRecord[]): void {
  const rows = spans.filter(isHarvestable).map((span) => ({
    traceId: span.traceId,
    status: attr(span, OTEL_ATTRS.OUTCOME_TRANSLATION_STATUS),
    modelCalls: span.attributes[OTEL_ATTRS.OUTCOME_MODEL_CALLS_COUNT],
    model: attr(span, OTEL_ATTRS.GEN_AI_REQUEST_MODEL),
    question: attr(span, OTEL_ATTRS.APP_QUESTION),
  }));
  if (rows.length === 0) {
    console.log('No failed or retried translations found.');
    return;
  }
  console.table(rows);
  console.log('\nHarvest one with: npm run harvest:trace -- --trace-id <traceId>');
}

function buildRegressionCase(span: SerializedSpanRecord): string {
  const question = attr(span, OTEL_ATTRS.APP_QUESTION);
  const status = attr(span, OTEL_ATTRS.OUTCOME_TRANSLATION_STATUS);
  const provenance = [
    `traceId=${span.traceId}`,
    `prompt=${attr(span, OTEL_ATTRS.PROMPT_ID)}@${attr(span, OTEL_ATTRS.PROMPT_VERSION)}`,
    `prompt.sha=${attr(span, OTEL_ATTRS.PROMPT_SHA).slice(0, 12)}`,
    `model=${attr(span, OTEL_ATTRS.GEN_AI_REQUEST_MODEL)}`,
    `status=${status}`,
  ].join(' ');

  const yamlBody = dumpYaml(
    [
      {
        description: `Regression (${span.traceId}): ${status}`,
        metadata: { tag: 'regression', trace_id: span.traceId },
        vars: { question, expect: 'translated' },
      },
    ],
    { lineWidth: -1, noRefs: true },
  );

  return [
    '',
    `# Harvested from ${provenance}`,
    '# TODO(human): confirm `expect` and add `expected_readout` before merging.',
    yamlBody.trimEnd(),
    '',
  ].join('\n');
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const spans = readSpans(options.filePath);

  if (options.list) {
    listHarvestable(spans);
    return;
  }

  const span = spans.find((candidate) => candidate.traceId === options.traceId);
  if (!span) {
    throw new Error(`No span found with traceId '${options.traceId}' in ${options.filePath}`);
  }

  const existing = readFileSync(GOLDEN_DATASET_PATH, 'utf-8');
  const question = normalizeQuestion(attr(span, OTEL_ATTRS.APP_QUESTION));
  const cases = (parseYaml(existing) ?? []) as GoldenCase[];
  const duplicate =
    existing.includes(`traceId=${span.traceId} `) ||
    cases.some((testCase) => normalizeQuestion(testCase.vars?.question ?? '') === question);

  if (duplicate) {
    console.log(
      `${options.dryRun ? '[DRY RUN] ' : ''}Question from trace '${span.traceId}' is already covered by evals/golden-dataset.yaml; skipping (idempotent no-op).`,
    );
    return;
  }

  const block = buildRegressionCase(span);
  if (options.dryRun) {
    console.log('--- DRY RUN: regression case to append to evals/golden-dataset.yaml ---');
    console.log(block);
    return;
  }

  writeFileSync(
    GOLDEN_DATASET_PATH,
    `${existing.endsWith('\n') ? existing : `${existing}\n`}${block}`,
    'utf-8',
  );
  console.log(
    `Appended regression case for traceId='${span.traceId}' to evals/golden-dataset.yaml.`,
  );
}

main();
