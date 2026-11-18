// npm run dev      ->  siteyi üretir, http://localhost:8080/ adresinde gösterir, dosyalar değişince yeniden üretir
// npm run preview  ->  aynısı, ama izleme (otomatik yeniden üretme) yok
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DIST } from './lib/paths.mjs';
import { build } from './lib/build.mjs';
import { resolveSafe, sendFile, send404, redirectDirSlash } from './lib/serve.mjs';

const PORT = Number(process.env.PORT || 8080);
const watch = !process.argv.includes('--no-watch');

function doBuild() {
  try { const r = build({ basePath: '/' }); console.log(`✔ ${new Date().toLocaleTimeString('tr-TR')} site üretildi`); r.warnings.forEach(w => console.log('  ⚠ ' + w)); }
  catch (e) { console.error('✖ Derleme hatası:\n' + e.message); }
}
doBuild();

if (watch) {
  let t;
  for (const dir of ['data', 'static', 'assets', 'admin']) {
    const p = path.join(ROOT, dir);
    if (!fs.existsSync(p)) continue;
    try {
      fs.watch(p, { recursive: true }, (ev, file) => {
        if (file && /\.(tmp|bak)$/.test(file)) return;
        clearTimeout(t); t = setTimeout(doBuild, 300);
      });
    } catch { /* bazı sistemlerde recursive izleme yok */ }
  }
}

http.createServer((req, res) => {
  if (redirectDirSlash(req, res, DIST)) return;
  if (sendFile(res, resolveSafe(DIST, req.url))) return;
  send404(res, DIST);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n✔ Önizleme: http://localhost:${PORT}/   (kapatmak için Ctrl + C)`);
  if (watch) console.log('  data/, static/, assets/ değişince site otomatik yeniden üretilir.');
});
