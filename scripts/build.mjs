// npm run build  ->  dist/ klasörüne statik siteyi üretir
import { build } from './lib/build.mjs';

try {
  const r = build();
  console.log(`✔ Site üretildi: ${r.out}`);
  console.log(`  Taban yol (base path): ${r.base}   Uygulama sayısı: ${r.apps}`);
  console.log('\nPlay Console için adresler (site adresi "Site ayarları"ndan değiştirilebilir):');
  for (const l of r.legal) console.log(`  ${l.name}\n    Gizlilik: ${l.privacy}\n    Şartlar:  ${l.terms}`);
  for (const w of r.warnings) console.log('  ⚠ ' + w);
} catch (e) {
  console.error('✖ Derleme başarısız:\n' + e.message);
  process.exit(1);
}
