# Aetheria: Legacy of the Dawn — Eksplorasi 3D Low-Poly

Game eksplorasi 3D open-world (mini RPG) berbasis Three.js r128, berlatar
**kerajaan pesisir abad pertengahan**. Seluruh dunia, vegetasi, langit, dan
karakter dibuat **prosedural** — cukup dobel-klik `index.html` (atau tombol Play
di editor), tanpa internet. Versi grafis penuh (bayangan halus, tekstur, efek,
dan **model karakter 3D CC0**) menyala otomatis saat dijalankan lewat
`jalankan.bat`; semua aset tersimpan lokal di repo ini.

**Fase 5** memperluas dunia menjadi **±3,24 km × 3,24 km (10× luas sebelumnya)**
dengan pegunungan & perbukitan yang ikut membesar, **12 pulau kecil** di lautan,
**pelabuhan beratap dermaga + perahu cadik yang bisa dikemudikan**, rumah
setengah-kayu yang lapang, **peta 4 mode** di kanan atas, **peta besar yang
bisa ditandai tujuannya** (kompas HUD + mercusuar 3D), dan HUD yang seluruhnya
bisa diklik.

Pembaruan **kerajaan abad pertengahan** mengubah pemain menjadi **ksatria
fajar**, desa utama menjadi **Aldenmere** dengan rumah setengah-kayu, alun-alun
batu, pasar beratap kain, dan gapura batu; menambah **reruntuhan kastil,
kapel tua, menara jaga, dan lingkaran batu berdiri** di lanskap; serta
menghadirkan **celeng hutan, penyamun jalan raya, roh rawa, dan ksatria
terkutuk**. Semua ID internal, simpanan v2, dan mekanik Fase 1–5 tetap utuh.

