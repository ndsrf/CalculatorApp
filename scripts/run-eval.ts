import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { loadDotEnvIfPresent } from './env.ts';

interface PromptfooAssertion {
  type: string;
  value?: string;
}

interface PromptfooPromptConfig {
  id: string;
  label: string;
  raw: string;
}

interface PromptfooProviderConfig {
  id: string;
  label: string;
  prompts: string[];
  config?: Record<string, unknown>;
}

interface PromptfooTestCase {
  description?: string;
  metadata?: Record<string, string>;
  threshold?: number;
  vars?: Record<string, string>;
  assert?: PromptfooAssertion[];
}

interface PromptfooConfig {
  description?: string;
  prompts: PromptfooPromptConfig[];
  providers?: PromptfooProviderConfig[];
  defaultTest?: {
    options?: Record<string, unknown>;
    assert?: PromptfooAssertion[];
  };
  tests?: string | PromptfooTestCase[];
}

interface PromptFrontmatter {
  id?: string;
  version?: string;
  model_routing?: { tier?: string };
}

interface RoutedPrompt {
  route: string;
  label: string;
  tier: string;
  version: string;
  body: string;
}

const REPO_ROOT = resolve(import.meta.dirname, '..');
const EVALS_DIR = join(REPO_ROOT, 'evals');
const BASE_CONFIG_PATH = join(EVALS_DIR, 'promptfooconfig.yaml');
const GOLDEN_DATASET_PATH = join(EVALS_DIR, 'golden-dataset.yaml');
const GENERATED_DIR = join(REPO_ROOT, '.promptfoo');
const GENERATED_CONFIG_PATH = join(GENERATED_DIR, 'eval.config.json');
const STUB_PROVIDER_ID = 'file://../evals/providers/deterministic-stub.mjs';
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const DEFAULT_ROUTE = 'calc-tester';

const TIER_DEFAULTS: Record<string, { temperature: number; max_tokens: number }> = {
  frontier: { temperature: 0, max_tokens: 400 },
  lightweight: { temperature: 0, max_tokens: 600 },
};

function envProviderFor(tier: string): string | undefined {
  const value = process.env[`EVAL_PROVIDER_${tier.toUpperCase()}`]?.trim();
  return value ? value : undefined;
}

function loadRoutedPrompt(prompt: PromptfooPromptConfig): RoutedPrompt {
  const promptPath = resolve(EVALS_DIR, prompt.raw.replace(/^file:\/\//, ''));
  const content = readFileSync(promptPath, 'utf-8');
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error(`${promptPath} is missing YAML frontmatter with model_routing.tier`);
  }
  const frontmatter = (parseYaml(match[1]) ?? {}) as PromptFrontmatter;
  const tier = frontmatter.model_routing?.tier;
  if (!tier) {
    throw new Error(`${promptPath} frontmatter must declare model_routing.tier`);
  }
  return {
    route: prompt.id,
    label: prompt.label,
    tier,
    version: frontmatter.version ?? 'unversioned',
    body: content.slice(match[0].length).trimStart(),
  };
}

function withDefaultRoute(tests: PromptfooTestCase[]): PromptfooTestCase[] {
  // Harvested trace regressions omit metadata.route; default them so --filter-metadata includes them.
  return tests.map((testCase) => ({
    ...testCase,
    metadata: { route: DEFAULT_ROUTE, ...testCase.metadata },
  }));
}

function withoutRubrics(assertions: PromptfooAssertion[] = []): PromptfooAssertion[] {
  return assertions.filter((assertion) => assertion.type !== 'llm-rubric');
}

function runRoute(prompt: RoutedPrompt, providerLabel: string): number {
  console.log(
    `\n==> Route '${prompt.route}' (${prompt.label}@${prompt.version}) on tier '${prompt.tier}'`,
  );
  const result = spawnSync(
    'npx',
    [
      'promptfoo',
      'eval',
      '-c',
      GENERATED_CONFIG_PATH,
      '--filter-providers',
      `^${providerLabel}$`,
      '--filter-metadata',
      `route=${prompt.route}`,
      '--no-cache',
      '--no-write',
    ],
    { cwd: REPO_ROOT, stdio: 'inherit', env: process.env },
  );
  return result.status ?? 1;
}

function main(): void {
  loadDotEnvIfPresent();

  const baseConfig = parseYaml(readFileSync(BASE_CONFIG_PATH, 'utf-8')) as PromptfooConfig;
  const tests = withDefaultRoute(
    parseYaml(readFileSync(GOLDEN_DATASET_PATH, 'utf-8')) as PromptfooTestCase[],
  );
  const prompts = baseConfig.prompts.map(loadRoutedPrompt);

  const forceDeterministic = process.argv.includes('--deterministic');
  const tiers = [...new Set(prompts.map((p) => p.tier))];
  const unresolvedTiers = tiers.filter((tier) => !envProviderFor(tier));
  const live = !forceDeterministic && unresolvedTiers.length === 0;

  if (!forceDeterministic && !live && unresolvedTiers.length < tiers.length) {
    console.error(
      `Live eval needs a provider for every tier. Missing: ${unresolvedTiers
        .map((tier) => `EVAL_PROVIDER_${tier.toUpperCase()}`)
        .join(', ')} (see .env.example).`,
    );
    process.exit(1);
  }

  const judge = process.env.EVAL_PROVIDER_JUDGE?.trim() || envProviderFor('frontier');
  const providerLabelFor = (prompt: RoutedPrompt) => `${prompt.route}@${prompt.tier}`;

  const providers: PromptfooProviderConfig[] = prompts.map((prompt) => ({
    id: live ? envProviderFor(prompt.tier)! : STUB_PROVIDER_ID,
    label: providerLabelFor(prompt),
    prompts: [prompt.label],
    ...(live ? { config: TIER_DEFAULTS[prompt.tier] ?? { temperature: 0 } } : {}),
  }));

  const generated: PromptfooConfig = {
    description: `${baseConfig.description ?? 'Evals'} (${live ? 'live' : 'deterministic'} mode)`,
    prompts: prompts.map((prompt) => ({ id: prompt.route, label: prompt.label, raw: prompt.body })),
    providers,
    defaultTest: {
      ...(live && judge ? { options: { provider: judge } } : {}),
      assert: live
        ? (baseConfig.defaultTest?.assert ?? [])
        : withoutRubrics(baseConfig.defaultTest?.assert),
    },
    tests: live
      ? tests
      : tests.map((testCase) => ({ ...testCase, assert: withoutRubrics(testCase.assert) })),
  };

  if (live) {
    console.log(
      `Running LIVE evals: ${providers.map((p) => `${p.label} -> ${p.id}`).join(', ')}; llm-rubric judge -> ${judge}`,
    );
  } else {
    console.log(
      'Running DETERMINISTIC evals offline against evals/providers/deterministic-stub.mjs (llm-rubric skipped). Set EVAL_PROVIDER_FRONTIER and EVAL_PROVIDER_LIGHTWEIGHT to run against real models (see .env.example).',
    );
  }

  mkdirSync(dirname(GENERATED_CONFIG_PATH), { recursive: true });
  writeFileSync(GENERATED_CONFIG_PATH, JSON.stringify(generated, null, 2), 'utf-8');

  for (const prompt of prompts) {
    const status = runRoute(prompt, providerLabelFor(prompt));
    if (status !== 0) {
      process.exit(status);
    }
  }
}

main();
