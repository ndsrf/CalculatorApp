import { describe, expect, it } from 'vitest';
import { startViteServer } from '../scripts/dev-server.ts';

const LIFECYCLE_PORT = 5178;

async function isServing(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

describe('test dev server', () => {
  it('refuses a port that is already serving, and frees the port when stopped', async () => {
    const server = await startViteServer(LIFECYCLE_PORT);
    try {
      await expect(startViteServer(LIFECYCLE_PORT)).rejects.toThrow('already in use');
    } finally {
      server.stop();
    }
    await expect.poll(() => isServing(server.url), { timeout: 5000 }).toBe(false);
  });
});
