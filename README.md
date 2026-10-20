# Pulau Nusantara — Eksplorasi 3D Low-Poly

Game eksplorasi 3D open-world (mini RPG) berbasis Three.js r128. Seluruh dunia,
vegetasi, langit, dan karakter dibuat **prosedural** — cukup dobel-klik
`index.html` (atau tombol Play di editor), tanpa internet. Versi grafis penuh
(bayangan halus, tekstur, efek, dan **model karakter 3D CC0**) menyala otomatis
saat dijalankan lewat `jalankan.bat`; semua aset tersimpan lokal di repo ini.

**Fase 5** memperluas dunia menjadi **±3,24 km persegi (10× luas sebelumnya)**
dengan pegunungan & perbukitan yang ikut membesar, **12 pulau kecil** di lautan,
**pelabuhan beratap dermaga + perahu cadik yang bisa dikemudikan**, rumah
seukuran manusia yang lapang, **peta 4 mode** di kanan atas, **peta besar yang
bisa ditandai tujuannya** (kompas HUD + mercusuar 3D), dan HUD yang seluruhnya
bisa diklik.

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

- **Audio** — slider musik/suasana & efek suara. Semua suara dibuat **prosedural
  dengan Web Audio** (ombak, pad lembut, desis malam, tebasan, jarahan, naik
  level, simpan/muat) — tanpa berkas audio, sesuai prinsip proyek.
- **Grafik** — **Cepat / HD / Ultra**; perubahan langsung berlaku (termasuk
  memasang model 3D bila baru dinyalakan).
- **Bahasa** — **Bahasa Indonesia / English** untuk antarmuka & menu (dialog
  cerita tetap Bahasa Indonesia).

Trailer menampilkan kamera terbang mengelilingi pulau (pantai → desa → puncak
gunung) dengan kartu judul dwibahasa dan bilah letterbox sinematik.

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
| H | makan daging babi (+30 HP) |
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
- **Vegetasi instanced**: **±960 pohon** — rimbun pedalaman yang **lebih tinggi**
  (mahkota 7 gumpalan organik bertekstur daun), **kelapa** pantai yang **sangat
  tinggi dengan batang melengkung + 16 pelepah 3D** (bergerigi, melengkung turun,
  pelepah kering & 3 kelapa), dan **cemara bertingkat** di punggung bukit &
  lereng — plus **340 batu**; low-poly, ditanam pas mengikuti permukaan tanah, + tabrakan
- **Rumput & bunga**: dibagi **potongan 36 m** yang dibangun bertahap (5×5
  potongan aktif ±90 m, 2 potongan per frame) — ±1.400 rumpun + ±200 bunga instanced
  di sekitar pemain, bergoyang tertiup angin (shader), hanya di daratan berumput.
  Dengan dunia 10×, biaya gambar rumput tetap konstan
- **Desa Nusantara (utama)**: alun-alun besar, 10 rumah panggung yang **bisa
  dimasuki** (pintu terbuka 1,5×2,15 m, tangga depan, lantai rendah), **balai
  desa** terbesar (pintu 1,8×2,3 m), sumur batu, pagar kayu, dan **3 tiang
  lampu alun-alun** — ukuran rumah **normal untuk manusia**, langit-langit dalam
  **2,8–3,05 m** agar leluasa berjalan di dalam
- **Cahaya malam**: saat senja–fajar **jendela & lentera rumah menyala hangat**,
  tiang lampu menerangi alun-alun (cahaya nyata di HD/Ultra), api unggun
  pendukuhan menyala lebih terang, dan satu **lampu ruangan** menyertai pemain
  di dalam rumah
- **3 pendukuhan kecil** tersebar di bagian pulau lain (barat & selatan):
  rumah panggung (bisa dimasuki), alun-alun mungil, dan **api unggun berkedip** —
  peta jalan di HUD tetap menuntun ke desa utama
- **9 penduduk** dengan jadwal jelajah sendiri: Pak Raka (kepala desa),
  Bu Sari, Mira, Adi, Kakek Bimo — plus **Bu Nia, Joni, dan Kakek Umar** di
  pendukuhan, serta **Paman Dera** (pelaut) di pulau kecil berpondok; berhenti
  & menoleh saat diajak bicara
- **Dialog & tugas** (Bahasa Indonesia): panel dialog, petunjuk interaksi (E),
  daftar tugas di HUD, dan notifikasi singkat. Dua tugas: mengumpulkan
  **5 kelapa** untuk Pak Raka dan mencari **keranjang Mira** yang hilang
