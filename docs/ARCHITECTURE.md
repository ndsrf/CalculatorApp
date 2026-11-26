# Architecture Overview

## Component Boundaries

- `src/ui/` — Thin DOM layer (`calculator-ui.ts`, `translator-client.ts`) bound to `docs/feature-map.md` selectors. Never imports `src/ai/` or `src/observability/`.
- `src/core/` — Pure arithmetic and state machine (`calculator.ts`, `parser.ts`) exposed exclusively via `src/core/index.ts`. Zero DOM or network globals.
- `src/ai/` — Server-side **Expression Translator** (`http-handler.ts`, `translate-service.ts`, `expression-translator.ts`, `model-clients.ts`, `prompt.ts`).
- `src/observability/` — Node-only OpenTelemetry tracer (`tracer.ts`) and `LoopBudget` circuit breaker (`guardrails.ts`).

Boundaries are enforced mechanically by `dependency-cruiser` and ESLint (`npm run lint:arch`).

## Data Flow

1. **Keypad & Expression Input:** User actions in `src/ui/calculator-ui.ts` call pure transitions in `src/core/index.ts`, which validate and evaluate via `src/core/parser.ts` and render to **Primary Readout** (`#display-current`).
2. **Natural Language Input:** `translator-client.ts` sends `POST /api/translate` → `http-handler.ts` → `expression-translator.ts`. The model proposes an expression within a bounded `LoopBudget`, `checkExpressionSyntax` validates it on the server, and `applyTranslation` re-validates and evaluates it in `src/core/` in the browser.

## Verification & Observability

- **Verification Loop:** `tools/calc-verify/` drives the real app via Playwright using only `docs/feature-map.md` selectors; `npm run check` runs formatting, doc/arch/deadcode lints, state-chart drift, unit/model/CLI/fuzz tests, and evals.
- **Observability Pipeline:** `traceTranslation` emits `expression-translator.translate` OTel spans to `traces/runs.jsonl` by default, or to `OTEL_EXPORTER_OTLP_ENDPOINT` when set.
