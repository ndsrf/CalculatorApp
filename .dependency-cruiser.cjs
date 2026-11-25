/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-import-ui-ai-or-observability',
      severity: 'error',
      comment: 'src/core/ must remain pure and isolated from UI, AI, and observability layers.',
      from: { path: '^src/core/' },
      to: { path: '^src/(ui|ai|observability)/' },
    },
    {
      name: 'ai-must-use-core-barrel-and-stay-server-side',
      severity: 'error',
      comment:
        'src/ai/ (server-side Expression Translator) may only reach core through src/core/index.ts and must never import browser UI code (ADR 002).',
      from: { path: '^src/ai/' },
      to: { path: '^src/(ui/|core/(?!index\\.ts$))' },
    },
    {
      name: 'observability-must-not-import-ai',
      severity: 'error',
      comment: 'src/observability/ is a generic layer; AI code depends on it, never the reverse.',
      from: { path: '^src/observability/' },
      to: { path: '^src/ai/' },
    },
    {
      name: 'ui-must-only-import-core-index',
      severity: 'error',
      comment:
        'src/ui/ must only import from src/ui/ or src/core/index.ts. In particular it must never import src/ai/ (server-side model calls and API keys) or Node observability modules (ADR 002).',
      from: { path: '^src/ui/' },
      to: {
        path: '^src/',
        pathNot: '^(src/ui/|src/core/index\\.ts$)',
      },
    },
    {
      name: 'src-must-not-import-tools-or-evals',
      severity: 'error',
      comment:
        'Production source under src/ must never depend on verification tools or eval harnesses.',
      from: { path: '^src/' },
      to: { path: '^(tools|evals)/' },
    },
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      comment: 'Disallow circular dependencies across src/.',
      from: { path: '^src/' },
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.js', '.mjs', '.cjs'],
    },
  },
};