- **Karakter dengan animasi** jalan/lari/lompat + **pedang di tangan kanan** dan
  bayangan nyata — memakai **model 3D CC0** (KayKit Adventurers: Barbarian,
  Knight, Mage, Rogue) saat dijalankan lewat `jalankan.bat`, dengan bentuk
  prosedural sebagai fallback otomatis
- **Grafis berjenjang (Cepat/HD/Ultra)**: bayangan halus (peta bayangan 1–4K),
  **tekstur prosedural** (kayu, papan, rumbia, kain, batu, air), **pantulan
  lingkungan** dari langit (PMREM), **bloom + FXAA**, dan model 3D
- **Pertarungan pedang (Fase 3)**: kombo 3 ayunan (klik kiri / F), busur
  tebasan di depan pemain, musuh terlempar & berkedip merah saat kena
- **3 jenis makhluk pulau** (±65 ekor: 26 babi, 22 slime, 16 bandit + 1 pembuka;
  pembangkit kembali setelah ~75 dtk):
  **Babi Hutan** (liar & cepat menanduk), **Bandit Rimba** (golok, koin),
  **Slime Hutan** (melompat kenyal) — AI: jelajah → kejar → serang → lemas →
  kembali pulang; menjauh dari desa & titik awal
- **HP · XP · level**: **level melayang di atas kepala pemain**; bilah **HP & XP
  di atas hotbar**; naik level menambah HP maks & serangan (pulih penuh), bilah
  HP musuh melayang mengikuti sasaran terakhir
- **Hotbar & tas**: 8 kotak item di tengah bawah (pedang, daging + tombol H,
  kelapa tugas, kulit, taring, koin, besi, lendir) dengan jumlah barang; ikon
  **tas 🎒** membuka **panel besar di tengah layar** berisi kartu item, jumlah,
  deskripsi, dan statistik pemain — tutup dengan I, Esc, ✕, atau klik di luar
- **Tas & jarahan**: musuh menjatuhkan barang (🥩 daging, 🟫 kulit, 🦷 taring,
  🪙 koin, ⚙️ besi, 🫧 lendir) berupa kotak berpendar yang otomatis terhisap
  saat didekati; tekan **I** untuk membuka tas, **H** untuk makan daging
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
  mengganti mode **Dunia** (seluruh 3,24 km + pulau kecil) → **Sekitar** →
  **Lokal** → **Sembunyi**, dengan label mode di bawah peta. Digambar dari tinggi
  terrain lalu diperbarui ~11×/detik. Utara selalu di atas; panah putih = arah
  pemain, kerucut emas = arah kamera. Penanda: desa, **pelabuhan & perahu**,
  **pondok pulau kecil**, warga (biru), musuh hidup, jarahan, dan sasaran tugas —
  plus panah tepi bila sasaran jauh.
- **Peta besar & tujuan (Fase 5 lanjutan)**: klik peta mini atau tombol 🗺️
  membuka peta seluruh dunia (kanvas 1024² dari peta dasar 512² yang sama) dengan
  ikon & label **Desa Nusantara**, **Pelabuhan**, **Pondok Paman Dera**, dan
  **Pondok Pulau**. Klik ikon/label — tujuan menempel otomatis — atau titik bebas;
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
  dan penghuni** (Paman Dera) — bisa didarati dengan perahu atau **direnangi**
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
js/world.js             terrain warna vertex, laut, vegetasi/batu, tabrakan, pulau kecil, pelabuhan
js/player.js            karakter prosedural + pedang, fisika, animasi, kombo serangan
js/grass.js             rumput & bunga instanced berpotongan (chunk) + goyangan angin
js/village.js           desa + pendukuhan + pondok pulau (rumah/sumur/pagar/api unggun), NPC, dialog, tugas
js/boat.js              pelabuhan (dermaga) + perahu cadik: naik/turun, kemudi, gelombang & bangun
js/enemies.js           makhluk (babi/bandit/slime), AI, pertarungan, jarahan, bilah HP
js/main.js              game loop, pemuatan bertahap, menu/pengaturan/keluar, trailer, kamera, HUD, simpan/muat, peta besar & tujuan, efek
assets/models/*.glb     model karakter 3D CC0 (KayKit + Quaternius)
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
- [x] **Grafis G6** — Lingkungan: terrain lebih halus + tekstur tanah, pohon lebih tinggi + cemara, rumah besar yang bisa dimasuki + lampu malam
- [x] **Grafis G7** — Pohon lebih tinggi (kelapa melengkung + pelepah 3D), hotbar item + panel tas besar, label level di atas kepala, instruksi/FPS disembunyikan
