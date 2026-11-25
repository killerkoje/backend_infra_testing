import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('GET / returns the Hello response', { timeout: 10_000 }, async (t) => {
  const server = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], {
    env: { ...process.env, PORT: '0', APP_ENV: 'ci', K_REVISION: 'test-revision' },
    stdio: ['ignore', 'pipe', 'inherit'],
    signal: t.signal,
  });
  t.after(() => server.kill());

  const output = createInterface({ input: server.stdout });
  const port = await new Promise((resolve, reject) => {
    server.once('error', reject);
    output.on('line', (line) => {
      const match = /^Demo server listening on port (\d+)$/.exec(line);
      if (match) resolve(match[1]);
    });
    output.once('close', () => reject(new Error('Demo server exited before listening')));
  });

  const response = await fetch(`http://127.0.0.1:${port}/`, { signal: t.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/);
  assert.deepEqual(await response.json(), {
    message: 'Hello from my app',
    environment: 'ci',
    revision: 'test-revision',
  });
});
