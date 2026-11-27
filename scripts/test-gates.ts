import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { applyEdit, GATE_VIOLATIONS, type GateViolation } from './gate-violations.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const HOOK_PREFIX = '.agents/hooks/';
const TIMEOUT_MS = 180_000;

export interface CommandResult {
  exitCode: number | null;
  output: string;
}

export function judge(
  expected: GateViolation['expected'],
  result: CommandResult,
): string | undefined {
  if (result.exitCode === 0) {
    return 'The gate passed, so nothing caught the violation.';
  }
  if (result.exitCode === null) {
    return 'The command did not finish.';
  }
  if (expected.exitCode !== undefined && result.exitCode !== expected.exitCode) {
    return `Expected exit code ${expected.exitCode}, got ${result.exitCode}.`;
  }
  const missing = expected.output.find((pattern) => !pattern.test(result.output));
  return missing ? `Failed for another reason: output does not match ${missing}.` : undefined;
}

function git(args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8', env }).trim();
}

// A commit of the working tree, including uncommitted files that are not ignored. It is built in a
// scratch index, so the user's branch, index, and files stay as they are.
function snapshotWorkingTree(scratch: string): string {
  const env = {
    ...process.env,
    GIT_INDEX_FILE: join(scratch, 'index'),
    GIT_AUTHOR_NAME: 'gate-test',
    GIT_AUTHOR_EMAIL: 'gate-test@localhost',
    GIT_COMMITTER_NAME: 'gate-test',
    GIT_COMMITTER_EMAIL: 'gate-test@localhost',
  };
  git(['read-tree', 'HEAD'], env);
  git(['add', '--all'], env);
  const tree = git(['write-tree'], env);
  return git(['commit-tree', tree, '-p', 'HEAD', '-m', 'gate test snapshot'], env);
}

// Eval tables truncate their reasons, so failed cases are read from the JSON report instead.
function readEvalFailures(reportPath: string): string {
  if (!existsSync(reportPath)) {
    return '';
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf-8')) as {
    results: {
      results: Array<{
        success: boolean;
        testCase: { description?: string };
        gradingResult?: { reason?: string };
      }>;
    };
  };
  return report.results.results
    .filter((entry) => !entry.success)
    .map((entry) => `FAIL ${entry.testCase.description}: ${entry.gradingResult?.reason}`)
    .join('\n');
}

function runCommand(
  command: string,
  worktree: string,
  snapshot: string,
  extraEnv: Record<string, string> = {},
): CommandResult {
  const reportPath = join(worktree, 'gate-eval-report.json');
  rmSync(reportPath, { force: true });
  const isEval = command === 'npm run eval';
  const isHook = command.startsWith(HOOK_PREFIX);
  // The hook's README command ends in `echo $?`, which would hide the exit code being checked.
  const script = isHook ? command.split(';')[0] : command;

  const run = spawnSync('bash', ['-c', isEval ? `${script} -- --output ${reportPath}` : script], {
    cwd: worktree,
    encoding: 'utf-8',
    timeout: TIMEOUT_MS,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      AI_FORCE_STUB: '1',
      ALLOW_VERIFY_EDIT: '0',
      PROMPT_BASE_REF: snapshot,
      ...extraEnv,
    },
  });
  const output = `${run.stdout}\n${run.stderr}\n${isEval ? readEvalFailures(reportPath) : ''}`;
  return { exitCode: run.status, output: stripVTControlCharacters(output) };
}

function withWorktree<T>(scratch: string, snapshot: string, use: (path: string) => T): T {
  const path = join(scratch, 'worktree');
  git(['worktree', 'add', '--detach', '--quiet', path, snapshot]);
  try {
    symlinkSync(join(REPO_ROOT, 'node_modules'), join(path, 'node_modules'));
    return use(path);
  } finally {
    git(['worktree', 'remove', '--force', path]);
  }
}

function breakGate(violation: GateViolation, worktree: string): void {
  for (const edit of violation.edits) {
    const path = join(worktree, edit.file);
    const content = existsSync(path) ? readFileSync(path, 'utf-8') : undefined;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, applyEdit(content, edit), 'utf-8');
  }
}

function lastLines(output: string): string {
  return output.trim().split('\n').slice(-25).join('\n');
}

function main(): void {
  const scratch = mkdtempSync(join(tmpdir(), 'gate-test-'));
  const problems: string[] = [];
  try {
    const snapshot = snapshotWorkingTree(scratch);

    console.log('Baseline: every gate must pass before anything is broken.\n');
    withWorktree(scratch, snapshot, (worktree) => {
      const baselines = new Map(GATE_VIOLATIONS.map((entry) => [entry.command, entry.passingEnv]));
      for (const [command, passingEnv] of baselines) {
        const result = runCommand(command, worktree, snapshot, passingEnv);
        console.log(`  ${result.exitCode === 0 ? 'PASS' : 'FAIL'}  ${command}`);
        if (result.exitCode !== 0) {
          problems.push(`Baseline failed: ${command}\n${lastLines(result.output)}`);
        }
      }
    });

    if (problems.length === 0) {
      console.log('\nViolations: each gate must fail, and for the stated reason.\n');
      for (const violation of GATE_VIOLATIONS) {
        withWorktree(scratch, snapshot, (worktree) => {
          breakGate(violation, worktree);
          const result = runCommand(violation.command, worktree, snapshot);
          const problem = judge(violation.expected, result);
          console.log(`  ${problem ? 'MISSED' : 'CAUGHT'}  ${violation.tryThis}`);
          if (problem) {
            problems.push(`${violation.tryThis}\n${problem}\n${lastLines(result.output)}`);
          }
        });
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  if (problems.length > 0) {
    console.error(`\nGate test failed:\n\n${problems.join('\n\n')}`);
    process.exit(1);
  }
  console.log(`\nAll ${GATE_VIOLATIONS.length} violations were caught.`);
}

if (process.argv[1] === import.meta.filename) {
  main();
}
