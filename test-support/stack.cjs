const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, rm, mkdir, appendFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const baseURL = 'http://127.0.0.1:43171';

async function createStack() {
  const store = await mkdtemp(resolve(tmpdir(), 'notes-e2e-synthetic-'));
  const evidence = resolve(process.env.E2E_EVIDENCE_DIR || resolve(root, 'test-results'));
  await mkdir(evidence, { recursive: true });
  const log = resolve(evidence, `servers-${process.pid}-${Date.now()}.log`);
  let children = [];
  let generation = 0;
  let logWrites = Promise.resolve();
  const record = data => { logWrites = logWrites.then(() => appendFile(log, data)); };
  async function startChild(command, args, env, readyMarker, url) {
    // Own a process group so npm's Vite child is also stopped, never a shared server.
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    let output = '';
    let spawnError;
    child.on('error', error => { spawnError = error; });
    const collect = data => { output += data; record(data); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (spawnError || child.exitCode !== null || child.signalCode !== null) throw new Error(`Server failed: ${spawnError || output}`);
      // A complete listening receipt from OUR child is mandatory, not just HTTP.
      const receipt = output.split('\n').slice(0, -1).find(line => line.startsWith('{') && line.includes(readyMarker));
      if (receipt) {
        const address = JSON.parse(receipt).address;
        if (address.address !== '127.0.0.1') throw new Error(`Unsafe bind: ${receipt}`);
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
          if (response.ok) return child.pid;
        } catch {}
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Server readiness timeout: ${output}`);
  }
  async function stop() {
    for (const child of children.reverse()) {
      if (child.exitCode !== null || child.signalCode !== null || !child.pid) continue;
      const closed = once(child, 'close'); // includes descendant stdout/stderr closure
      process.kill(-child.pid, 'SIGTERM');
      let timer;
      const ended = await Promise.race([closed.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 5000); })]);
      clearTimeout(timer);
      if (!ended) { process.kill(-child.pid, 'SIGKILL'); await closed; }
    }
    children = [];
    record(JSON.stringify({ kind: 'stopped', generation }) + '\n');
    await logWrites;
  }
  async function start() {
    generation++;
    try {
      const backend = await startChild(process.execPath, ['test-support/backend.cjs'], { NOTES_DATA_DIR: store }, 'backend-listening', 'http://127.0.0.1:43172/api/notes');
      const frontend = await startChild('npm', ['run', 'start', '--workspace', 'frontend', '--', '--config', resolve(root, 'test-support/vite.config.mjs')], {}, 'frontend-listening', baseURL);
      const receipt = { generation, backend, frontend, store };
      record(JSON.stringify(receipt) + '\n');
      await logWrites;
      return receipt;
    } catch (error) { await stop(); throw error; }
  }
  return {
    start, stop, store, log,
    async restart() { await stop(); return start(); },
    async dispose() { await stop(); await rm(store, { recursive: true, force: true }); },
  };
}
module.exports = { createStack, baseURL };