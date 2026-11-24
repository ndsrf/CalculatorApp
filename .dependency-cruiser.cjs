/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-import-ui-or-observability',
      severity: 'error',
      comment: 'src/core/ must remain pure and isolated from UI and observability layers.',
      from: { path: '^src/core/' },
      to: { path: '^src/(ui|observability)/' },
    },
    {
      name: 'ui-must-only-import-core-index',
      severity: 'error',
      comment: 'src/ui/ must only import from src/ui/ or src/core/index.ts (no internal core modules or Node observability modules).',
      from: { path: '^src/ui/' },
      to: {
        path: '^src/',
        pathNot: '^(src/ui/|src/core/index\\.ts$)',
      },
    },
    {
      name: 'src-must-not-import-tools-or-evals',
      severity: 'error',
      comment: 'Production source under src/ must never depend on verification tools or eval harnesses.',
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
