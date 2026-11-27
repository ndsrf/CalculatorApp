import { describe, expect, it } from 'vitest';
import { findPromptViolations } from '../scripts/check-prompts.ts';

const prompt = (version: string, body = 'Translate.') => `---\nversion: ${version}\n---\n${body}\n`;
const cases = (...questions: string[]) =>
  questions.map((question) => `- vars: { question: '${question}' }`).join('\n');
const path = 'prompts/expression-translator.md';

describe('prompt lint', () => {
  it('accepts an unchanged prompt', () => {
    const content = prompt('1.0.0');
    const dataset = { before: cases('a'), after: cases('a') };
    expect(findPromptViolations([{ path, before: content, after: content, dataset }])).toEqual([]);
  });

  it('accepts a change with a higher version and a new golden case', () => {
    const change = {
      path,
      before: prompt('1.9.0'),
      after: prompt('1.10.0', 'Translate carefully.'),
      dataset: { before: cases('a'), after: cases('a', 'b') },
    };
    expect(findPromptViolations([change])).toEqual([]);
  });

  it.each(['1.0.0', '0.9.0'])('rejects a body change that leaves the version at %s', (version) => {
    const change = { path, before: prompt('1.0.0'), after: prompt(version, 'New body.') };
    expect(findPromptViolations([change])).toEqual([expect.stringContaining('version')]);
  });

  it('rejects a change that only rewrites existing golden cases', () => {
    const change = {
      path,
      before: prompt('1.0.0'),
      after: prompt('1.0.1', 'New body.'),
      dataset: { before: cases('a', 'b'), after: cases('b') },
    };
    expect(findPromptViolations([change])).toEqual([expect.stringContaining('golden case')]);
  });
});
