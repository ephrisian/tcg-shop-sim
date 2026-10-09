import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapeCardFunSet } from './cardfun-scraper.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolDir = path.join(root, 'developer-tools');
const packagesDir = path.join(toolDir, 'set-packages');
const port = Number(process.env.DEV_TOOL_PORT || 5179);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const artHosts = new Set(['cards.lorcast.io', 'goodso.card.fun']);

function inside(base, target) {
  const relative = path.relative(base, target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function listPackages(dir = packagesDir, found = []) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { await listPackages(full, found); continue; }
    if (!entry.name.toLowerCase().endsWith('.json')) continue;
    try {
      const data = JSON.parse(await fs.readFile(full, 'utf8'));
      if (!data || !Array.isArray(data.card_data) || !data.game || !data.set) continue;
      const relative = path.relative(packagesDir, full).split(path.sep).join('/');
      found.push({ path: relative, data });
    } catch { /* skip unreadable or invalid JSON */ }
  }
  return found;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const send = (status, body, type = 'text/plain') => {
    res.writeHead(status, { 'Content-Type': type });
    res.end(body);
  };
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/packages' && req.method === 'GET') {
      return send(200, JSON.stringify(await listPackages()), 'application/json');
    }
    if (url.pathname === '/api/files' && req.method === 'PUT') {
      const relative = url.searchParams.get('path') || '';
      const target = path.resolve(packagesDir, relative);
      if (!relative || !inside(packagesDir, target)) return send(400, 'Invalid path.');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, await readBody(req));
      return send(200, 'ok');
    }
    if (url.pathname === '/api/exists' && req.method === 'GET') {
      const target = path.resolve(packagesDir, url.searchParams.get('path') || '');
      if (!inside(packagesDir, target)) return send(400, 'Invalid path.');
      try { await fs.access(target); return send(200, 'ok'); } catch { return send(404, 'missing'); }
    }
    if (url.pathname === '/api/cardfun/scrape' && req.method === 'POST') {
      let body;
      try { body = JSON.parse((await readBody(req)).toString('utf8')); } catch { return send(400, 'Invalid JSON.'); }
      try {
        return send(200, JSON.stringify(await scrapeCardFunSet(String(body?.url || ''))), 'application/json');
      } catch (error) {
        return send(422, error instanceof Error ? error.message : 'Scrape failed.');
      }
    }
    if (url.pathname === '/api/art' && req.method === 'GET') {
      const remote = new URL(url.searchParams.get('url') || '');
      if (remote.protocol !== 'https:' || !artHosts.has(remote.hostname)) return send(400, 'Host not allowed.');
      const upstream = await fetch(remote);
      if (!upstream.ok) return send(upstream.status, 'Upstream error.');
      res.writeHead(200, { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream' });
      return res.end(Buffer.from(await upstream.arrayBuffer()));
    }
    if (req.method === 'GET') {
      const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const target = path.resolve(toolDir, name);
      if (!inside(toolDir, target) || inside(packagesDir, target)) return send(404, 'Not found.');
      const body = await fs.readFile(target);
      return send(200, body, types[path.extname(target)] || 'application/octet-stream');
    }
    send(404, 'Not found.');
  } catch (error) {
    send(error?.code === 'ENOENT' ? 404 : 500, error instanceof Error ? error.message : 'Server error.');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Set package author running at http://localhost:${port}/`);
  console.log(`Writing set packages to ${packagesDir}`);
});
