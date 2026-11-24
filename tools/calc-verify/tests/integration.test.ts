import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { startViteServer } from '../../../scripts/dev-server.ts';
import type { VerifyResult } from '../index.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const CLI_PATH = join(REPO_ROOT, 'tools', 'calc-verify', 'index.ts');
const BROKEN_FIXTURE_URL = pathToFileURL(
  join(REPO_ROOT, 'tools', 'calc-verify', 'fixtures', 'broken-calc.html'),
).href;

function runCli(args: string[]): SpawnSyncReturns<string> {
  return spawnSync('npx', ['tsx', CLI_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
}

describe('calc-verify integration tests', () => {
  it('captures uncaught ReferenceError from broken-calc.html, saves failure trace, and returns status "error"', () => {
    const traceOut = join(REPO_ROOT, 'traces', 'test-broken-trace.zip');
    rmSync(traceOut, { force: true });

    const run = runCli([
      'press',
      '2',
      'add',
      '2',
      'equals',
      '--snapshot',
      '--trace',
      traceOut,
      '--url',
      BROKEN_FIXTURE_URL,
    ]);

    expect(run.status).toBe(1);
    const parsed = JSON.parse(run.stdout) as VerifyResult;
    expect(parsed.status).toBe('error');
    expect(parsed.console_errors.length).toBeGreaterThan(0);
    expect(parsed.console_errors.some((err) => err.includes('ReferenceError'))).toBe(true);
    expect(parsed.ui_state).not.toBeNull();
    expect(existsSync(traceOut)).toBe(true);
    rmSync(traceOut, { force: true });
  });

  it('returns status "ok" with clean snapshot and writes PNG when --screenshot is passed', () => {
    const screenshotOut = join(REPO_ROOT, 'traces', 'test-ok-screenshot.png');
    rmSync(screenshotOut, { force: true });

    const run = runCli([
      'press',
      '4',
      '2',
      '--snapshot',
      '--screenshot',
      screenshotOut,
      '--url',
      BROKEN_FIXTURE_URL,
    ]);

    expect(run.status).toBe(0);
    const parsed = JSON.parse(run.stdout) as VerifyResult;
    expect(parsed.status).toBe('ok');
    expect(parsed.console_errors).toEqual([]);
    expect(parsed.ui_state?.display).toBe('42');
    expect(existsSync(screenshotOut)).toBe(true);
    rmSync(screenshotOut, { force: true });
  });

  it('omits ui_state when --snapshot is not passed and rejects non-pressable keys', () => {
    const withoutSnapshot = runCli(['press', '4', '2', '--url', BROKEN_FIXTURE_URL]);
    expect(withoutSnapshot.status).toBe(0);
    const parsedNoSnap = JSON.parse(withoutSnapshot.stdout) as VerifyResult;
    expect(parsedNoSnap.ui_state).toBeNull();

    const invalidPress = runCli([
      'press',
      'display-current',
      '--snapshot',
      '--url',
      BROKEN_FIXTURE_URL,
    ]);
    expect(invalidPress.status).toBe(1);
    const parsedInvalid = JSON.parse(invalidPress.stdout) as VerifyResult;
    expect(parsedInvalid.status).toBe('error');
    expect(parsedInvalid.console_errors[0]).toContain('not a pressable control');
  });

  it('is idempotent across repeated runs from a fresh browser context', () => {
    const args = ['press', '7', '3', '--snapshot', '--url', BROKEN_FIXTURE_URL];
    const first = runCli(args);
    const second = runCli(args);

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(JSON.parse(first.stdout)).toEqual(JSON.parse(second.stdout));
  });

  it('safely rejects code-injection payloads in Expression Input against the live app with zero pageerrors', async () => {
    const server = await startViteServer(5176);

    try {
      for (const payload of ['process.exit(1)', "alert('xss')"]) {
        const run = runCli([
          'type-expression',
          payload,
          '--submit',
          '--snapshot',
          '--url',
          server.url,
        ]);

        expect(run.status).toBe(0);
        const parsed = JSON.parse(run.stdout) as VerifyResult;
        expect(parsed.status).toBe('ok');
        expect(parsed.console_errors).toEqual([]);
        expect(parsed.ui_state?.display).toBe('Invalid expression');
        expect(parsed.ui_state?.error_state).toBe(true);
      }
    } finally {
      server.stop();
    }
  });
});
