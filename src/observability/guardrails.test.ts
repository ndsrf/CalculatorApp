import { describe, expect, it } from 'vitest';
import { CircuitBreakerError, LoopBudget } from './guardrails.ts';

describe('LoopBudget circuit breaker', () => {
  it('trips when maxModelCalls is exceeded', () => {
    const budget = new LoopBudget({ maxModelCalls: 2, maxTokens: 4000 });
    budget.recordStep({ modelCalls: 1, inputTokens: 100, outputTokens: 50 });
    budget.recordStep({ modelCalls: 1, inputTokens: 100, outputTokens: 50 });
    expect(budget.isTripped).toBe(false);

    expect(() => budget.recordStep({ modelCalls: 1 })).toThrow(CircuitBreakerError);
    expect(budget.isTripped).toBe(true);
    expect(budget.modelCallsCount).toBe(3);
  });

  it('trips when maxTokens is exceeded', () => {
    const budget = new LoopBudget({ maxModelCalls: 5, maxTokens: 500 });
    budget.recordStep({ modelCalls: 1, inputTokens: 300, outputTokens: 150 });
    expect(budget.isTripped).toBe(false);

    expect(() => budget.recordStep({ modelCalls: 1, inputTokens: 100, outputTokens: 10 })).toThrow(
      CircuitBreakerError,
    );
    expect(budget.isTripped).toBe(true);
    expect(budget.totalTokens).toBe(560);
    expect(budget.reason).toContain('maxTokens');
  });
});
