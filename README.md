# KADO – Geliştirici Web Sitesi

Uygulamalarınızı (Android, Windows…) tanıttığınız, her uygulamanın **Gizlilik Politikası** ve **Kullanım Şartları** sayfasının bulunduğu, **tamamen ücretsiz** yayınlanabilen kişisel web siteniz.

- Site, `data/site.json` dosyasındaki bilgilerden **statik HTML** olarak üretilir (hızlı, Google tarafından okunabilir, JavaScript gerekmez).
- Uygulamaları, kategorileri ve metinleri **yönetim panelinden** düzenlersiniz; kod yazmanız gerekmez.
- **GitHub Pages** üzerinde ücretsiz yayınlanır. Hiçbir ücretli hizmet kullanılmaz.

---

## İçindekiler

1. [Gerekenler](#1-gerekenler)
2. [İlk kurulum](#2-ilk-kurulum-bir-kez)
3. [Yönetim paneli (npm run admin)](#3-yönetim-paneli-npm-run-admin)
4. [Siteyi derleme ve önizleme](#4-siteyi-derleme-ve-önizleme)
5. [GitHub Pages'te ücretsiz yayınlama](#5-github-pagesde-ücretsiz-yayınlama)
6. [Play Console'a gizlilik politikası adresi](#6-play-consolea-gizlilik-politikası-adresini-girme)
7. [Çevrimiçi yönetim paneli (isteğe bağlı)](#7-çevrimiçi-yönetim-paneli-isteğe-bağlı)
8. [Döngüm'ün kendi web sitesi dosyaları](#8-döngümün-kendi-web-sitesi-dosyaları)
9. [Yayından önce yapılacaklar (önemli)](#9-yayından-önce-yapılacaklar-önemli)
10. [Klasör yapısı](#10-klasör-yapısı)
11. [Sık karşılaşılan sorunlar](#11-sık-karşılaşılan-sorunlar)

---

## 1. Gerekenler

- **Node.js** (sizde kurulu: Node 26, npm 11) – kontrol için: `node -v`
- **Git** (kurulu) – kontrol için: `git --version`
- **Cursor** (kurulu) – dosyaları düzenlemek ve komut çalıştırmak için
- Ücretsiz bir **GitHub hesabı** – yoksa https://github.com/signup adresinden açın

## 2. İlk kurulum (bir kez)

1. Cursor'ı açın → **File → Open Folder** → `C:\Users\user_local\Desktop\kado-site` klasörünü seçin.
2. Üst menüden **Terminal → New Terminal** ile bir terminal açın (alt kısımda açılır).
3. Şu komutu yazıp Enter'a basın:

   ```
   npm install
   ```

   Bu, gereken tek küçük paketi (`marked`, Markdown → HTML çevirici) indirir. `node_modules` klasörü oluşur; bu klasörü silerseniz tekrar `npm install` yazmanız yeterli.

## 3. Yönetim paneli (`npm run admin`)

```
npm run admin
```

- Tarayıcıda otomatik olarak **http://localhost:4000/admin/** açılır (açılmazsa adresi kendiniz yazın).
- Sitenin canlı önizlemesi: **http://localhost:4000/**
- Panel yalnızca sizin bilgisayarınızdan erişilebilir. Kapatmak için terminalde **Ctrl + C**.

Panelde yapabilecekleriniz:

| Sekme | Ne işe yarar |
|---|---|
| **Uygulamalar** | Uygulama ekleme / düzenleme / silme; ad, kısa ad (adres), kategoriler, platformlar, açıklama, simge ve ekran görüntüsü yükleme, Google Play ve Windows kurulum bağlantıları, **Gizlilik Politikası** ve **Kullanım Şartları** metinleri (önizlemeli) |
| **Kategoriler** | Kategori ekleme, yeniden adlandırma, sıralama, silme (silinen kategorideki uygulamalar silinmez) |
| **Site ayarları** | Site adı, slogan, "Hakkımda" yazısı, iletişim e-postası, site adresi, GitHub depo bilgileri |
| **Play Console bağlantıları** | Her uygulamanın gizlilik/şartlar adresleri, tek tıkla kopyalama |

Her **Kaydet** işleminde `data/site.json` güncellenir ve site `dist/` klasörüne yeniden üretilir. Yüklenen resimler `static/img/<uygulama>/` klasörüne kaydedilir. (Bir önceki veri her kayıtta `data/site.json.bak` olarak yedeklenir.)

**Metinlerde kullanılabilecek kısaltmalar** (otomatik doldurulur): `{{uygulama}}` uygulama adı, `{{gelistirici}}` geliştirici adı, `{{eposta}}` iletişim e-postası, `{{tarih}}` politika tarihi.

> 4000 portu doluysa: `set PORT=4001 && npm run admin` (Komut İstemi) veya `$env:PORT=4001; npm run admin` (PowerShell).

## 4. Siteyi derleme ve önizleme

| Komut | Ne yapar |
|---|---|
| `npm run build` | Siteyi `dist/` klasörüne üretir ve Play Console adreslerini listeler |
| `npm run dev` | Siteyi üretir, **http://localhost:8080/** adresinde gösterir; `data/`, `static/`, `assets/` değişince otomatik yeniler |
| `npm run preview` | `dev` ile aynı, otomatik yenileme olmadan |
| `npm run check` | Her uygulamanın gizlilik/şartlar sayfasının oluştuğunu kontrol eder ve doğrulanması gereken `[DOĞRULA: …]` işaretlerini listeler |

> GitHub Pages'te yayınlarken siteyi **bilgisayarda derlemenize gerek yoktur**; GitHub bunu otomatik yapar (bkz. 5. bölüm). `dist/` klasörü GitHub'a gönderilmez.

## 5. GitHub Pages'te ücretsiz yayınlama

### 5.1. Depo (repository) oluşturun

1. https://github.com/new adresine gidin.
2. **Repository name:** `kado-site` (başka bir ad da olabilir; adres buna göre değişir).
3. **Public** seçin (ücretsiz GitHub Pages için depo herkese açık olmalıdır).
4. "Add a README" vb. hiçbir kutuyu **işaretlemeyin** → **Create repository**.

### 5.2. Dosyaları GitHub'a gönderin (ilk sefer)

Cursor terminalinde, proje klasöründeyken sırayla yazın (`KULLANICIADI` yerine GitHub kullanıcı adınızı yazın):

```
git init
git add .
git commit -m "İlk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICIADI/kado-site.git
git push -u origin main
```

İlk `git push` sırasında GitHub'a giriş yapmanız için bir tarayıcı penceresi açılır; giriş yapıp onaylayın.

> Git ilk kez kullanılıyorsa `git commit` "kim olduğunuzu" sorabilir. Bir kez şunları yazın:
> `git config --global user.name "KADO"` ve `git config --global user.email "eposta@adresiniz.com"`

### 5.3. GitHub Pages'i açın

1. GitHub'da deponuza gidin → **Settings** → soldan **Pages**.
2. **Build and deployment → Source:** **GitHub Actions** seçin. (Başka bir şey seçmenize gerek yok.)
3. Deponun **Actions** sekmesine gidin. "Siteyi yayınla" iş akışı çalışıyor olmalı; çalışmıyorsa tıklayıp **Run workflow** deyin.
4. 1-2 dakika sonra yeşil tik çıkar. Siteniz şu adreste yayındadır:

   **https://KULLANICIADI.github.io/kado-site/**

### 5.4. Site ayarlarını güncelleyin

`npm run admin` → **Site ayarları** → **Sitenin tam adresi** alanına `https://KULLANICIADI.github.io/kado-site` yazıp kaydedin. Ayrıca **iletişim e-postanızı** girin. (Yayındaki sitede adres zaten otomatik doğru ayarlanır; bu ayar paneldeki "Play Console bağlantıları" listesinin doğru görünmesi içindir.)

### 5.5. Sonraki güncellemeler

Panelde değişiklik yaptıktan sonra terminalde:

```
git add .
git commit -m "Uygulamalar güncellendi"
git push
```

GitHub siteyi 1-2 dakika içinde otomatik olarak yeniden yayınlar.

> **Kendi alan adınız** (ör. `kado.dev`) olursa: Settings → Pages → **Custom domain**. Taban yol otomatik ayarlandığı için başka bir şey değiştirmeniz gerekmez; sadece Site ayarlarındaki adresi güncelleyin.

## 6. Play Console'a gizlilik politikası adresini girme

Her uygulamanın adresleri sabittir:

| Uygulama | Gizlilik Politikası | Kullanım Şartları |
|---|---|---|
| Döngüm | `https://KULLANICIADI.github.io/kado-site/apps/dongum/gizlilik/` | `https://KULLANICIADI.github.io/kado-site/apps/dongum/sartlar/` |
| İndirici | `https://KULLANICIADI.github.io/kado-site/apps/indirici/gizlilik/` | `https://KULLANICIADI.github.io/kado-site/apps/indirici/sartlar/` |

Genel kalıp: `https://<kullaniciadi>.github.io/<depo-adi>/apps/<uygulama-kisa-adi>/gizlilik/`

Bu adresleri ayrıca şuralarda görürsünüz: panelde **Play Console bağlantıları** sekmesi ve `npm run build` çıktısı.

**Play Console'da nereye yapıştırılır:**

1. https://play.google.com/console → uygulamanızı seçin.
2. Sol menü: **Politika ve programlar → Uygulama içeriği** (İngilizce: *Policy and programs → App content*).
3. **Gizlilik politikası** (*Privacy policy*) → **Başlat / Yönet** → adresi yapıştırın → **Kaydet**.
4. Mağaza girişinde (*Store settings → Store listing contact details*) web sitesi olarak `https://KULLANICIADI.github.io/kado-site/apps/dongum/` adresini de verebilirsiniz.

> Önemli: Adresi Play Console'a girmeden önce sayfanın tarayıcıda açıldığını kontrol edin. Uygulamanın **kısa adını (slug) sonradan değiştirmeyin**; değiştirirseniz adres de değişir.

## 7. Çevrimiçi yönetim paneli (isteğe bağlı)

Bilgisayarınız yanınızda değilken de (telefondan bile) siteyi düzenleyebilirsiniz:

**Adres:** `https://KULLANICIADI.github.io/kado-site/admin/`

Bu panel değişiklikleri doğrudan GitHub deponuza kaydeder; site 1-2 dakika içinde kendiliğinden güncellenir. Giriş için bir **GitHub erişim anahtarı (fine-grained personal access token)** gerekir – yalnızca sizin oluşturabileceğiniz bir anahtardır, bu yüzden başkaları sitenizi değiştiremez.

**Anahtar oluşturma:**

1. GitHub → sağ üst profil resmi → **Settings** → en alttaki **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name:** `kado-site-admin`, **Expiration:** örn. 90 gün.
3. **Repository access:** *Only select repositories* → `kado-site`.
4. **Permissions → Repository permissions → Contents:** *Read and write* (başka izin vermeyin).
5. **Generate token** → `github_pat_…` ile başlayan anahtarı kopyalayın.
6. `/admin/` sayfasında kullanıcı adınızı, depo adını ve anahtarı girip **Bağlan**'a basın.

Güvenlik notları:

- Anahtar **yalnızca o tarayıcıda** (localStorage) saklanır; depoya, siteye veya başka bir yere gönderilmez (yalnızca GitHub'ın kendi API'sine).
- Başkasının bilgisayarında kullandıysanız **Çıkış yap**'a basın. Anahtar çalınırsa GitHub → Settings → Developer settings'ten silin.
- Çevrimiçi panelde kaydettikten sonra bilgisayarınızda çalışmaya devam etmeden önce **`git pull`** yazın (yoksa GitHub'daki değişikliklerle çakışır).
- Çevrimiçi paneli istemiyorsanız: Site ayarları → "Çevrimiçi yönetim panelini yayınla" işaretini kaldırın.

## 8. Döngüm'ün kendi web sitesi dosyaları

Döngüm'ün mevcut web sitesi dosyalarını (index.html, css, resimler…) olduğu gibi **`static/dongum/`** klasörüne kopyalayın.

- Bu klasör siteye aynen **`/dongum/`** adresine kopyalanır: `https://KULLANICIADI.github.io/kado-site/dongum/`
- Klasörde `index.html` varsa, Döngüm uygulama sayfasında otomatik **"Döngüm web sitesi"** düğmesi çıkar.
- Dosyalardaki bağlantılar `/` ile başlıyorsa (ör. `/style.css`) çalışmayabilir; göreli yazın (`style.css` veya `./style.css`).
- Adı `_` ile başlayan dosyalar (ör. `_BENIOKU.txt`) siteye kopyalanmaz.
- Aynı yöntem her uygulama için geçerli: `static/<kisa-ad>/index.html`.
- `static/` içindeki diğer her şey de sitenin köküne kopyalanır (ör. `static/app-ads.txt` → `/app-ads.txt`).

## 9. Yayından önce yapılacaklar (önemli)

1. **`[DOĞRULA: …]` işaretleri:** Gizlilik ve şartlar metinleri **taslaktır**. Sarı işaretli her yeri uygulamanızın gerçek durumuna göre düzeltin ve işareti silin (ör. verilerin sadece cihazda mı saklandığı, reklam/analiz SDK'sı olup olmadığı, istenen izinler). Listeyi görmek için: `npm run check`.
2. **İletişim e-postası:** Site ayarlarından girin (Google Play bunu zorunlu tutar).
3. **Döngüm (sağlık verisi):** Play Console'da *Uygulama içeriği* bölümündeki **Veri güvenliği (Data safety)** formunu ve **Sağlık uygulamaları** beyanını, gizlilik politikanızla **aynı** bilgilerle doldurun. Çelişki olursa uygulama reddedilebilir.
4. **İndirici:** Google Play, YouTube gibi platformlardan içerik indirmeye izin veren uygulamalara karşı çok katıdır (platform şartlarını ihlal eden indirme işlevi reddedilme nedenidir). Android sürümünü Play'e göndermeden önce Google Play'in "Fikri mülkiyet" politikasını inceleyin; gerekirse Android sürümünü siteden doğrudan (APK) dağıtmayı düşünün.
5. **Uygulama adı:** "İndirici (geçici ad)" adını panelden gerçek adla değiştirin (kısa adı `indirici` olarak bırakabilirsiniz).
6. Bu metinler hukuki danışmanlık değildir; mümkünse bir uzmana göz attırın.

## 10. Klasör yapısı

```
kado-site/
├─ data/site.json          ← TÜM içerik: site ayarları, kategoriler, uygulamalar, gizlilik/şartlar metinleri
├─ static/                 ← Olduğu gibi siteye kopyalanan dosyalar
│  ├─ img/<uygulama>/      ← Simgeler ve ekran görüntüleri
│  └─ dongum/              ← Döngüm'ün kendi web sitesi dosyaları (→ /dongum/)
├─ assets/                 ← Sitenin görünümü (style.css, favicon.svg)
├─ admin/                  ← Yönetim paneli (yerel ve çevrimiçi aynı panel)
├─ scripts/                ← Site üretici ve sunucular (build, dev, admin, check)
├─ .github/workflows/      ← GitHub Pages otomatik yayın ayarı
├─ dist/                   ← Üretilen site (otomatik oluşur, GitHub'a gönderilmez)
├─ package.json            ← npm komutları
└─ README.md               ← Bu dosya
```

Üretilen sitede adresler:

- `/` – ana sayfa (uygulamalar kategorilere göre)
- `/apps/<kisa-ad>/` – uygulama sayfası
- `/apps/<kisa-ad>/gizlilik/` – Gizlilik Politikası
- `/apps/<kisa-ad>/sartlar/` – Kullanım Şartları
- `/dongum/` – Döngüm'ün kendi sitesi (dosyaları eklediğinizde)
- `/admin/` – çevrimiçi yönetim paneli

## 11. Sık karşılaşılan sorunlar

- **`npm` tanınmıyor:** Node.js kurulumundan sonra Cursor'ı kapatıp yeniden açın.
- **PowerShell "running scripts is disabled" hatası:** Terminal açılır menüsünden **Command Prompt** seçin veya `npm.cmd run admin` yazın.
- **Sitede tasarım bozuk / sayfalar 404:** Settings → Pages → Source'un **GitHub Actions** olduğundan emin olun ve Actions sekmesinde iş akışının yeşil olduğunu kontrol edin.
- **Değişiklikler sitede görünmüyor:** `git push` yaptınız mı? Actions bitti mi? Tarayıcıda **Ctrl + F5** ile yenileyin.
- **Çevrimiçi panelde 404 / 403:** Kullanıcı adı, depo adı doğru mu; anahtar bu depoya *Contents: Read and write* izniyle verildi mi; süresi doldu mu?
- **`git push` reddedildi (rejected):** Önce `git pull`, sonra tekrar `git push`.
- **Veriyi bozdum:** `data/site.json.bak` bir önceki kayıttır; ya da `git checkout data/site.json` ile son gönderilen hale dönün.
