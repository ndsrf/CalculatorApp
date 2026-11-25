# Agent Operating Rules (`AGENTS.md`)

This repository is structured for an AI-native engineering workflow. Every agent and contributor (human or AI, any vendor) operating in this repo MUST follow these rules. Tool-specific wiring lives in [`docs/agent-adapters.md`](docs/agent-adapters.md); this file stays tool-agnostic.

## 1. Mandatory Pre-Change Context

Before proposing or implementing any change, you MUST read:

1. [`docs/feature-map.md`](docs/feature-map.md) — Canonical feature names, spec sections, and DOM selectors.
2. [`docs/glossary.md`](docs/glossary.md) — Canonical domain terms and explicitly banned synonyms.
3. [`docs/personas.md`](docs/personas.md) — Supported `@persona:` tags and user mental models.
4. The relevant living specification under [`openspec/specs/`](openspec/specs/).
5. Any relevant decision record under [`docs/adr/`](docs/adr/) (e.g. why `eval()` is banned, and why the AI only translates).

## 2. Commands

| Goal                                | Command                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Install                             | `npm install && npx playwright install chromium`                               |
| Run every gate (same as CI)         | `npm run check`                                                                |
| Fast feedback while coding          | `npm run test:unit` · `npm run test:model`                                     |
| Docs/spec governance                | `npm run lint:docs`                                                            |
| Architecture boundaries & dead code | `npm run lint:arch` · `npm run lint:deadcode`                                  |
| Browser verification (needs app)    | `npm run test:cli` · `npm run test:fuzz`                                       |
| Observe the app as an agent         | `npm run dev`, then `npm run verify:cli -- press 1 add 2 equals --snapshot`    |
| Observe the AI feature as an agent  | `npm run dev`, then `npm run verify:cli -- ask "15% of 80, plus 5" --snapshot` |
| Evaluate the AI feature             | `npm run eval` (offline stub unless `AI_*` is set; see `.env.example`)         |
| See evals fail without a key        | `npm run eval:simulate` (real evals vs. a scripted flawed model)               |
| Regenerate the state chart          | `npm run docs:state-chart`                                                     |

## 3. Workflow & Definition of Done

1. **Explore → Propose:** For behavior changes, draft an OpenSpec change under `openspec/changes/<change-id>/` before writing code. Ask the human when requirements are ambiguous instead of guessing.
2. **Apply:** Implement in small steps; run the fast tests after each step.
3. **Done means all of the following are true:**
   - `npm run check` passes.
   - Living specs in `openspec/specs/` describe the new behavior, and the change folder is archived.
   - `docs/state-chart.md` was regenerated (never hand-edited) if state transitions changed.
   - The PR description follows `.github/pull_request_template.md`, including `calc-verify` evidence and the **AI Assistance** section.

## 4. 1:1 OpenSpec Governance

- Every folder under `openspec/specs/<feature>/spec.md` MUST correspond 1:1 to a top-level section in `docs/feature-map.md`.
- **Update existing specs in place** instead of creating new top-level spec files.
- Never add a new folder under `openspec/specs/` unless the corresponding top-level feature section has first been approved and added to `docs/feature-map.md`.
- All specs MUST use canonical terms from `docs/glossary.md` and valid `@persona:` tags from `docs/personas.md`.
- Run `npm run lint:docs` after any documentation or spec edit.

## 5. Guardrails & Verification Integrity

- Do NOT modify `tools/calc-verify/` to make failing checks pass. Edits to `tools/calc-verify/` are blocked by `.agents/hooks/pre-tool-guard.sh` unless a human explicitly authorizes them with `ALLOW_VERIFY_EDIT=1`.
- Do NOT weaken a gate to get green: no skipping/deleting tests, loosening eval assertions, disabling lint rules, or adding `eslint-disable` without a human asking for it. If a gate seems wrong, stop and explain why.
- All UI controls MUST remain wired exclusively to the canonical selectors documented in `docs/feature-map.md`.
- Any selector addition or change requires updating `docs/feature-map.md` and verifying `npm run test:cli` (contract + integration tests).
- Never commit secrets. Keys belong in a local, gitignored `.env` (see `.env.example`).

## 6. AI Feature Rules (Expression Translator)

- **Model output is untrusted.** Never evaluate, display as a result, or act on model output except through the safe parser in `src/core/` (see `docs/adr/002-ai-translates-parser-decides.md`).
- **Never call a model from `src/ui/`.** Model calls and keys stay server-side in `src/ai/` (enforced by `npm run lint:arch`).
- **Any prompt edit bumps `version`** in its frontmatter and comes with golden cases in `evals/golden-dataset.yaml`. Never name a vendor model in a prompt; declare a `model_routing.tier`.
- **Do not loosen `limits`, eval assertions, or safety cases** to make evals pass. Report the failing case instead.

## 7. Code & Comment Hygiene

- Keep UI thin (`src/ui/`) and delegate all arithmetic and state transitions to pure modules in `src/core/`.
- Never use `eval()` or `new Function()` for expression evaluation (see `docs/adr/001-expression-parser.md`).
- **Ban unnecessary inline comments.** Do not write comments that restate what the code already expresses clearly. Only document non-obvious invariants, edge cases, or architectural rationale.

## 8. Installed Agent Skills

- Reusable discovery and review skills live under `.agents/skills/` (managed verbatim via `skills-lock.json` from `mattpocock/skills`):
  - `.agents/skills/grill-with-docs/SKILL.md` (composes `grilling` and `domain-modeling`)
  - `.agents/skills/code-review/SKILL.md`
- **Repository Path Overrides:** When running these vendored skills in this repo, map their upstream defaults to this repository's canonical paths:
  - Write glossary updates to [`docs/glossary.md`](docs/glossary.md) (not a root `GLOSSARY.md`) and ADRs to `docs/adr/NNN-<slug>.md` (3-digit numbering).
  - Write behavioral requirement deltas in place under [`openspec/specs/`](openspec/specs/) matching [`docs/feature-map.md`](docs/feature-map.md) 1:1.
  - For `/code-review`, treat [`openspec/specs/`](openspec/specs/) and [`docs/feature-map.md`](docs/feature-map.md) as the primary spec sources (no external issue tracker setup is required).
