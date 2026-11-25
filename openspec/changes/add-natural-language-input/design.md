# Design: Add Natural Language Input

Architectural rationale is recorded in [`docs/adr/002-ai-translates-parser-decides.md`](../../../docs/adr/002-ai-translates-parser-decides.md). This document covers the concrete shape of the change.

## Flow

```text
Natural Language Input ──► Translate Question ──► POST /api/translate (Vite middleware)
                                                     │
                                                     ▼
                                   Expression Translator (src/ai, server-side)
                                   ├─ length guard (no model call for empty/oversized questions)
                                   ├─ model call (OpenAI-compatible endpoint or offline stub)
                                   ├─ parse reply: expression | CANNOT_TRANSLATE
                                   ├─ validate with src/core parser
                                   ├─ invalid? retry with parser feedback (repair loop)
                                   └─ LoopBudget: max model calls / tokens from prompt frontmatter
                                                     │  { status, expression? }
                                                     ▼
UI ──► applyTranslation(state, outcome) (pure, src/core) ──► submitExpression ──► Primary Readout
```

## Core (pure)

- `CalculatorState` gains `naturalLanguageInput`.
- `setNaturalLanguageInput(state, text)`: ignored in Error State.
- `applyTranslation(state, outcome)`:
  - `{ status: 'translated', expression }` → write `expression` to `expressionInput`, then `submitExpression`. The parser runs again in the browser (defense in depth).
  - `{ status: 'failed' }` → Error State with `TRANSLATION_FAILED_MESSAGE` (`"Could not translate question"`).
  - Ignored in Error State.
- `pressClearEntry` also empties `naturalLanguageInput`; `pressAllClear` resets everything.

## Expression Translator (server-side)

- Prompt: `prompts/expression-translator.md`, `model_routing.tier: lightweight`, with `limits.max_model_calls` and `limits.max_tokens` versioned alongside the prompt.
- Statuses: `translated`, `refused` (explicit `CANNOT_TRANSLATE` or guard), `budget_exceeded` (repair loop exhausted), `unavailable` (provider error). Only `translated` reaches the UI as an expression.
- Model access: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL_<TIER>`. Unset (or `AI_FORCE_STUB=1`) → deterministic stub.
- Every request through the dev server emits one OpenTelemetry span.

## Selectors

| Feature Name           | CLI Key / Action         | DOM Selector                         |
| ---------------------- | ------------------------ | ------------------------------------ |
| Natural Language Input | `natural-language-input` | `#natural-language-input`            |
| Translate Question     | `translate-question`     | `[data-action="translate-question"]` |

`[data-action="translate-question"]` carries `aria-busy="true"` while a request is in flight so agents and tests can wait for completion.