> **Deskripsi lengkap** — cerita, seluruh fitur, daftar aset, teknologi, cara game
> dibangun, dan batasannya ada di [Deskripsi lengkap](#deskripsi-lengkap).
> Panduan menaruhnya di internet ada di [Publikasi & hosting](#publikasi--hosting).

## Cara menjalankan

Dobel-klik **`index.html`** (Chrome/Edge/Firefox). Selesai — tidak butuh server.
Mode ini memakai bentuk prosedural (peramban memblokir pembacaan berkas model
saat `file://`).

Untuk grafis penuh: **`jalankan.bat`** — menyalakan server lokal kecil
(`server.js`, Node.js) dan membuka `http://localhost:8317/`. Mode ini
mengaktifkan **model karakter 3D** (KayKit & Quaternius, CC0).

Menu utama punya **Mulai Menjelajah** (memutar trailer sinematik singkat — bisa
dilewati dengan klik/tombol apa pun — lalu masuk game), **Pengaturan**, dan
**Keluar**. Bila ada simpanan, tombol emas **Lanjutkan Perjalanan** muncul di
atas beserta ringkasan level, jam dunia, dan waktu simpan. Menu **Pengaturan**
(juga bisa dibuka dari menu jeda) berisi tiga tab:

Tampilan menu memakai tema **medieval tavern** — panel kulit gelap, bingkai besi
dan emas, emblem fajar SVG, tombol plakat berikon, serta font lokal
**Cinzel Decorative / Cinzel / Alegreya**. Semua font disimpan di repo, jadi menu
tetap tampil penuh saat dibuka lewat `file://` tanpa internet.

- **Audio** — slider musik/suasana & efek suara. Semua suara dibuat **prosedural
  dengan Web Audio** (ombak, pad lembut, desis malam, tebasan, jarahan, naik
  level, simpan/muat) — tanpa berkas audio, sesuai prinsip proyek.
- **Grafik** — **Cepat / HD / Ultra**; perubahan langsung berlaku (termasuk
  memasang model 3D bila baru dinyalakan).
- **Bahasa** — **Bahasa Indonesia / English** untuk antarmuka & menu (dialog
  cerita tetap Bahasa Indonesia).

Trailer menampilkan kamera terbang mengelilingi kerajaan pesisir (pantai →
Aldenmere → perbukitan) dengan kartu judul dwibahasa dan bilah letterbox
sinematik.

## Publikasi & hosting

Game ini adalah **situs statis murni**: tidak ada backend, basis data, API key,
maupun proses build. `server.js` hanya server berkas lokal opsional untuk
mengaktifkan model 3D; untuk publikasi cukup unggah isi repo apa adanya dan
pastikan `index.html` berada di akar situs.

| Layanan | Langkah singkat |
|---|---|
| **GitHub Pages** | Push repo ke GitHub → *Settings* → *Pages* → *Deploy from a branch* → pilih `main` dan folder `/ (root)` → *Save*. Situs tersedia di `https://<pengguna>.github.io/<repo>/`. |
| **Cloudflare Pages** | *Create a project* → hubungkan repo atau gunakan *Direct Upload* → *Framework preset*: **None** → *Build command*: kosong → *Build output directory*: `.` |
| **Netlify** | *Add new site* → *Import an existing project* atau seret folder repo → *Build command*: kosong → *Publish directory*: `.` |
| **itch.io** | Buat ZIP isi repo (tanpa `.git`) → *Create new project* → *Kind of project*: **HTML** → unggah ZIP → centang *This file will be played in the browser* → `index.html`. |
| **cPanel / hosting statis** | Unggah seluruh isi repo ke `public_html` (pertahankan folder `js/`, `lib/`, `assets/`, `css/`). |

Hal yang perlu diperhatikan:

- **Jangan mengubah struktur folder.** Semua path di `index.html` relatif; `js/`,
  `lib/`, `css/`, dan `assets/` harus ikut terunggah.
- **Berkas `.glb` harus tersaji sebagai biner** (MIME `model/gltf-binary` atau
  `application/octet-stream`). Layanan di atas sudah menanganinya; di cPanel,
  tambahkan tipe MIME bila model gagal dimuat (mis. `AddType model/gltf-binary .glb`).
- **HTTPS disarankan** dan sudah otomatis di GitHub Pages, Cloudflare Pages, dan
  Netlify. Game tetap berjalan di HTTP biasa; tidak ada API khusus yang
  mewajibkan HTTPS.
- **Tidak perlu build step, environment variable, atau database.** Repo berukuran
  sekitar 20 MB, dengan ±17,5 MB di antaranya model karakter GLB dan ±1,3 MB
  model bangunan GLB.
- **Simpanan `localStorage` terikat pada origin.** Pindah dari
  `http://localhost:8317` ke domain publik (atau pindah domain) membuat simpanan
  lama tidak terbaca. Tidak ada cloud save; memindahkan progres secara manual
  tidak didukung.
- Setelah memperbarui berkas, lakukan *hard refresh* (Ctrl + F5) karena nama
  berkas tidak memakai hash cache.

## Kontrol

| Tombol | Fungsi |
|---|---|
| W A S D / panah | jalan (relatif kamera) / **berenang** / **mengemudikan perahu** |
| Shift | lari / berenang lebih cepat |
| Spasi | lompat |
| **Klik Kiri** / F | ayunkan pedang — kombo 3 gerakan (tebas atas, tebas samping, tusuk) |
| E | bicara dengan penduduk / memetik kelapa / mengambil benda / **naik & turun perahu** |
| Klik / E | memajukan dialog |
| I | buka/tutup **tas** besar di tengah layar (isi jarahan) |
| H | makan daging celeng (+30 HP) |
| M | ganti mode **peta mini**: Dunia → Sekitar → Lokal → Sembunyi |
| Klik peta mini / 🗺️ | buka **peta besar**; klik lokasi atau POI untuk menandai tujuan |
| × kompas / **Hapus Tujuan** | hapus tujuan yang aktif |
| ✕ / Esc / **Tutup & Jalan** | tutup peta besar — dunia tetap berjalan |
| Klik ikon HUD | tugas 📜, tas 🎒, dan jeda ⏸️ juga bisa diklik |
| Ctrl + S | simpan cepat (muat dari menu jeda) |
| **Klik Kanan (tahan)** | putar kamera — kursor selalu tampil, tanpa pointer lock |
| Roda mouse | zoom |
| Esc | tutup peta/tas/dialog, atau jeda/lanjutkan |
| F3 | panel info performa (tersembunyi secara bawaan) |

Saat **peta besar** terbuka, jam dunia, makhluk, dan autosave tetap berjalan;
gerak & serangan dikunci, dan peta menutup otomatis bila pemain diserang.

## Isi game

- **Terrain pulau prosedural** (noise fBm + ridged) dengan warna vertex natural:
  pantai, rumput bercak kering/gelap, tanah lereng, batu, puncak karang;
  peneduhan lembah — mesh 352×352 dengan **kerutan mikro yang diperhalus** +
  **tekstur tanah** (bercak lempung/kerikil + normal map) agar punggung bukit mulus.
  Fase 5: dunia **3240 m** (10× luas) dengan pegunungan ±3,16× lebih tinggi
- **Laut** bergradasi kedalaman (turquoise dangkal → biru tua) + gelombang
  naik-turun beranimasi + busa pantai yang berdenyut mengikuti ombak; mesh air
  beriak 3600 m + samudra luar 60 km, gelombangnya juga menganggukkan perahu.
  **Seluruh lautan terbuka**: pemain otomatis berenang di air dalam (W/A/S/D,
  Shift lebih cepat), bisa naik ke dermaga dari air, dan tidak ada dinding
  kedalaman atau batas peta yang tak terlihat — termasuk di sekitar pelabuhan
- **Langit & siklus siang–malam 10 menit**: kubah gradasi yang berubah warna,
  matahari terbit/terbenam, pendar matahari, bulan, 700 bintang, awan tertiup
  angin (berputar ulang di ujung langit), kabut atmosferik (FogExp2)
- **Vegetasi instanced**: **±1.000 pohon** bergaya hutan sedang — rimbun
  pedalaman (mahkota 7 gumpalan organik bertekstur daun), **cemara bertingkat**
  yang mendominasi punggung bukit & lereng, dan **kelapa pesisir yang jarang**
  (batang melengkung + pelepah 3D) — plus **±330 batu**; low-poly, ditanam pas
  mengikuti permukaan tanah, + tabrakan. Palet daun, rumput, dan bunga digeser
  ke hijau zaitun/tanah agar terasa seperti lembah kerajaan, bukan tropis
- **Rumput & bunga**: dibagi **potongan 36 m** yang dibangun bertahap (5×5
  potongan aktif ±90 m, 2 potongan per frame) — ±1.400 rumpun + ±200 bunga instanced
  di sekitar pemain, bergoyang tertiup angin (shader), hanya di daratan berumput.
  Dengan dunia 10×, biaya gambar rumput tetap konstan
- **Desa Aldenmere (utama)**: alun-alun batu dengan **medali batu**, 10 rumah
  **setengah-kayu** yang **bisa dimasuki** (fondasi batu, dinding plester,
  rangka kayu gelap, atap sirap curam, cerobong, jendela berterali, pintu besi,
  dan lentera beranda), **balai desa** terbesar dengan panji, sumur batu,
  **gapura batu** berpilar dan berdinding rendah, pagar kayu, serta **3 pasar
  beratap kain** dengan peti, tong, dan barang dagangan. Ukuran rumah normal
  untuk manusia, langit-langit dalam **2,8–3,05 m** agar leluasa berjalan
- **Kerajaan Pusat Aetheria**: kota berbenteng **120 m** di lahan paling datar
  dekat pusat peta — **tembok batu melingkar 48 segmen** (tinggi 7,2 m) dengan
  **8 menara beratap kerucut**, **4 gerbang** (gerbang utama menghadap
  Aldenmere), dan lorong patroli di puncak tembok. Di tengahnya berdiri
  **kastil**: keep batu persegi dengan 4 turret sudut, dinding tirai, 4 menara
  sudut, gerbang kayu, dan panji merah. **30 rumah warga** tersusun rapi di tiga
  cincin mengikuti **4 jalan radial + 4 jalan lingkar**, lengkap dengan pasar
  beratap kain, sumur, patung penjaga, tiang lampu, api unggun, pagar taman, dan
  pohon hias. Semua bangunan menapak tinggi tanah setempat (tidak melayang di
  lereng), rumah **bisa dimasuki** (platform + collider dinding), dan kerajaan
  tampil sebagai **POI di peta** serta disorot di trailer pembuka
- **Cahaya malam**: saat senja–fajar **jendela & lentera rumah menyala hangat**,
  lentera besi dan tiang lampu menerangi alun-alun (cahaya nyata di HD/Ultra),
  api unggun pendukuhan menyala lebih terang, dan satu **lampu ruangan**
  menyertai pemain di dalam rumah
- **3 pendukuhan kecil** tersebar di bagian pulau lain (barat & selatan):
  rumah setengah-kayu (bisa dimasuki), alun-alun mungil, dan **api unggun
  berkedip** — peta jalan di HUD tetap menuntun ke desa utama
- **9 penduduk** dengan jadwal jelajah sendiri: **Raka** (tetua desa), **Sari**
  (pedagang), **Mira** (tabib), **Adi** (nelayan), **Bimo** (kakek), plus
  **Nia, Joni, dan Umar** di pendukuhan, serta **Dera** (pelaut) di pulau kecil
  berpondok; pakaian prosedural berupa mantel, celemek, kerudung, ikat
  pinggang, tas, janggut, dan tongkat. Mereka berhenti & menoleh saat diajak
  bicara
- **Dialog & tugas** (Bahasa Indonesia): panel dialog, petunjuk interaksi (E),
  daftar tugas kerajaan di HUD, dan notifikasi singkat. Dua tugas: mengumpulkan
  **5 kelapa** untuk minyak lampu Fajar Panen milik Raka, dan mencari
  **keranjang obat Mira** di dekat lingkaran batu berdiri
- **Reruntuhan batu tua**: **kastil** di punggung bukit (dinding tirai, menara
  sudut, keep, gerbang kayu berlapis besi, panji merah-biru, obor), **kapel
  gotik** dengan gapura bergerigi, jendela lancip, salib batu, dan kuburan,
  **menara jaga** pesisir dengan brazier, serta **lingkaran batu berdiri**
  dengan altar dan rune. Semua dibangun dari balok batu instanced, dilengkapi
  collider dinding yang terlihat, dan muncul sebagai **POI di peta**
- **Pemain ksatria fajar** dengan animasi jalan/lari/lompat + **pedang di
  tangan kanan** dan bayangan nyata — memakai **model 3D CC0 KayKit Knight**
  saat dijalankan lewat `jalankan.bat`, dengan bentuk prosedural lengkap
  (pelat dada, pauldron, jubah perang, dan helm baja) sebagai fallback `file://`
- **Grafis berjenjang (Cepat/HD/Ultra)**: bayangan halus (peta bayangan 1–4K),
  **tekstur prosedural** (kayu, papan, rumbia, kain, batu, air), **pantulan
  lingkungan** dari langit (PMREM), **bloom + FXAA**, dan model 3D
- **Pertarungan pedang (Fase 3)**: kombo 3 ayunan (klik kiri / F), busur
  tebasan di depan pemain, musuh terlempar & berkedip merah saat kena
- **4 jenis penghuni rimba** (±69 ekor: 27 celeng, 22 roh rawa, 16 penyamun,
  ditambah penjaga terkutuk di kastil; pembangkit kembali setelah ~75 dtk):
  **Celeng Hutan** (liar & cepat menanduk), **Penyamun Jalan Raya** (golok,
  koin), **Roh Rawa** (melompat kenyal dengan tiga titik api rawa), dan
  **Ksatria Terkutuk** (pedang panjang, menjaga reruntuhan kastil) — AI:
  jelajah → kejar → serang → lemas → kembali pulang; menjauh dari desa &
  titik awal
- **HP · XP · level**: **level melayang di atas kepala pemain**; bilah **HP & XP
  di atas hotbar**; naik level menambah HP maks & serangan (pulih penuh), bilah
  HP musuh melayang mengikuti sasaran terakhir
- **Hotbar & tas**: 8 kotak item di tengah bawah (pedang, daging + tombol H,
  kelapa tugas, kulit, taring, koin, besi, lendir) dengan jumlah barang; ikon
  **tas 🎒** membuka **panel besar di tengah layar** berisi kartu item, jumlah,
  deskripsi, dan statistik pemain — tutup dengan I, Esc, ✕, atau klik di luar
- **Tas & jarahan**: musuh menjatuhkan barang (🥩 daging celeng, 🟫 kulit celeng,
  🦷 taring celeng, 🪙 koin perak kerajaan, ⚙️ besi tempa, 🫧 inti roh rawa)
  berupa kotak berpendar yang otomatis terhisap saat didekati; tekan **I** untuk
  membuka tas, **H** untuk makan daging
- **Layar tumbang & bangkit**: saat HP habis, "KAU TUMBANG" muncul —
  tekan *Bangkit Kembali* untuk lahir ulang di pantai dengan HP penuh
- **Kamera orang ketiga**, mouse + keyboard, HUD jam dunia; instruksi kanan-bawah
  dan kotak FPS **disembunyikan** agar layar bersih (F3 menampilkan panel
  performa lagi); kamera otomatis mendekat & dibatasi langit-langit saat pemain
  masuk rumah, dan label level disembunyikan di dalam rumah
- **Simpan/muat**: satu slot simpanan di peramban (`localStorage`, **v2** sejak
  Fase 5), tombol **Simpan / Muat** di menu jeda + **Lanjutkan Perjalanan** di
  menu utama. Tersimpan: posisi & arah pemain, HP/level/XP, isi tas, waktu dunia,
  kelapa yang sudah dipetik, kemajuan kedua tugas, variasi dialog warga,
  **posisi perahu & status menaikinya**, serta **tujuan peta** (koordinat + nama
  POI; opsional — simpanan lama tanpa field ini tetap sah). Simpan cepat dengan
  **Ctrl + S**; permainan juga **menyimpan otomatis ke slot yang sama tiap 2 menit**
  saat bermain.
- **Peta 4 mode (Fase 5)**: peta bundar kanan atas **tampil sejak awal**; **M**
  mengganti mode **Dunia** (seluruh dunia 3,24 km + pulau kecil) → **Sekitar** →
  **Lokal** → **Sembunyi**, dengan label mode di bawah peta. Digambar dari tinggi
  terrain lalu diperbarui ~11×/detik. Utara selalu di atas; panah putih = arah
  pemain, kerucut emas = arah kamera. Penanda: desa, **pelabuhan & perahu**,
  **pondok pulau kecil**, warga (biru), musuh hidup, jarahan, dan sasaran tugas —
  plus panah tepi bila sasaran jauh.
- **Peta besar & tujuan (Fase 5 lanjutan)**: klik peta mini atau tombol 🗺️
  membuka peta seluruh dunia (kanvas 1024² dari peta dasar 512² yang sama) dengan
  ikon & label **Desa Aldenmere**, **Pelabuhan**, **Pondok Dera**, **Pondok
  Pulau**, **Reruntuhan Kastil**, **Kapel Tua**, dan **Lingkaran Batu**. Klik
  ikon/label — tujuan menempel otomatis — atau titik bebas;
  footer menampilkan label & jarak, tombol **Hapus Tujuan** dan **Tutup & Jalan**
  (atau ✕/Esc). Setelah ditutup: **panah kompas** di HUD berputar relatif kamera,
  jarak m/km diperbarui, peta mini menampilkan **pin + garis putus-putus**, dan
  **mercusuar emas 3D** menandai lokasi. Tiba dalam ±3 m → tujuan dibersihkan
  otomatis. **Dunia tetap berjalan** saat peta terbuka (jam, musuh, autosave);
  gerak & serangan dikunci, header menampilkan HP/XP/jam + tanda "dunia berjalan",
  dan peta otomatis menutup bila pemain diserang. Tujuan ikut tersimpan di save v2.
- **Dunia 10× (Fase 5)**: luas **3240×3240 m** dengan bentuk pulau utama yang
  sama namun diperbesar; pegunungan & perbukitan ±3,16× lebih tinggi. **12 pulau
  kecil** tersebar di lautan; **dua** di antaranya punya **pondok, api unggun,
  dan penghuni** (Dera) — bisa didarati dengan perahu atau **direnangi**
- **Pelabuhan & perahu (Fase 5)**: dermaga kayu 28 m di pesisir dekat titik awal
  (dek 1,15 m di atas air, 12 tiang, lentera, peti & tong) dengan **jembatan
  pantai** yang menyambung pasir ke dek (dulu dermaga terpisah oleh air dan terasa
  seperti dinding), **perahu cadik** bersandar di sisinya. Tekan **E** untuk naik;
  **W/S** maju–mundur, **A/D** membelok. Perahu mengangguk & berguling mengikuti
  gelombang, meninggalkan buih, dan **bisa diturunkan di laut dalam** — pemain
  langsung berenang. Tabrakan dermaga tetap fisik, tetapi tidak ikut berputar saat
  perahu berbelok, dan tidak ada batas lingkaran di samudra.
- **HUD bisa diklik (Fase 5)**: deretan tombol **🗺️ peta / 📜 tugas / 🎒 tas /
  ⏸️ jeda** di bawah peta; daftar tugas bisa disembunyikan, kotak hotbar juga
  bisa diklik (pedang = menebas, daging = makan). Klik kiri hanya menyerang bila
  terjadi di atas dunia — tidak pernah saat menekan UI. Kursor selalu tampil;
  kamera diputar dengan **menahan klik kanan**.
- **Efek (Fase 4)**: percikan saat tebasan mengenai/mengalahkan musuh, cincin
  gelombang, debu langkah saat berjalan/berlari, pendar naik level, getaran kamera saat
  terluka/bertarung, dan vignette merah berdenyut saat HP di bawah 36%.
- **Menu utama & trailer**: Play → trailer kamera terbang (lewati kapan saja),
  Pengaturan bertab (audio prosedural / grafis / bahasa ID–EN), Keluar dengan
  layar pamit; pengaturan audio & bahasa tersimpan di peramban
- **Ringan**: ±660–745 ribu segitiga saat menjelajah (dunia 10×), tetapi rumput
  hanya digambar sebagai 5×5 potongan di sekitar pemain, hanya 2–3 cahaya dinamis
  aktif (pool lampu/api terdekat), dan jumlah vegetasi diskalakan sublinear.
  Terukur di Intel UHD (iGPU kelas bawah, 1262×704, DPR 1): **Cepat ±58 FPS**,
  **HD ±44–47 FPS**, **Ultra ±39–44 FPS** (≈40; variasi suhu iGPU) — sesuai
  target **Cepat ±45–60**, **HD/Ultra ±40–50**. Di layar HiDPI, HD/Ultra
  merender 1,25×/1,5× (bukan 1,75×) agar tetap ringan. Peta mini hanya
  ±0,1 ms per gambar (~11×/detik); peta besar digambar di kanvas 2D terpisah
  hanya saat dibuka (~5×/detik), dan mercusuar tujuan hanya 3 draw call additive
  tanpa bayangan — overhead di luar render dunia tetap kecil. Efek partikel/cincin
  juga memakai beberapa draw call kecil — tetap ramah perangkat kelas bawah

## Deskripsi lengkap

### Identitas

**Aetheria: Legacy of the Dawn** adalah game eksplorasi 3D *open-world*
bergenre mini-RPG yang berjalan langsung di peramban. Pemain berperan sebagai
**ksatria fajar** di kerajaan pesisir abad pertengahan: hutan pinus dan padang
rumput, desa setengah-kayu **Aldenmere**, pelabuhan, pulau-pulau kecil, serta
reruntuhan kastil, kapel tua, menara jaga, dan lingkaran batu.

| Aspek | Keterangan |
|---|---|
| **Judul** | **Aetheria: Legacy of the Dawn** |
| **Genre** | Eksplorasi *open-world*, mini-RPG, petualangan |
| **Latar** | Kerajaan pesisir abad pertengahan |
| **Mode** | Pemain tunggal; seluruh aset dilayani dari origin yang sama |
| **Peramban** | Chrome, Edge, Firefox versi desktop |
| **Mesin** | Three.js r128, JavaScript, HTML, CSS |
| **Status** | Fase 1–5 selesai, termasuk konversi kerajaan abad pertengahan |
| **Bahasa** | Antarmuka Indonesia/English; cerita dan dialog Indonesia |
| **Simpanan** | `localStorage`, satu slot, format **v2** |

Game ini menekankan **eksplorasi bebas**, bukan kampanye linier. Tidak ada
dinding tak terlihat atau batas kedalaman: pemain dapat berjalan, berlari,
berenang, dan berlayar mengelilingi dunia. Tabrakan hanya diberikan pada
bangunan dan objek yang terlihat, seperti rumah, dinding kastil, dermaga, pohon,
dan batu.

### Dunia dan cerita

> Di bawah fajar terakhir, kerajaan Aetheria bangkit kembali — jelajahi hutan
> pinus, desa batu, dan reruntuhan kastil di tepi lautan.

Dunia dibangun sebagai kepulauan pesisir berukuran **3240 × 3240 m** dengan
pegunungan dan perbukitan yang jauh lebih tinggi daripada versi awal, **12 pulau
kecil**, serta samudra terbuka yang dapat diseberangi dengan perahu atau renang.
Siklus siang–malam berlangsung sekitar **10 menit**, lengkap dengan matahari
terbit dan terbenam, bulan, bintang, awan, dan kabut atmosferik.

Lokasi penting:

- **Aldenmere** — desa utama dengan alun-alun batu, balai desa, sumur, gapura,
  pasar beratap kain, dan rumah setengah-kayu yang bisa dimasuki.
- **Pelabuhan** — dermaga kayu 28 m dengan jembatan pantai, lentera, peti, tong,
  dan perahu cadik yang bisa dikemudikan.
- **Reruntuhan Kastil** — dinding tirai, menara sudut, keep, gerbang berlapis
  besi, panji, dan obor; dijaga ksatria terkutuk.
- **Kapel Tua** — bangunan gotik dengan jendela lancip, salib batu, dan kuburan.
- **Menara Jaga** — menara pesisir dengan brazier yang menghadap laut.
- **Lingkaran Batu** — altar dan rune berdiri di tengah lanskap.
- **Pondok Pulau** — dua pulau kecil memiliki pondok dan api unggun; Dera, si
  pelaut, tinggal di salah satunya.

Cerita tidak disampaikan lewat kampanye linier, melainkan melalui suasana dunia,
dialog warga, dan dua tugas kecil. Pemain bebas menentukan arah perjalanan.

### Fitur

#### Eksplorasi dan dunia

- Terrain prosedural dari noise fBm dan ridged dengan warna vertex alami:
  pantai, rumput bercak kering/gelap, tanah lereng, batu, dan puncak karang.
  Mesh terrain berukuran 352 × 352 dengan tekstur tanah dan normal map.
- **±1.000 pohon** (rimbun, cemara bertingkat, kelapa pesisir), **±330 batu**,
  **±1.400 rumpun rumput**, dan **±200 bunga** yang bergoyang tertiup angin.
  Vegetasi memakai *instancing*; rumput dibagi menjadi potongan 36 m dan hanya
  5 × 5 potongan di sekitar pemain yang aktif.
- Laut bergradasi kedalaman dengan gelombang beranimasi, busa pantai, dan
  samudra luar. Tidak ada dinding kedalaman atau batas peta tak terlihat.
- Siklus siang–malam 10 menit: kubah langit berubah warna, matahari terbit dan
  terbenam, pendar matahari, bulan, 700 bintang, awan tertiup angin, dan kabut.
- Empat landmark batu tua (kastil, kapel, menara jaga, lingkaran batu) dibangun
  dari balok batu *instanced* dan memiliki collider pada dinding yang terlihat.

#### Aldenmere, penduduk, dan tugas

- **10 rumah setengah-kayu** yang bisa dimasuki: fondasi batu, dinding plester,
  rangka kayu gelap, atap sirap curam, cerobong, jendela berterali, pintu besi,
  dan lentera beranda. Langit-langit dalam 2,8–3,05 m.
- **Balai desa** terbesar dengan panji, **sumur batu**, **gapura batu**, pagar
  kayu, dan **3 pasar** dengan peti, tong, dan barang dagangan.
- **3 pendukuhan kecil** di bagian pulau lain, masing-masing dengan rumah yang
  bisa dimasuki, alun-alun mungil, dan api unggun.
- **9 penduduk** dengan jadwal jelajah sendiri: Raka (tetua), Sari (pedagang),
  Mira (tabib), Adi (nelayan), Bimo (kakek), Nia, Joni, Umar, dan Dera (pelaut).
  Mereka berhenti dan menoleh saat diajak bicara.
- **Dialog Bahasa Indonesia** dengan panel dialog, petunjuk interaksi `E`, daftar
  tugas di HUD, dan notifikasi singkat.
- **Dua tugas**: mengumpulkan **5 kelapa** untuk minyak lampu Fajar Panen milik
  Raka, dan mencari **keranjang obat Mira** di dekat lingkaran batu.
- **Cahaya malam**: jendela dan lentera menyala hangat saat senja–fajar; lentera
  besi, tiang lampu, api unggun, dan lampu ruangan menerangi pemain di dalam
  rumah.

#### Pertarungan dan progresi

- **Kombo pedang 3 gerakan** (tebas atas, tebas samping, tusuk) dengan klik kiri
  atau `F`, busur tebasan di depan pemain, dan getaran kamera saat terkena.
- **4 jenis penghuni rimba** (±69 ekor): **Celeng Hutan** (27), **Roh Rawa**
  (22), **Penyamun Jalan Raya** (16), dan **Ksatria Terkutuk** (4, penjaga
  kastil). Mereka bangkit kembali setelah sekitar 75 detik.
- AI berjalan dalam keadaan **jelajah → kejar → serang → lemas → kembali
  pulang**, menjauh dari desa dan titik awal pemain.
- **HP, XP, dan level**: level melayang di atas kepala pemain, bilah HP/XP di
  atas hotbar, dan bilah HP musuh mengikuti sasaran terakhir. Naik level menambah
  HP maksimum dan serangan serta memulihkan HP penuh.
- **Layar tumbang**: saat HP habis, muncul "KAU TUMBANG" dengan tombol *Bangkit
  Kembali* untuk lahir ulang di pantai.

#### Tas, hotbar, dan jarahan

- **Hotbar 8 kotak** di tengah bawah: pedang, daging, kelapa tugas, kulit, taring,
  koin, besi, dan lendir, lengkap dengan jumlah barang.
- **Panel tas** besar di tengah layar berisi kartu item, jumlah, deskripsi, dan
  statistik pemain; dibuka dengan `I`, ditutup dengan `I`, `Esc`, `✕`, atau klik
  di luar.
- Musuh menjatuhkan **daging celeng, kulit, taring, koin perak, besi tempa, dan
  inti roh rawa** dalam kotak berpendar yang otomatis terhisap saat didekati.
- `H` memakan daging celeng untuk memulihkan **+30 HP**.

#### Simpan dan muat

- Satu slot simpanan di `localStorage` dengan kunci `pulau.simpanan.v2`; hanya
  format v2 yang dibaca, sedangkan kunci `pulau.simpanan.v1` lama dibersihkan
  saat menulis simpanan baru.
- Tombol **Simpan/Muat** di menu jeda, **Lanjutkan Perjalanan** di menu utama,
  dan simpan cepat **Ctrl + S**.
- **Autosave setiap 2 menit** ke slot yang sama saat bermain.
- Yang tersimpan: posisi dan arah pemain, HP/level/XP, isi tas, waktu dunia,
  kelapa yang sudah dipetik, kemajuan kedua tugas, variasi dialog warga, posisi
  perahu dan status menaikinya, serta tujuan peta. Field baru bersifat opsional
  agar simpanan lama tetap sah.

#### Peta dan navigasi

- **Peta mini 4 mode** (`M`): Dunia → Sekitar → Lokal → Sembunyi, digambar dari
  tinggi terrain dan diperbarui sekitar 11 kali per detik. Utara selalu di atas;
  panah putih menunjukkan arah pemain, kerucut emas arah kamera.
- Penanda peta: desa, pelabuhan, perahu, pondok pulau, warga, musuh hidup,
  jarahan, dan sasaran tugas, plus panah tepi bila sasaran jauh.
- **Peta besar** (kanvas 1024²) dengan ikon dan label **Desa Aldenmere**,
  **Pelabuhan**, **Pondok Dera**, **Pondok Pulau**, **Reruntuhan Kastil**,
  **Kapel Tua**, dan **Lingkaran Batu**. Klik ikon, label, atau titik bebas untuk
  menandai tujuan.
- Setelah peta ditutup: **kompas HUD** berputar relatif kamera, jarak m/km
  diperbarui, peta mini menampilkan pin dan garis putus-putus, dan **mercusuar
  emas 3D** menandai lokasi. Tiba dalam ±3 m, tujuan dibersihkan otomatis.
- Dunia tetap berjalan saat peta terbuka (jam, makhluk, autosave); gerak dan
  serangan dikunci, dan peta menutup otomatis bila pemain diserang.

#### Laut, pelabuhan, dan perahu

- **Perahu cadik** bersandar di dermaga. Tekan `E` untuk naik; `W/S` maju–mundur,
  `A/D` membelok. Perahu mengangguk dan berguling mengikuti gelombang,
  meninggalkan buih, dan bisa diturunkan di laut dalam.
- Pemain otomatis **berenang** di air dalam (`W/A/S/D`, `Shift` lebih cepat),
  bisa naik ke dermaga dari air, dan tidak dibatasi dinding kedalaman.
- Tabrakan dermaga tetap fisik tetapi tidak ikut berputar saat perahu berbelok.

#### Tampilan, suara, dan antarmuka

- **Tiga preset grafis** — Cepat, HD, dan Ultra — dengan bayangan halus (peta
  bayangan 1–4K), tekstur prosedural, pantulan lingkungan PMREM dari langit,
  bloom, dan FXAA. Perubahan preset langsung berlaku.
- **Model karakter 3D CC0** (KayKit dan Quaternius) saat dijalankan lewat
  HTTP/HTTPS, dengan **fallback prosedural lengkap** saat `file://`.
- **Efek**: percikan tebasan, cincin gelombang, debu langkah, pendar naik level,
  getaran kamera, dan vignette merah saat HP di bawah 36%.
- **Audio prosedural Web Audio** tanpa berkas audio: ombak, pad suasana, desis
  malam, tebasan, jarahan, naik level, dan simpan/muat. Slider musik/suasana dan
  efek suara tersedia di Pengaturan.
- **Menu medieval tavern**: panel kulit gelap, bingkai besi dan emas, emblem fajar
  SVG, tombol plakat berikon, font lokal Cinzel/Alegreya, dan partikel debu emas.
- **Trailer sinematik** kamera terbang (pantai → Aldenmere → perbukitan) dengan
  kartu judul dwibahasa dan bilah letterbox; bisa dilewati dengan klik/tombol.
- **HUD bisa diklik**: peta, tugas, tas, dan jeda di bawah peta mini; hotbar juga
  bisa diklik. Kursor selalu tampil; kamera diputar dengan menahan klik kanan.
- **Kamera orang ketiga** dengan zoom, pembatas langit-langit saat di dalam rumah,
  jam dunia, panel performa `F3`, dan layar pamit saat keluar.

Ringkasan tombol lengkap ada di [Kontrol](#kontrol).

### Aset

Seluruh aset pihak ketiga disimpan lokal di repo; tidak ada CDN, permintaan ke
layanan eksternal, atau berkas audio/gambar terunduh saat bermain.

| Kategori | Berkas / jumlah | Keterangan |
|---|---|---|
| **Model karakter** | 6 berkas `.glb` (±17,5 MB) | KayKit Character Pack: Adventures (5 karakter berig + 75 animasi) dan Quaternius Boar. Tekstur tertanam di dalam `.glb`. |
| **Model bangunan** | 33 berkas `.glb` (±1,3 MB) | Quaternius Medieval Village MegaKit (Free, CC0): dinding, lantai, atap, tangga, pintu, jendela, cerobong, pagar, pedati, dan anggur. Setiap model adalah `.glb` mandiri (geometri + buffer di dalam satu berkas, tekstur diganti material prosedural) sehingga **tidak ada permintaan `.bin`/`.gltf`/PNG** saat bermain. |
| **Font menu** | 4 berkas `.woff2` | Cinzel, Cinzel Decorative 700, Alegreya reguler, dan Alegreya italic; disertai lisensi OFL. |
| **Pustaka grafis** | Three.js r128 + modul lokal | `three.min.js`, GLTFLoader, SkeletonUtils, EffectComposer, RenderPass, UnrealBloomPass, CopyShader, FXAAShader, dan LuminosityHighPassShader. |
| **Tekstur** | 18 tekstur + 2 normal map | Dibuat saat runtime dengan Canvas 2D: tanah, rumput kering, kulit kayu, papan, plester, bata batu, cobble, sirap, rumbia, kain, kulit, logam, bulu, daun, batu, dan gel; plus normal map air dan tanah. |
| **Audio** | 0 berkas | Seluruh musik suasana dan efek suara disintesis dengan Web Audio API. |
| **Antarmuka** | SVG, emoji, CSS | Emblem fajar, ikon HUD, dan ornamen menu dibuat inline/CSS; tidak ada berkas gambar UI. |

Pemakaian model 3D saat ini:

- `Knight.glb` — pemain dan **Ksatria Terkutuk**.
- `Rogue.glb`, `Rogue_Hooded.glb`, `Mage.glb` — model penduduk; penyamun memakai
  varian bertudung.
- `Boar.glb` — **Celeng Hutan**.
- `Barbarian.glb` — tersedia di repo sebagai bagian paket CC0, tetapi belum
  ditugaskan ke karakter mana pun.
- `assets/models/buildings/*.glb` — modul MegaKit untuk **desa Aldenmere,
  pendukuhan, dan Kerajaan Pusat** (dinding, atap, tangga, jendela, pasar, dll).

#### Pipeline model bangunan (`.gltf` → `.glb`)

MegaKit asli terdiri dari 176 berkas `.gltf` + `.bin` + PNG. Model `.gltf`
meminta berkas `.bin` terpisah, dan peramban kerap menampilkan dialog unduh
untuk berkas biner tersebut. Karena itu seluruh model yang dipakai dikonversi
menjadi `.glb` mandiri:

```bat
node tools/gltf-to-glb.js          :: hanya model yang dipakai js/assets.js
node tools/gltf-to-glb.js --all    :: semua .gltf di folder buildings
```

Konverter menggabungkan buffer `.bin` ke dalam berkas, membuang tekstur PNG
(material diganti tekstur prosedural `TexLib` agar tetap ringan dan seragam),
lalu menulis satu `.glb` per model. Sumber asli (`.gltf`, `.bin`, PNG) sudah
dipindahkan ke `assets/models/buildings/_unused/` yang **diabaikan git**
(`.gitignore`) sehingga repo tetap ramping; berkas `.bin` dihapus karena tidak
lagi dibutuhkan.

Saat dibuka lewat `file://`, peramban memblokir pembacaan model sehingga game
memakai bentuk prosedural untuk pemain, penduduk, dan makhluk. Semua tekstur,
bangunan, vegetasi, langit, dan efek tetap tersedia karena dibuat dari kode.

### Teknologi dan arsitektur

| Lapisan | Implementasi |
|---|---|
| **Bahasa** | JavaScript gaya ES5 (IIFE), HTML5, CSS3; tanpa framework UI |
| **Render** | Three.js r128 melalui WebGL; kamera orang ketiga |
| **Dunia** | PRNG ber-seed, noise 2D, fBm, ridged, sampling tinggi terrain, warna vertex |
| **Vegetasi** | `InstancedMesh`, potongan rumput 36 m, shader goyangan angin |
| **Tekstur** | `CanvasTexture` + normal map, repeat dan anisotropi |
| **Audio** | Web Audio API (oscillator, filter, noise, LFO) |
| **Antarmuka** | DOM overlay + CSS; i18n lewat atribut `data-i18n` |
| **Simpanan** | JSON di `localStorage`, versi 2, satu slot |
| **Server** | Node.js `http` statis tanpa dependensi (opsional, port 8317) |
| **Uji** | Suite integrasi Node + skrip Chrome DevTools Protocol |
| **Build** | Tidak ada; berkas sumber langsung dijalankan |

`index.html` memuat pustaka Three.js lalu modul game dalam urutan dependensi.
Setiap modul adalah IIFE yang mengekspos satu global (`Utils`, `World`, `Player`,
`Enemies`, `Village`, `Minimap`, dan seterusnya). Modul yang dipakai uji Node
menjaga diri agar tidak menyentuh `document`/`window` saat tidak tersedia.

Alur utamanya:

1. `main.js` menyiapkan renderer, adegan, kamera, input, UI, audio, dan langit.
2. Dunia dibangun bertahap (terrain → laut → vegetasi → desa → landmark →
   pelabuhan).
3. Pemain, makhluk, NPC, perahu, dan efek dihubungkan ke *game loop*.
4. Render memakai *frustum culling* bawaan Three.js, *instancing*, dan pool
   cahaya dinamis; hanya 2–3 cahaya aktif di sekitar pemain.
5. Peta mini dan peta besar memakai kanvas 2D terpisah agar tidak membebani
   render 3D.

**Strategi performa**: jumlah vegetasi diskalakan sublinear, rumput hanya
digambar di sekitar pemain, bayangan dibatasi sesuai preset, DPR HD/Ultra
dibatasi 1,25×/1,5×, dan banyak geometri bangunan memakai material serta balok
yang dapat di-*instance*. Target di iGPU kelas bawah (Intel UHD, 1262 × 704,
DPR 1): **Cepat ±58 FPS**, **HD ±44–47 FPS**, **Ultra ±39–44 FPS**.

**Tanpa build step**: tidak ada `package.json`, bundler, transpiler, atau proses
kompilasi. Node.js hanya dipakai untuk server lokal opsional dan alat uji. Ini
membuat repo bisa langsung diunggah ke hosting statis dan dibuka lewat
`file://` (dengan fallback prosedural).

### Cara game dibangun

Game dibangun bertahap dalam lima fase, lalu diubah menjadi latar kerajaan abad
pertengahan:

1. **Fase 1 — Dunia dan pemain.** Terrain, laut, langit, siklus waktu, karakter,
   kamera, dan kontrol dasar.
2. **Fase 2 — Dunia hidup.** Rumput, bunga, desa, NPC, dialog, dan tugas.
3. **Fase 3 — RPG.** Kombo pedang, tiga jenis makhluk, AI, XP/level, tas,
   hotbar, dan jarahan.
4. **Fase 4 — Polesan.** Simpan/muat, audio prosedural, peta mini, dan efek
   partikel.
5. **Fase 5 — Dunia 10×.** Pegunungan lebih besar, 12 pulau kecil, pelabuhan dan
   perahu, peta 4 mode, peta besar dengan tujuan, serta HUD yang bisa diklik.
6. **Konversi medieval.** Pemain menjadi ksatria fajar, desa menjadi Aldenmere
   dengan rumah setengah-kayu, lanskap mendapat kastil/kapel/menara/lingkaran
   batu, dan makhluk menjadi celeng, penyamun, roh rawa, serta ksatria terkutuk.
   ID internal, ID tugas, tipe musuh, dan kunci `pulau.` dipertahankan agar
   simpanan serta perilaku lama tetap kompatibel.
7. **QA.** `tools/test-build.js` menguji dunia, pulau, pelabuhan, perahu, renang,
   rumah, NPC, tugas, tempur, simpan/muat v2, peta, efek, dan 120 frame; skrip
   CDP dipakai untuk jepretan dan pengukuran FPS di peramban.

Seluruh geometri dunia, bangunan, karakter prosedural, tekstur, dan audio dibuat
dari kode. Aset eksternal sengaja dibatasi pada enam model GLB CC0, empat berkas
font, dan pustaka Three.js. Tidak ada editor level atau mesin game pihak ketiga:
dunia adalah hasil kode generator yang deterministik dari seed.

### Batasan

- **Pemain tunggal.** Tidak ada multiplayer, server game, cloud save,
  leaderboard, atau sinkronisasi antarperangkat.
- **Satu slot simpanan** yang terikat pada origin peramban. Tidak ada ekspor/impor
  save; pindah domain atau menghapus data situs akan menghilangkan progres.
- **Dirancang untuk desktop** dengan keyboard dan mouse. Kontrol sentuh dan
  gamepad belum tersedia.
- **Cerita dan dialog hanya Bahasa Indonesia**; antarmuka dapat diganti
  Indonesia/English.
- **Mode `file://` memakai fallback prosedural.** Model 3D hanya aktif lewat
  HTTP/HTTPS (termasuk `localhost`).
- **Cakupan konten**: dua tugas, empat jenis makhluk, satu peta, dan sembilan NPC.
  Ini game eksplorasi/mini-RPG, bukan RPG penuh dengan cabang cerita atau ekonomi
  kompleks.
- **Unduhan awal** sekitar 19 MB, sebagian besar model GLB. Performa bergantung
  pada GPU; angka FPS di atas diukur pada iGPU kelas bawah, bukan jaminan untuk
  semua perangkat.
- **Tidak ada PWA/service worker.** Game tidak memasang dirinya untuk dibuka
  offline setelah tab ditutup; mode offline praktis adalah menjalankan berkas
  lokal.

### Lisensi dan atribusi

Kode game dibuat khusus untuk proyek ini. Three.js r128 berlisensi **MIT**;
model karakter KayKit dan Quaternius berlisensi **CC0 1.0** (domain publik);
font Cinzel, Cinzel Decorative, dan Alegreya berlisensi **SIL Open Font License
1.1**. Rincian berkas dan sumbernya ada di [Lisensi](#lisensi),
`assets/LICENSE.txt`, dan `assets/fonts/`.

## Uji & alat pengembangan

```
node tools/test-build.js        # uji integrasi Node (dunia 10× + pulau kecil + pelabuhan/perahu + berenang/laut terbuka + rumah + NPC + tugas + tempur + simpan/muat v2 + peta 4 mode + peta besar/kompas + efek + 120 frame)
node tools/test-terrain.js      # peta ASCII tinggi pulau
node tools/probe.js <url> <png> # buka game via CDP, cetak diagnostik + jepretan
node tools/shot.js <url> <png>  # jepretan layar sederhana (menunggu __gameReady)
node tools/act.js <url> <png> <ms> "<js1 ;; js2>"  # jalankan aksi JS sebelum jepretan
node tools/perf.js <url> <png> <ms> <berkas.js>   # ukur FPS rata-rata / bench komponen async
```

Tip pengembangan (parameter hash):
- `index.html#autostart` — lompati menu **& trailer**, langsung bermain
- `...#autostart&yaw=3.14` — putar awal kamera (radian)
- `...#autostart&pos=303,20` — mulai dari titik tertentu (uji cepat pantai/lereng)
- `...#autostart&time=0.92` — mulai pada jam dunia tertentu (0–1; 0.92 = malam)
- `...#autostart&q=cepat` — mulai dengan preset grafis tertentu (`cepat`/`hd`/`ultra`)

## Struktur

```
index.html              halaman utama + menu/pengaturan/trailer + HUD (dialog, tugas, vital, tas, tombol HUD, peta besar, tumbang)
css/style.css           tampilan UI (menu, pengaturan, trailer, HUD, peta mini/besar & kompas tujuan)
lib/three.min.js        Three.js r128 (UMD, lokal)
lib/loaders/            GLTFLoader (pemuat model .glb, r128)
lib/utils/              SkeletonUtils (klon karakter berig, r128)
lib/postprocessing/     EffectComposer, RenderPass, UnrealBloomPass (r128)
lib/shaders/            CopyShader, FXAAShader, LuminosityHighPassShader (r128)
js/config.js            konstanta (kamera, pemain, dunia, air, perahu, kabut)
js/i18n.js              dwibahasa antarmuka ID/EN (kamus + penerap data-i18n)
js/audio.js             audio prosedural Web Audio (musik suasana + efek suara)
js/trailer.js           trailer sinematik in-engine (jalur kamera + kartu judul)
js/utils.js             PRNG ber-seed, noise 2D, fBm, ridged, matematika
js/input.js             keyboard, mouse (klik serang, seret kanan untuk kamera), tombol sekali-tekan
js/ui.js                dialog, petunjuk interaksi, daftar tugas, vital, tas, toast
js/rpg.js               data RPG: daftar barang + Stats (HP, XP, level, isi tas)
js/save.js              simpan/muat satu slot v2 (localStorage, aman di Node)
js/minimap.js           peta 4 mode + peta besar/klik tujuan & arah kompas; peta dasar terrain
js/effects.js           pool partikel THREE.Points, cincin gelombang, debu & efek naik level
js/textures.js          pustaka tekstur prosedural (canvas; aman di Node)
js/assets.js            pemuat model 3D + klon berig (fallback aman)
js/sky.js               WorldSky: kubah langit, matahari/bulan/bintang/awan, cahaya
js/world.js             terrain warna vertex, laut, vegetasi/batu, landmark batu tua (kastil/kapel/menara/lingkaran batu), tabrakan, pulau kecil, pelabuhan
js/player.js            ksatria prosedural + pedang, fisika, animasi, kombo serangan
js/grass.js             rumput & bunga instanced berpotongan (chunk) + goyangan angin
js/village.js           Aldenmere + pendukuhan + pondok pulau (rumah setengah-kayu, pasar, gapura, sumur, pagar, api unggun), NPC, dialog, tugas
js/boat.js              pelabuhan (dermaga) + perahu cadik: naik/turun, kemudi, gelombang & bangun
js/enemies.js           celeng/penyamun/roh rawa/ksatria terkutuk, AI, pertarungan, jarahan, bilah HP
js/main.js              game loop, pemuatan bertahap, menu/pengaturan/keluar, trailer, kamera, HUD, simpan/muat, peta besar & tujuan, efek
assets/models/*.glb     model karakter 3D CC0 (KayKit + Quaternius)
assets/fonts/*.woff2    font menu lokal (Cinzel Decorative, Cinzel, Alegreya) + lisensi OFL
server.js               server statis opsional (tanpa dependensi)
jalankan.bat            peluncur opsional untuk pemain (server + browser)
tools/                  uji & alat (Node)
```

## Lisensi

- Kode game: dibuat khusus untuk proyek ini.
- Three.js r128 — lisensi MIT (`lib/three.min.js`, `lib/loaders`,
  `lib/postprocessing`, `lib/shaders`).
- Model karakter 3D — CC0 1.0 / domain publik: KayKit Character Pack Adventures
  (Kay Lousberg) dan Quaternius (babi hutan) — rincian di `assets/LICENSE.txt`.
- Font menu — **Cinzel**, **Cinzel Decorative**, dan **Alegreya**, dilisensikan
  SIL Open Font License 1.1; berkas lisensi ada di `assets/fonts/`.

## Peta jalan

- [x] **Fase 1** — Dunia & pemain: terrain, laut, langit, siklus waktu, karakter, kamera
- [x] **Fase 2** — Dunia hidup: rumput & bunga, desa, NPC, dialog, quest
- [x] **Fase 3** — RPG: pertarungan pedang, musuh + AI, XP/level, inventory, loot
- [x] **Fase 4** — Polesan: simpan/muat, audio Web Audio, minimap, efek
- [x] **Fase 5** — Dunia 10×: pegunungan besar, 12 pulau kecil berpondok, pelabuhan & perahu yang bisa dikemudikan, peta 4 mode + HUD bisa diklik, rumah normal yang lapang
- [x] **Peta besar (Fase 5 lanjutan)** — klik peta mini, pilih POI/titik bebas, kompas HUD + pin mini + mercusuar 3D, tujuan tersimpan di save v2
- [x] **Laut terbuka (Fase 5 lanjutan)** — berenang di air dalam, dermaga tersambung dari darat, perahu bisa turun di laut dalam, tanpa dinding kedalaman/batas peta; samudra diperluas
- [x] **Grafis G1** — Preset kualitas (Cepat/HD/Ultra) + bayangan halus
- [x] **Grafis G2** — Tekstur prosedural (kayu, papan, rumbia, kain, batu, air)
- [x] **Grafis G3** — Pantulan lingkungan PMREM dari langit + air beriak
- [x] **Grafis G4** — Post-processing: bloom + FXAA (pustaka r128 lokal)
- [x] **Grafis G5** — Model karakter 3D CC0 (KayKit & Quaternius) + fallback prosedural
- [x] **Menu M1** — Menu utama (Mulai/Pengaturan/Keluar), trailer sinematik pra-game, pengaturan audio prosedural / grafis / bahasa ID–EN
- [x] **Menu M2** — Redesign medieval tavern: panel kulit/emas, emblem fajar, tombol plakat berikon, font Cinzel/Alegreya lokal, partikel debu emas, branding Aetheria
- [x] **Grafis G6** — Lingkungan: terrain lebih halus + tekstur tanah, pohon lebih tinggi + cemara, rumah besar yang bisa dimasuki + lampu malam
- [x] **Grafis G7** — Pohon lebih tinggi (kelapa melengkung + pelepah 3D), hotbar item + panel tas besar, label level di atas kepala, instruksi/FPS disembunyikan
- [x] **Dunia K1** — Konversi kerajaan abad pertengahan: ksatria pemain, Aldenmere setengah-kayu + pasar + gapura batu, kapel/kastil/menara/lingkaran batu, celeng/penyamun/roh rawa/ksatria terkutuk, palet hutan sedang, dialog & peta bernuansa kerajaan
