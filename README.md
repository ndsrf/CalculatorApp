# Calculator App — AI-Native Engineering Workflow Reference

A minimal, runnable **Calculator App (Standard Keypad + Expression Input)** built with Vite + Vanilla TypeScript to demonstrate an AI-native engineering workflow: canonical docs, 1:1 OpenSpec governance, pre-tool guardrails, model-based testing (`fast-check`), a Playwright verification CLI (`calc-verify`), and Promptfoo evals.

---

## Repository Layout

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Top-level agent operating rules (mandatory doc reads, 1:1 OpenSpec updates, comment hygiene). |
| `.agents/skills/` | Installed agent skills from `mattpocock/skills` (`code-review`, `grill-with-docs`, plus dependencies `grilling` and `domain-modeling`), locked in `skills-lock.json`. |
| `.agent/hooks/pre-tool-guard.sh` | Executable pre-tool hook blocking unauthorized edits to `tools/calc-verify/` and orphan folders in `openspec/specs/`. |
| `docs/feature-map.md` | User-centric sitemap mapping feature sections 1:1 to `openspec/specs/` and exact DOM selectors. |
| `docs/glossary.md` | Canonical domain terms (`Primary Readout`, `Expression Input`, `Clear Entry (CE)`, `All Clear (AC)`) and banned synonyms. |
| `docs/personas.md` | Supported `@persona:` tags (`@persona:casual-user`, `@persona:power-user`). |
| `docs/adr/001-expression-parser.md` | ADR explaining why a safe recursive-descent parser is used instead of `eval()`. |
| `openspec/` | OpenSpec configuration, 3 canonical 1:1 specs (`keypad`, `expression-input`, `error-handling`), and `archive/`. |
| `scripts/lint-docs.ts` | Deterministic CI linter checking banned synonyms, valid `@persona:` tags, and Feature Map 1:1 alignment. |
| `src/core/` | Safe parser (`parser.ts`), pure calculator state machine (`calculator.ts`), unit tests, and `fast-check` model-based tests (`calculator.model.test.ts`). |
| `src/ui/` | Thin DOM layer wired strictly to `docs/feature-map.md` selectors. |
| `tools/calc-verify/` | Playwright verification CLI, `broken-calc.html` fixture, Feature Map contract test, and integration test. |
| `prompts/` | Versioned agent system prompts (`calc-tester-agent.md`, `doc-generator-agent.md`). |
| `evals/` | Promptfoo config (`promptfooconfig.yaml`) and 3-case `golden-dataset.yaml`. |
| `.github/workflows/ci.yml` | Full CI pipeline running doc lint, build, Vitest suites, and Promptfoo evals. |

---

## Quick Start

```bash
npm install
npx playwright install chromium
```

## Step-by-Step Workflow Walkthrough

### 1. Lint Documentation & 1:1 OpenSpec Governance
Checks banned synonyms (`docs/glossary.md`), valid `@persona:` tags (`docs/personas.md`), and 1:1 folder parity with `docs/feature-map.md`:
```bash
npm run lint:docs
```

### 2. Test the Pre-Tool Guardrail Hook
```bash
# Blocked: modifying calc-verify without authorization
.agent/hooks/pre-tool-guard.sh tools/calc-verify/index.ts

# Allowed: explicitly authorized verification CLI change
ALLOW_VERIFY_EDIT=1 .agent/hooks/pre-tool-guard.sh tools/calc-verify/index.ts

# Blocked: orphan spec folder not present in docs/feature-map.md
.agent/hooks/pre-tool-guard.sh openspec/specs/unmapped-feature/spec.md

# Allowed: 1:1 update to an existing Feature Map spec
.agent/hooks/pre-tool-guard.sh openspec/specs/keypad/spec.md
```

### 3. Run Unit & Model-Based Tests (`Vitest` + `fast-check`)
```bash
npm run test:unit
npm run test:model
```

### 4. Run the App & Custom Verification CLI (`calc-verify`)
Start the dev server in one terminal:
```bash
npm run dev
```

In another terminal, verify UI behavior against the running app (`http://localhost:5173` by default):
```bash
# Division by zero via Standard Keypad
npm run verify:cli -- press 8 divide 0 equals --snapshot

# Evaluate a parenthesized expression via Expression Input
npm run verify:cli -- type-expression "(10 + 5) * 2" --submit --snapshot
```

Run the CLI contract test (against `docs/feature-map.md`) and integration test (against `fixtures/broken-calc.html`):
```bash
npm run test:cli
```

### 5. Run Promptfoo Evals
Deterministic assertions (valid tool call arguments, no leaked `#display-current` or `data-op` selectors) run completely offline without an API key:
```bash
npm run eval
```

To also run the `llm-rubric` checks against a live LLM, copy `.env.example` to `.env`, set `OPENAI_API_KEY`, and re-run `npm run eval`:
```bash
cp .env.example .env
# Edit .env with your OPENAI_API_KEY
npm run eval
```

### 6. Typecheck & Production Build
```bash
npm run build
```

---

## Observability & Advanced Guardrails

### OpenTelemetry Tracing & Business Outcomes
Run a traced verification flow that emits a local OpenTelemetry span (with `gen_ai.*`, `prompt.sha`, `outcome.status`, `outcome.leaked_selector`, `outcome.tool_calls_count`, and `LoopBudget` circuit breaker metadata) to `traces/runs.jsonl` (or to an OTLP HTTP collector if `OTEL_EXPORTER_OTLP_ENDPOINT` is set):
```bash
npm run trace:demo
cat traces/runs.jsonl | jq .
```

### Harvest a Failing Trace into the Golden Eval Dataset
Preview or append a failing trace directly into `evals/golden-dataset.yaml` with `traceId` and `prompt.sha` provenance:
```bash
# Dry-run against the included sample failing trace
npm run harvest:trace -- --trace-id sample-fail-001 --file traces/sample-failed-trace.jsonl --dry-run

# Append into evals/golden-dataset.yaml
npm run harvest:trace -- --trace-id sample-fail-001 --file traces/sample-failed-trace.jsonl
```

### Visual Verification Artifacts & Auto-Generated State Chart
Capture a PNG screenshot and Playwright trace ZIP during `calc-verify` runs (failures also auto-save a trace ZIP to `traces/last-failure-trace.zip`):
```bash
npm run verify:cli -- press 8 divide 0 equals --snapshot --screenshot traces/div-zero.png --trace traces/div-zero.zip
```

Regenerate the Mermaid `stateDiagram-v2` state chart (`docs/state-chart.md`) directly from `CALCULATOR_STATE_TRANSITIONS` in `src/core/calculator.ts`:
```bash
npm run docs:state-chart
```

### Architectural Linting & UI Property-Based Fuzzing
Enforce strict `src/core` / `src/ui` / `tools` / `evals` dependency boundaries (`dependency-cruiser`) plus prescriptive ESLint rules banning `eval()`, `new Function()`, browser globals in `src/core/`, and inline explanatory comments:
```bash
npm run lint:arch
```

Run randomized Playwright + `fast-check` browser fuzzing against the live Vite app:
```bash
npm run test:fuzz
```

