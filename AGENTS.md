# Agent Operating Rules (`AGENTS.md`)

This repository is structured for an AI-native engineering workflow. Every agent and contributor operating in this repo MUST follow these rules.

## 1. Mandatory Pre-Change Context

Before proposing or implementing any change, you MUST read:

1. [`docs/feature-map.md`](docs/feature-map.md) — Canonical feature names, spec sections, and DOM selectors.
2. [`docs/glossary.md`](docs/glossary.md) — Canonical domain terms and explicitly banned synonyms.
3. [`docs/personas.md`](docs/personas.md) — Supported `@persona:` tags and user mental models.
4. The relevant living specification under [`openspec/specs/`](openspec/specs/).

## 2. 1:1 OpenSpec Governance

- Every folder under `openspec/specs/<feature>/spec.md` MUST correspond 1:1 to a top-level section in `docs/feature-map.md`.
- **Update existing specs in place** instead of creating new top-level spec files.
- Never add a new folder under `openspec/specs/` unless the corresponding top-level feature section has first been approved and added to `docs/feature-map.md`.
- All specs MUST use canonical terms from `docs/glossary.md` and valid `@persona:` tags from `docs/personas.md`.
- Run `npm run lint:docs` after any documentation or spec edit.

## 3. Guardrails & Verification Integrity

- Do NOT modify `tools/calc-verify/` to make failing checks pass. Edits to `tools/calc-verify/` are blocked by `.agent/hooks/pre-tool-guard.sh` unless explicitly authorized with `ALLOW_VERIFY_EDIT=1`.
- All UI controls MUST remain wired exclusively to the canonical selectors documented in `docs/feature-map.md`.
- Any selector addition or change requires updating `docs/feature-map.md` and verifying `npm run test:cli` (contract + integration tests).

## 4. Code & Comment Hygiene

- Keep UI thin (`src/ui/`) and delegate all arithmetic and state transitions to pure modules in `src/core/`.
- Never use `eval()` or `new Function()` for expression evaluation (see `docs/adr/001-expression-parser.md`).
- **Ban unnecessary inline comments.** Do not write comments that restate what the code already expresses clearly. Only document non-obvious invariants, edge cases, or architectural rationale.

## 5. Installed Agent Skills

- Reusable discovery and review skills live under `.agents/skills/` (managed via `skills-lock.json` from `mattpocock/skills`):
  - `.agents/skills/grill-with-docs/SKILL.md` (composes `grilling` and `domain-modeling`)
  - `.agents/skills/code-review/SKILL.md`
