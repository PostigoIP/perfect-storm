import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

// Dev-only: lets tools/render-clips.html save rendered WAVs to review/clips/.
const saveClips = {
  name: 'save-review-clips',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__save-clip', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      const name = basename(new URL(req.url, 'http://x').searchParams.get('name') || '').replace(/[^\w.-]/g, '');
      if (!name.endsWith('.wav')) { res.statusCode = 400; return res.end(); }
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const dir = join(server.config.root, 'review/clips');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, name), Buffer.concat(chunks));
        res.end('ok');
      });
    });
  },
};

export default defineConfig({ base: './', plugins: [saveClips], test: { environment: 'node' } });
