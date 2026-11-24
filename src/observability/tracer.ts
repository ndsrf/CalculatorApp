import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { type Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK, type NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import {
  CircuitBreakerError,
  LoopBudget,
  type LoopBudgetConfig,
  OTEL_ATTRS,
} from './guardrails.ts';

export { CircuitBreakerError, LoopBudget, type LoopBudgetConfig, OTEL_ATTRS };

type SpanExporter = NonNullable<NodeSDKConfiguration['traceExporter']>;
type ExportableSpan = Parameters<SpanExporter['export']>[0][number];
type ExportCallback = Parameters<SpanExporter['export']>[1];

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const DEFAULT_TRACE_FILE = join(REPO_ROOT, 'traces', 'runs.jsonl');
const DEFAULT_PROMPT_PATH = join(REPO_ROOT, 'prompts', 'calc-tester-agent.md');

export const LEAKED_SELECTOR_PATTERNS = [
  '#display-',
  '#expression-input',
  'data-op',
  'data-key',
  'data-action',
] as const;

export interface SerializedSpanRecord {
  traceId: string;
  spanId: string;
  name: string;
  startTime: [number, number];
  endTime: [number, number];
  durationMs: number;
  status: { code: number; message?: string };
  attributes: Record<string, unknown>;
}

export class JsonlSpanExporter implements SpanExporter {
  private readonly filePath: string;

  constructor(filePath = DEFAULT_TRACE_FILE) {
    this.filePath = filePath;
  }

  export(spans: ExportableSpan[], resultCallback: ExportCallback): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      for (const span of spans) {
        const ctx = span.spanContext();
        const durationMs =
          (span.duration[0] * 1_000_000_000 + span.duration[1]) / 1_000_000;
        const record: SerializedSpanRecord = {
          traceId: ctx.traceId,
          spanId: ctx.spanId,
          name: span.name,
          startTime: span.startTime,
          endTime: span.endTime,
          durationMs: Number(durationMs.toFixed(3)),
          status: span.status,
          attributes: { ...span.attributes },
        };
        appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, 'utf-8');
      }
      resultCallback({ code: 0 });
    } catch (error) {
      resultCallback({
        code: 1,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  async shutdown(): Promise<void> {
    return;
  }

  async forceFlush(): Promise<void> {
    return;
  }
}

export function computePromptSha(promptPath = DEFAULT_PROMPT_PATH): string {
  if (!existsSync(promptPath)) {
    throw new Error(`Prompt file not found for SHA calculation: ${promptPath}`);
  }
  const content = readFileSync(promptPath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

export function detectLeakedSelector(outputText: string): boolean {
  return LEAKED_SELECTOR_PATTERNS.some((pattern) => outputText.includes(pattern));
}

export interface ObservabilityHandle {
  sdk: NodeSDK;
  shutdown: () => Promise<void>;
}

export function startObservability(traceFilePath = DEFAULT_TRACE_FILE): ObservabilityHandle {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  const traceExporter: SpanExporter = otlpEndpoint
    ? new OTLPTraceExporter({ url: otlpEndpoint })
    : new JsonlSpanExporter(traceFilePath);

  const sdk = new NodeSDK({
    serviceName: 'calculator-app-verifier',
    traceExporter,
  });

  sdk.start();
  return {
    sdk,
    shutdown: () => sdk.shutdown(),
  };
}

export interface TracedAgentRunInput {
  spanName: string;
  userRequest: string;
  toolArgs: string[];
  genAiSystem?: string;
  model?: string;
  retried?: boolean;
  budget?: LoopBudgetConfig;
}

export interface TracedAgentStepResult {
  status: 'ok' | 'error';
  agentOutput: string;
  inputTokens: number;
  outputTokens: number;
  toolCallsCount: number;
  retried?: boolean;
}

export async function runTracedAgentSpan<T extends TracedAgentStepResult>(
  input: TracedAgentRunInput,
  fn: (span: Span, budget: LoopBudget) => Promise<T>
): Promise<T & { traceId: string; promptSha: string; leakedSelector: boolean }> {
  const tracer = trace.getTracer('calculator-app');
  const promptSha = computePromptSha();
  const budget = new LoopBudget(input.budget);

  return tracer.startActiveSpan(input.spanName, async (span) => {
    const traceId = span.spanContext().traceId;
    span.setAttributes({
      [OTEL_ATTRS.GEN_AI_SYSTEM]: input.genAiSystem ?? 'local-verifier',
      [OTEL_ATTRS.GEN_AI_REQUEST_MODEL]: input.model ?? 'calc-tester-agent',
      [OTEL_ATTRS.GEN_AI_USAGE_INPUT_TOKENS]: 0,
      [OTEL_ATTRS.GEN_AI_USAGE_OUTPUT_TOKENS]: 0,
      [OTEL_ATTRS.PROMPT_SHA]: promptSha,
      [OTEL_ATTRS.APP_USER_REQUEST]: input.userRequest,
      [OTEL_ATTRS.TOOL_ARGS]: input.toolArgs.join(' '),
      [OTEL_ATTRS.OUTCOME_RETRIED]: input.retried ?? false,
      [OTEL_ATTRS.OUTCOME_TOOL_CALLS_COUNT]: 0,
      [OTEL_ATTRS.OUTCOME_CIRCUIT_BREAKER_TRIPPED]: false,
    });

    try {
      const result = await fn(span, budget);
      const leakedSelector = detectLeakedSelector(result.agentOutput);
      const finalStatus: 'ok' | 'error' =
        result.status === 'error' || leakedSelector || budget.isTripped ? 'error' : 'ok';

      span.setAttributes({
        [OTEL_ATTRS.GEN_AI_USAGE_INPUT_TOKENS]: result.inputTokens,
        [OTEL_ATTRS.GEN_AI_USAGE_OUTPUT_TOKENS]: result.outputTokens,
        [OTEL_ATTRS.APP_AGENT_OUTPUT]: result.agentOutput,
        [OTEL_ATTRS.OUTCOME_STATUS]: finalStatus,
        [OTEL_ATTRS.OUTCOME_LEAKED_SELECTOR]: leakedSelector,
        [OTEL_ATTRS.OUTCOME_RETRIED]: result.retried ?? input.retried ?? false,
        [OTEL_ATTRS.OUTCOME_TOOL_CALLS_COUNT]: result.toolCallsCount,
        [OTEL_ATTRS.OUTCOME_CIRCUIT_BREAKER_TRIPPED]: budget.isTripped,
      });

      span.setStatus({
        code: finalStatus === 'ok' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      });

      return {
        ...result,
        status: finalStatus,
        traceId,
        promptSha,
        leakedSelector,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      budget.applyToSpan(span);
      span.setAttributes({
        [OTEL_ATTRS.OUTCOME_STATUS]: 'error',
        [OTEL_ATTRS.OUTCOME_LEAKED_SELECTOR]: false,
        [OTEL_ATTRS.OUTCOME_CIRCUIT_BREAKER_TRIPPED]:
          budget.isTripped || error instanceof CircuitBreakerError,
      });
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      throw error;
    } finally {
      span.end();
    }
  });
}
