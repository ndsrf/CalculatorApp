import { join } from 'node:path';
import { traceTranslation } from '../observability/tracer.ts';
import { type TranslationResult, translateQuestion } from './expression-translator.ts';
import { createModelClientFromEnv, type ModelClient } from './model-clients.ts';
import { loadVersionedPrompt, type VersionedPrompt } from './prompt.ts';

const EXPRESSION_TRANSLATOR_PROMPT = join('prompts', 'expression-translator.md');

export interface TranslateService {
  readonly prompt: VersionedPrompt;
  readonly client: ModelClient;
  translate(question: string): Promise<TranslationResult & { traceId?: string }>;
}

export interface TranslateServiceOptions {
  repoRoot: string;
  env?: NodeJS.ProcessEnv;
  traced?: boolean;
}

export function createTranslateService(options: TranslateServiceOptions): TranslateService {
  const prompt = loadVersionedPrompt(join(options.repoRoot, EXPRESSION_TRANSLATOR_PROMPT));
  const client = createModelClientFromEnv(options.env ?? process.env, prompt.tier);
  const run = (question: string) =>
    translateQuestion(question, client, { systemPrompt: prompt.body, limits: prompt.limits });

  return {
    prompt,
    client,
    translate: options.traced
      ? (question) =>
          traceTranslation(
            {
              question,
              promptId: prompt.id,
              promptVersion: prompt.version,
              promptSha: prompt.sha,
              system: client.system,
              model: client.model,
            },
            () => run(question),
          )
      : run,
  };
}
