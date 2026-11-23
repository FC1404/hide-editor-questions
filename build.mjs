import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const path = relative => fileURLToPath(new URL(relative, import.meta.url));
const manifest = JSON.parse(await readFile(path('manifest.json'), 'utf8'));
const repository = new URL(manifest.repoUrl);
const names = repository.pathname.slice(1).replace(/\/$/, '').split('/');

if (repository.protocol !== 'https:' || repository.hostname !== 'github.com' ||
    names.length !== 2 || names.some(name => !/^[\w.-]+$/.test(name)) ||
    repository.pathname === '/remnoteio/remnote-plugin-template-react' ||
    names.includes('YOUR-USERNAME') || names.includes('YOUR-REPOSITORY') ||
    manifest.author === 'YOUR AUTHOR NAME') {
  throw new Error('Set the author name and public GitHub repository URL in manifest.json.');
}

await mkdir(path('dist'), { recursive: true });
const bundle = {
  entryPoints: [path('main.mjs')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['chrome105', 'safari15.4'],
  loader: { '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
};

await Promise.all([
  build({ ...bundle, outfile: path('dist/index-sandbox.js') }),
  build({ ...bundle, outfile: path('dist/index.js'), banner: { js: 'const IMPORT_META = import.meta;' } }),
  ...['index.html', 'manifest.json', 'README.md', 'THIRD-PARTY-NOTICES.txt'].map(file => copyFile(path(file), path(`dist/${file}`))),
]);
