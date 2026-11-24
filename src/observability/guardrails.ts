import type { Span } from '@opentelemetry/api';

export const OTEL_ATTRS = {
  GEN_AI_SYSTEM: 'gen_ai.system',
  GEN_AI_REQUEST_MODEL: 'gen_ai.request.model',
  GEN_AI_USAGE_INPUT_TOKENS: 'gen_ai.usage.input_tokens',
  GEN_AI_USAGE_OUTPUT_TOKENS: 'gen_ai.usage.output_tokens',
  PROMPT_SHA: 'prompt.sha',
  APP_USER_REQUEST: 'app.user_request',
  APP_AGENT_OUTPUT: 'app.agent_output',
  TOOL_ARGS: 'tool.args',
  OUTCOME_STATUS: 'outcome.status',
  OUTCOME_LEAKED_SELECTOR: 'outcome.leaked_selector',
  OUTCOME_RETRIED: 'outcome.retried',
  OUTCOME_TOOL_CALLS_COUNT: 'outcome.tool_calls_count',
  OUTCOME_CIRCUIT_BREAKER_TRIPPED: 'outcome.circuit_breaker_tripped',
  OUTCOME_CIRCUIT_BREAKER_REASON: 'outcome.circuit_breaker_reason',
} as const;

export interface LoopBudgetConfig {
  maxToolCalls?: number;
  maxTokens?: number;
}

export interface LoopStepUsage {
  toolCalls?: number;
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
  readonly maxToolCalls: number;
  readonly maxTokens: number;
  private toolCalls = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private tripped = false;
  private tripReason: string | undefined;

  constructor(config: LoopBudgetConfig = {}) {
    this.maxToolCalls = config.maxToolCalls ?? 5;
    this.maxTokens = config.maxTokens ?? 4000;
  }

  get toolCallsCount(): number {
    return this.toolCalls;
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

  applyToSpan(span: Span): void {
    span.setAttributes({
      [OTEL_ATTRS.GEN_AI_USAGE_INPUT_TOKENS]: this.inputTokens,
      [OTEL_ATTRS.GEN_AI_USAGE_OUTPUT_TOKENS]: this.outputTokens,
      [OTEL_ATTRS.OUTCOME_TOOL_CALLS_COUNT]: this.toolCalls,
      [OTEL_ATTRS.OUTCOME_CIRCUIT_BREAKER_TRIPPED]: this.tripped,
      ...(this.tripReason ? { [OTEL_ATTRS.OUTCOME_CIRCUIT_BREAKER_REASON]: this.tripReason } : {}),
    });
  }

  recordStep(usage: LoopStepUsage, span?: Span): void {
    this.toolCalls += usage.toolCalls ?? 0;
    this.inputTokens += usage.inputTokens ?? 0;
    this.outputTokens += usage.outputTokens ?? 0;

    if (this.toolCalls > this.maxToolCalls) {
      this.trip(
        `tool calls (${this.toolCalls}) exceeded maxToolCalls (${this.maxToolCalls})`,
        span,
      );
    }

    if (this.totalTokens > this.maxTokens) {
      this.trip(`token usage (${this.totalTokens}) exceeded maxTokens (${this.maxTokens})`, span);
    }

    if (span) {
      this.applyToSpan(span);
    }
  }

  private trip(reason: string, span?: Span): never {
    this.tripped = true;
    this.tripReason = reason;
    if (span) {
      this.applyToSpan(span);
      span.setAttribute(OTEL_ATTRS.OUTCOME_STATUS, 'error');
    }
    throw new CircuitBreakerError(reason);
  }
}
