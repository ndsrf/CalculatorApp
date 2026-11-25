# Tasks: Add Natural Language Input

## 1. Canonical context

- [x] 1.1 Add `natural-language-input` section to `docs/feature-map.md` (owner-approved)
- [x] 1.2 Add glossary terms and banned synonyms; update personas
- [x] 1.3 Record ADR 002 (AI translates, parser decides)
- [x] 1.4 Write spec deltas; run `npm run lint:docs`

## 2. Pure core

- [x] 2.1 `naturalLanguageInput`, `setNaturalLanguageInput`, `applyTranslation`, CE/AC behavior
- [x] 2.2 Unit tests + model-based `TranslationCommand`
- [x] 2.3 Regenerate `docs/state-chart.md`

## 3. Expression Translator

- [x] 3.1 Versioned prompt `prompts/expression-translator.md` (tier + limits)
- [x] 3.2 Output parsing, parser validation, repair loop bounded by `LoopBudget`
- [x] 3.3 OpenAI-compatible client + deterministic stub; provider chosen by environment
- [x] 3.4 `POST /api/translate` middleware with one OpenTelemetry span per request
- [x] 3.5 Unit tests with fake model clients

## 4. UI

- [x] 4.1 Natural Language Input + Translate Question wired to canonical selectors
- [x] 4.2 Stale responses ignored after All Clear (AC)

## 5. Verification & evals

- [x] 5.1 `calc-verify ask` command + contract/integration tests (blocked by the guardrail for an agent; applied after the repository owner explicitly authorized the reviewed patch)
- [x] 5.2 UI fuzzing includes questions
- [x] 5.3 Golden dataset runs the real translation pipeline (functional, edge, safety)
- [x] 5.4 `trace:demo` and `harvest:trace` operate on real translation spans
- [x] 5.5 Remove stand-in agent prompts

## 6. Docs & archive

- [x] 6.1 README, `AGENTS.md`, agent adapters, PR template
- [x] 6.2 `npm run check` green; archive this change
