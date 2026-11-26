# Non-Goals

To prevent scope creep and agent over-engineering, this application intentionally does **not** build:

- **Scientific or graphing functions:** No trigonometry, logarithms, exponents, unit conversions, or plotting. Only `+`, `-`, `*`, `/`, and parentheses are supported.
- **Server-side persistence or history:** No database, saved calculation tapes, or cross-session state. State lives in memory for the active browser session.
- **User accounts or authentication:** No login, profiles, roles, or multi-tenant storage.
- **Arbitrary JavaScript execution:** No `eval()`, `new Function()`, or dynamic code evaluation anywhere in the codebase (see [ADR 001](adr/001-expression-parser.md)).
- **Browser-side AI calls:** No model SDKs, prompts, or API keys in `src/ui/` (enforced by `npm run lint:arch`).
- **Multi-turn conversational behavior:** The **Expression Translator** is single-turn only—it returns one arithmetic expression or `CANNOT_TRANSLATE`, never prose explanations or multi-turn memory.
- **Vendor-locked AI SDKs:** Only the OpenAI-compatible Chat Completions HTTP API and the offline deterministic stub are supported.

## Scope Rule

If a proposed feature conflicts with any guardrail above, stop and ask a human before drafting an OpenSpec change or editing `docs/feature-map.md`.
