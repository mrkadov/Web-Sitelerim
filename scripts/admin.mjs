// npm run admin  ->  http://localhost:4000/admin/  (yerel yönetim paneli)
// Yalnızca bu bilgisayardan (127.0.0.1) erişilebilir. data/site.json ve static/img/ dosyalarını düzenler, siteyi yeniden üretir.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { ROOT, DIST, STATIC_DIR, ADMIN_DIR, MARKED_ESM, DATA_FILE } from './lib/paths.mjs';
import { loadData, saveData, validateData, SLUG_RE } from './lib/data.mjs';
import { build } from './lib/build.mjs';
import { resolveSafe, sendFile, send404, redirectDirSlash } from './lib/serve.mjs';

const PORT = Number(process.env.PORT || process.env.ADMIN_PORT || 4000);
const HOST = '127.0.0.1';
const MAX_BODY = 25 * 1024 * 1024;
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico']);

function rebuild() {
  // Yerel önizleme her zaman kök yoldan ("/") çalışır
  const r = build({ basePath: '/', quiet: true });
  return { ok: true, warnings: r.warnings, legal: r.legal, builtAt: new Date().toISOString() };
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('Dosya çok büyük (en fazla 25 MB).')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function safeFileName(name) {
  const ext = path.extname(name || '').toLowerCase();
  const baseName = path.basename(name || 'resim', ext)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'resim';
  return { baseName, ext };
}

async function handleApi(req, res, url) {
  // Basit CSRF koruması: yalnızca aynı kaynaktan gelen yazma isteklerini kabul et
  if (req.method !== 'GET') {
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return json(res, 403, { error: 'İzin verilmeyen kaynak.' });
    if (!String(req.headers['content-type'] || '').includes('application/json')) return json(res, 415, { error: 'JSON bekleniyor.' });
  }
  try {
    if (url === '/api/ping' && req.method === 'GET') return json(res, 200, { ok: true, mode: 'local', root: ROOT });
    if (url === '/api/data' && req.method === 'GET') return json(res, 200, loadData());
    if (url === '/api/data' && req.method === 'PUT') {
      const data = JSON.parse(await readBody(req));
      const errors = validateData(data);
      if (errors.length) return json(res, 400, { error: errors.join('\n'), errors });
      saveData(data);
      return json(res, 200, { saved: true, ...rebuild() });
    }
    if (url === '/api/build' && req.method === 'POST') return json(res, 200, rebuild());
    if (url === '/api/upload' && req.method === 'POST') {
      const { filename, dataBase64, folder } = JSON.parse(await readBody(req));
      const { baseName, ext } = safeFileName(filename);
      if (!IMG_EXT.has(ext)) return json(res, 400, { error: 'Yalnızca resim dosyaları yüklenebilir (png, jpg, webp, svg, gif, ico).' });
      const sub = SLUG_RE.test(folder || '') ? folder : 'genel';
      const dir = path.join(STATIC_DIR, 'img', sub);
      fs.mkdirSync(dir, { recursive: true });
      let name = `${baseName}${ext}`, i = 1;
      while (fs.existsSync(path.join(dir, name))) name = `${baseName}-${++i}${ext}`;
      const buf = Buffer.from(String(dataBase64 || '').replace(/^data:[^,]*,/, ''), 'base64');
      if (!buf.length) return json(res, 400, { error: 'Dosya boş.' });
      fs.writeFileSync(path.join(dir, name), buf);
      return json(res, 200, { path: `img/${sub}/${name}` });
    }
    return json(res, 404, { error: 'Bilinmeyen istek.' });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (url.startsWith('/api/')) return handleApi(req, res, url);
  if (url === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
  if (url === '/admin/marked.esm.js') { if (sendFile(res, MARKED_ESM)) return; }
  if (url.startsWith('/admin/')) {
    if (sendFile(res, resolveSafe(ADMIN_DIR, url.slice('/admin'.length)))) return;
    return send404(res, DIST);
  }
  // Önizleme: önce dist/, sonra static/ (yeni yüklenen resimler hemen görünsün)
  if (redirectDirSlash(req, res, DIST)) return;
  if (sendFile(res, resolveSafe(DIST, url))) return;
  if (sendFile(res, resolveSafe(STATIC_DIR, url))) return;
  send404(res, DIST);
});

try { rebuild(); } catch (e) { console.error('⚠ İlk derleme başarısız:\n' + e.message); }

server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`✖ ${PORT} portu kullanımda. Başka bir pencerede "npm run admin" açık olabilir. Farklı port için: set PORT=4001 && npm run admin`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const adminUrl = `http://localhost:${PORT}/admin/`;
  console.log(`\n✔ Yönetim paneli hazır:  ${adminUrl}`);
  console.log(`  Site önizlemesi:       http://localhost:${PORT}/`);
  console.log(`  Veri dosyası:          ${DATA_FILE}`);
  console.log('  Kapatmak için bu pencerede Ctrl + C tuşlarına basın.\n');
  if (process.env.NO_OPEN !== '1' && !process.env.CI) {
    const cmd = process.platform === 'win32' ? `start "" "${adminUrl}"` : process.platform === 'darwin' ? `open "${adminUrl}"` : `xdg-open "${adminUrl}"`;
    exec(cmd, () => {});
  }
});
