import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
await build({
    entryPoints: [resolve(here, 'composer.tsx')],
    bundle: true,
    outfile: resolve(here, '../../.local/demo/composer.js'),
    jsx: 'automatic',
    format: 'esm',
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    target: ['chrome120', 'safari17']
});
console.log('Built Example Workshop email studio.');
