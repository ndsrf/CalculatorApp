import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type BrowserContext, chromium } from 'playwright';

export const DEFAULT_URL = 'http://localhost:5173';

export const PRESSABLE_KEY_SELECTORS = {
  '0': '[data-key="0"]',
  '1': '[data-key="1"]',
  '2': '[data-key="2"]',
  '3': '[data-key="3"]',
  '4': '[data-key="4"]',
  '5': '[data-key="5"]',
  '6': '[data-key="6"]',
  '7': '[data-key="7"]',
  '8': '[data-key="8"]',
  '9': '[data-key="9"]',
  add: '[data-op="add"]',
  subtract: '[data-op="subtract"]',
  multiply: '[data-op="multiply"]',
  divide: '[data-op="divide"]',
  equals: '[data-action="equals"]',
  ce: '[data-action="ce"]',
  ac: '[data-action="ac"]',
  'submit-expression': '[data-action="submit-expression"]',
} as const;

export type PressableKey = keyof typeof PRESSABLE_KEY_SELECTORS;

export const FEATURE_SELECTORS: Record<string, string> = {
  'display-current': '#display-current',
  'expression-input': '#expression-input',
  ...PRESSABLE_KEY_SELECTORS,
};

export interface UiSnapshot {
  display: string;
  expression_input: string;
  error_state: boolean;
  operators_disabled: boolean;
}

export interface VerifyArtifacts {
  screenshot?: string;
  trace?: string;
}

export interface VerifyResult {
  status: 'ok' | 'error';
  ui_state: UiSnapshot | null;
  console_errors: string[];
  artifacts?: VerifyArtifacts;
}

interface CommonCliOptions {
  snapshot: boolean;
  url: string;
  screenshotPath?: string;
  tracePath?: string;
}

export type CliCommand =
  | ({ kind: 'press'; keys: PressableKey[] } & CommonCliOptions)
  | ({ kind: 'type-expression'; expression: string; submit: boolean } & CommonCliOptions);

function isPressableKey(key: string): key is PressableKey {
  return key in PRESSABLE_KEY_SELECTORS;
}

function normalizeUrl(rawUrl: string): string {
  if (/^(https?|file):\/\//i.test(rawUrl)) {
    return rawUrl;
  }
  return pathToFileURL(resolve(rawUrl)).href;
}

function readFlagValue(argv: string[], index: number, flag: string): { value: string; nextIndex: number } {
  const arg = argv[index];
  if (arg === flag) {
    const next = argv[index + 1];
    if (!next) {
      throw new Error(`Missing value for ${flag}`);
    }
    return { value: next, nextIndex: index + 1 };
  }
  const value = arg.slice(flag.length + 1);
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return { value, nextIndex: index };
}

export function parseCliArgs(argv: string[]): CliCommand {
  let url = DEFAULT_URL;
  let snapshot = false;
  let submit = false;
  let screenshotPath: string | undefined;
  let tracePath: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url' || arg.startsWith('--url=')) {
      const parsed = readFlagValue(argv, i, '--url');
      url = parsed.value;
      i = parsed.nextIndex;
    } else if (arg === '--screenshot' || arg.startsWith('--screenshot=')) {
      const parsed = readFlagValue(argv, i, '--screenshot');
      screenshotPath = resolve(parsed.value);
      i = parsed.nextIndex;
    } else if (arg === '--trace' || arg.startsWith('--trace=')) {
      const parsed = readFlagValue(argv, i, '--trace');
      tracePath = resolve(parsed.value);
      i = parsed.nextIndex;
    } else if (arg === '--snapshot') {
      snapshot = true;
    } else if (arg === '--submit') {
      submit = true;
    } else {
      positional.push(arg);
    }
  }

  const subcommand = positional[0];
  if (subcommand === 'press') {
    const rawKeys = positional.slice(1);
    if (rawKeys.length === 0) {
      throw new Error('press requires at least one key argument');
    }
    const keys: PressableKey[] = [];
    for (const key of rawKeys) {
      if (!isPressableKey(key)) {
        throw new Error(`Key '${key}' is not a pressable control in docs/feature-map.md.`);
      }
      keys.push(key);
    }
    return {
      kind: 'press',
      keys,
      snapshot,
      url: normalizeUrl(url),
      screenshotPath,
      tracePath,
    };
  }

  if (subcommand === 'type-expression') {
    const expression = positional[1];
    if (expression === undefined) {
      throw new Error('type-expression requires an expression string argument');
    }
    return {
      kind: 'type-expression',
      expression,
      submit,
      snapshot,
      url: normalizeUrl(url),
      screenshotPath,
      tracePath,
    };
  }

  throw new Error(
    'Usage:\n  calc-verify press <keys...> [--snapshot] [--screenshot <path>] [--trace <path>] [--url <url>]\n  calc-verify type-expression "<expr>" [--submit] [--snapshot] [--screenshot <path>] [--trace <path>] [--url <url>]'
  );
}

