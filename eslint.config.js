import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const localArchitecturePlugin = {
  rules: {
    'no-explanatory-comments': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Flag inline comments in src/ for review; behavior and decisions belong in specs and ADRs.',
        },
        schema: [],
      },
      create(context) {
        return {
          Program() {
            const comments = context.sourceCode.getAllComments();
            for (const comment of comments) {
              const trimmed = comment.value.trim();
              if (
                trimmed.startsWith('eslint-') ||
                trimmed.startsWith('@ts-') ||
                trimmed.startsWith('vite-')
              ) {
                continue;
              }
              context.report({
                loc: comment.loc,
                message:
                  'Inline comment: keep it only for a non-obvious invariant, edge case, or rationale (AGENTS.md §7). Behavior belongs in openspec/specs/, decisions in docs/adr/.',
              });
            }
          },
        };
      },
    },
  },
};

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      local: localArchitecturePlugin,
    },
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='eval']",
          message:
            'eval() is banned. Use the safe recursive-descent parser in src/core/parser.ts (see docs/adr/001-expression-parser.md).',
        },
        {
          selector: "NewExpression[callee.name='Function']",
          message:
            'new Function() is banned. Use the safe recursive-descent parser in src/core/parser.ts (see docs/adr/001-expression-parser.md).',
        },
        {
          selector: "CallExpression[callee.name='Function']",
          message:
            'Function() constructor is banned. Use the safe recursive-descent parser in src/core/parser.ts (see docs/adr/001-expression-parser.md).',
        },
      ],
      'local/no-explanatory-comments': 'warn',
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'src/core/ must remain pure and must not reference browser DOM globals.',
        },
        {
          name: 'document',
          message: 'src/core/ must remain pure and must not reference browser DOM globals.',
        },
        {
          name: 'navigator',
          message: 'src/core/ must remain pure and must not reference browser DOM globals.',
        },
        {
          name: 'localStorage',
          message: 'src/core/ must remain pure and must not reference browser DOM globals.',
        },
        {
          name: 'sessionStorage',
          message: 'src/core/ must remain pure and must not reference browser DOM globals.',
        },
        {
          name: 'HTMLElement',
          message: 'src/core/ must remain pure and must not reference browser DOM globals.',
        },
      ],
    },
  },
];
