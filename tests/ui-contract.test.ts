import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type RunningViteServer, startViteServer } from '../scripts/dev-server.ts';

const CONTRACT_PORT = 5175;
const featureMap = readFileSync(
  join(resolve(import.meta.dirname, '..'), 'docs', 'feature-map.md'),
  'utf-8',
);

const features = Array.from(
  featureMap.matchAll(/^\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|$/gm),
  ([, name, cliKey, selector]) => ({ name, cliKey, selector }),
);

function featureFor(cliKey: string): (typeof features)[number] {
  const feature = features.find((entry) => entry.cliKey === cliKey);
  if (!feature) {
    throw new Error(`docs/feature-map.md has no row for '${cliKey}'`);
  }
  return feature;
}

describe('UI matches the Feature Map', () => {
  let server: RunningViteServer;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    server = await startViteServer(CONTRACT_PORT);
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.goto(server.url, { waitUntil: 'domcontentloaded' });
  }, 30000);

  afterAll(async () => {
    await browser?.close();
    server?.stop();
  });

  it('reads every documented control', () => {
    expect(features.length).toBeGreaterThanOrEqual(22);
  });

  it.each(features)('renders $name exactly once at $selector', async ({ selector }) => {
    expect(await page.locator(selector).count()).toBe(1);
  });

  it.each([
    ['expression-input', 'textbox'],
    ['natural-language-input', 'textbox'],
    ['submit-expression', 'button'],
    ['translate-question', 'button'],
  ] as const)('exposes %s under its canonical name', async (cliKey, role) => {
    const { name, selector } = featureFor(cliKey);
    const byName = page.getByRole(role, { name, exact: true });
    expect(await byName.count()).toBe(1);
    expect(await byName.and(page.locator(selector)).count()).toBe(1);
    if (role === 'button') {
      expect((await byName.innerText()).trim()).toBe(name);
    }
  });
});
