import fc from 'fast-check';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type RunningViteServer, startViteServer } from '../scripts/dev-server.ts';
import { FEATURE_SELECTORS, PRESSABLE_KEY_SELECTORS } from '../tools/calc-verify/index.ts';

const FUZZ_PORT = 5174;

type FuzzAction =
  | { kind: 'keypad'; selector: string }
  | { kind: 'expression'; text: string; submitVia: 'enter' | 'button' };

const KEYPAD_SELECTORS = Object.entries(PRESSABLE_KEY_SELECTORS)
  .filter(([key]) => key !== 'submit-expression')
  .map(([, selector]) => selector);

const MALFORMED_AND_VALID_EXPRESSIONS = [
  '(10 + 5) * 2',
  '8 / 0',
  '10 / (5 - 5)',
  '2 + * 3',
  '((1 + 2)',
  ')(',
  '1..2 + 3',
  '   ',
  'alert(1)',
  'Infinity + 1',
  'NaN',
  '-0',
];

const actionArb: fc.Arbitrary<FuzzAction> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.constantFrom(...KEYPAD_SELECTORS).map((selector) => ({
      kind: 'keypad' as const,
      selector,
    })),
  },
  {
    weight: 4,
    arbitrary: fc
      .record({
        text: fc.oneof(
          fc.constantFrom(...MALFORMED_AND_VALID_EXPRESSIONS),
          fc.string({ minLength: 0, maxLength: 18 }),
        ),
        submitVia: fc.constantFrom<'enter' | 'button'>('enter', 'button'),
      })
      .map((entry) => ({ kind: 'expression' as const, ...entry })),
  },
);

async function assertDisplayClean(page: Page): Promise<void> {
  const text = (
    (await page.locator(FEATURE_SELECTORS['display-current']).textContent()) ?? ''
  ).trim();
  expect(text).not.toContain('NaN');
  expect(text).not.toContain('undefined');
  expect(text).not.toContain('[object Object]');
  expect(text).not.toContain('Infinity');
  expect(text.length).toBeGreaterThan(0);
}

describe('UI property-based fuzzing (Playwright + fast-check)', () => {
  let server: RunningViteServer;
  let browser: Browser;

  beforeAll(async () => {
    server = await startViteServer(FUZZ_PORT);
    browser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    await browser?.close();
    server?.stop();
  });

  it('survives randomized browser interactions with zero errors, clean display, and reliable AC recovery', async () => {
    const page = await browser.newPage();
    const runtimeErrors: string[] = [];

    page.on('pageerror', (err) => {
      runtimeErrors.push(err.message ? `${err.name}: ${err.message}` : String(err));
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        runtimeErrors.push(msg.text());
      }
    });

    await page.goto(server.url, { waitUntil: 'domcontentloaded' });

    try {
      await fc.assert(
        fc.asyncProperty(fc.array(actionArb, { minLength: 5, maxLength: 18 }), async (actions) => {
          runtimeErrors.length = 0;
          await page.locator(PRESSABLE_KEY_SELECTORS.ac).click();

          for (const action of actions) {
            if (action.kind === 'keypad') {
              const btn = page.locator(action.selector);
              if (!(await btn.isDisabled())) {
                await btn.click();
              }
            } else {
              const input = page.locator(FEATURE_SELECTORS['expression-input']);
              if (!(await input.isDisabled())) {
                await input.fill(action.text);
                if (action.submitVia === 'enter') {
                  await input.press('Enter');
                } else {
                  const submitBtn = page.locator(PRESSABLE_KEY_SELECTORS['submit-expression']);
                  if (!(await submitBtn.isDisabled())) {
                    await submitBtn.click();
                  }
                }
              }
            }

            expect(runtimeErrors).toEqual([]);
            await assertDisplayClean(page);
          }

          await page.locator(PRESSABLE_KEY_SELECTORS.ac).click();
          expect(runtimeErrors).toEqual([]);
          expect(
            ((await page.locator(FEATURE_SELECTORS['display-current']).textContent()) ?? '').trim(),
          ).toBe('0');
          expect(await page.locator(FEATURE_SELECTORS['expression-input']).inputValue()).toBe('');
          expect(await page.locator(FEATURE_SELECTORS['expression-input']).isDisabled()).toBe(
            false,
          );
          expect(await page.locator(PRESSABLE_KEY_SELECTORS.add).isDisabled()).toBe(false);
        }),
        { numRuns: 15 },
      );
    } finally {
      await page.close();
    }
  }, 60000);
});
