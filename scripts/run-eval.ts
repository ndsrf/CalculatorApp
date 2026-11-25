import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createModelClientFromEnv } from '../src/ai/model-clients.ts';
import { loadVersionedPrompt } from '../src/ai/prompt.ts';
import { loadDotEnvIfPresent } from './env.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const CONFIG_PATH = join(REPO_ROOT, 'evals', 'promptfooconfig.yaml');
const PROMPT_PATH = join(REPO_ROOT, 'prompts', 'expression-translator.md');

function main(): void {
  loadDotEnvIfPresent();

  if (process.argv.includes('--deterministic')) {
    process.env.AI_FORCE_STUB = '1';
  }

  const prompt = loadVersionedPrompt(PROMPT_PATH);
  const modelVariable = `AI_MODEL_${prompt.tier.toUpperCase()}`;
  const hasBaseUrl = Boolean(process.env.AI_BASE_URL?.trim());
  const hasModel = Boolean(process.env[modelVariable]?.trim());

  if (process.env.AI_FORCE_STUB !== '1' && hasBaseUrl !== hasModel) {
    console.error(
      `Live evals need both AI_BASE_URL and ${modelVariable} (prompt '${prompt.id}' uses tier '${prompt.tier}'). See .env.example.`,
    );
    process.exit(1);
  }

  const client = createModelClientFromEnv(process.env, prompt.tier);
  console.log(
    client.system === 'stub'
      ? `Running DETERMINISTIC evals for ${prompt.id}@${prompt.version} against the offline stub. Set AI_BASE_URL and ${modelVariable} to evaluate a real model.`
      : `Running LIVE evals for ${prompt.id}@${prompt.version} on ${client.model} (tier '${prompt.tier}').`,
  );

  const result = spawnSync(
    'npx',
    ['promptfoo', 'eval', '-c', CONFIG_PATH, '--no-cache', '--no-write'],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, '--import tsx'].filter(Boolean).join(' '),
      },
    },
  );
  process.exit(result.status ?? 1);
}

main();
