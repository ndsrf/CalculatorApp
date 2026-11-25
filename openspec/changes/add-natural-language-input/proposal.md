# Proposal: Add Natural Language Input

## Why

The Calculator App has no AI functionality, so the repository's AI practices (versioned prompts, evals, tracing, circuit breakers, trace harvesting) were demonstrated on stand-in agents the product never used. That made the reference harder to understand, not easier. A small, real AI feature lets every practice apply to something the app actually does.

## What Changes

- New **Natural Language Input** (`#natural-language-input`) and **Translate Question** (`[data-action="translate-question"]`) controls.
- New server-side **Expression Translator** (`src/ai/`, `POST /api/translate`) that turns an everyday question into an arithmetic expression. It never computes results. Its output is untrusted and must pass the safe parser from ADR 001.
- The translated expression is placed in the **Expression Input** (so the user can see exactly what was evaluated) and evaluated as if submitted.
- Failed translations enter **Error State** with `"Could not translate question"`, recoverable via **All Clear (AC)**.
- Provider-agnostic model access through any OpenAI-compatible Chat Completions endpoint, with a deterministic offline stub as the default.
- The stand-in `calc-tester-agent` and `doc-generator-agent` prompts are removed. Evals, tracing, `LoopBudget`, and trace harvesting are re-targeted at the real Expression Translator.

## User Stories

- As a `@persona:casual-user`, I type `15% of 80, plus 5` and see `17`, without knowing operator precedence or percentage syntax.
- As a `@persona:power-user`, I can read the translated expression in the **Expression Input** and correct it by hand if the translation is not what I meant.

## Non-Goals

- Free-form conversation, explanations, or multi-turn chat.
- The model computing answers. Arithmetic stays in `src/core/`.
- Production hosting of the translation endpoint (the reference serves it from the Vite dev and preview servers only).

## Impact

- Feature Map: new top-level section `natural-language-input` (approved by the repository owner).
- Specs: new `openspec/specs/natural-language-input/spec.md`; modified `openspec/specs/error-handling/spec.md`.
- Glossary, personas, ADR 002, state chart, `calc-verify` (human-authorized), evals, telemetry, README.
