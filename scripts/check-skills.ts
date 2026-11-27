import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');

interface SkillsLock {
  skills: Record<string, { computedHash: string }>;
}

// Mirrors the version 2 `computedHash` of the `skills` CLI that writes skills-lock.json,
// including the files it leaves out and its line-ending normalization.
export function hashSkillFolder(directory: string): string {
  const files = readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== 'metadata.json')
    .map((entry) => {
      const fullPath = join(entry.parentPath, entry.name);
      return { path: relative(directory, fullPath).split(sep).join('/'), fullPath };
    })
    .filter(({ path }) => !/(^|\/)(\.git|__pycache__|__pypackages__)\//.test(path))
    .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));

  const hash = createHash('sha256');
  for (const { path, fullPath } of files) {
    let content = readFileSync(fullPath);
    if (!content.includes(0) && content.includes('\r\n')) {
      content = Buffer.from(content.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
    }
    hash.update(path).update('\0').update(String(content.length)).update('\0').update(content);
  }
  return hash.digest('hex');
}

export function findSkillViolations(skillsDirectory: string, lock: SkillsLock): string[] {
  const violations: string[] = [];
  for (const [name, { computedHash }] of Object.entries(lock.skills)) {
    const directory = join(skillsDirectory, name);
    if (!existsSync(directory)) {
      violations.push(`Skill '${name}' is in skills-lock.json but not installed.`);
    } else if (hashSkillFolder(directory) !== computedHash) {
      violations.push(`Skill '${name}' does not match its hash in skills-lock.json.`);
    }
  }
  for (const entry of readdirSync(skillsDirectory)) {
    if (!Object.hasOwn(lock.skills, entry)) {
      violations.push(`'${entry}' is in .agents/skills/ but not in skills-lock.json.`);
    }
  }
  return violations;
}

function main(): void {
  const lock = JSON.parse(readFileSync(join(REPO_ROOT, 'skills-lock.json'), 'utf-8')) as SkillsLock;
  const violations = findSkillViolations(join(REPO_ROOT, '.agents', 'skills'), lock);
  if (violations.length > 0) {
    console.error('Skill lint failed:\n');
    for (const violation of violations) {
      console.error(`  ${violation}`);
    }
    process.exit(1);
  }
  console.log(`Skill lint passed (${Object.keys(lock.skills).length} vendored skills match).`);
}

if (process.argv[1] === import.meta.filename) {
  main();
}
