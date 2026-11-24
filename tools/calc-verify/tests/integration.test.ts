import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { VerifyResult } from '../index.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const CLI_PATH = join(REPO_ROOT, 'tools', 'calc-verify', 'index.ts');
const BROKEN_FIXTURE_URL = pathToFileURL(
  join(REPO_ROOT, 'tools', 'calc-verify', 'fixtures', 'broken-calc.html')
).href;

describe('calc-verify integration tests', () => {
  it('captures uncaught ReferenceError from broken-calc.html and returns status "error"', () => {
    const run = spawnSync(
      'npx',
      ['tsx', CLI_PATH, 'press', '2', 'add', '2', 'equals', '--snapshot', '--url', BROKEN_FIXTURE_URL],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      }
    );

    expect(run.status).toBe(1);
    const parsed = JSON.parse(run.stdout) as VerifyResult;
    expect(parsed.status).toBe('error');
    expect(parsed.console_errors.length).toBeGreaterThan(0);
    expect(parsed.console_errors.some((err) => err.includes('ReferenceError'))).toBe(true);
    expect(parsed.ui_state).not.toBeNull();
  });

  it('returns status "ok" with clean snapshot when --snapshot is passed', () => {
    const run = spawnSync(
      'npx',
      ['tsx', CLI_PATH, 'press', '4', '2', '--snapshot', '--url', BROKEN_FIXTURE_URL],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      }
    );

    expect(run.status).toBe(0);
    const parsed = JSON.parse(run.stdout) as VerifyResult;
    expect(parsed.status).toBe('ok');
    expect(parsed.console_errors).toEqual([]);
    expect(parsed.ui_state?.display).toBe('42');
  });

  it('omits ui_state when --snapshot is not passed and rejects non-pressable keys', () => {
    const withoutSnapshot = spawnSync(
      'npx',
      ['tsx', CLI_PATH, 'press', '4', '2', '--url', BROKEN_FIXTURE_URL],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      }
    );
    expect(withoutSnapshot.status).toBe(0);
    const parsedNoSnap = JSON.parse(withoutSnapshot.stdout) as VerifyResult;
    expect(parsedNoSnap.ui_state).toBeNull();

    const invalidPress = spawnSync(
      'npx',
      ['tsx', CLI_PATH, 'press', 'display-current', '--snapshot', '--url', BROKEN_FIXTURE_URL],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      }
    );
    expect(invalidPress.status).toBe(1);
    const parsedInvalid = JSON.parse(invalidPress.stdout) as VerifyResult;
    expect(parsedInvalid.status).toBe('error');
    expect(parsedInvalid.console_errors[0]).toContain('not a pressable control');
  });
});
