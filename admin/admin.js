// KADO Yönetim Paneli
// İki modda çalışır:
//  1) Yerel mod: "npm run admin" ile açılan sunucu (http://localhost:4000/admin/). Dosyalar doğrudan bilgisayarda düzenlenir.
//  2) GitHub modu: Yayındaki sitede /admin/ adresi. Değişiklikler GitHub API ile depoya kaydedilir,
//     GitHub Actions siteyi otomatik yeniden yayınlar. Erişim anahtarı (token) YALNIZCA bu tarayıcıda saklanır.
import { marked } from './marked.esm.js';

const PLATFORMS = { android: 'Android', windows: 'Windows', ios: 'iOS', web: 'Web', macos: 'macOS', linux: 'Linux' };
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GH_KEY = 'kado-admin-github';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let store = null;   // aktif depolama (yerel veya GitHub)
let data = null;    // site.json içeriği
let tab = 'apps';
let editing = null; // düzenlenen uygulamanın taslağı
let editingIsNew = false;

// ---------- yardımcılar ----------
function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast ' + kind; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), kind === 'err' ? 9000 : 3500);
}
export function slugify(s) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
  return String(s || '').replace(/[çğıöşüÇĞİIÖŞÜ]/g, c => map[c]).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const countMarks = s => (String(s || '').match(/\[(DOĞRULA|DOGRULA):/g) || []).length;
const imgSrc = p => !p ? '' : /^(https?:)?\/\//.test(p) ? p : '../' + String(p).replace(/^\/+/, '');
function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const b64ToUtf8 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
const fileToB64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
function renderMd(md) {
  const vars = { gelistirici: data.site.developerName || data.site.name, eposta: data.site.email || '', uygulama: editing ? editing.name : '', tarih: editing?.policyDate || '', site: data.site.siteUrl || '' };
  const html = marked.parse(String(md || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? esc(vars[k]) : m)));
  return html.replace(/\[(DOĞRULA|DOGRULA):([^\]]*)\]/g, '<mark>[$1:$2]</mark>');
}
function safeName(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || ''); const ext = m ? '.' + m[1].toLowerCase() : '';
  return (slugify(name.replace(/\.[^.]+$/, '')) || 'resim') + ext;
}

