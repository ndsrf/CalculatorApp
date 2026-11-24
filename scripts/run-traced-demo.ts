import { join, resolve } from 'node:path';
import { parseCliArgs, runVerify } from '../tools/calc-verify/index.ts';
import { runTracedAgentSpan, startObservability } from '../src/observability/tracer.ts';
import { startViteServer } from './dev-server.ts';
import { loadDotEnvIfPresent } from './env.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DEMO_PORT = 5175;

async function main(): Promise<void> {
  loadDotEnvIfPresent();

  const rawArgs = process.argv.slice(2);
  const verifyArgs =
    rawArgs.length > 0 ? rawArgs : ['press', '8', 'divide', '0', 'equals', '--snapshot'];

  const obs = startObservability();
  const server = await startViteServer(DEMO_PORT);

  try {
    const hasCustomUrl = verifyArgs.some((arg) => arg === '--url' || arg.startsWith('--url='));
    const finalArgs = hasCustomUrl ? verifyArgs : [...verifyArgs, '--url', server.url];

    const traced = await runTracedAgentSpan(
      {
        spanName: 'calc-verify.agent-run',
        userRequest: `Run verification sequence: ${verifyArgs.join(' ')}`,
        toolArgs: verifyArgs,
        genAiSystem: 'local-verifier',
        model: 'calc-tester-agent',
        budget: { maxToolCalls: 5, maxTokens: 4000 },
      },
      async (span, budget) => {
        const command = parseCliArgs(finalArgs);
        const result = await runVerify(command);
        const inputTokens = 320;
        const outputTokens = 85;
        budget.recordStep({ toolCalls: 1, inputTokens, outputTokens }, span);

        const display = result.ui_state?.display ?? 'unavailable';
        const agentOutput = [
          `Tool Call: calc-verify ${verifyArgs.join(' ')}`,
          '',
          'Summary:',
          `The Primary Readout shows "${display}". ${
            result.ui_state?.error_state
              ? 'Operator keys are paused until you press All Clear (AC).'
              : 'No runtime errors were observed.'
          }`,
        ].join('\n');

        return {
          status: result.status,
          agentOutput,
          inputTokens,
          outputTokens,
          toolCallsCount: budget.toolCallsCount,
        };
      },
    );

    console.log(
      JSON.stringify(
        {
          traceId: traced.traceId,
          promptSha: traced.promptSha,
          status: traced.status,
          leakedSelector: traced.leakedSelector,
          traceFile: join(REPO_ROOT, 'traces', 'runs.jsonl'),
        },
        null,
        2,
      ),
    );
  } finally {
    server.stop();
    await obs.shutdown();
  }
}

void main();
