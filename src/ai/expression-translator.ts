import { checkExpressionSyntax } from '../core/index.ts';
import {
  CircuitBreakerError,
  LoopBudget,
  type LoopBudgetConfig,
} from '../observability/guardrails.ts';
import type { ChatMessage, ModelClient } from './model-clients.ts';

export const CANNOT_TRANSLATE = 'CANNOT_TRANSLATE';
export const MAX_QUESTION_LENGTH = 200;

type TranslationStatus = 'translated' | 'refused' | 'budget_exceeded' | 'unavailable';

export interface TranslationResult {
  status: TranslationStatus;
  expression?: string;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  circuitBreakerReason?: string;
  error?: string;
}

type ModelReply = { kind: 'refusal' } | { kind: 'expression'; expression: string };

export function parseModelReply(text: string): ModelReply {
  const cleaned = text
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^`+|`+$/g, '')
    .trim();

  return cleaned === CANNOT_TRANSLATE
    ? { kind: 'refusal' }
    : { kind: 'expression', expression: cleaned };
}

function repairInstruction(parserError: string): string {
  return `The calculator parser rejected that reply (${parserError}). Reply with ONLY the arithmetic expression, or exactly ${CANNOT_TRANSLATE}.`;
}

export async function translateQuestion(
  question: string,
  client: ModelClient,
  options: { systemPrompt: string; limits: LoopBudgetConfig },
): Promise<TranslationResult> {
  const usage = { modelCalls: 0, inputTokens: 0, outputTokens: 0 };
  const trimmed = question.trim();
  if (!trimmed || trimmed.length > MAX_QUESTION_LENGTH) {
    return { status: 'refused', ...usage };
  }

  const budget = new LoopBudget(options.limits);
  const messages: ChatMessage[] = [
    { role: 'system', content: options.systemPrompt },
    { role: 'user', content: trimmed },
  ];

  try {
    for (;;) {
      budget.recordStep({ modelCalls: 1 });
      const reply = await client.complete(messages);
      usage.modelCalls += 1;
      usage.inputTokens += reply.inputTokens;
      usage.outputTokens += reply.outputTokens;
      budget.recordStep({ inputTokens: reply.inputTokens, outputTokens: reply.outputTokens });

      const parsed = parseModelReply(reply.text);
      if (parsed.kind === 'refusal') {
        return { status: 'refused', ...usage };
      }

      const check = checkExpressionSyntax(parsed.expression);
      if (check.ok) {
        return { status: 'translated', expression: parsed.expression, ...usage };
      }

      messages.push(
        { role: 'assistant', content: reply.text },
        { role: 'user', content: repairInstruction(check.reason) },
      );
    }
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      return { status: 'budget_exceeded', ...usage, circuitBreakerReason: error.reason };
    }
    return {
      status: 'unavailable',
      ...usage,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
