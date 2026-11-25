## Summary

<!-- Briefly describe what changed and why. -->

## AI Assistance

<!-- Agents write code; humans own it. Be explicit so reviewers know where to look hardest. -->

- Agent/tooling used: <!-- e.g. any coding agent, chat assistant, none -->
- Parts generated or heavily edited by an agent: <!-- files / areas -->
- What I personally verified (beyond green CI): <!-- e.g. read every line of parser.ts, ran calc-verify manually -->

## Spec & Feature Map Alignment

- [ ] Linked canonical feature section(s) in `docs/feature-map.md`: <!-- e.g. keypad, expression-input, error-handling -->
- [ ] Updated existing 1:1 living spec delta in `openspec/specs/<feature>/spec.md` (no orphan spec folders created)
- [ ] Used only canonical terms from `docs/glossary.md` and valid `@persona:` tags from `docs/personas.md`

## Verification Evidence

- [ ] Attached `calc-verify` JSON snapshot (and PNG screenshot / Playwright trace ZIP for UI changes)
- [ ] Updated `docs/state-chart.md` via `npm run docs:state-chart` (if state transitions changed)

```json
// Paste `npm run verify:cli -- ... --snapshot` output here
```

## Automated Quality Gates

- [ ] `npm run check` passes locally (runs every gate below, same as CI)
  - `format:check` · `lint:docs` · `lint:arch` · `lint:deadcode` · state-chart drift · `build` · `npm test` · `eval:deterministic`
- [ ] No changes to `tools/calc-verify/`, `evals/`, lint configs or `AGENTS.md` — or, if there are, they are called out above for CODEOWNERS review
