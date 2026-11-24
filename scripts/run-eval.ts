import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { loadDotEnvIfPresent } from './env.ts';

interface PromptfooAssertion {
  type: string;
  value?: string;
}

interface PromptfooPromptConfig {
  id?: string;
  label?: string;
  raw: string;
}

interface PromptfooProviderConfig {
  id: string;
  label?: string;
  prompts?: string[];
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
  prompts?: Array<string | PromptfooPromptConfig>;
  providers?: Array<string | PromptfooProviderConfig>;
  defaultTest?: {
    options?: Record<string, unknown>;
    assert?: PromptfooAssertion[];
  };
  tests?: string | PromptfooTestCase[];
}

interface ModelRoute {
  name: string;
  providerFilter: string;
  metadataFilter: string;
}

const REPO_ROOT = resolve(import.meta.dirname, '..');
const EVALS_DIR = join(REPO_ROOT, 'evals');
const FULL_CONFIG_PATH = join(EVALS_DIR, 'promptfooconfig.yaml');
const GOLDEN_DATASET_PATH = join(EVALS_DIR, 'golden-dataset.yaml');
const GENERATED_DIR = join(REPO_ROOT, '.promptfoo');
const GENERATED_CONFIG_PATH = join(GENERATED_DIR, 'deterministic.config.json');
const GENERATED_LIVE_CONFIG_PATH = join(GENERATED_DIR, 'live.config.json');
const STUB_PROVIDER_PATH = 'file://../evals/providers/deterministic-stub.mjs';

const MODEL_ROUTES: readonly ModelRoute[] = [
  {
    name: 'frontier-verifier (calc-tester-agent)',
    providerFilter: '^frontier-verifier$',
    metadataFilter: 'route=calc-tester',
  },
  {
    name: 'lightweight-doc-compiler (doc-generator-agent)',
    providerFilter: '^lightweight-doc-compiler$',
    metadataFilter: 'route=doc-generator',
  },
];

function hasValidOpenAiKey(): boolean {
  const key = process.env.OPENAI_API_KEY?.trim();
  return Boolean(key && key !== 'sk-your-openai-api-key-here');
}

function normalizeRouteMetadata(tests: PromptfooTestCase[]): PromptfooTestCase[] {
  // Harvested trace regressions omit metadata.route; default them to calc-tester so --filter-metadata includes them.
  return tests.map((testCase) => ({
    ...testCase,
    metadata: {
      route: 'calc-tester',
      ...testCase.metadata,
    },
  }));
}

function runPromptfooRoute(configPath: string, route: ModelRoute): number {
  console.log(`\n==> Running route: ${route.name}`);
  const result = spawnSync(
    'npx',
    [
      'promptfoo',
      'eval',
      '-c',
      configPath,
      '--filter-providers',
      route.providerFilter,
      '--filter-metadata',
      route.metadataFilter,
      '--no-cache',
      '--no-write',
    ],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    },
  );
  return result.status ?? 1;
}

function runAllRoutes(configPath: string): number {
  for (const route of MODEL_ROUTES) {
    const status = runPromptfooRoute(configPath, route);
    if (status !== 0) {
      return status;
    }
  }
  return 0;
}

function main(): void {
  loadDotEnvIfPresent();

  const baseConfig = parseYaml(readFileSync(FULL_CONFIG_PATH, 'utf-8')) as PromptfooConfig;
  const rawTests = parseYaml(readFileSync(GOLDEN_DATASET_PATH, 'utf-8')) as PromptfooTestCase[];
  const normalizedTests = normalizeRouteMetadata(rawTests);

  const forceDeterministic = process.argv.includes('--deterministic');
  if (!forceDeterministic && hasValidOpenAiKey()) {
    console.log('Running full Promptfoo eval suite (deterministic assertions + llm-rubric)...');
    const hasUnroutedTest = rawTests.some((testCase) => !testCase.metadata?.route);
    if (!hasUnroutedTest) {
      process.exit(runAllRoutes(FULL_CONFIG_PATH));
    }

    mkdirSync(GENERATED_DIR, { recursive: true });
    writeFileSync(
      GENERATED_LIVE_CONFIG_PATH,
      JSON.stringify({ ...baseConfig, tests: normalizedTests }, null, 2),
      'utf-8',
    );
    process.exit(runAllRoutes(GENERATED_LIVE_CONFIG_PATH));
  }

  console.log(
    'OPENAI_API_KEY not set (or --deterministic specified): running deterministic Promptfoo assertions offline (skipping llm-rubric; see .env.example to enable llm-rubric).',
  );

  const deterministicProviders: PromptfooProviderConfig[] = (baseConfig.providers ?? []).map(
    (provider) => {
      if (typeof provider === 'string') {
        return { id: STUB_PROVIDER_PATH };
      }
      return {
        id: STUB_PROVIDER_PATH,
        label: provider.label,
        prompts: provider.prompts,
      };
    },
  );

  const deterministicTests = normalizedTests.map((testCase) => ({
    ...testCase,
    assert: (testCase.assert ?? []).filter((assertion) => assertion.type !== 'llm-rubric'),
  }));

  const deterministicConfig: PromptfooConfig = {
    description: `${baseConfig.description ?? 'Calculator Evals'} (deterministic mode)`,
    prompts: baseConfig.prompts,
    providers: deterministicProviders,
    defaultTest: {
      assert: (baseConfig.defaultTest?.assert ?? []).filter(
        (assertion) => assertion.type !== 'llm-rubric',
      ),
    },
    tests: deterministicTests,
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(GENERATED_CONFIG_PATH, JSON.stringify(deterministicConfig, null, 2), 'utf-8');

  process.exit(runAllRoutes(GENERATED_CONFIG_PATH));
}

main();
