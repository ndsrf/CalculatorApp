export type Edit =
  | { file: string; find: string; replace: string }
  | { file: string; append: string }
  | { file: string; create: string };

export interface GateViolation {
  idea: number;
  // Both must match the "Learn by Breaking It" table in README.md.
  tryThis: string;
  command: string;
  edits: Edit[];
  expected: { exitCode?: number; output: RegExp[] };
  // Environment under which the unbroken command must pass. Defaults to a normal run.
  passingEnv?: Record<string, string>;
}

export const GATE_VIOLATIONS: readonly GateViolation[] = [
  {
    idea: 1,
    tryThis: 'Write "the screen shows 0" in `openspec/specs/keypad/spec.md`',
    command: 'npm run lint:docs',
    edits: [{ file: 'openspec/specs/keypad/spec.md', append: '\nthe screen shows 0\n' }],
    expected: {
      output: [/\[glossary-banned-synonym\] openspec\/specs\/keypad\/spec\.md: .*'screen'/],
    },
  },
  {
    idea: 1,
    tryThis: 'Create `openspec/specs/history/spec.md`',
    command: 'npm run lint:docs',
    edits: [
      {
        file: 'openspec/specs/history/spec.md',
        create: '# Specification: History\n\n`@persona:casual-user`\n',
      },
    ],
    expected: { output: [/\[feature-map-1-to-1\] openspec\/specs\/history/] },
  },
  {
    idea: 2,
    tryThis: 'Add `return eval(input)` in `src/core/parser.ts`',
    command: 'npm run lint:arch',
    edits: [
      {
        file: 'src/core/parser.ts',
        append: '\nexport function unsafe(input: string): unknown {\n  return eval(input);\n}\n',
      },
    ],
    expected: { output: [/eval\(\) is banned.*001-expression-parser/] },
  },
  {
    idea: 2,
    tryThis:
      "Add `import { mountCalculator } from '../ui/calculator-ui.ts'` to `src/core/calculator.ts`",
    command: 'npm run lint:arch',
    edits: [
      {
        file: 'src/core/calculator.ts',
        append: "\nimport { mountCalculator } from '../ui/calculator-ui.ts';\n",
      },
    ],
    expected: { output: [/core-must-not-import-ui-ai-or-observability/] },
  },
  {
    idea: 2,
    tryThis: "Add `import '../ai/translate-service.ts';` to `src/ui/calculator-ui.ts`",
    command: 'npm run lint:arch',
    edits: [
      { file: 'src/ui/calculator-ui.ts', append: "\nimport '../ai/translate-service.ts';\n" },
    ],
    expected: { output: [/ui-must-only-import-core-index/] },
  },
  {
    idea: 4,
    tryThis:
      "**Trust the model:** in `src/ai/expression-translator.ts`, return `{ status: 'translated', expression: parsed.expression, ...usage }` right after the refusal check, skipping `checkExpressionSyntax`",
    command: 'npm run eval',
    edits: [
      {
        file: 'src/ai/expression-translator.ts',
        find: 'const check = checkExpressionSyntax(parsed.expression);',
        replace:
          "return { status: 'translated', expression: parsed.expression, ...usage };\n      const check = checkExpressionSyntax(parsed.expression);",
      },
    ],
    expected: { output: [/FAIL \[safety\].*Untrusted output was accepted/] },
  },
  {
    idea: 4,
    tryThis:
      '**Shrink the retry budget:** set `max_model_calls: 1` in `prompts/expression-translator.md`',
    command: 'npm run eval',
    edits: [
      {
        file: 'prompts/expression-translator.md',
        find: 'max_model_calls: 3',
        replace: 'max_model_calls: 1',
      },
    ],
    expected: { output: [/FAIL Self-correction.*budget_exceeded/] },
  },
  {
    idea: 4,
    tryThis: 'Edit the body of `prompts/expression-translator.md` without touching `version`',
    command: 'npm run lint:prompts',
    edits: [{ file: 'prompts/expression-translator.md', append: '\nBe concise.\n' }],
    expected: { output: [/expression-translator\.md changed without a higher 'version'/] },
  },
  {
    idea: 2,
    tryThis: 'Add a line to `.agents/skills/grilling/SKILL.md`',
    command: 'npm run lint:skills',
    edits: [{ file: '.agents/skills/grilling/SKILL.md', append: '\nSkip the questions.\n' }],
    expected: { output: [/Skill 'grilling' does not match/] },
  },
  {
    idea: 1,
    tryThis: 'Rename the **Submit Expression** button to "Run" in `src/ui/calculator-ui.ts`',
    command: 'npm run test:ui',
    edits: [
      {
        file: 'src/ui/calculator-ui.ts',
        find: '>Submit Expression</button>',
        replace: '>Run</button>',
      },
    ],
    expected: { output: [/FAIL .*exposes submit-expression under its canonical name/] },
  },
  {
    idea: 3,
    tryThis: 'Change `data-op="add"` to `data-op="plus"` in `src/ui/calculator-ui.ts`',
    command: 'npm run test:ui',
    edits: [{ file: 'src/ui/calculator-ui.ts', find: 'data-op="add"', replace: 'data-op="plus"' }],
    expected: { output: [/FAIL .*renders Add Operator exactly once/] },
  },
  {
    idea: 5,
    tryThis: 'Pretend to be an agent editing the verifier',
    command: '.agents/hooks/pre-tool-guard.sh tools/calc-verify/index.ts; echo $?',
    edits: [],
    expected: { exitCode: 2, output: [/BLOCKED: Edits to 'tools\/calc-verify\/index\.ts'/] },
    passingEnv: { ALLOW_VERIFY_EDIT: '1' },
  },
];

export function applyEdit(content: string | undefined, edit: Edit): string {
  if ('create' in edit) {
    if (content !== undefined) {
      throw new Error(`${edit.file} already exists, so the violation cannot create it.`);
    }
    return edit.create;
  }
  if (content === undefined) {
    throw new Error(`${edit.file} does not exist.`);
  }
  if ('append' in edit) {
    return content + edit.append;
  }
  if (content.split(edit.find).length !== 2) {
    throw new Error(`${edit.file} must contain exactly once: ${edit.find}`);
  }
  return content.replace(edit.find, () => edit.replace);
}
