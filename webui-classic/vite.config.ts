import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The file server of the daemon answers requests for .js files with the .js.gz file
// (when the browser accepts gzip), so every script needs a compressed copy, including those in public/
const gzipScripts = (): Plugin => ({
  name: 'gzip-scripts',
  async writeBundle(options, bundle) {
    await Promise.all(
      [...Object.keys(bundle), 'sw.js']
        .filter((file) => file.endsWith('.js'))
        .map(async (file) => {
          const path = join(options.dir!, file);
          await writeFile(`${path}.gz`, gzipSync(await readFile(path), { level: 9 }));
        }),
    );
  },
});

// Relative base: the build also works behind a reverse proxy subpath
export default defineConfig({
  base: './',
  plugins: [react(), gzipScripts()],
  build: { outDir: 'dist', target: 'es2022' },
  server: {
    // npm run dev against a running daemon: AIRDCPP_URL=http://host:5600 npm run dev
    proxy: {
      '/api': { target: process.env.AIRDCPP_URL || 'http://localhost:5600', ws: true, changeOrigin: true },
    },
  },
});