async function stopTracing(
  context: BrowserContext,
  targetTracePath: string | undefined,
  artifacts: VerifyArtifacts
): Promise<void> {
  if (targetTracePath) {
    mkdirSync(dirname(targetTracePath), { recursive: true });
    await context.tracing.stop({ path: targetTracePath });
    artifacts.trace = targetTracePath;
  } else {
    await context.tracing.stop();
  }
}

export async function runVerify(command: CliCommand): Promise<VerifyResult> {
  const consoleErrors: string[] = [];
  const artifacts: VerifyArtifacts = {};
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const autoFailureTracePath = resolve('traces', 'last-failure-trace.zip');
  let tracingStarted = false;

  try {
    await context.tracing.start({ screenshots: true, snapshots: true });
    tracingStarted = true;

    const page = await context.newPage();

    page.on('pageerror', (err) => {
      consoleErrors.push(err.message ? `${err.name}: ${err.message}` : String(err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(command.url, { waitUntil: 'domcontentloaded' });

    if (command.kind === 'press') {
      for (const key of command.keys) {
        const selector = PRESSABLE_KEY_SELECTORS[key];
        const locator = page.locator(selector);
        await locator.waitFor({ state: 'attached', timeout: 5000 });
        if (!(await locator.isDisabled())) {
          await locator.click({ timeout: 5000 });
        }
      }
    } else {
      const inputLocator = page.locator(FEATURE_SELECTORS['expression-input']);
      await inputLocator.waitFor({ state: 'attached', timeout: 5000 });
      if (!(await inputLocator.isDisabled())) {
        await inputLocator.fill(command.expression);
      }

      if (command.submit) {
        const submitLocator = page.locator(PRESSABLE_KEY_SELECTORS['submit-expression']);
        await submitLocator.waitFor({ state: 'attached', timeout: 5000 });
        if (!(await submitLocator.isDisabled())) {
          await submitLocator.click({ timeout: 5000 });
        }
      }
    }

    if (command.screenshotPath) {
      mkdirSync(dirname(command.screenshotPath), { recursive: true });
      await page.screenshot({ path: command.screenshotPath, fullPage: true });
      artifacts.screenshot = command.screenshotPath;
    }

    let uiState: UiSnapshot | null = null;
    if (command.snapshot) {
      const displayLocator = page.locator(FEATURE_SELECTORS['display-current']);
      const expressionLocator = page.locator(FEATURE_SELECTORS['expression-input']);
      const displayText = ((await displayLocator.textContent()) ?? '').trim();
      const expressionValue =
        (await expressionLocator.count()) > 0 ? await expressionLocator.inputValue() : '';

      const operatorSelectors = ['add', 'subtract', 'multiply', 'divide'].map(
        (op) => FEATURE_SELECTORS[op]
      );
      const disabledChecks = await Promise.all(
        operatorSelectors.map(async (sel) => {
          const loc = page.locator(sel);
          return (await loc.count()) > 0 ? loc.isDisabled() : false;
        })
      );
      const operatorsDisabled = disabledChecks.every(Boolean);

      uiState = {
        display: displayText,
        expression_input: expressionValue,
        error_state: operatorsDisabled,
        operators_disabled: operatorsDisabled,
      };
    }

    const status: 'ok' | 'error' = consoleErrors.length > 0 ? 'error' : 'ok';
    if (tracingStarted) {
      const targetTracePath =
        command.tracePath ?? (status === 'error' ? autoFailureTracePath : undefined);
      await stopTracing(context, targetTracePath, artifacts);
      tracingStarted = false;
    }

    return {
      status,
      ui_state: uiState,
      console_errors: consoleErrors,
      ...(Object.keys(artifacts).length > 0 ? { artifacts } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    consoleErrors.push(message);
    if (tracingStarted) {
      await stopTracing(context, command.tracePath ?? autoFailureTracePath, artifacts);
    }
    return {
      status: 'error',
      ui_state: null,
      console_errors: consoleErrors,
      ...(Object.keys(artifacts).length > 0 ? { artifacts } : {}),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main(): Promise<void> {
  try {
    const command = parseCliArgs(process.argv.slice(2));
    const result = await runVerify(command);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.status === 'ok' ? 0 : 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure: VerifyResult = {
      status: 'error',
      ui_state: null,
      console_errors: [message],
    };
    process.stdout.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exit(1);
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.filename);

if (isEntrypoint) {
  void main();
}
