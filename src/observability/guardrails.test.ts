import { describe, expect, it } from 'vitest';
import { CircuitBreakerError, LoopBudget } from './guardrails.ts';
import { computePromptSha, detectLeakedSelector } from './tracer.ts';

describe('observability guardrails', () => {
  it('trips LoopBudget when maxToolCalls is exceeded', () => {
    const budget = new LoopBudget({ maxToolCalls: 2, maxTokens: 4000 });
    budget.recordStep({ toolCalls: 1, inputTokens: 100, outputTokens: 50 });
    budget.recordStep({ toolCalls: 1, inputTokens: 100, outputTokens: 50 });
    expect(budget.isTripped).toBe(false);

    expect(() => budget.recordStep({ toolCalls: 1, inputTokens: 100, outputTokens: 50 })).toThrow(
      CircuitBreakerError,
    );
    expect(budget.isTripped).toBe(true);
    expect(budget.toolCallsCount).toBe(3);
  });

  it('trips LoopBudget when maxTokens is exceeded', () => {
    const budget = new LoopBudget({ maxToolCalls: 5, maxTokens: 500 });
    budget.recordStep({ toolCalls: 1, inputTokens: 300, outputTokens: 150 });
    expect(budget.isTripped).toBe(false);

    expect(() => budget.recordStep({ toolCalls: 1, inputTokens: 100, outputTokens: 10 })).toThrow(
      CircuitBreakerError,
    );
    expect(budget.isTripped).toBe(true);
    expect(budget.totalTokens).toBe(560);
  });

  it('computes full 64-character SHA-256 digest for calc-tester-agent.md and detects leaked selectors', () => {
    expect(computePromptSha()).toMatch(/^[0-9a-f]{64}$/);
    expect(detectLeakedSelector('The Primary Readout shows 14.')).toBe(false);
    expect(detectLeakedSelector('Check #display-current for the error.')).toBe(true);
    expect(detectLeakedSelector('Buttons with data-op are disabled.')).toBe(true);
  });
});
