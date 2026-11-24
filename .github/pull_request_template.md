## Summary
<!-- Briefly describe what changed and why. -->

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
- [ ] `npm run lint:docs`
- [ ] `npm run lint:arch`
- [ ] `npm run lint:deadcode`
- [ ] `npm run test:unit` & `npm run test:model`
- [ ] `npm run test:cli` & `npm run test:fuzz`
- [ ] `npm run eval`
