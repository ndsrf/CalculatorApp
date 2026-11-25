import { fileURLToPath } from 'node:url';
import { applyTranslation, createInitialState } from '../../src/core/index.ts';
import { createTranslateService } from '../../src/ai/translate-service.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

// Evaluates the shipped pipeline end to end: prompt + model client + repair loop + core state machine.
export default class ExpressionTranslatorProvider {
  constructor() {
    this.service = createTranslateService({ repoRoot: REPO_ROOT });
  }

  id() {
    const { client, prompt } = this.service;
    return `${prompt.id}@${prompt.version} (${client.system}:${client.model})`;
  }

  async callApi(question) {
    const result = await this.service.translate(question);
    const outcome =
      result.status === 'translated'
        ? { status: 'translated', expression: result.expression }
        : { status: 'failed' };
    const state = applyTranslation(createInitialState(), outcome);

    return {
      output: JSON.stringify({
        status: result.status,
        expression: result.expression ?? null,
        readout: state.display,
        model_calls: result.modelCalls,
      }),
      tokenUsage: {
        prompt: result.inputTokens,
        completion: result.outputTokens,
        total: result.inputTokens + result.outputTokens,
      },
    };
  }
}
