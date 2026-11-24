import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEATURE_SELECTORS } from '../index.ts';

interface DocumentedSelector {
  featureName: string;
  cliKey: string;
  selector: string;
}

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const FEATURE_MAP_PATH = join(REPO_ROOT, 'docs', 'feature-map.md');

function parseFeatureMapSelectors(markdown: string): DocumentedSelector[] {
  const entries: DocumentedSelector[] = [];
  const rowRegex = /^\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|$/gm;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(markdown)) !== null) {
    entries.push({
      featureName: match[1].trim(),
      cliKey: match[2].trim(),
      selector: match[3].trim(),
    });
  }

  return entries;
}

describe('calc-verify Feature Map contract', () => {
  const featureMapContent = readFileSync(FEATURE_MAP_PATH, 'utf-8');
  const documented = parseFeatureMapSelectors(featureMapContent);

  it('parses all documented selectors from docs/feature-map.md', () => {
    expect(documented.length).toBeGreaterThanOrEqual(19);
  });

  it('supports every key and exact DOM selector documented in docs/feature-map.md', () => {
    for (const entry of documented) {
      expect(
        FEATURE_SELECTORS[entry.cliKey],
        `Missing or mismatched selector for '${entry.featureName}' (key '${entry.cliKey}')`,
      ).toBe(entry.selector);
    }
  });

  it('does not drift with undocumented keys in FEATURE_SELECTORS', () => {
    const documentedKeys = new Set(documented.map((item) => item.cliKey));
    for (const cliKey of Object.keys(FEATURE_SELECTORS)) {
      expect(
        documentedKeys.has(cliKey),
        `FEATURE_SELECTORS contains undocumented key '${cliKey}' not found in docs/feature-map.md`,
      ).toBe(true);
    }
  });
});
