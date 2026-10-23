import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const required = ['index.html', 'styles.css', 'app.js', 'core.js', 'audio.js', 'scratch-worklet.js', 'manifest.webmanifest', 'icon.svg', 'sw.js'];
for (const file of required) await access(resolve('dist', file));
const html = await readFile(resolve('dist/index.html'), 'utf8');
for (const needle of ['КИБЕР VENGANCE', 'styles.css', 'app.js']) {
  if (!html.includes(needle)) throw new Error(`index.html is missing ${needle}`);
}
console.log(`КИБЕР VENGANCE static build verified (${required.length} assets).`);
