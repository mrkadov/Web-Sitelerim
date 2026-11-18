// npm run check  ->  siteyi üretir ve her uygulamanın gizlilik/şartlar sayfasının oluştuğunu kontrol eder,
// doğrulanması gereken [DOĞRULA: ...] işaretlerini listeler.
import fs from 'node:fs';
import path from 'node:path';
import { build } from './lib/build.mjs';
import { loadData } from './lib/data.mjs';

const r = build();
const d = loadData();
let ok = true;
for (const app of d.apps) {
  for (const kind of ['gizlilik', 'sartlar']) {
    const f = path.join(r.out, 'apps', app.slug, kind, 'index.html');
    const exists = fs.existsSync(f);
    if (!exists) ok = false;
    console.log(`${exists ? '✔' : '✖'} apps/${app.slug}/${kind}/index.html`);
  }
  const marks = [...`${app.privacy}\n${app.terms}`.matchAll(/\[(?:DOĞRULA|DOGRULA):([^\]]*)\]/g)].map(m => m[1].trim());
  if (marks.length) {
    console.log(`  ⚠ ${app.name}: doğrulanacak ${marks.length} işaret:`);
    [...new Set(marks)].forEach(m => console.log('     - ' + m));
  }
}
if (/DOĞRULA|DOGRULA/.test(d.site.email || '')) console.log('⚠ Site ayarlarında iletişim e-postası henüz girilmemiş.');
process.exit(ok ? 0 : 1);
