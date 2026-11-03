import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.wasm':'application/wasm', '.json':'application/json', '.svg':'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, clean === '/' ? 'index.html' : clean);
    const body = await readFile(file);
    const mime = types[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime.startsWith('text/') || /json|svg/.test(mime) ? `${mime}; charset=utf-8` : mime, 'Cache-Control':'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const port = Number(process.env.PORT || 4173);
server.listen(port, '0.0.0.0', () => console.log(`КИБЕР VENGANCE → http://0.0.0.0:${port}`));
