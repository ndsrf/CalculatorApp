import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadVersionedPrompt } from '../src/ai/prompt.ts';
import { loadDotEnvIfPresent } from './env.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const PROMPT_PATH = join(REPO_ROOT, 'prompts', 'doc-generator-agent.md');
const USER_GUIDE_PATH = join(REPO_ROOT, 'docs', 'USER-GUIDE.md');
const RELEASE_NOTES_PATH = join(REPO_ROOT, 'docs', 'RELEASE-NOTES.md');

interface CliOptions {
  dryRun: boolean;
  since?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--since' && argv[i + 1]) {
      options.since = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--since=')) {
      options.since = arg.slice('--since='.length);
    }
  }
  return options;
}

function git(args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function readPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
    version?: string;
  };
  return pkg.version ?? '0.0.0';
}

function resolveGitRange(since?: string): { label: string; commits: string[] } {
  const latestTag = since ?? git(['describe', '--tags', '--abbrev=0']);
  const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';
  const raw = git(['log', range, '--pretty=format:%h %ad %s', '--date=short', '-n', '20']);
  const commits = raw ? raw.split('\n').filter(Boolean) : [];
  return { label: latestTag ? `${latestTag} → HEAD` : 'Recent commits', commits };
}

function readSpecSummaries(): Array<{ name: string; content: string }> {
  const specsDir = join(REPO_ROOT, 'openspec', 'specs');
  if (!existsSync(specsDir)) {
    return [];
  }
  return readdirSync(specsDir)
    .sort()
    .map((dir) => {
      const specPath = join(specsDir, dir, 'spec.md');
      return existsSync(specPath)
        ? { name: dir, content: readFileSync(specPath, 'utf-8') }
        : undefined;
    })
    .filter((item): item is { name: string; content: string } => Boolean(item));
}

function listArchivedChanges(): string[] {
  const archiveDir = join(REPO_ROOT, 'openspec', 'changes', 'archive');
  if (!existsSync(archiveDir)) {
    return [];
  }
  return readdirSync(archiveDir)
    .filter((entry) => !entry.startsWith('.'))
    .sort();
}

function extractPurpose(specMarkdown: string): string {
  const match = specMarkdown.match(/##\s+Purpose\s*\r?\n+([^\n]+)/i);
  return match ? match[1].trim() : '';
}

function buildDeterministicUserGuide(
  version: string,
  specs: Array<{ name: string; content: string }>,
): string {
  const specBullets = specs
    .map((spec) => {
      const purpose = extractPurpose(spec.content);
      return purpose ? `- **${spec.name}:** ${purpose}` : `- **${spec.name}**`;
    })
    .join('\n');

  return [
    `# Calculator App User Guide (v${version})`,
    '',
    '> Auto-generated from `docs/feature-map.md`, `docs/glossary.md`, and `openspec/specs/` via `npm run docs:generate`. Do not edit manually.',
    '',
    '## Using the Calculator',
    '',
    '- **Standard Keypad:** Tap digits `0`–`9` and operators (`+`, `-`, `*`, `/`), then press **Equals** to evaluate. Use **Clear Entry (CE)** to clear the current entry or **All Clear (AC)** to reset everything.',
    '- **Expression Input:** Type full parenthesized arithmetic expressions (for example, `(12 + 8) / 4`) and press **Submit Expression**.',
    '- **Natural Language Input:** Ask an arithmetic question in everyday words (for example, `15% of 80, plus 5`) and press **Translate Question**. The **Expression Translator** writes the expression into the **Expression Input** and displays the result in the **Primary Readout**.',
    '- **Error State Recovery:** If an invalid operation occurs (such as division by zero, a syntax error, or a **Translation Refusal**), the **Primary Readout** shows an error message and locks operators until you press **All Clear (AC)**.',
    '',
    '## Specified Capabilities',
    '',
    specBullets,
    '',
  ].join('\n');
}

function buildDeterministicReleaseNotes(
  version: string,
  rangeLabel: string,
  commits: string[],
  archives: string[],
): string {
  const today = new Date().toISOString().slice(0, 10);
  const archiveLines =
    archives.length > 0 ? archives.map((entry) => `- \`${entry}\``).join('\n') : '- None recorded.';
  const commitLines =
    commits.length > 0 ? commits.map((line) => `- ${line}`).join('\n') : '- No commits in range.';

  return [
    `# Release Notes — v${version} (${today})`,
    '',
    '> Auto-generated from `package.json`, `openspec/changes/archive/`, and `git log` via `npm run docs:generate`. Do not edit manually.',
    '',
    `## Archived OpenSpec Changes`,
    '',
    archiveLines,
    '',
    `## Git History (${rangeLabel})`,
    '',
    commitLines,
    '',
  ].join('\n');
}

async function generateWithModel(
  systemPrompt: string,
  contextPayload: string,
  maxTokens: number,
): Promise<{ userGuide: string; releaseNotes: string } | undefined> {
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const model = process.env.AI_MODEL_LIGHTWEIGHT?.trim();
  if (process.env.AI_FORCE_STUB === '1' || !baseUrl || !model) {
    return undefined;
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const apiKey = process.env.AI_API_KEY?.trim();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${contextPayload}\n\nReturn JSON with exactly two string keys: "userGuide" and "releaseNotes".`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Model provider returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = body.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    return undefined;
  }

  const parsed = JSON.parse(raw) as { userGuide?: string; releaseNotes?: string };
  if (typeof parsed.userGuide === 'string' && typeof parsed.releaseNotes === 'string') {
    return {
      userGuide: `${parsed.userGuide.trim()}\n`,
      releaseNotes: `${parsed.releaseNotes.trim()}\n`,
    };
  }
  return undefined;
}

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const options = parseArgs(process.argv.slice(2));
  const prompt = loadVersionedPrompt(PROMPT_PATH);
  const version = readPackageVersion();
  const { label: rangeLabel, commits } = resolveGitRange(options.since);
  const specs = readSpecSummaries();
  const archives = listArchivedChanges();

  const contextPayload = JSON.stringify({ version, rangeLabel, commits, archives, specs }, null, 2);
  const aiOutput = await generateWithModel(prompt.body, contextPayload, prompt.limits.maxTokens);

  const userGuide = aiOutput?.userGuide ?? buildDeterministicUserGuide(version, specs);
  const releaseNotes =
    aiOutput?.releaseNotes ??
    buildDeterministicReleaseNotes(version, rangeLabel, commits, archives);

  const mode = aiOutput
    ? `model (${prompt.id}@${prompt.version})`
    : `offline-deterministic (${prompt.id}@${prompt.version})`;

  if (options.dryRun) {
    console.log(`=== Dry Run [${mode}] ===\n`);
    console.log(userGuide);
    console.log('---\n');
    console.log(releaseNotes);
    return;
  }

  mkdirSync(dirname(USER_GUIDE_PATH), { recursive: true });
  writeFileSync(USER_GUIDE_PATH, userGuide, 'utf-8');
  writeFileSync(RELEASE_NOTES_PATH, releaseNotes, 'utf-8');
  console.log(`Generated docs/USER-GUIDE.md and docs/RELEASE-NOTES.md via ${mode}.`);
}

void main();
