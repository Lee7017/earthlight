import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outdir = '_site';
const textures = ['earth_atmos_2048.jpg', 'earth_lights_2048.png'];

await mkdir(path.join(outdir, 'assets'), { recursive: true });
await mkdir(path.join(outdir, 'src'), { recursive: true });
await mkdir(path.join(outdir, 'textures'), { recursive: true });

const result = await build({
  entryPoints: { earthlight: 'src/main.js' },
  outdir: path.join(outdir, 'assets'),
  entryNames: '[name]-[hash]',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  metafile: true,
});
const generatedFile = Object.entries(result.metafile.outputs)
  .find(([, meta]) => meta.entryPoint === 'src/main.js')?.[0];
if (!generatedFile) throw new Error('Earthlight entry bundle not found after build');

const htmlSource = await readFile('index.html', 'utf8');
const html = htmlSource
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(
    '<script type="module" src="./src/main.js"></script>',
    '<script type="module" src="./' + generatedFile.replace(/^_site\//, '') + '"></script>',
  )
  .replace(/\s*<link rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net" crossorigin \/>/, '')
  .replace(/\s*<link rel="preconnect" href="https:\/\/threejs\.org" crossorigin \/>/, '');

if (html.includes('src/main.js') || html.includes('importmap')) {
  throw new Error('CDN import map was not removed from built index.html');
}
await writeFile(path.join(outdir, 'index.html'), html);
await copyFile('src/styles.css', path.join(outdir, 'src/styles.css'));
await copyFile('favicon.svg', path.join(outdir, 'favicon.svg'));
await writeFile(path.join(outdir, '.nojekyll'), '');

for (const filename of textures) {
  const urls = [
    'https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/textures/planets/' + filename,
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r180/examples/textures/planets/' + filename,
  ];
  let downloaded = false;
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength < 100000) throw new Error('Texture unexpectedly small: ' + buffer.length);
      await writeFile(path.join(outdir, 'textures', filename), buffer);
      console.log('Bundled local texture:', filename, buffer.byteLength + ' bytes');
      downloaded = true;
      break;
    } catch (err) {
      console.warn('Texture mirror failed:', url, err.message);
    }
  }
  if (!downloaded) throw new Error('Cannot build self-hosted texture: ' + filename);
}
console.log('Built fully self-hosted JS and Earth textures:', generatedFile);
