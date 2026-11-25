import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const HOOK = join(REPO_ROOT, '.agents', 'hooks', 'pre-tool-guard.sh');

function runHook(options: { arg?: string; stdin?: string; env?: Record<string, string> }) {
  return spawnSync('bash', options.arg ? [HOOK, options.arg] : [HOOK], {
    cwd: REPO_ROOT,
    input: options.stdin ?? '',
    env: { ...process.env, ALLOW_VERIFY_EDIT: '0', ...options.env },
    encoding: 'utf-8',
  });
}

describe('pre-tool-guard hook', () => {
  it.each([
    'tools/calc-verify/index.ts',
    './tools/calc-verify/index.ts',
    'src/../tools/calc-verify/index.ts',
    'tools//calc-verify/index.ts',
    join(REPO_ROOT, 'tools/calc-verify/index.ts'),
  ])('blocks edits to the verification harness via %s', (path) => {
    const result = runHook({ arg: path });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('BLOCKED');
  });

  it('allows harness edits only with explicit human authorization', () => {
    const result = runHook({
      arg: 'tools/calc-verify/index.ts',
      env: { ALLOW_VERIFY_EDIT: '1' },
    });
    expect(result.status).toBe(0);
  });

  it('blocks spec folders that are not anchored in the Feature Map', () => {
    expect(runHook({ arg: 'openspec/specs/unmapped-feature/spec.md' }).status).toBe(2);
    expect(runHook({ arg: 'openspec/specs/orphan.md' }).status).toBe(2);
    expect(runHook({ arg: 'openspec/specs/keypad/spec.md' }).status).toBe(0);
  });

  it('reads the target path from an agent hook JSON payload on stdin', () => {
    const blocked = runHook({
      stdin: JSON.stringify({
        tool_name: 'Edit',
        tool_input: { file_path: 'tools/calc-verify/x.ts' },
      }),
    });
    expect(blocked.status).toBe(2);

    const allowed = runHook({
      stdin: JSON.stringify({ tool_input: { file_path: 'src/core/parser.ts' } }),
    });
    expect(allowed.status).toBe(0);
  });

  it('lets tool calls without a file path through', () => {
    const result = runHook({ stdin: JSON.stringify({ tool_input: { command: 'npm test' } }) });
    expect(result.status).toBe(0);
  });
});
