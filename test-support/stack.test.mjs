import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { readFile, access } from 'node:fs/promises';
import { createStack, baseURL } from './stack.cjs';

test('harness owns loopback servers, fresh store, proxy and actual two-server restart', async () => {
  const stack = await createStack();
  try {
    const first = await stack.start();
    assert.deepEqual(await (await fetch(`${baseURL}/api/notes`)).json(), []);
    const created = await fetch(`${baseURL}/api/notes`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Synthetic harness probe', body: 'Restart probe' }),
    });
    assert.equal(created.status, 201);
    const expected = [await created.json()];
    const info = await (await fetch(`${baseURL}/api/storage-info`)).json();
    assert.equal(info.storagePath, `${stack.store}/notes.json`);
    const frontend = await (await fetch(baseURL)).text();
    assert.match(frontend, /src\/main.tsx/);
    const second = await stack.restart();
    assert.notEqual(first.backend, second.backend);
    assert.notEqual(first.frontend, second.frontend);
    assert.deepEqual(await (await fetch(`${baseURL}/api/notes`)).json(), expected);
    const log = await readFile(stack.log, 'utf8');
    const receipts = log.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
    assert.equal(receipts.filter(receipt => receipt.kind === 'backend-listening').length, 2);
    assert.equal(receipts.filter(receipt => receipt.kind === 'frontend-listening').length, 2);
    for (const receipt of receipts.filter(receipt => receipt.address)) {
      assert.equal(receipt.address.address, '127.0.0.1');
    }
  } finally { await stack.dispose(); }
  await assert.rejects(access(stack.store));
  for (const port of [43171, 43172]) {
    await assert.rejects(fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) }));
  }
});

test('occupied frontend port is refused, never reused, and owned backend is cleaned up', async () => {
  const occupied = net.createServer(socket => socket.destroy());
  occupied.listen(43171, '127.0.0.1');
  await once(occupied, 'listening');
  const stack = await createStack();
  try {
    await assert.rejects(stack.start(), /already in use|EADDRINUSE/);
    assert.equal(occupied.listening, true);
    await assert.rejects(fetch('http://127.0.0.1:43172/api/notes', { signal: AbortSignal.timeout(1000) }));
  } finally {
    await stack.dispose();
    occupied.close();
    await once(occupied, 'close');
  }
});