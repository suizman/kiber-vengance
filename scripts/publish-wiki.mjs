import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'docs/wiki');
const repository = 'https://github.com/suizman/kiber-vengance';
const pages = readdirSync(source).filter(name => name.endsWith('.md')).sort();
const entries = [...pages.map(name => resolve(source, name)), ...['README.md', 'companion/README.md', 'tests/README.md'].map(name => resolve(root, name))];
const links = /(!?)\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g;

function localTarget(file, target) {
  return resolve(dirname(file), decodeURIComponent(target.split(/[?#]/)[0]));
}

function check() {
  for (const name of ['Home.md', '_Sidebar.md', '_Footer.md']) {
    if (!pages.includes(name)) throw Error(`Missing wiki navigation: ${name}`);
  }
  for (const name of pages.filter(name => !name.startsWith('_') && !name.startsWith('ES-'))) {
    if (!pages.includes('ES-' + name)) throw Error(`Missing Spanish counterpart: ${name}`);
    const body = readFileSync(resolve(source, name), 'utf8');
    if (!body.includes(`](ES-${name})`)) throw Error(`Missing language switch: ${name}`);
    const spanish = readFileSync(resolve(source, 'ES-' + name), 'utf8');
    if (!spanish.includes(`](${name})`)) throw Error(`Missing English return link: ES-${name}`);
  }
  let count = 0;
  for (const file of entries) {
    const body = readFileSync(file, 'utf8');
    if (!body.trim()) throw Error(`Empty documentation: ${file}`);
    for (const [, image, label, target] of body.matchAll(links)) {
      if (image && !label.trim()) throw Error(`Missing image alternative text in ${file}`);
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const path = localTarget(file, target);
      if (relative(root, path).startsWith('..') || !existsSync(path)) throw Error(`Broken local link in ${relative(root, file)}: ${target}`);
      count++;
    }
  }
  console.log(`Documentation verified: ${pages.length - 2} pages, 3 READMEs, ${count} local links/images.`);
}

function render(destination) {
  mkdirSync(destination, { recursive: true });
  for (const name of pages) {
    const file = resolve(source, name);
    const body = readFileSync(file, 'utf8').replace(links, (whole, image, label, target) => {
      if (/^(?:https?:|mailto:|#)/.test(target)) return whole;
      const path = localTarget(file, target);
      const suffix = target.includes('#') ? '#' + target.split('#').slice(1).join('#') : '';
      let url;
      if (dirname(path) === source && pages.includes(path.slice(source.length + 1))) {
        url = path.slice(source.length + 1, -3) + suffix;
      } else if (path.startsWith(resolve(source, 'assets') + '/')) {
        url = `${repository}/wiki/${relative(source, path).split('/').map(encodeURIComponent).join('/')}`;
      } else {
        url = `${repository}/blob/master/${relative(root, path).split('/').map(encodeURIComponent).join('/')}${suffix}`;
      }
      return `${image}[${label}](${url})`;
    });
    writeFileSync(resolve(destination, name), body);
  }
  cpSync(resolve(source, 'assets'), resolve(destination, 'assets'), { recursive: true });
}

function git(args, cwd = root) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function publish() {
  const destination = resolve(mkdtempSync(resolve(tmpdir(), 'kiber-wiki-')), 'wiki');
  try {
    git(['clone', 'git@github.com:suizman/kiber-vengance.wiki.git', destination]);
  } catch {
    throw Error('Wiki unavailable. Enable Settings → General → Features → Wikis and create Home first. Private wikis require a supported GitHub plan. No repository settings were changed.');
  }
  render(destination);
  git(['config', 'user.name', git(['config', 'user.name'])], destination);
  git(['config', 'user.email', git(['config', 'user.email'])], destination);
  git(['add', '--', ...pages, 'assets'], destination);
  if (git(['diff', '--cached', '--name-only'], destination)) {
    git(['commit', '-m', 'Update studio manual'], destination);
    git(['push', 'origin', 'HEAD'], destination);
  }
  console.log(`Wiki published: ${repository}/wiki · ${git(['rev-parse', 'HEAD'], destination)}`);
}

try {
  check();
  const args = process.argv.slice(2);
  if (!args.length || (args.length === 1 && args[0] === '--check')) {
    // Validation is offline and never publishes.
  } else if (args.length === 2 && args[0] === '--render' && isAbsolute(args[1])) {
    const destination = resolve(args[1]);
    if (!relative(root, destination).startsWith('..') || (existsSync(destination) && readdirSync(destination).length)) throw Error('Render into an empty absolute directory outside the source repository.');
    render(destination);
    console.log(`Wiki prepared: ${destination}`);
  } else if (args.length === 1 && args[0] === '--publish') {
    publish();
  } else {
    throw Error('Usage: node scripts/publish-wiki.mjs --check | --render /absolute/empty/path | --publish');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
