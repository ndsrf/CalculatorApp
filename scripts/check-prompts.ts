import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load as parseYaml } from 'js-yaml';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const GOLDEN_DATASETS: Readonly<Record<string, string>> = {
  'prompts/expression-translator.md': 'evals/golden-dataset.yaml',
};

export interface PromptChange {
  path: string;
  before: string;
  after: string;
  dataset?: { before: string; after: string };
}

function readVersion(content: string): number[] {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const { version } = (parseYaml(frontmatter) ?? {}) as { version?: unknown };
  return String(version ?? '0')
    .split('.')
    .map(Number);
}

function isNewerVersion(after: number[], before: number[]): boolean {
  for (let i = 0; i < Math.max(after.length, before.length); i += 1) {
    const difference = (after[i] ?? 0) - (before[i] ?? 0);
    if (difference !== 0) {
      return difference > 0;
    }
  }
  return false;
}

function readQuestions(dataset: string): string[] {
  const cases = (parseYaml(dataset) ?? []) as Array<{ vars?: { question?: string } }>;
  return cases.map((entry) => entry.vars?.question ?? '');
}

export function findPromptViolations(changes: PromptChange[]): string[] {
  const violations: string[] = [];
  for (const { path, before, after, dataset } of changes) {
    if (before === after) {
      continue;
    }
    if (!isNewerVersion(readVersion(after), readVersion(before))) {
      violations.push(`${path} changed without a higher 'version' in its frontmatter.`);
    }
    if (dataset) {
      const known = new Set(readQuestions(dataset.before));
      if (!readQuestions(dataset.after).some((question) => !known.has(question))) {
        violations.push(`${path} changed without a new golden case in ${GOLDEN_DATASETS[path]}.`);
      }
    }
  }
  return violations;
}

function git(args: string[]): string {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function resolveBase(): string {
  const requested = process.env.PROMPT_BASE_REF?.trim();
  if (requested) {
    return git(['rev-parse', '--verify', `${requested}^{commit}`]).trim();
  }
  return git(['merge-base', 'HEAD', 'origin/main']).trim();
}

function readAtBase(base: string, path: string): string | undefined {
  const tracked = git(['ls-tree', '--name-only', base, '--', path]).trim();
  return tracked ? git(['show', `${base}:${path}`]) : undefined;
}

function readWorkingTree(path: string): string {
  const fullPath = join(REPO_ROOT, path);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
}

function collectChanges(base: string): PromptChange[] {
  return readdirSync(join(REPO_ROOT, 'prompts'))
    .filter((file) => file.endsWith('.md'))
    .flatMap((file) => {
      const path = `prompts/${file}`;
      const before = readAtBase(base, path);
      if (before === undefined) {
        return [];
      }
      const datasetPath = GOLDEN_DATASETS[path];
      return [
        {
          path,
          before,
          after: readWorkingTree(path),
          dataset: datasetPath
            ? {
                before: readAtBase(base, datasetPath) ?? '',
                after: readWorkingTree(datasetPath),
              }
            : undefined,
        },
      ];
    });
}

function main(): void {
  let base: string;
  try {
    base = resolveBase();
  } catch {
    console.error(
      'Prompt lint could not find a base commit. Fetch origin/main, or set PROMPT_BASE_REF to the commit to compare against.',
    );
    process.exit(1);
  }

  const violations = findPromptViolations(collectChanges(base));
  if (violations.length > 0) {
    console.error(`Prompt lint failed (compared with ${base.slice(0, 7)}):\n`);
    for (const violation of violations) {
      console.error(`  ${violation}`);
    }
    process.exit(1);
  }
  console.log(`Prompt lint passed (compared with ${base.slice(0, 7)}).`);
}

if (process.argv[1] === import.meta.filename) {
  main();
}
