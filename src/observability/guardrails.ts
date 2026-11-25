export const OTEL_ATTRS = {
  GEN_AI_SYSTEM: 'gen_ai.system',
  GEN_AI_REQUEST_MODEL: 'gen_ai.request.model',
  GEN_AI_USAGE_INPUT_TOKENS: 'gen_ai.usage.input_tokens',
  GEN_AI_USAGE_OUTPUT_TOKENS: 'gen_ai.usage.output_tokens',
  PROMPT_ID: 'prompt.id',
  PROMPT_VERSION: 'prompt.version',
  PROMPT_SHA: 'prompt.sha',
  APP_QUESTION: 'app.question',
  APP_EXPRESSION: 'app.expression',
  OUTCOME_STATUS: 'outcome.status',
  OUTCOME_TRANSLATION_STATUS: 'outcome.translation_status',
  OUTCOME_RETRIED: 'outcome.retried',
  OUTCOME_MODEL_CALLS_COUNT: 'outcome.model_calls_count',
  OUTCOME_CIRCUIT_BREAKER_TRIPPED: 'outcome.circuit_breaker_tripped',
  OUTCOME_CIRCUIT_BREAKER_REASON: 'outcome.circuit_breaker_reason',
} as const;

export interface LoopBudgetConfig {
  maxModelCalls?: number;
  maxTokens?: number;
}

export interface LoopStepUsage {
  modelCalls?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export class CircuitBreakerError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Loop circuit breaker tripped: ${reason}`);
    this.name = 'CircuitBreakerError';
    this.reason = reason;
  }
}

export class LoopBudget {
  readonly maxModelCalls: number;
  readonly maxTokens: number;
  private modelCalls = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private tripped = false;
  private tripReason: string | undefined;

  constructor(config: LoopBudgetConfig = {}) {
    this.maxModelCalls = config.maxModelCalls ?? 3;
    this.maxTokens = config.maxTokens ?? 1500;
  }

  get modelCallsCount(): number {
    return this.modelCalls;
  }

  get totalInputTokens(): number {
    return this.inputTokens;
  }

  get totalOutputTokens(): number {
    return this.outputTokens;
  }

  get totalTokens(): number {
    return this.inputTokens + this.outputTokens;
  }

  get isTripped(): boolean {
    return this.tripped;
  }

  get reason(): string | undefined {
    return this.tripReason;
  }

  recordStep(usage: LoopStepUsage): void {
    this.modelCalls += usage.modelCalls ?? 0;
    this.inputTokens += usage.inputTokens ?? 0;
    this.outputTokens += usage.outputTokens ?? 0;

    if (this.modelCalls > this.maxModelCalls) {
      this.trip(`model calls (${this.modelCalls}) exceeded maxModelCalls (${this.maxModelCalls})`);
    }

    if (this.totalTokens > this.maxTokens) {
      this.trip(`token usage (${this.totalTokens}) exceeded maxTokens (${this.maxTokens})`);
    }
  }

  private trip(reason: string): never {
    this.tripped = true;
    this.tripReason = reason;
    throw new CircuitBreakerError(reason);
  }
}
