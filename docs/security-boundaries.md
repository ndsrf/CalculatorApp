# Security Boundaries

## Untrusted Input & Safe Evaluation

- **Expression Input** (`#expression-input`), **Natural Language Input** (`#natural-language-input`), and all **Expression Translator** replies are **untrusted input**.
- Every expression MUST be parsed and evaluated by `src/core/parser.ts` (recursive-descent parser). `eval()` and `new Function()` are banned by ESLint ([ADR 001](adr/001-expression-parser.md)).
- **Expression Translator** output is validated by `checkExpressionSyntax` on the server and re-parsed in the browser before updating **Primary Readout** ([ADR 002](adr/002-ai-translates-parser-decides.md)).

## Secrets & Network Boundaries

- `AI_API_KEY` and provider credentials live only in gitignored `.env` and server-side `src/ai/`. Never commit secrets or import `src/ai/` from `src/ui/` (`npm run lint:arch`).
- Browser code (`src/ui/`) makes only same-origin `POST /api/translate` requests. Outbound model requests occur exclusively in `src/ai/model-clients.ts` to `AI_BASE_URL` (offline stub when unset).

## Observability & Trace Hygiene

- `traces/runs.jsonl` records `app.question` and `app.expression` for regression harvesting (`scripts/harvest-trace.ts`).
- **Zero PII or secrets in traces:** Never attach `AI_API_KEY`, authorization headers, cookies, or user identifiers to OTel span attributes or CI failure artifacts.