// ---------- depolama: yerel sunucu ----------
const LocalStore = {
  mode: 'local',
  async api(method, url, body) {
    const r = await fetch('../api/' + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Sunucu hatası: ' + r.status);
    return j;
  },
  load() { return this.api('GET', 'data'); },
  async save(d) { const r = await this.api('PUT', 'data', d); return 'Kaydedildi ve site yeniden üretildi.' + (r.warnings?.length ? '\n' + r.warnings.join('\n') : ''); },
  async upload(file, folder) { const j = await this.api('POST', 'upload', { filename: file.name, folder, dataBase64: await fileToB64(file) }); return j.path; }
};

// ---------- depolama: GitHub API ----------
const GitHubStore = {
  mode: 'gh', sha: null,
  get cfg() { try { return JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch { return {}; } },
  set cfg(v) { localStorage.setItem(GH_KEY, JSON.stringify(v)); },
  async gh(method, path, body) {
    const c = this.cfg;
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/${path}`, {
      method, cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${c.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const hints = { 401: 'Erişim anahtarı (token) geçersiz veya süresi dolmuş.', 403: 'Token bu depoya yazma iznine sahip değil (Contents: Read and write gerekli).', 404: 'Depo veya dosya bulunamadı. Kullanıcı adı / depo adı / dal doğru mu? Token bu depoya erişebiliyor mu?', 409: 'Dosya bu arada başka yerden değişmiş. Sayfayı yenileyip tekrar deneyin.', 422: 'GitHub isteği reddetti.' };
      throw new Error((hints[r.status] || 'GitHub hatası ' + r.status) + (j.message ? `\n(${j.message})` : ''));
    }
    return j;
  },
  async load() {
    const c = this.cfg;
    const j = await this.gh('GET', `contents/data/site.json?ref=${encodeURIComponent(c.branch || 'main')}`);
    this.sha = j.sha;
    return JSON.parse(b64ToUtf8(j.content));
  },
  async save(d) {
    const c = this.cfg;
    const j = await this.gh('PUT', 'contents/data/site.json', { message: 'Yönetim paneli: site verisi güncellendi', content: utf8ToB64(JSON.stringify(d, null, 2) + '\n'), sha: this.sha, branch: c.branch || 'main' });
    this.sha = j.content.sha;
    return 'GitHub\'a kaydedildi. Site 1-2 dakika içinde otomatik olarak güncellenecek.';
  },
  async upload(file, folder) {
    const c = this.cfg;
    const name = `${Date.now().toString(36)}-${safeName(file.name)}`;
    const path = `static/img/${folder}/${name}`;
    await this.gh('PUT', 'contents/' + path.split('/').map(encodeURIComponent).join('/'), { message: `Yönetim paneli: resim yüklendi (${name})`, content: await fileToB64(file), branch: c.branch || 'main' });
    return `img/${folder}/${name}`;
  }
};

// ---------- doğrulama ----------
function validate(d) {
  const errs = [], ids = new Set(), slugs = new Set();
  for (const c of d.categories) { if (!SLUG_RE.test(c.id)) errs.push(`Geçersiz kategori kimliği: ${c.id}`); if (ids.has(c.id)) errs.push(`Kategori kimliği tekrar ediyor: ${c.id}`); ids.add(c.id); if (!c.name?.trim()) errs.push('Kategori adı boş olamaz.'); }
  for (const a of d.apps) {
    if (!SLUG_RE.test(a.slug)) errs.push(`Geçersiz kısa ad: "${a.slug}" (küçük harf, rakam, tire)`);
    if (['admin', 'assets', 'img', 'api'].includes(a.slug)) errs.push(`"${a.slug}" kısa adı ayrılmış.`);
    if (slugs.has(a.slug)) errs.push(`Kısa ad tekrar ediyor: ${a.slug}`); slugs.add(a.slug);
    if (!a.name?.trim()) errs.push('Uygulama adı boş olamaz.');
  }
  return errs;
}
async function persist(btn) {
  const errs = validate(data);
  if (errs.length) { toast(errs.join('\n'), 'err'); return false; }
  if (btn) btn.disabled = true;
  try { toast('Kaydediliyor…'); const msg = await store.save(data); toast(msg, 'ok'); return true; }
  catch (e) { toast('Kaydedilemedi:\n' + e.message, 'err'); return false; }
  finally { if (btn) btn.disabled = false; }
}
async function reload() { data = await store.load(); data.categories ||= []; data.apps ||= []; data.site ||= {}; }

// ---------- görünümler ----------
function render() {
  $('#tabs').hidden = false;
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const v = $('#view');
  if (tab === 'apps') return editing ? renderEditor(v) : renderApps(v);
  if (tab === 'cats') return renderCats(v);
  if (tab === 'site') return renderSite(v);
  if (tab === 'links') return renderLinks(v);
  if (tab === 'gh') return renderGhLogin(v, true);
}

function renderApps(v) {
  const catName = id => data.categories.find(c => c.id === id)?.name || id;
  v.innerHTML = `<div class="card">
    <div class="row"><h2 style="margin:0">Uygulamalar (${data.apps.length})</h2><span class="spacer" style="flex:1"></span><button class="primary" id="newApp">+ Yeni uygulama</button></div>
    <p class="muted">Düzenlemek için bir uygulamaya tıklayın. Sarı uyarı, gizlilik/şartlar metninde doğrulanması gereken <code>[DOĞRULA: …]</code> işaretlerini gösterir.</p>
    <div class="applist">${data.apps.map((a, i) => {
      const n = countMarks(a.privacy) + countMarks(a.terms);
      return `<button class="appitem" data-i="${i}">${a.icon ? `<img src="${esc(imgSrc(a.icon))}" alt="">` : '<span class="ico"></span>'}
        <span><b>${esc(a.name)}</b><span class="muted">/apps/${esc(a.slug)}/</span><br>
        ${(a.platforms || []).map(p => `<span class="tag">${esc(PLATFORMS[p] || p)}</span>`).join('')}
        ${(a.categories || []).map(c => `<span class="tag" style="background:#e0f2fe;color:#075985">${esc(catName(c))}</span>`).join('')}
        ${a.published === false ? '<span class="tag off">Gizli</span>' : ''}${n ? `<span class="tag warn">${n} doğrulanacak</span>` : ''}</span></button>`;
    }).join('') || '<p class="muted">Henüz uygulama yok.</p>'}</div></div>`;
  $('#newApp').onclick = () => {
    editingIsNew = true;
    editing = { slug: '', name: '', published: true, categories: [], platforms: [], shortDescription: '', description: '', icon: '', screenshots: [], links: { googlePlay: '', windowsInstaller: '', website: '' }, policyDate: localToday(), privacy: templatePrivacy(), terms: templateTerms() };
    render();
  };
  $$('.appitem').forEach(b => b.onclick = () => { editingIsNew = false; editing = structuredClone(data.apps[+b.dataset.i]); editing._orig = editing.slug; render(); });
}

function mdField(id, label, value, tall) {
  return `<label for="${id}">${label}</label>
  <div class="row" style="margin-bottom:6px"><button type="button" class="small" data-prev="${id}">Önizleme</button><span class="muted" data-count="${id}"></span></div>
  <textarea id="${id}" class="${tall ? 'tall' : ''}">${esc(value)}</textarea>
  <div class="preview" id="${id}-prev" hidden></div>`;
}

function renderEditor(v) {
  const a = editing;
  a.links ||= {}; a.screenshots ||= []; a.categories ||= []; a.platforms ||= [];
  v.innerHTML = `<div class="card">
  <div class="row"><button id="back">← Listeye dön</button><h2 style="margin:0">${editingIsNew ? 'Yeni uygulama' : esc(a.name)}</h2></div>
  <div class="grid2">
    <div><label>Uygulama adı</label><input type="text" id="f-name" value="${esc(a.name)}" placeholder="ör. Döngüm"></div>
    <div><label>Kısa ad (adres) <small>yalnızca küçük harf, rakam, tire</small></label><input type="text" id="f-slug" value="${esc(a.slug)}" placeholder="ör. dongum">
      <div class="muted" id="slugHint"></div></div>
  </div>
  <label class="checks" style="margin-top:12px"><input type="checkbox" id="f-pub" ${a.published !== false ? 'checked' : ''}> Sitede göster (işaretli değilse ana sayfada görünmez; gizlilik/şartlar sayfaları yine de yayınlanır)</label>
  <div class="grid2">
    <div><label>Kategoriler</label><div class="checks">${data.categories.map(c => `<label><input type="checkbox" name="cat" value="${esc(c.id)}" ${a.categories.includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('') || '<span class="muted">Önce "Kategoriler" sekmesinden kategori ekleyin.</span>'}</div></div>
    <div><label>Platformlar</label><div class="checks">${Object.entries(PLATFORMS).map(([k, n]) => `<label><input type="checkbox" name="plat" value="${k}" ${a.platforms.includes(k) ? 'checked' : ''}> ${n}</label>`).join('')}</div></div>
  </div>
  <label>Kısa açıklama <small>(kartlarda ve arama motorlarında görünür)</small></label><input type="text" id="f-short" value="${esc(a.shortDescription)}">
  ${mdField('f-desc', 'Uzun açıklama <small>(Markdown)</small>', a.description)}

  <h3>Simge ve ekran görüntüleri</h3>
  <div class="row"><img id="iconPrev" class="ico" src="${esc(imgSrc(a.icon))}" alt="" ${a.icon ? '' : 'style="visibility:hidden"'}>
    <div style="flex:1;min-width:220px"><label>Simge yolu <small>(ör. img/dongum/icon.png veya https://…)</small></label><input type="text" id="f-icon" value="${esc(a.icon)}"></div>
    <label class="btn">Simge yükle<input type="file" id="up-icon" accept="image/*" hidden></label></div>
  <div class="row" style="margin-top:12px"><label class="btn">Ekran görüntüsü ekle<input type="file" id="up-shot" accept="image/*" multiple hidden></label><span class="muted">Telefon ekran görüntüleri dikey olarak en iyi görünür.</span></div>
  <div class="shotlist" id="shots"></div>

  <h3>İndirme bağlantıları</h3>
  <div class="grid2">
    <div><label>Google Play adresi</label><input type="url" id="f-play" value="${esc(a.links.googlePlay)}" placeholder="https://play.google.com/store/apps/details?id=..."></div>
    <div><label>Windows kurulum (setup) adresi <small>(ör. GitHub Releases bağlantısı)</small></label><input type="text" id="f-win" value="${esc(a.links.windowsInstaller)}" placeholder="https://github.com/.../releases/latest"></div>
    <div><label>Harici web sitesi <small>(isteğe bağlı)</small></label><input type="url" id="f-web" value="${esc(a.links.website)}" placeholder="https://"></div>
    <div><label>Politika güncelleme tarihi</label><input type="date" id="f-date" value="${esc(a.policyDate)}"></div>
  </div>
  <p class="muted">İpucu: <code>static/${esc(a.slug || 'kisa-ad')}/index.html</code> varsa uygulama sayfasında otomatik "web sitesi" düğmesi çıkar.</p>

  <h3>Gizlilik Politikası ve Kullanım Şartları</h3>
  <p class="muted">Metinlerde şu kısaltmalar otomatik doldurulur: <code>{{uygulama}}</code> <code>{{gelistirici}}</code> <code>{{eposta}}</code> <code>{{tarih}}</code>. Yayından önce tüm <code>[DOĞRULA: …]</code> işaretlerini gerçek bilgilerle değiştirip silin.</p>
  ${mdField('f-privacy', 'Gizlilik Politikası <small>(Markdown)</small>', a.privacy, true)}
  ${mdField('f-terms', 'Kullanım Şartları <small>(Markdown)</small>', a.terms, true)}

  <div class="sticky-actions"><button class="primary" id="saveApp">💾 Kaydet</button><button id="cancel">Vazgeç</button><span style="flex:1"></span>${editingIsNew ? '' : '<button class="danger" id="delApp">Uygulamayı sil</button>'}</div>
  </div>`;

  const nameEl = $('#f-name'), slugEl = $('#f-slug');
  let slugTouched = !editingIsNew;
  slugEl.oninput = () => { slugTouched = true; hint(); };
  nameEl.oninput = () => { if (!slugTouched) slugEl.value = slugify(nameEl.value); hint(); };
  function hint() { $('#slugHint').innerHTML = slugEl.value ? `Adresler: <code>/apps/${esc(slugEl.value)}/gizlilik/</code>` : ''; }
  hint();

  const updCount = id => { const n = countMarks($('#' + id).value); $(`[data-count="${id}"]`).textContent = n ? `⚠ ${n} adet [DOĞRULA] işareti` : ''; };
  for (const id of ['f-desc', 'f-privacy', 'f-terms']) {
    updCount(id);
    $('#' + id).addEventListener('input', () => { updCount(id); const p = $('#' + id + '-prev'); if (!p.hidden) p.innerHTML = renderMd($('#' + id).value); });
  }
  $$('[data-prev]').forEach(b => b.onclick = () => { const id = b.dataset.prev, p = $('#' + id + '-prev'); p.hidden = !p.hidden; b.textContent = p.hidden ? 'Önizleme' : 'Önizlemeyi kapat'; if (!p.hidden) p.innerHTML = renderMd($('#' + id).value); });

  $('#f-icon').oninput = e => { const im = $('#iconPrev'); im.src = imgSrc(e.target.value); im.style.visibility = e.target.value ? '' : 'hidden'; };
  const folder = () => SLUG_RE.test(slugEl.value) ? slugEl.value : 'genel';
  $('#up-icon').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { toast('Yükleniyor…'); const p = await store.upload(f, folder()); $('#f-icon').value = p; $('#f-icon').dispatchEvent(new Event('input')); toast('Simge yüklendi. Kaydetmeyi unutmayın.', 'ok'); }
    catch (err) { toast('Yüklenemedi:\n' + err.message, 'err'); }
    e.target.value = '';
  };
  $('#up-shot').onchange = async e => {
    try { for (const f of e.target.files) { toast('Yükleniyor: ' + f.name); editing.screenshots.push(await store.upload(f, folder())); } drawShots(); toast('Ekran görüntüleri eklendi. Kaydetmeyi unutmayın.', 'ok'); }
    catch (err) { toast('Yüklenemedi:\n' + err.message, 'err'); }
    e.target.value = '';
  };
  function drawShots() {
    $('#shots').innerHTML = editing.screenshots.map((s, i) => `<div class="shot"><img src="${esc(imgSrc(s))}" alt="" title="${esc(s)}"><button class="small danger" data-rm="${i}">✕</button></div>`).join('') || '<span class="muted">Ekran görüntüsü yok.</span>';
    $$('[data-rm]').forEach(b => b.onclick = () => { editing.screenshots.splice(+b.dataset.rm, 1); drawShots(); });
  }
  drawShots();

  $('#back').onclick = $('#cancel').onclick = () => { editing = null; render(); };
  $('#saveApp').onclick = async e => {
    const slug = slugEl.value.trim();
    if (!editingIsNew && editing._orig !== slug && !confirm(`Kısa ad "${editing._orig}" → "${slug}" olarak değişecek. Eski gizlilik adresi çalışmayı bırakır; Play Console'daki bağlantıyı da güncellemeniz gerekir. Devam edilsin mi?`)) return;
    const app = {
      slug, name: nameEl.value.trim(), published: $('#f-pub').checked,
      categories: $$('input[name=cat]:checked').map(x => x.value), platforms: $$('input[name=plat]:checked').map(x => x.value),
      shortDescription: $('#f-short').value.trim(), description: $('#f-desc').value,
      icon: $('#f-icon').value.trim(), screenshots: [...editing.screenshots],
      links: { ...editing.links, googlePlay: $('#f-play').value.trim(), windowsInstaller: $('#f-win').value.trim(), website: $('#f-web').value.trim() },
      policyDate: $('#f-date').value, privacy: $('#f-privacy').value, terms: $('#f-terms').value
    };
    const backup = structuredClone(data.apps);
    if (editingIsNew) data.apps.push(app);
    else data.apps[data.apps.findIndex(x => x.slug === editing._orig)] = app;
    if (await persist(e.target)) { editing = structuredClone(app); editing._orig = app.slug; editingIsNew = false; render(); }
    else data.apps = backup;
  };
  if ($('#delApp')) $('#delApp').onclick = async e => {
    if (!confirm(`"${editing.name}" silinsin mi? Gizlilik ve şartlar sayfaları da siteden kalkar.`)) return;
    const backup = structuredClone(data.apps);
    data.apps = data.apps.filter(x => x.slug !== editing._orig);
    if (await persist(e.target)) { editing = null; render(); } else data.apps = backup;
  };
}

function renderCats(v) {
  const cats = [...data.categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const used = id => data.apps.filter(a => (a.categories || []).includes(id)).length;
  v.innerHTML = `<div class="card"><h2>Kategoriler</h2>
  <p class="muted">Ana sayfada uygulamalar bu kategorilere göre gruplanır. Bir uygulama birden çok kategoride olabilir. Sıra küçükten büyüğe.</p>
  <table><thead><tr><th>Ad</th><th>Açıklama</th><th style="width:80px">Sıra</th><th>Kimlik</th><th></th></tr></thead><tbody>
  ${cats.map(c => `<tr data-id="${esc(c.id)}"><td><input type="text" class="c-name" value="${esc(c.name)}"></td><td><input type="text" class="c-desc" value="${esc(c.description || '')}"></td><td><input type="number" class="c-order" value="${esc(c.order ?? 0)}"></td><td><code>${esc(c.id)}</code><br><span class="muted">${used(c.id)} uygulama</span></td><td><button class="small danger c-del">Sil</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Kategori yok.</td></tr>'}
  </tbody></table>
  <div class="sticky-actions"><button class="primary" id="saveCats">💾 Değişiklikleri kaydet</button></div></div>
  <div class="card"><h2>Yeni kategori</h2><div class="grid2"><div><label>Ad</label><input type="text" id="nc-name" placeholder="ör. Oyunlar"></div><div><label>Kimlik <small>(otomatik)</small></label><input type="text" id="nc-id"></div></div>
  <label>Açıklama</label><input type="text" id="nc-desc"><div style="margin-top:12px"><button class="primary" id="addCat">+ Kategori ekle</button></div></div>`;
  let idTouched = false;
  $('#nc-id').oninput = () => (idTouched = true);
  $('#nc-name').oninput = () => { if (!idTouched) $('#nc-id').value = slugify($('#nc-name').value); };
  $('#saveCats').onclick = async e => {
    const backup = structuredClone(data.categories);
    $$('tr[data-id]').forEach(tr => { const c = data.categories.find(x => x.id === tr.dataset.id); c.name = $('.c-name', tr).value.trim(); c.description = $('.c-desc', tr).value.trim(); c.order = Number($('.c-order', tr).value) || 0; });
    if (await persist(e.target)) render(); else data.categories = backup;
  };
  $$('.c-del').forEach(b => b.onclick = async e => {
    const id = b.closest('tr').dataset.id;
    if (!confirm(`"${data.categories.find(c => c.id === id).name}" kategorisi silinsin mi? Uygulamalar silinmez, sadece bu kategoriden çıkarılır.`)) return;
    const backup = structuredClone(data);
    data.categories = data.categories.filter(c => c.id !== id);
    data.apps.forEach(a => a.categories = (a.categories || []).filter(x => x !== id));
    if (await persist(e.target)) render(); else data = backup;
  });
  $('#addCat').onclick = async e => {
    const name = $('#nc-name').value.trim(), id = $('#nc-id').value.trim();
    if (!name) return toast('Kategori adı girin.', 'err');
    if (!SLUG_RE.test(id)) return toast('Kimlik yalnızca küçük harf, rakam ve tire içerebilir.', 'err');
    if (data.categories.some(c => c.id === id)) return toast('Bu kimlikte bir kategori zaten var.', 'err');
    data.categories.push({ id, name, description: $('#nc-desc').value.trim(), order: Math.max(0, ...data.categories.map(c => c.order || 0)) + 1 });
    if (await persist(e.target)) render(); else data.categories.pop();
  };
}

function renderSite(v) {
  const s = data.site; s.github ||= {};
  v.innerHTML = `<div class="card"><h2>Site ayarları</h2>
  <div class="grid2">
    <div><label>Site adı</label><input type="text" id="s-name" value="${esc(s.name)}"></div>
    <div><label>Geliştirici adı <small>(metinlerde {{gelistirici}})</small></label><input type="text" id="s-dev" value="${esc(s.developerName)}"></div>
    <div><label>Ana sayfa başlığı</label><input type="text" id="s-hero" value="${esc(s.heroTitle)}"></div>
    <div><label>İletişim e-postası <small>(metinlerde {{eposta}})</small></label><input type="text" id="s-email" value="${esc(s.email)}"></div>
  </div>
  <label>Slogan / kısa tanıtım</label><input type="text" id="s-tag" value="${esc(s.tagline)}">
  ${mdField('s-about', 'Hakkımda <small>(Markdown)</small>', s.about)}
  <h3>Yayın adresi</h3>
  <div class="grid2">
    <div><label>Sitenin tam adresi <small>(Play Console bağlantıları buna göre gösterilir)</small></label><input type="url" id="s-url" value="${esc(s.siteUrl)}" placeholder="https://kullaniciadi.github.io/kado-site"></div>
    <div><label>Taban yol (base path) <small>yalnızca elle "npm run build" için</small></label><input type="text" id="s-base" value="${esc(s.basePath)}" placeholder="/kado-site/"></div>
  </div>
  <p class="muted">GitHub Actions ile yayınlarken taban yol ve adres otomatik ayarlanır; buradaki değer yalnızca bilgisayarda elle derleme içindir.</p>
  <h3>GitHub deposu <small class="muted">(çevrimiçi yönetim paneli için)</small></h3>
  <div class="grid2"><div><label>GitHub kullanıcı adı</label><input type="text" id="s-owner" value="${esc(s.github.owner)}"></div><div><label>Depo adı</label><input type="text" id="s-repo" value="${esc(s.github.repo)}"></div><div><label>Dal (branch)</label><input type="text" id="s-branch" value="${esc(s.github.branch || 'main')}"></div></div>
  <label class="checks" style="margin-top:12px"><input type="checkbox" id="s-online" ${s.onlineAdmin !== false ? 'checked' : ''}> Çevrimiçi yönetim panelini (/admin/) yayınla</label>
  <div class="sticky-actions"><button class="primary" id="saveSite">💾 Kaydet</button></div></div>`;
  $$('[data-prev]').forEach(b => b.onclick = () => { const id = b.dataset.prev, p = $('#' + id + '-prev'); p.hidden = !p.hidden; if (!p.hidden) p.innerHTML = renderMd($('#' + id).value); });
  $('#saveSite').onclick = async e => {
    const backup = structuredClone(data.site);
    Object.assign(s, { name: $('#s-name').value.trim(), developerName: $('#s-dev').value.trim(), heroTitle: $('#s-hero').value.trim(), email: $('#s-email').value.trim(), tagline: $('#s-tag').value.trim(), about: $('#s-about').value, siteUrl: $('#s-url').value.trim().replace(/\/+$/, ''), basePath: $('#s-base').value.trim() || '/', onlineAdmin: $('#s-online').checked, github: { owner: $('#s-owner').value.trim(), repo: $('#s-repo').value.trim(), branch: $('#s-branch').value.trim() || 'main' } });
    if (await persist(e.target)) render(); else data.site = backup;
  };
}

function renderLinks(v) {
  const base = (data.site.siteUrl || '').replace(/\/+$/, '');
  const row = (label, url) => `<tr><td>${label}</td><td><code>${esc(url)}</code></td><td><button class="small" data-copy="${esc(url)}">Kopyala</button></td></tr>`;
  v.innerHTML = `<div class="card"><h2>Play Console bağlantıları</h2>
  <p class="muted">Google Play Console → Uygulamanız → <b>Politika ve programlar → Uygulama içeriği → Gizlilik politikası</b> alanına ilgili "Gizlilik" adresini yapıştırın. Adresler <b>Site ayarları</b>ndaki site adresine göre oluşturulur${/kullaniciadi/.test(base) ? ' — <b style="color:#b45309">şu an örnek adres yazılı, kendi adresinizle değiştirin!</b>' : ''}.</p>
  <table><tbody>${data.apps.map(a => row(`<b>${esc(a.name)}</b> – Gizlilik`, `${base}/apps/${a.slug}/gizlilik/`) + row(`${esc(a.name)} – Şartlar`, `${base}/apps/${a.slug}/sartlar/`) + row(`${esc(a.name)} – Uygulama sayfası`, `${base}/apps/${a.slug}/`)).join('')}</tbody></table>
  ${data.apps.some(a => countMarks(a.privacy) + countMarks(a.terms)) ? '<p class="tag warn" style="padding:8px 12px;font-size:.9rem">⚠ Bazı metinlerde hâlâ [DOĞRULA: …] işaretleri var. Play Console\'a göndermeden önce bunları tamamlayın.</p>' : ''}
  </div>`;
  $$('[data-copy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Kopyalandı', 'ok'); } catch { prompt('Kopyalayın:', b.dataset.copy); } });
}

function renderGhLogin(v, inTab) {
  const c = GitHubStore.cfg;
  // Adresten tahmin et: kullaniciadi.github.io/depo/admin/
  const host = location.hostname, seg = location.pathname.split('/').filter(Boolean);
  const guessOwner = host.endsWith('.github.io') ? host.split('.')[0] : '';
  const guessRepo = guessOwner ? (seg.length > 1 ? seg[0] : `${guessOwner}.github.io`) : '';
  v.innerHTML = `<div class="card" style="max-width:720px"><h2>GitHub ile giriş</h2>
  <p>Bu panel yayındaki sitede çalışıyor. Değişiklikler doğrudan GitHub deponuza kaydedilir ve site 1-2 dakika içinde otomatik güncellenir.</p>
  <div class="help"><b>Erişim anahtarı (token) nasıl alınır?</b><ol>
    <li>GitHub'da sağ üstte profil resmi → <b>Settings</b> → en altta <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>
    <li><b>Repository access:</b> "Only select repositories" → yalnızca bu sitenin deposunu seçin.</li>
    <li><b>Permissions → Repository permissions → Contents:</b> "Read and write". Başka izin gerekmez.</li>
    <li>Bir son kullanma tarihi seçin, oluşturun ve <code>github_pat_…</code> ile başlayan anahtarı aşağıya yapıştırın.</li></ol>
    Anahtar <b>yalnızca bu tarayıcıda</b> (localStorage) saklanır, depoya veya siteye asla yazılmaz. Ortak/yabancı bilgisayarda kullandıktan sonra "Çıkış yap"a basın.</div>
  <div class="grid2"><div><label>GitHub kullanıcı adı</label><input type="text" id="g-owner" value="${esc(c.owner || guessOwner)}"></div><div><label>Depo adı</label><input type="text" id="g-repo" value="${esc(c.repo || guessRepo)}"></div>
  <div><label>Dal (branch)</label><input type="text" id="g-branch" value="${esc(c.branch || 'main')}"></div><div><label>Erişim anahtarı (token)</label><input type="password" id="g-token" value="${esc(c.token || '')}" autocomplete="off" placeholder="github_pat_..."></div></div>
  <div class="row" style="margin-top:14px"><button class="primary" id="g-login">Bağlan</button>${c.token ? '<button class="danger" id="g-logout">Çıkış yap (anahtarı bu tarayıcıdan sil)</button>' : ''}</div></div>`;
  $('#g-login').onclick = async e => {
    const cfg = { owner: $('#g-owner').value.trim(), repo: $('#g-repo').value.trim(), branch: $('#g-branch').value.trim() || 'main', token: $('#g-token').value.trim() };
    if (!cfg.owner || !cfg.repo || !cfg.token) return toast('Kullanıcı adı, depo adı ve erişim anahtarını doldurun.', 'err');
    GitHubStore.cfg = cfg;
    e.target.disabled = true;
    try { await reload(); toast('GitHub\'a bağlanıldı.', 'ok'); tab = 'apps'; editing = null; render(); }
    catch (err) { toast('Bağlanılamadı:\n' + err.message, 'err'); e.target.disabled = false; }
  };
  if ($('#g-logout')) $('#g-logout').onclick = () => { localStorage.removeItem(GH_KEY); data = null; $('#tabs').hidden = true; renderGhLogin(v); toast('Çıkış yapıldı, anahtar silindi.', 'ok'); };
}

function templatePrivacy() {
  return `Bu Gizlilik Politikası, **{{gelistirici}}** tarafından geliştirilen **{{uygulama}}** uygulamasının kişisel verilerinizi nasıl işlediğini açıklar.

## 1. Veri sorumlusu ve iletişim

{{gelistirici}} – {{eposta}}

## 2. Topladığımız veriler

[DOĞRULA: uygulama hangi verileri topluyor? Hiç veri toplamıyorsa bunu açıkça yazın.]

## 3. Verilerin kullanımı ve paylaşımı

Verileriniz yalnızca uygulamanın çalışması için kullanılır, satılmaz. [DOĞRULA: üçüncü taraf hizmetler (reklam, analiz) var mı?]

## 4. Haklarınız

KVKK madde 11 ve GDPR kapsamındaki haklarınız için {{eposta}} adresine yazabilirsiniz.

## 5. Değişiklikler

Bu politika güncellenebilir; güncel sürüm her zaman bu sayfadadır.
`;
}
function templateTerms() {
  return `Bu Kullanım Şartları, **{{gelistirici}}** tarafından geliştirilen **{{uygulama}}** uygulamasının kullanımını düzenler. Uygulamayı kullanarak bu şartları kabul etmiş olursunuz.

## 1. Kullanım

Uygulamayı yalnızca yasal amaçlarla kullanabilirsiniz.

## 2. Sorumluluk reddi

Uygulama "olduğu gibi" sunulur; yürürlükteki hukukun izin verdiği ölçüde doğabilecek zararlardan sorumlu değiliz.

## 3. Uygulanacak hukuk

Türkiye Cumhuriyeti kanunları uygulanır. [DOĞRULA: yetkili mahkeme şehri]

## 4. İletişim

{{eposta}}
`;
}

// ---------- başlangıç ----------
$$('#tabs button').forEach(b => b.onclick = () => {
  if (editing && b.dataset.tab !== 'apps' && !confirm('Kaydedilmemiş değişiklikler kaybolabilir. Devam edilsin mi?')) return;
  if (b.dataset.tab !== 'apps') editing = null;
  tab = b.dataset.tab; render();
});

(async function init() {
  let local = false;
  try { const r = await fetch('../api/ping', { cache: 'no-store' }); local = r.ok && (await r.json()).mode === 'local'; } catch {}
  store = local ? LocalStore : GitHubStore;
  const m = $('#mode');
  m.textContent = local ? 'Yerel mod (bilgisayarınız)' : 'Çevrimiçi mod (GitHub)';
  m.className = 'pill ' + (local ? 'local' : 'gh');
  $('#ghTab').hidden = local;
  if (local) {
    try { await reload(); render(); } catch (e) { $('#view').innerHTML = `<div class="card"><h2>Veri okunamadı</h2><pre>${esc(e.message)}</pre></div>`; }
    return;
  }
  if (GitHubStore.cfg.token) {
    try { await reload(); render(); return; } catch (e) { toast('GitHub\'a bağlanılamadı:\n' + e.message, 'err'); }
  }
  renderGhLogin($('#view'));
})();
