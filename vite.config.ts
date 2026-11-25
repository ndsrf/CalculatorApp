import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Connect, defineConfig, type Plugin } from 'vite';
import { loadDotEnvIfPresent } from './scripts/env.ts';
import { createTranslateMiddleware } from './src/ai/http-handler.ts';
import { createTranslateService } from './src/ai/translate-service.ts';
import { startObservability } from './src/observability/tracer.ts';

const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));

// The Expression Translator runs server-side so API keys never reach the browser (ADR 002).
function expressionTranslatorApi(): Plugin {
  const mount = (middlewares: Connect.Server) => {
    loadDotEnvIfPresent(join(REPO_ROOT, '.env'));
    startObservability(join(REPO_ROOT, 'traces', 'runs.jsonl'));
    const service = createTranslateService({ repoRoot: REPO_ROOT, traced: true });
    middlewares.use('/api/translate', createTranslateMiddleware(service));
  };

  return {
    name: 'expression-translator-api',
    configureServer: (server) => mount(server.middlewares),
    configurePreviewServer: (server) => mount(server.middlewares),
  };
}

export default defineConfig({
  plugins: [expressionTranslatorApi()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
