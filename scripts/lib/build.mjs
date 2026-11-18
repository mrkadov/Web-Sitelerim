// Statik site üreticisi: data/site.json -> dist/
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { DIST, STATIC_DIR, ASSETS_DIR, ADMIN_DIR, MARKED_ESM } from './paths.mjs';
import { loadData, validateData, PLATFORMS } from './data.mjs';

marked.setOptions({ gfm: true, breaks: false });

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function normalizeBase(b) {
  let s = String(b ?? '/').trim();
  if (!s.startsWith('/')) s = '/' + s;
  if (!s.endsWith('/')) s += '/';
  return s.replace(/\/{2,}/g, '/');
}

function isExternal(u) { return /^(https?:)?\/\//i.test(u) || /^(mailto|tel|data):/i.test(u); }

function trDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return esc(iso);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Markdown metnini HTML'e çevirir; {{değişken}} ve [DOĞRULA: ...] işaretlerini işler
function renderMarkdown(md, vars) {
  let text = String(md || '');
  text = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  let html = marked.parse(text);
  html = html.replace(/\[(DOĞRULA|DOGRULA):([^\]]*)\]/g, '<mark class="dogrula" title="Yayından önce doğrulayın ve bu işareti silin">[$1:$2]</mark>');
  return html;
}

function countPlaceholders(s) { return (String(s || '').match(/\[(DOĞRULA|DOGRULA):/g) || []).length; }

function layout({ site, base, title, description, body, canonicalPath, noindex }) {
  const fullTitle = title ? `${title} | ${site.name}` : `${site.name} | ${site.tagline || ''}`;
  const siteUrl = (site.siteUrl || '').replace(/\/+$/, '');
  const canonical = siteUrl && canonicalPath != null ? `${siteUrl}/${canonicalPath}` : '';
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || site.tagline || '')}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description || site.tagline || '')}">
<meta name="theme-color" content="#6d28d9">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${base}assets/style.css">
</head>
<body>
<header class="topbar">
  <div class="wrap topbar-in">
    <a class="brand" href="${base}"><span class="brand-mark">${esc((site.name || 'K').slice(0, 1))}</span>${esc(site.name)}</a>
    <nav class="nav"><a href="${base}#uygulamalar">Uygulamalar</a><a href="${base}#hakkimda">Hakkımda</a>${site.email && !countPlaceholders(site.email) ? `<a href="mailto:${esc(site.email)}">İletişim</a>` : ''}</nav>
  </div>
</header>
<main class="wrap">
${body}
</main>
<footer class="footer">
  <div class="wrap">© ${new Date().getFullYear()} ${esc(site.name)}. Tüm hakları saklıdır.${site.email && !countPlaceholders(site.email) ? ` · <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : ''}</div>
</footer>
</body>
</html>
`;
}

function imgUrl(p, base) {
  if (!p) return '';
  if (isExternal(p)) return p;
  return base + String(p).replace(/^\/+/, '');
}

function platformBadges(app) {
  return (app.platforms || []).map(p => `<span class="badge badge-${esc(p)}">${esc(PLATFORMS[p] || p)}</span>`).join('');
}

function iconHtml(app, base, cls = 'app-icon') {
  if (app.icon) return `<img class="${cls}" src="${esc(imgUrl(app.icon, base))}" alt="${esc(app.name)} simgesi" width="96" height="96" loading="lazy">`;
  return `<span class="${cls} app-icon-fallback">${esc((app.name || '?').slice(0, 1))}</span>`;
}

function appCard(app, base) {
  return `<a class="card" href="${base}apps/${app.slug}/">
  ${iconHtml(app, base)}
  <div class="card-body">
    <h3>${esc(app.name)}</h3>
    <div class="badges">${platformBadges(app)}</div>
    <p>${esc(app.shortDescription)}</p>
  </div>
</a>`;
}

