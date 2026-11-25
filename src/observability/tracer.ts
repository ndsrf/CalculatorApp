import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  type ReadableSpan,
  SimpleSpanProcessor,
  type SpanExporter,
} from '@opentelemetry/sdk-trace';
import { OTEL_ATTRS } from './guardrails.ts';

export { OTEL_ATTRS };

type ExportCallback = Parameters<SpanExporter['export']>[1];

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

class JsonlSpanExporter implements SpanExporter {
  constructor(private readonly filePath: string) {}

  export(spans: ReadableSpan[], resultCallback: ExportCallback): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      for (const span of spans) {
        const ctx = span.spanContext();
        const durationMs = (span.duration[0] * 1_000_000_000 + span.duration[1]) / 1_000_000;
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

  async shutdown(): Promise<void> {}

  async forceFlush(): Promise<void> {}
}

export interface ObservabilityHandle {
  shutdown: () => Promise<void>;
}

let active: ObservabilityHandle | undefined;

export function startObservability(traceFilePath: string): ObservabilityHandle {
  if (active) {
    return active;
  }

  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  const spanProcessor = otlpEndpoint
    ? new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: otlpEndpoint }) })
    : new SimpleSpanProcessor({ exporter: new JsonlSpanExporter(traceFilePath) });

  const sdk = new NodeSDK({ serviceName: 'calculator-app', spanProcessors: [spanProcessor] });
  sdk.start();

  const handle: ObservabilityHandle = {
    shutdown: async () => {
      active = undefined;
      await sdk.shutdown();
    },
  };
  active = handle;
  return handle;
}

export interface TranslationSpanInput {
  question: string;
  promptId: string;
  promptVersion: string;
  promptSha: string;
  system: string;
  model: string;
}

export interface TracedTranslation {
  status: string;
  expression?: string;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  circuitBreakerReason?: string;
  error?: string;
}

const FAILING_TRANSLATION_STATUSES = new Set(['budget_exceeded', 'unavailable']);

export async function traceTranslation<T extends TracedTranslation>(
  input: TranslationSpanInput,
  run: () => Promise<T>,
): Promise<T & { traceId: string }> {
  const tracer = trace.getTracer('calculator-app');

  return tracer.startActiveSpan('expression-translator.translate', async (span) => {
    const traceId = span.spanContext().traceId;
    span.setAttributes({
      [OTEL_ATTRS.GEN_AI_SYSTEM]: input.system,
      [OTEL_ATTRS.GEN_AI_REQUEST_MODEL]: input.model,
      [OTEL_ATTRS.PROMPT_ID]: input.promptId,
      [OTEL_ATTRS.PROMPT_VERSION]: input.promptVersion,
      [OTEL_ATTRS.PROMPT_SHA]: input.promptSha,
      [OTEL_ATTRS.APP_QUESTION]: input.question,
    });

    try {
      const result = await run();
      const failed = FAILING_TRANSLATION_STATUSES.has(result.status);
      span.setAttributes({
        [OTEL_ATTRS.GEN_AI_USAGE_INPUT_TOKENS]: result.inputTokens,
        [OTEL_ATTRS.GEN_AI_USAGE_OUTPUT_TOKENS]: result.outputTokens,
        [OTEL_ATTRS.OUTCOME_STATUS]: failed ? 'error' : 'ok',
        [OTEL_ATTRS.OUTCOME_TRANSLATION_STATUS]: result.status,
        [OTEL_ATTRS.OUTCOME_MODEL_CALLS_COUNT]: result.modelCalls,
        [OTEL_ATTRS.OUTCOME_RETRIED]: result.modelCalls > 1,
        [OTEL_ATTRS.OUTCOME_CIRCUIT_BREAKER_TRIPPED]: Boolean(result.circuitBreakerReason),
        ...(result.expression ? { [OTEL_ATTRS.APP_EXPRESSION]: result.expression } : {}),
        ...(result.circuitBreakerReason
          ? { [OTEL_ATTRS.OUTCOME_CIRCUIT_BREAKER_REASON]: result.circuitBreakerReason }
          : {}),
      });
      span.setStatus(
        failed
          ? { code: SpanStatusCode.ERROR, message: result.error ?? result.status }
          : { code: SpanStatusCode.OK },
      );
      return { ...result, traceId };
    } catch (error) {
      span.setAttribute(OTEL_ATTRS.OUTCOME_STATUS, 'error');
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
