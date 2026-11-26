# Runbook: Verification & Prompt Regression

## 1. Diagnose a Failing `calc-verify` CI Job

1. Download the `verification-evidence` artifact (`traces/`, `test-results/`) from the failed CI run.
2. Inspect Playwright traces (`npx playwright show-trace <trace>.zip`) and screenshots for DOM or console errors.
3. Reproduce locally against the dev server:
   - `npm run dev` (terminal 1)
   - `npm run verify:cli -- press 1 add 2 equals --snapshot --screenshot traces/debug.png --trace traces/debug.zip` (terminal 2)
4. Run `npm run test:cli` to confirm `tools/calc-verify/` matches `docs/feature-map.md` selectors.

## 2. Harvest a Failing OTel Trace into `evals/golden-dataset.yaml`

1. List failed or retried spans: `npm run harvest:trace -- --list` (pass `--file traces/sample-failed-trace.jsonl` to test with the sample).
2. Preview the regression case: `npm run harvest:trace -- --trace-id <id> --dry-run`.
3. Append it (`npm run harvest:trace -- --trace-id <id>`), replace the `TODO` expected readout in `evals/golden-dataset.yaml`, and verify with `npm run eval`.

## 3. Roll Back a Prompt Regression in `prompts/`

1. Restore the prior known-good prompt: `git checkout <good-sha> -- prompts/expression-translator.md` (or revert the offending commit).
2. Ensure `version` in frontmatter reflects the rollback release if publishing forward, then run `npm run eval` and `npm run check` before merging.
