import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load as parseYaml } from 'js-yaml';

interface PromptfooAssertion {
  type: string;
  value?: string;
}

interface PromptfooTestCase {
  description?: string;
  vars?: Record<string, string>;
  assert?: PromptfooAssertion[];
}

interface PromptfooConfig {
  description?: string;
  prompts?: string[];
  providers?: unknown[];
  defaultTest?: {
    assert?: PromptfooAssertion[];
  };
  tests?: string | PromptfooTestCase[];
}

const REPO_ROOT = resolve(import.meta.dirname, '..');
const EVALS_DIR = join(REPO_ROOT, 'evals');
const FULL_CONFIG_PATH = join(EVALS_DIR, 'promptfooconfig.yaml');
const GOLDEN_DATASET_PATH = join(EVALS_DIR, 'golden-dataset.yaml');
const ENV_PATH = join(REPO_ROOT, '.env');
const GENERATED_DIR = join(REPO_ROOT, '.promptfoo');
const GENERATED_CONFIG_PATH = join(GENERATED_DIR, 'deterministic.config.json');

function loadDotEnvIfPresent(): void {
  if (!existsSync(ENV_PATH)) {
    return;
  }
  const content = readFileSync(ENV_PATH, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    const value = line
      .slice(eqIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function hasValidOpenAiKey(): boolean {
  const key = process.env.OPENAI_API_KEY?.trim();
  return Boolean(key && key !== 'sk-your-openai-api-key-here');
}

function runPromptfoo(configPath: string): number {
  const result = spawnSync(
    'npx',
    ['promptfoo', 'eval', '-c', configPath, '--no-cache', '--no-write'],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    },
  );
  return result.status ?? 1;
}

function main(): void {
  loadDotEnvIfPresent();

  const forceDeterministic = process.argv.includes('--deterministic');
  if (!forceDeterministic && hasValidOpenAiKey()) {
    console.log('Running full Promptfoo eval suite (deterministic assertions + llm-rubric)...');
    process.exit(runPromptfoo(FULL_CONFIG_PATH));
  }

  console.log(
    'OPENAI_API_KEY not set (or --deterministic specified): running deterministic Promptfoo assertions offline (skipping llm-rubric; see .env.example to enable llm-rubric).',
  );

  const baseConfig = parseYaml(readFileSync(FULL_CONFIG_PATH, 'utf-8')) as PromptfooConfig;
  const rawTests = parseYaml(readFileSync(GOLDEN_DATASET_PATH, 'utf-8')) as PromptfooTestCase[];

  const deterministicTests = rawTests.map((testCase) => ({
    ...testCase,
    assert: (testCase.assert ?? []).filter((assertion) => assertion.type !== 'llm-rubric'),
  }));

  const deterministicConfig: PromptfooConfig = {
    description: `${baseConfig.description ?? 'Calculator Evals'} (deterministic mode)`,
    prompts: ['file://../prompts/calc-tester-agent.md'],
    providers: ['file://../evals/providers/deterministic-stub.mjs'],
    defaultTest: {
      assert: (baseConfig.defaultTest?.assert ?? []).filter(
        (assertion) => assertion.type !== 'llm-rubric',
      ),
    },
    tests: deterministicTests,
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(GENERATED_CONFIG_PATH, JSON.stringify(deterministicConfig, null, 2), 'utf-8');

  process.exit(runPromptfoo(GENERATED_CONFIG_PATH));
}

main();
