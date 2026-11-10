import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const outdir = '_site';
const textures = [
  {
    type: 'day',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg',
      'https://edu.solarsystemscope.com/textures/download/8k_earth_daymap.jpg',
      'https://media.huira.space/data/textures/solar_system/8k_earth_daymap.jpg',
    ],
  },
  {
    type: 'night',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/b/b3/Solarsystemscope_texture_8k_earth_nightmap.jpg',
      'https://edu.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg',
    ],
  },
];

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

// One-time build downloads only. The published site loads all textures from
// GitHub Pages itself; visitors never contact Wikimedia or Solar System Scope.
for (const asset of textures) {
  let original = null;
  for (const url of asset.urls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(45000),
        headers: { 'User-Agent': 'Earthlight/1.1 (static map build; CC BY 4.0 attribution)' },
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(bytes).metadata();
      if (metadata.width !== 8192 || metadata.height !== 4096) {
        throw new Error('Unexpected source dimensions ' + metadata.width + 'x' + metadata.height);
      }
      original = bytes;
      console.log('Downloaded original 8K', asset.type, bytes.byteLength + ' bytes', url);
      break;
    } catch (error) {
      console.warn('8K texture mirror failed:', url, error.message);
    }
  }
  if (!original) throw new Error('All 8K texture sources failed for ' + asset.type);

  // 8K original for strong desktops, 4K for normal 2K monitors, 2K for phones.
  await writeFile(path.join(outdir, 'textures', asset.type + '_8192.jpg'), original);
  for (const width of [4096, 2048]) {
    const height = width / 2;
    const resized = await sharp(original)
      .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
      .jpeg({ quality: width === 4096 ? 92 : 88, mozjpeg: true })
      .toBuffer();
    await writeFile(path.join(outdir, 'textures', asset.type + '_' + width + '.jpg'), resized);
    console.log('Generated', width + 'x' + height, asset.type, resized.length + ' bytes');
  }
}
console.log('Built 2K/4K/8K locally hosted Earth maps and JavaScript:', generatedFile);
