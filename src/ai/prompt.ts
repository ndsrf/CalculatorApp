import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { load as parseYaml } from 'js-yaml';

export interface VersionedPrompt {
  id: string;
  version: string;
  tier: string;
  limits: { maxModelCalls: number; maxTokens: number };
  body: string;
  sha: string;
}

interface PromptFrontmatter {
  id?: string;
  version?: string;
  model_routing?: { tier?: string };
  limits?: { max_model_calls?: number; max_tokens?: number };
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function loadVersionedPrompt(promptPath: string): VersionedPrompt {
  const content = readFileSync(promptPath, 'utf-8');
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error(`${promptPath} is missing YAML frontmatter`);
  }

  const frontmatter = (parseYaml(match[1]) ?? {}) as PromptFrontmatter;
  const { id, version } = frontmatter;
  const tier = frontmatter.model_routing?.tier;
  const maxModelCalls = frontmatter.limits?.max_model_calls;
  const maxTokens = frontmatter.limits?.max_tokens;
  if (!id || !version || !tier || !maxModelCalls || !maxTokens) {
    throw new Error(
      `${promptPath} frontmatter must declare id, version, model_routing.tier, limits.max_model_calls, and limits.max_tokens`,
    );
  }

  return {
    id,
    version,
    tier,
    limits: { maxModelCalls, maxTokens },
    body: content.slice(match[0].length).trim(),
    sha: createHash('sha256').update(content).digest('hex'),
  };
}
