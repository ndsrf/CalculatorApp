import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type RunningViteServer, startViteServer } from '../scripts/dev-server.ts';

const VOCABULARY_PORT = 5175;
const featureMap = readFileSync(
  join(resolve(import.meta.dirname, '..'), 'docs', 'feature-map.md'),
  'utf-8',
);

function featureFor(cliKey: string): { name: string; selector: string } {
  const row = featureMap.match(
    new RegExp(`^\\|\\s*([^|]+?)\\s*\\|\\s*\`${cliKey}\`\\s*\\|\\s*\`([^\`]+)\``, 'm'),
  );
  if (!row) {
    throw new Error(`docs/feature-map.md has no row for '${cliKey}'`);
  }
  return { name: row[1], selector: row[2] };
}

describe('UI vocabulary matches the Feature Map', () => {
  let server: RunningViteServer;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    server = await startViteServer(VOCABULARY_PORT);
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.goto(server.url, { waitUntil: 'domcontentloaded' });
  }, 30000);

  afterAll(async () => {
    await browser?.close();
    server?.stop();
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
