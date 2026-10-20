/* Konfigurasi global game — "Pulau Nusantara" (Low-Poly).
   Seluruh dunia dibuat prosedural: tanpa berkas aset, tanpa server. */
(function (global) {
  'use strict';

  /* Fase 5: dunia diperluas ±10× luas (sisi ±3,16×). Semua bentuk (pulau,
     gunung, bukit) dibuat pada ukuran Fase 1–4 lalu diperbesar seragam.
     Vegetasi/desa/rumah tetap berukuran manusia normal agar mudah dijelajahi. */
  var BASE_SIZE = 1024;
  var WORLD_SIZE = 3240;

  var CONFIG = {
    GAME_TITLE: 'Pulau Nusantara',
    PHASE: 'Low-Poly',

    RENDER: {
      /* Preset kualitas grafis (dipilih di menu; disimpan di localStorage).
         Nilai efektif pixelRatio/shadowMap ditulis oleh main.js dari preset. */
      quality: 'hd',     // 'cepat' | 'hd' | 'ultra'
      presets: {
        cepat: { pixelRatio: 1.0, shadowMap: 1024, postFx: false, env: false, models: false, lampLights: false },
        hd:    { pixelRatio: 1.25, shadowMap: 1024, postFx: true, env: true, models: true, lampLights: true },
        ultra: { pixelRatio: 1.5, shadowMap: 2048, postFx: true, env: true, models: true, lampLights: true }
      },
      pixelRatio: 1.5,   // nilai efektif — diisi dari preset saat boot
      shadowMap: 2048    // nilai efektif — diisi dari preset saat boot
    },

    WORLD: {
      baseSize: BASE_SIZE, // acuan skala Fase 1–4
      scale: WORLD_SIZE / BASE_SIZE, // faktor pembesaran seragam (±3,16×)
      size: WORLD_SIZE,  // ukuran dunia (unit) — pulau berada di tengah
      segments: 352,     // resolusi mesh terrain (relatif lebih halus dari Fase 1–4)
      seed: 20261018,    // seed deterministik: pulau selalu sama
      islands: 12,       // jumlah pulau kecil di lautan sekitar (8–12)
      seaLevel: 0,
      exploreLimit: 100000 // hanya penjaga simpanan; pemain tidak dibatasi dinding
    },

    DAY: {
      cycleSeconds: 600, // 1 hari penuh = 10 menit nyata
      startTime: 0.30    // mulai pagi (0 = tengah malam, 0.25 = matahari terbit)
    },

    PLAYER: {
      walkSpeed: 6.5,
      runSpeed: 11.5,
      accel: 34,
      jumpSpeed: 9.5,
      gravity: 26,
      turnSmooth: 12,
      /* Laut terbuka: pemain berenang saat dasar laut lebih dalam dari ini. */
      swimDepth: 1.15,   // kedalaman (di bawah permukaan) sebelum berenang
      swimOffset: -0.92, // kaki di bawah permukaan saat berenang
      swimSpeed: 4.3,
      swimRunSpeed: 7.2,
      swimAccel: 24,
      swimClimb: 1.55    // tinggi dek rendah yang bisa dinaiki dari air
    },

    CAMERA: {
      fov: 60,
      near: 0.1,
      far: 6000,         // Fase 5: dunia jauh lebih luas
      distance: 9,
      minDistance: 4.5,
      maxDistance: 16,
      minPitch: -0.4,
      maxPitch: 1.25,
      height: 1.7,       // titik fokus di atas pemain (tinggi dada)
      smooth: 12,
      mouseSens: 0.0022
    },

    FOG: { density: 0.00035 }, // FogExp2 — kabut atmosferik (Fase 5: jarak pandang ±2 km)

    WATER: {
      level: 0,
      size: 3600,        // mesh air beriak di sekitar pulau (busa + ombak)
      segments: 128,     // resolusi mesh air beriak
      oceanSize: 60000,  // samudra luar (datar, sangat jauh, tertutup kabut)
      oceanSegments: 12
    },

    /* Fase 5: perahu & pelabuhan */
    BOAT: {
      accel: 6.5,
      brake: 10,
      maxSpeed: 15,
      maxReverse: 4,
      turnRate: 1.05,    // rad/dtk pada kecepatan jelajah (kemudi butuh laju)
      minDepth: -0.55,   // dasar laut minimum agar perahu tidak kandas di pasir
      boardRange: 3.6    // jarak E untuk menaiki perahu
    }
  };

  global.CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
