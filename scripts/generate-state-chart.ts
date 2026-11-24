import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CALCULATOR_STATE_TRANSITIONS } from '../src/core/calculator.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_PATH = join(REPO_ROOT, 'docs', 'state-chart.md');

function renderStateChartMarkdown(): string {
  const lines: string[] = [
    '# Calculator State Chart',
    '',
    '> Auto-generated from `CALCULATOR_STATE_TRANSITIONS` in [`src/core/calculator.ts`](../src/core/calculator.ts) via `npm run docs:state-chart`. Do not edit manually.',
    '',
    '```mermaid',
    'stateDiagram-v2',
    '    [*] --> Idle',
  ];

  for (const transition of CALCULATOR_STATE_TRANSITIONS) {
    lines.push(`    ${transition.from} --> ${transition.to}: ${transition.event}`);
  }

  lines.push('```', '');
  return lines.join('\n');
}

function main(): void {
  const markdown = renderStateChartMarkdown();
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, markdown, 'utf-8');
  console.log(
    `Generated ${OUTPUT_PATH} with ${CALCULATOR_STATE_TRANSITIONS.length} state transitions.`,
  );
}

main();
