// Küçük, bağımlılıksız statik dosya sunucusu yardımcıları
import fs from 'node:fs';
import path from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf', '.exe': 'application/octet-stream',
  '.apk': 'application/vnd.android.package-archive', '.zip': 'application/zip', '.map': 'application/json'
};

// URL yolunu güvenli şekilde kök klasör içindeki bir dosyaya çevirir (klasör dışına çıkmayı engeller)
export function resolveSafe(rootDir, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch { return null; }
  const full = path.resolve(rootDir, '.' + path.posix.normalize('/' + p));
  const rootResolved = path.resolve(rootDir);
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) return null;
  return full;
}

// Dosyayı gönderir; klasörse index.html'i dener. Bulunamazsa false döner.
export function sendFile(res, file) {
  if (!file) return false;
  let f = file;
  try {
    let st = fs.statSync(f);
    if (st.isDirectory()) { f = path.join(f, 'index.html'); st = fs.statSync(f); }
    if (!st.isFile()) return false;
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
    return true;
  } catch { return false; }
}

export function redirectDirSlash(req, res, rootDir) {
  // "/apps/dongum" -> "/apps/dongum/" (GitHub Pages ile aynı davranış)
  const u = req.url.split('?')[0];
  if (u.endsWith('/')) return false;
  const f = resolveSafe(rootDir, u);
  try { if (f && fs.statSync(f).isDirectory()) { res.writeHead(301, { Location: u + '/' }); res.end(); return true; } } catch {}
  return false;
}

export function send404(res, distDir) {
  const nf = path.join(distDir, '404.html');
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  if (fs.existsSync(nf)) fs.createReadStream(nf).pipe(res); else res.end('404 - Bulunamadı');
}