function homePage(d, base) {
  const apps = d.apps.filter(a => a.published !== false);
  const cats = [...d.categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let sections = '';
  for (const c of cats) {
    const list = apps.filter(a => (a.categories || []).includes(c.id));
    if (!list.length) continue;
    sections += `<section class="cat" id="kategori-${c.id}">
  <h2>${esc(c.name)}</h2>
  ${c.description ? `<p class="muted">${esc(c.description)}</p>` : ''}
  <div class="grid">${list.map(a => appCard(a, base)).join('\n')}</div>
</section>`;
  }
  const other = apps.filter(a => !(a.categories || []).some(id => d.categories.find(c => c.id === id)));
  if (other.length) sections += `<section class="cat" id="kategori-diger"><h2>Diğer</h2><div class="grid">${other.map(a => appCard(a, base)).join('\n')}</div></section>`;
  if (!apps.length) sections = '<p class="muted">Henüz yayınlanmış bir uygulama yok.</p>';

  const s = d.site;
  const body = `<section class="hero">
  <h1>${esc(s.heroTitle || s.name)}</h1>
  <p class="lead">${esc(s.tagline)}</p>
  <a class="btn btn-primary" href="#uygulamalar">Uygulamaları gör</a>
</section>
<div id="uygulamalar"></div>
${sections}
<section class="about" id="hakkimda">
  <h2>Hakkımda</h2>
  <div class="prose">${renderMarkdown(s.about, vars(d))}</div>
</section>`;
  return layout({ site: s, base, title: '', description: s.tagline, body, canonicalPath: '' });
}

function vars(d, app) {
  return {
    gelistirici: d.site.developerName || d.site.name,
    eposta: d.site.email || '[DOĞRULA: iletişim e-postası]',
    uygulama: app ? app.name : '',
    tarih: app && app.policyDate ? trDate(app.policyDate) : trDate(new Date().toLocaleDateString('sv-SE')),
    site: (d.site.siteUrl || '').replace(/\/+$/, '')
  };
}

function appPage(d, app, base, hasOwnSite) {
  const links = [];
  const L = app.links || {};
  if (L.googlePlay) links.push(`<a class="btn btn-play" href="${esc(L.googlePlay)}" rel="noopener">Google Play'den indir</a>`);
  if (L.windowsInstaller) links.push(`<a class="btn btn-win" href="${esc(isExternal(L.windowsInstaller) ? L.windowsInstaller : imgUrl(L.windowsInstaller, base))}" rel="noopener">Windows için indir (kurulum)</a>`);
  if (L.appStore) links.push(`<a class="btn" href="${esc(L.appStore)}" rel="noopener">App Store</a>`);
  if (hasOwnSite) links.push(`<a class="btn" href="${base}${app.slug}/">${esc(app.name)} web sitesi</a>`);
  if (L.website) links.push(`<a class="btn" href="${esc(L.website)}" rel="noopener">Web sitesi</a>`);
  const shots = (app.screenshots || []).filter(Boolean);
  const cats = (app.categories || []).map(id => d.categories.find(c => c.id === id)).filter(Boolean);
  const body = `<nav class="crumbs"><a href="${base}">Ana sayfa</a> › ${esc(app.name)}</nav>
<section class="app-head">
  ${iconHtml(app, base, 'app-icon app-icon-lg')}
  <div>
    <h1>${esc(app.name)}</h1>
    <div class="badges">${platformBadges(app)}${cats.map(c => `<a class="badge badge-cat" href="${base}#kategori-${c.id}">${esc(c.name)}</a>`).join('')}</div>
    <p class="lead">${esc(app.shortDescription)}</p>
  </div>
</section>
${links.length ? `<div class="actions">${links.join('')}</div>` : '<p class="muted">İndirme bağlantıları yakında eklenecek.</p>'}
${app.description ? `<section class="prose">${renderMarkdown(app.description, vars(d, app))}</section>` : ''}
${shots.length ? `<section><h2>Ekran görüntüleri</h2><div class="shots">${shots.map((s, i) => `<a href="${esc(imgUrl(s, base))}"><img src="${esc(imgUrl(s, base))}" alt="${esc(app.name)} ekran görüntüsü ${i + 1}" loading="lazy"></a>`).join('')}</div></section>` : ''}
<section class="legal-box">
  <h2>Yasal</h2>
  <ul>
    <li><a href="${base}apps/${app.slug}/gizlilik/">Gizlilik Politikası</a></li>
    <li><a href="${base}apps/${app.slug}/sartlar/">Kullanım Şartları</a></li>
  </ul>
</section>`;
  return layout({ site: d.site, base, title: app.name, description: app.shortDescription, body, canonicalPath: `apps/${app.slug}/` });
}

function legalPage(d, app, base, kind) {
  const isPrivacy = kind === 'gizlilik';
  const title = isPrivacy ? 'Gizlilik Politikası' : 'Kullanım Şartları';
  const md = isPrivacy ? app.privacy : app.terms;
  const body = `<nav class="crumbs"><a href="${base}">Ana sayfa</a> › <a href="${base}apps/${app.slug}/">${esc(app.name)}</a> › ${title}</nav>
<article class="prose legal">
  <h1>${esc(app.name)} – ${title}</h1>
  ${app.policyDate ? `<p class="muted">Son güncelleme: ${trDate(app.policyDate)}</p>` : ''}
  ${md && md.trim() ? renderMarkdown(md, vars(d, app)) : '<p>Bu metin henüz hazırlanmadı.</p>'}
  <hr>
  <p class="muted">Diğer metin: ${isPrivacy ? `<a href="${base}apps/${app.slug}/sartlar/">Kullanım Şartları</a>` : `<a href="${base}apps/${app.slug}/gizlilik/">Gizlilik Politikası</a>`}</p>
</article>`;
  return layout({ site: d.site, base, title: `${app.name} ${title}`, description: `${app.name} uygulaması ${title.toLowerCase()}`, body, canonicalPath: `apps/${app.slug}/${kind}/` });
}

function notFound(d, base) {
  const body = `<section class="hero"><h1>Sayfa bulunamadı</h1><p class="lead">Aradığınız sayfa taşınmış veya silinmiş olabilir.</p><a class="btn btn-primary" href="${base}">Ana sayfaya dön</a></section>`;
  return layout({ site: d.site, base, title: 'Sayfa bulunamadı', body, noindex: true });
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

// Klasörü kopyalar; adı "_" ile başlayan dosya/klasörler (ör. _BENIOKU.txt) atlanır
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name.startsWith('_') || ent.name === '.gitkeep') continue;
    const s = path.join(src, ent.name), t = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, t);
    else { fs.mkdirSync(dest, { recursive: true }); fs.copyFileSync(s, t); }
  }
}

