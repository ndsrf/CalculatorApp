import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const VITE_BIN = join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

export interface RunningViteServer {
  url: string;
  stop: () => void;
}

async function isServing(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

export async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  throw new Error(`Timed out waiting for Vite server at ${url}`);
}

export async function startViteServer(port: number, timeoutMs = 15000): Promise<RunningViteServer> {
  const url = `http://localhost:${port}`;
  if (await isServing(url)) {
    throw new Error(`Port ${port} is already in use. Stop that server so tests cannot reach it.`);
  }
  // Spawned without npx, which would leave Vite running after the signal in stop().
  const proc = spawn(process.execPath, [VITE_BIN, '--port', String(port), '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    env: { ...process.env, AI_FORCE_STUB: '1' },
  });

  try {
    await waitForServer(url, timeoutMs);
  } catch (error) {
    proc.kill('SIGTERM');
    throw error;
  }

  return {
    url,
    stop: () => {
      proc.kill('SIGTERM');
    },
  };
}
