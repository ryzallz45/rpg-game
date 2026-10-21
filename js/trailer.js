/* Trailer sinematik (Tahap Menu): kamera terbang mengelilingi pulau sebelum
   masuk permainan — dibuat langsung di dalam mesin game (tanpa berkas video).
   Kartu judul, bilah letterbox, dan tombol lewati. Aman di Node (document
   hanya disentuh saat start() dipanggil di peramban). */
(function (global) {
  'use strict';

  /* Jadwal kartu judul (detik): {t0,t1} jendela tampil, tk/sk = kunci i18n,
     title/sub = teks asli Bahasa Indonesia. */
  var CARDS = [
    { t0: 0.8, t1: 6.2, tk: 'trailer.c1t', sk: 'trailer.c1s', title: 'AETHERIA', sub: 'Legacy of the Dawn — sebuah petualangan 3D di kerajaan pesisir Aetheria' },
    { t0: 7.6, t1: 12.6, tk: 'trailer.c2t', sk: 'trailer.c2s', title: 'Hutan pinus & jalan tua', sub: 'Susuri pantai, hutan pinus, dan pelabuhan — naiki perahu, jelajahi kepulauan' },
    { t0: 14.0, t1: 18.4, tk: 'trailer.c3t', sk: 'trailer.c3s', title: 'Temui warga Aldenmere', sub: 'Bantu mereka menyelesaikan tugas kerajaan' },
    { t0: 19.6, t1: 24.0, tk: 'trailer.c4t', sk: 'trailer.c4s', title: 'Taklukkan alam liar', sub: 'Celeng hutan, penyamun & roh rawa — juga ksatria terkutuk di reruntuhan kastil' },
    { t0: 25.2, t1: 30.4, tk: 'trailer.c5t', sk: 'trailer.c5s', title: 'Kekaisaran di seberang', sub: 'Seratus atap di balik tembok raksasa — takhta Kekaisaran Aetheria' },
    { t0: 37.6, t1: 42.4, tk: 'trailer.c6t', sk: 'trailer.c6s', title: 'AETHERIA', sub: 'Legacy of the Dawn — selamat menjelajah!' }
  ];

  function Trailer(camera, world) {
    this.camera = camera;
    this.world = world;
    this.active = false;
    this.elapsed = 0;
    this.duration = 42;
    this.onDone = null;
    this._posCurve = null;
    this._tgtCurve = null;
    this._cardIndex = -2;
    this._skipArmed = 0;
    this.el = null;
    this.cardWrap = null;
    this.cardTitle = null;
    this.cardSub = null;
    var self = this;
    this._onSkip = function () {
      // hindari klik tombol "Mulai" ikut melewati trailer
      if (global.performance && performance.now() - self._skipArmed < 350) return;
      self.skip();
    };
  }

  /* Bangun jalur kamera dari data dunia (pantai, desa, puncak tertinggi). */
  Trailer.prototype._buildCurves = function () {
    var w = this.world;
    var S = w.scale || 1; // skala dunia Fase 5 — jalur ikut membesar
    var spawn = w.findSpawnPoint();
    // Lokasi desa utama: world.villageSpot diisi saat buildEnvironment;
    // fallback ke objek desa (bila diberikan) atau pusat pulau.
    var v = w.villageCenter || w.villageSpot || (w.village ? w.village.center : { x: 0, z: 0 });

    // Lokasi kerajaan besar (dipilih saat buildEnvironment) — pusat perhatian trailer.
    var k = w.kingdomSite || { x: 0, z: 0, r: 60 };
    var kr = k.r || 60;
    // Kekaisaran agung: puncak tur sinematik.
    var e = w.empireSite || { x: k.x, z: k.z, r: 145 };
    var er = e.r || 145;
    // Arah masuk kekaisaran: dari arah gerbang utama (menghadap desa), sedikit miring.
    var ea = Math.atan2(v.z - e.z, v.x - e.x) + 0.45;
    var ecos = Math.cos(ea), esin = Math.sin(ea);

    var pts = [
      [spawn.x + 150 * S, 34 * S, spawn.z + 120 * S],       // laut lepas (pelabuhan)
      [spawn.x + 56 * S, 18 * S, spawn.z + 44 * S],         // menyusur pantai awal
      [v.x + 64 * S, 17 * S, v.z + 58 * S],                 // menuju desa
      [v.x + 20 * S, 9.5 * S, v.z + 20 * S],                // melintas alun-alun
      [k.x + (kr + 105) * 0.72, 62, k.z + (kr + 105) * 0.72], // terbang menuju kerajaan
      [k.x + kr * 1.15, 34, k.z + kr * 1.15],               // mengitari tembok kerajaan
      [k.x - kr * 0.55, 26, k.z - kr * 0.55],               // melintas di atas kastil
      [(k.x + e.x) / 2, 155, (k.z + e.z) / 2],              // terbang tinggi antar kota
      [e.x + ecos * (er + 62), 58, e.z + esin * (er + 62)],  // menuju tembok kekaisaran
      [e.x + ecos * (er * 0.82), 52, e.z + esin * (er * 0.82)], // melintasi tembok
      [e.x + ecos * (er * 0.3), 74, e.z + esin * (er * 0.3)]    // menanjak di atas kastil
    ];
    var tgts = [
      [0, 16 * S, 0],
      [spawn.x, 3, spawn.z],
      [v.x, 6, v.z],
      [v.x, 3.5, v.z],
      [k.x, 12, k.z],
      [k.x, 14, k.z],
      [k.x, 20, k.z],
      [(k.x + e.x) / 2, 90, (k.z + e.z) / 2],
      [e.x, 16, e.z],
      [e.x, 22, e.z],
      [e.x, 30, e.z]
    ];

    var P = [], T = [];
    for (var i = 0; i < pts.length; i++) {
      P.push(new THREE.Vector3(pts[i][0], pts[i][1], pts[i][2]));
      T.push(new THREE.Vector3(tgts[i][0], tgts[i][1], tgts[i][2]));
    }
    this._posCurve = new THREE.CatmullRomCurve3(P, false, 'catmullrom', 0.35);
    this._tgtCurve = new THREE.CatmullRomCurve3(T, false, 'catmullrom', 0.35);
  };

  Trailer.prototype.start = function (onDone) {
    if (this.active || typeof document === 'undefined') return false;
    this.onDone = onDone || null;
    this.elapsed = 0;
    this._cardIndex = -2;
    this._finishing = false;
    this._buildCurves();

    this.el = document.getElementById('trailer');
    this.cardWrap = document.getElementById('trailer-card');
    this.cardTitle = document.getElementById('trailer-card-title');
    this.cardSub = document.getElementById('trailer-card-sub');
    if (this.el) this.el.classList.remove('hidden');

    var self = this;
    // bilah letterbox masuk dengan animasi
    setTimeout(function () { if (self.el && self.active) self.el.classList.add('letterbox'); }, 60);

    this._skipArmed = global.performance ? performance.now() : 0;
    global.addEventListener('click', this._onSkip, true);
    global.addEventListener('keydown', this._onSkip, true);
    this.active = true;
    this._showCard(-1);
    return true;
  };

  Trailer.prototype._showCard = function (i) {
    if (i === this._cardIndex) return;
    this._cardIndex = i;
    if (!this.cardWrap) return;
    if (i < 0) {
      this.cardWrap.classList.remove('show');
      return;
    }
    var c = CARDS[i];
    var tx = global.Lang ? global.Lang.tx : function (k, fb) { return fb; };
    if (this.cardTitle) this.cardTitle.textContent = tx(c.tk, c.title);
    if (this.cardSub) this.cardSub.textContent = tx(c.sk, c.sub);
    this.cardWrap.classList.add('show');
  };

  /* Kembalikan true selama trailer masih berjalan. */
  Trailer.prototype.update = function (dt) {
    if (!this.active) return false;
    this.elapsed += dt;

    var u = Math.min(this.elapsed / this.duration, 1);
    var p = this._posCurve.getPointAt(u);
    // jangan menembus terrain
    var minY = this.world.groundHeight(p.x, p.z) + 8;
    if (p.y < minY) p.y = minY;
    this.camera.position.copy(p);
    var tgt = this._tgtCurve.getPointAt(u);
    this.camera.lookAt(tgt.x, tgt.y, tgt.z);

    var ci = -1;
    for (var i = 0; i < CARDS.length; i++) {
      if (this.elapsed >= CARDS[i].t0 && this.elapsed <= CARDS[i].t1) { ci = i; break; }
    }
    this._showCard(ci);

    if (u >= 1) { this.finish(); return false; }
    return true;
  };

  Trailer.prototype.skip = function () {
    if (!this.active) return;
    this._showCard(-1);
    this.finish();
  };

  /* Akhiri trailer: bilah keluar, layar menggelap, lalu serahkan ke permainan. */
  Trailer.prototype.finish = function () {
    if (!this.active) return;
    this.active = false;
    global.removeEventListener('click', this._onSkip, true);
    global.removeEventListener('keydown', this._onSkip, true);
    if (this.el) this.el.classList.remove('letterbox');
    if (this.cardWrap) this.cardWrap.classList.remove('show');

    var fade = document.getElementById('fade');
    var self = this;
    if (fade) fade.classList.add('on');
    setTimeout(function () {
      if (self.el) self.el.classList.add('hidden');
      if (self.onDone) self.onDone();
      setTimeout(function () { if (fade) fade.classList.remove('on'); }, 170);
    }, 540);
  };

  Trailer.CARDS = CARDS;
  global.Trailer = Trailer;
})(typeof window !== 'undefined' ? window : globalThis);