/**
 * Siteyi üretir.
 * @param {{basePath?: string, siteUrl?: string, outDir?: string, data?: object, quiet?: boolean}} opts
 */
export function build(opts = {}) {
  const d = opts.data || loadData();
  const errors = validateData(d);
  if (errors.length) throw new Error('Veri dosyasında hata var:\n- ' + errors.join('\n- '));
  const base = normalizeBase(opts.basePath ?? process.env.BASE_PATH ?? d.site.basePath ?? '/');
  const site = { ...d.site };
  const envUrl = opts.siteUrl ?? process.env.SITE_URL;
  if (envUrl) site.siteUrl = envUrl;
  const data = { ...d, site };
  const out = opts.outDir || DIST;

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  copyDir(STATIC_DIR, out);          // static/ -> dist/ (img/, dongum/ ...)
  copyDir(ASSETS_DIR, path.join(out, 'assets'));

  write(path.join(out, 'index.html'), homePage(data, base));
  write(path.join(out, '404.html'), notFound(data, base));

  const pages = [''];
  const warnings = [];
  for (const app of data.apps) {
    if (app.published === false) {
      // Yayında olmayan uygulamanın yasal sayfaları yine de üretilir (Play Console incelemesi için gerekebilir)
    }
    const hasOwnSite = fs.existsSync(path.join(STATIC_DIR, app.slug, 'index.html'));
    if (app.published !== false) write(path.join(out, 'apps', app.slug, 'index.html'), appPage(data, app, base, hasOwnSite));
    write(path.join(out, 'apps', app.slug, 'gizlilik', 'index.html'), legalPage(data, app, base, 'gizlilik'));
    write(path.join(out, 'apps', app.slug, 'sartlar', 'index.html'), legalPage(data, app, base, 'sartlar'));
    pages.push(`apps/${app.slug}/`, `apps/${app.slug}/gizlilik/`, `apps/${app.slug}/sartlar/`);
    const n = countPlaceholders(app.privacy) + countPlaceholders(app.terms);
    if (n) warnings.push(`${app.name}: ${n} adet [DOĞRULA: ...] işareti doğrulanmayı bekliyor.`);
  }

  // Çevrimiçi yönetim paneli (GitHub üzerinden kaydeder; içinde gizli bilgi yoktur)
  if (site.onlineAdmin !== false) {
    copyDir(ADMIN_DIR, path.join(out, 'admin'));
    fs.mkdirSync(path.join(out, 'admin'), { recursive: true });
    if (fs.existsSync(MARKED_ESM)) fs.copyFileSync(MARKED_ESM, path.join(out, 'admin', 'marked.esm.js'));
  }

  const siteUrl = (site.siteUrl || '').replace(/\/+$/, '');
  write(path.join(out, 'robots.txt'), `User-agent: *\nDisallow: ${base}admin/\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`);
  if (siteUrl) {
    write(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${esc(siteUrl + '/' + p)}</loc></url>`).join('\n')}\n</urlset>\n`);
  }
  write(path.join(out, '.nojekyll'), '');

  const legal = data.apps.map(a => ({
    name: a.name,
    privacy: `${siteUrl || ''}${siteUrl ? '/' : base}apps/${a.slug}/gizlilik/`,
    terms: `${siteUrl || ''}${siteUrl ? '/' : base}apps/${a.slug}/sartlar/`
  }));
  return { out, base, siteUrl, apps: data.apps.length, pages: pages.length, warnings, legal };
}
