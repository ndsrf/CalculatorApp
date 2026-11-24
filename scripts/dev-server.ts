import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');

export interface RunningViteServer {
  url: string;
  stop: () => void;
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
  const proc = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
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
