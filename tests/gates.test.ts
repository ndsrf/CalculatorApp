import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyEdit, GATE_VIOLATIONS } from '../scripts/gate-violations.ts';
import { judge } from '../scripts/test-gates.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..');

function read(file: string): string | undefined {
  const path = join(REPO_ROOT, file);
  return existsSync(path) ? readFileSync(path, 'utf-8') : undefined;
}

function readBreakItTable() {
  const section = read('README.md')
    ?.split(/^## Learn by Breaking It.*$/m)[1]
    ?.split(/^## /m)[0];
  return Array.from(
    (section ?? '').matchAll(/^\|\s*(\d)\s*\|([^|]+)\|\s*`([^|]+)`\s*\|/gm),
    ([, idea, tryThis, command]) => ({ idea: Number(idea), tryThis: tryThis.trim(), command }),
  );
}

describe('gate violations', () => {
  it('lists the same rows as the README table', () => {
    const listed = GATE_VIOLATIONS.map(({ idea, tryThis, command }) => ({
      idea,
      tryThis,
      command,
    }));
    expect(readBreakItTable()).toEqual(listed);
  });

  it.each(GATE_VIOLATIONS)('still applies to the code: $tryThis', ({ edits }) => {
    for (const edit of edits) {
      expect(() => applyEdit(read(edit.file), edit)).not.toThrow();
    }
  });

  it.each([
    ['the text to replace is missing', 'abc', { file: 'f', find: 'x', replace: 'y' }],
    ['the text to replace is ambiguous', 'x x', { file: 'f', find: 'x', replace: 'y' }],
    ['the file to append to is missing', undefined, { file: 'f', append: 'y' }],
    ['the file to create already exists', 'abc', { file: 'f', create: 'y' }],
  ])('refuses an edit when %s', (_reason, content, edit) => {
    expect(() => applyEdit(content, edit)).toThrow();
  });
});

describe('gate verdict', () => {
  const expected = { output: [/banned synonym/] };

  it('counts a failure for the stated reason', () => {
    expect(judge(expected, { exitCode: 1, output: 'banned synonym' })).toBeUndefined();
  });

  it.each([
    ['passed', { exitCode: 0, output: 'banned synonym' }, 'passed'],
    ['timed out', { exitCode: null, output: 'banned synonym' }, 'did not finish'],
    ['failed for another reason', { exitCode: 1, output: 'SyntaxError' }, 'another reason'],
  ])('reports a gate that %s', (_name, result, message) => {
    expect(judge(expected, result)).toContain(message);
  });

  it('requires the stated exit code', () => {
    const result = { exitCode: 1, output: 'banned synonym' };
    expect(judge({ ...expected, exitCode: 2 }, result)).toContain('exit code 2');
  });
});
