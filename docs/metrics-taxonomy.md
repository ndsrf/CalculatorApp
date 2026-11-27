# Metrics Taxonomy

Canonical OpenTelemetry span attributes emitted by `src/observability/tracer.ts` (defined in `OTEL_ATTRS` in `src/observability/guardrails.ts`) on `expression-translator.translate` spans:

| Attribute                         | Type      | Definition                                                                                                          |
| --------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `outcome.status`                  | `string`  | `'ok'` for `translated` or valid `refused`; `'error'` for `budget_exceeded`, `unavailable`, or uncaught errors.     |
| `outcome.translation_status`      | `string`  | Translator result before UI evaluation: `'translated'`, `'refused'`, `'budget_exceeded'`, or `'unavailable'`.       |
| `outcome.retried`                 | `boolean` | `true` when `outcome.model_calls_count > 1` (repair loop retried after parser rejection).                           |
| `outcome.model_calls_count`       | `number`  | Total model invocations for the request, bounded by `limits.max_model_calls` in `prompts/expression-translator.md`. |
| `outcome.circuit_breaker_tripped` | `boolean` | `true` when `LoopBudget` halts execution (`maxModelCalls` or `maxTokens` exceeded).                                 |
| `outcome.circuit_breaker_reason`  | `string`  | Human-readable limit reason when `outcome.circuit_breaker_tripped` is `true`.                                       |

_Selector leakage (`outcome.leaked_selector`) is not yet emitted by `tracer.ts`; selector compliance is gated in CI by `npm run test:cli` and `npm run test:ui`._

## Model & Prompt Provenance

- `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` — provider, model ID, and token usage.
- `prompt.id`, `prompt.version`, `prompt.sha` — ties every traced outcome to an exact prompt version in `prompts/`.
- `app.question`, `app.expression` — user question and validated expression (absent on refusal/failure).
