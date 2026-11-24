import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

interface LintIssue {
  file: string;
  rule: string;
  message: string;
}

const REPO_ROOT = resolve(import.meta.dirname, '..');
const GLOSSARY_PATH = join(REPO_ROOT, 'docs', 'glossary.md');
const PERSONAS_PATH = join(REPO_ROOT, 'docs', 'personas.md');
const FEATURE_MAP_PATH = join(REPO_ROOT, 'docs', 'feature-map.md');
const SPECS_DIR = join(REPO_ROOT, 'openspec', 'specs');

function parseBannedSynonyms(glossaryContent: string): string[] {
  const sectionMatch = glossaryContent.match(/##\s+Banned Synonyms[\s\S]*$/i);
  if (!sectionMatch) {
    throw new Error('Could not find "## Banned Synonyms" section in docs/glossary.md');
  }

  const synonyms: string[] = [];
  const lines = sectionMatch[0].split('\n');
  for (const line of lines) {
    const rowMatch = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (rowMatch) {
      synonyms.push(rowMatch[1].trim());
    }
  }
  return synonyms;
}

function parseDefinedPersonas(personasContent: string): Set<string> {
  const matches = personasContent.match(/@persona:[a-z0-9-]+/g) ?? [];
  return new Set(matches);
}

function parseFeatureMapSections(featureMapContent: string): Set<string> {
  const sections = new Set<string>();
  const regex = /^##\s+`([a-z0-9-]+)`/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(featureMapContent)) !== null) {
    sections.add(match[1]);
  }
  return sections;
}

function collectMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      results.push(...collectMarkdownFiles(fullPath));
    } else if (entry.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main(): void {
  const glossaryContent = readFileSync(GLOSSARY_PATH, 'utf-8');
  const personasContent = readFileSync(PERSONAS_PATH, 'utf-8');
  const featureMapContent = readFileSync(FEATURE_MAP_PATH, 'utf-8');

  const bannedSynonyms = parseBannedSynonyms(glossaryContent);
  const definedPersonas = parseDefinedPersonas(personasContent);
  const featureMapSections = parseFeatureMapSections(featureMapContent);

  const issues: LintIssue[] = [];

  const specFolders = new Set<string>();
  const specEntries = readdirSync(SPECS_DIR);
  for (const entry of specEntries) {
    const fullPath = join(SPECS_DIR, entry);
    if (!statSync(fullPath).isDirectory()) {
      issues.push({
        file: relative(REPO_ROOT, fullPath),
        rule: 'feature-map-1-to-1',
        message: `Top-level file '${entry}' is not allowed in openspec/specs/. Anchor specs inside feature folders matching docs/feature-map.md.`,
      });
      continue;
    }

    specFolders.add(entry);
    if (!featureMapSections.has(entry)) {
      issues.push({
        file: relative(REPO_ROOT, fullPath),
        rule: 'feature-map-1-to-1',
        message: `Spec folder '${entry}' does not match any top-level section in docs/feature-map.md (expected one of: ${[...featureMapSections].join(', ')}).`,
      });
    }
  }

  for (const section of featureMapSections) {
    const expectedSpecPath = join(SPECS_DIR, section, 'spec.md');
    if (!specFolders.has(section) || !existsSync(expectedSpecPath)) {
      issues.push({
        file: relative(REPO_ROOT, FEATURE_MAP_PATH),
        rule: 'feature-map-1-to-1',
        message: `Feature Map section '${section}' is missing its 1:1 spec file at openspec/specs/${section}/spec.md.`,
      });
    }
  }

  const specFiles = collectMarkdownFiles(SPECS_DIR);
  for (const filePath of specFiles) {
    const content = readFileSync(filePath, 'utf-8');
    const relPath = relative(REPO_ROOT, filePath);

    for (const synonym of bannedSynonyms) {
      const pattern = new RegExp(`\\b${escapeRegExp(synonym)}\\b`, 'i');
      if (pattern.test(content)) {
        issues.push({
          file: relPath,
          rule: 'glossary-banned-synonym',
          message: `Found banned synonym '${synonym}'. Replace it with the canonical term from docs/glossary.md.`,
        });
      }
    }

    const foundPersonas = content.match(/@persona:[a-z0-9-]+/g) ?? [];
    if (foundPersonas.length === 0) {
      issues.push({
        file: relPath,
        rule: 'persona-required',
        message:
          'Specification must reference at least one @persona: tag defined in docs/personas.md.',
      });
    }
    for (const persona of foundPersonas) {
      if (!definedPersonas.has(persona)) {
        issues.push({
          file: relPath,
          rule: 'persona-defined',
          message: `Unknown persona tag '${persona}' is not defined in docs/personas.md.`,
        });
      }
    }
  }

  if (issues.length > 0) {
    console.error(`Doc lint failed with ${issues.length} issue(s):\n`);
    for (const issue of issues) {
      console.error(`  [${issue.rule}] ${issue.file}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(
    `Doc lint passed (${specFiles.length} spec files checked against ${bannedSynonyms.length} banned synonyms, ${definedPersonas.size} personas, and ${featureMapSections.size} feature-map sections).`,
  );
}

main();
