import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Harness-only config. Production/dev application config is not changed.
export default defineConfig({
  plugins: [react(), {
    name: 'test-bind-evidence',
    configureServer(server) {
      server.httpServer.once('listening', () => {
        console.log(JSON.stringify({ kind: 'frontend-listening', pid: process.pid, address: server.httpServer.address() }));
      });
    },
  }],
  server: {
    host: '127.0.0.1',
    port: 43171,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:43172', changeOrigin: true } },
  },
});