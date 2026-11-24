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
