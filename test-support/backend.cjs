// Test-only launcher: import the unchanged application without its wildcard
// main-entry listen(), and bind the test instance to IPv4 loopback explicitly.
const app = require('../backend/dist/index.js').default;
const server = app.listen(43172, '127.0.0.1', () => {
  console.log(JSON.stringify({ kind: 'backend-listening', pid: process.pid, address: server.address() }));
});
server.on('error', (error) => { console.error(error); process.exit(1); });