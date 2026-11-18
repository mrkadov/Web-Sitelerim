// data/site.json okuma, doğrulama ve kaydetme
import fs from 'node:fs';
import { DATA_FILE } from './paths.mjs';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PLATFORMS = {
  android: 'Android',
  windows: 'Windows',
  ios: 'iOS',
  web: 'Web',
  macos: 'macOS',
  linux: 'Linux'
};

export function loadData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

// Hatalı veri varsa Türkçe hata mesajlarının listesini döner (boş liste = sorun yok)
export function validateData(d) {
  const errors = [];
  if (!d || typeof d !== 'object') return ['Veri bir JSON nesnesi olmalı.'];
  if (!d.site || typeof d.site !== 'object') errors.push('"site" ayarları eksik.');
  if (!Array.isArray(d.categories)) errors.push('"categories" bir liste olmalı.');
  if (!Array.isArray(d.apps)) errors.push('"apps" bir liste olmalı.');
  if (errors.length) return errors;

  const catIds = new Set();
  for (const c of d.categories) {
    if (!c || !SLUG_RE.test(c.id || '')) errors.push(`Geçersiz kategori kimliği: "${c && c.id}" (yalnızca küçük harf, rakam ve tire).`);
    else if (catIds.has(c.id)) errors.push(`Aynı kategori kimliği iki kez kullanılmış: "${c.id}".`);
    else catIds.add(c.id);
    if (!c || !String(c.name || '').trim()) errors.push(`"${c && c.id}" kategorisinin adı boş.`);
  }
  const slugs = new Set();
  for (const a of d.apps) {
    if (!a || !SLUG_RE.test(a.slug || '')) { errors.push(`Geçersiz uygulama kısa adı (slug): "${a && a.slug}" (yalnızca küçük harf, rakam ve tire).`); continue; }
    if (['admin', 'assets', 'img', 'api'].includes(a.slug)) errors.push(`"${a.slug}" kısa adı ayrılmış, başka bir ad seçin.`);
    if (slugs.has(a.slug)) errors.push(`Aynı kısa ad iki uygulamada kullanılmış: "${a.slug}".`);
    slugs.add(a.slug);
    if (!String(a.name || '').trim()) errors.push(`"${a.slug}" uygulamasının adı boş.`);
    if (a.categories && !Array.isArray(a.categories)) errors.push(`"${a.slug}" uygulamasının kategorileri bir liste olmalı.`);
    for (const cid of a.categories || []) if (!catIds.has(cid)) errors.push(`"${a.slug}" uygulaması olmayan bir kategoriye bağlı: "${cid}".`);
    if (a.platforms && !Array.isArray(a.platforms)) errors.push(`"${a.slug}" uygulamasının platformları bir liste olmalı.`);
    if (a.screenshots && !Array.isArray(a.screenshots)) errors.push(`"${a.slug}" uygulamasının ekran görüntüleri bir liste olmalı.`);
  }
  return errors;
}

export function saveData(d) {
  const errors = validateData(d);
  if (errors.length) {
    const e = new Error(errors.join('\n'));
    e.validation = errors;
    throw e;
  }
  const json = JSON.stringify(d, null, 2) + '\n';
  // Önce geçici dosyaya yaz, sonra yerine taşı (yarım kalmış dosya oluşmasın)
  const tmp = DATA_FILE + '.tmp';
  if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak');
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}
