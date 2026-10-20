/* Tekstur prosedural (Tahap G2) — digambar lewat canvas, tanpa berkas aset.
   Semua tekstur adalah "pengali" hampir-putih (0.75..1.0) sehingga warna
   vertex/instance tetap menjadi warna utama — hanya detail permukaan yang
   bertambah. Aman di Node: tanpa document, get() mengembalikan null. */
(function (global) {
  'use strict';
  var U = global.Utils;

  var hasCanvas = typeof document !== 'undefined' && !!document.createElement;
  var cache = {};
  var aniso = 1;

  function allow() { return hasCanvas; }

  /* Fbm mulus yang bisa di-tile: blend 4 sampel di tepi (bilinear wrap). */
  function makeTileFbm(seed, scale, octaves) {
    var fbm = U.makeFbm(U.createNoise2D(seed), octaves || 2);
    return function (u, v, size) {
      var a = fbm(u / scale, v / scale);
      var b = fbm((u - size) / scale, v / scale);
      var c = fbm(u / scale, (v - size) / scale);
      var d = fbm((u - size) / scale, (v - size) / scale);
      var wx = u / size, wy = v / size;
      return U.lerp(U.lerp(a, b, wx), U.lerp(c, d, wx), wy); // -1..1
    };
  }

  function drawGray(size, fn) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(size, size);
    var d = img.data;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var v = U.clamp(fn(x, y, size), 0, 1);
        var i = (y * size + x) * 4;
        var c = (v * 255) | 0;
        d[i] = c; d[i + 1] = c; d[i + 2] = c; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { cv: cv, ctx: ctx };
  }

  /* Normal map dari fungsi tinggi (Sobel dengan wrap — tetap tile-able). */
  function drawNormal(size, heightFn, strength) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(size, size);
    var d = img.data;
    var h = new Float32Array(size * size);
    var x, y;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) h[y * size + x] = heightFn(x, y, size);
    var at = function (xx, yy) {
      xx = (xx + size) % size; yy = (yy + size) % size;
      return h[yy * size + xx];
    };
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        var dx = (at(x + 1, y) - at(x - 1, y)) * strength;
        var dy = (at(x, y + 1) - at(x, y - 1)) * strength;
        var inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
        var i = (y * size + x) * 4;
        d[i] = ((dx * inv) * 0.5 + 0.5) * 255;
        d[i + 1] = ((dy * inv) * 0.5 + 0.5) * 255;
        d[i + 2] = (inv * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { cv: cv, ctx: ctx };
  }

  function makeTexture(cv, srgb) {
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    if (srgb && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* ---------- Generator ---------- */
  var GEN = {
    // Detail tanah: bercak lembut + bintik-bintik halus (repeat besar)
    ground: function () {
      var n = makeTileFbm(101, 34, 2), n2 = makeTileFbm(102, 9, 1);
      return drawGray(256, function (x, y, s) {
        return 0.88 + n(x, y, s) * 0.07 + n2(x, y, s) * 0.05;
      });
    },
    // Tanah: bercak lempung/gambut + kerikil halus (dipakai terrain)
    soil: function () {
      var n = makeTileFbm(103, 28, 2), n2 = makeTileFbm(104, 8, 2), n3 = makeTileFbm(105, 3, 1);
      return drawGray(256, function (x, y, s) {
        var base = 0.90 + n(x, y, s) * 0.10 + n2(x, y, s) * 0.06;
        var pit = n3(x, y, s) < -0.42 ? -0.08 : 0; // kerikil / lubang kecil
        return base + pit;
      });
    },
    // Gambut/rumput kering untuk alun-alun & jalur
    dirt: function () {
      var n = makeTileFbm(111, 26, 2), n2 = makeTileFbm(112, 7, 1);
      return drawGray(256, function (x, y, s) {
        return 0.86 + n(x, y, s) * 0.09 + n2(x, y, s) * 0.05;
      });
    },
    // Kulit kayu: serat vertikal
    bark: function () {
      var n = makeTileFbm(121, 40, 2);
      return drawGray(128, function (x, y, s) {
        return 0.84 + n(x * 0.35, y, s) * 0.10 + n(x, y * 2.6, s) * 0.06;
      });
    },
    // Kayu papan (tiang, pintu, pagar) — serat lebih halus & terang
    wood: function () {
      var n = makeTileFbm(131, 46, 2);
      return drawGray(128, function (x, y, s) {
        return 0.90 + n(x * 0.3, y, s) * 0.06 + n(x, y * 3, s) * 0.04;
      });
    },
    // Papan lantai/dinding: garis sambung horizontal tiap 32 px
    plank: function () {
      var n = makeTileFbm(141, 30, 2);
      var cv = drawGray(128, function (x, y, s) {
        return 0.92 + n(x * 0.4, y, s) * 0.05 + n(x, y * 2.2, s) * 0.03;
      });
      var ctx = cv.ctx;
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      for (var yy = 0; yy < 128; yy += 32) ctx.fillRect(0, yy, 128, 2);
      // serat pendek antar papan
      ctx.strokeStyle = 'rgba(0,0,0,0.13)';
      ctx.lineWidth = 1;
      for (var k = 0; k < 26; k++) {
        var y0 = 6 + ((k * 37) % 116), x0 = (k * 53) % 128;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 26, y0 + 1); ctx.stroke();
      }
      return cv;
    },
    // Plester kapur rumah abad pertengahan: bercak halus, retak tipis.
    plaster: function () {
      var n = makeTileFbm(153, 26, 2), n2 = makeTileFbm(154, 6, 1);
      var cv = drawGray(128, function (x, y, s) {
        return 0.94 + n(x, y, s) * 0.045 + n2(x * 0.7, y * 1.3, s) * 0.025;
      });
      var ctx = cv.ctx;
      ctx.strokeStyle = 'rgba(48,40,32,0.16)';
      ctx.lineWidth = 1;
      for (var k = 0; k < 7; k++) {
        var x0 = (k * 41 + 9) % 118, y0 = (k * 29 + 17) % 112;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + 9 + (k % 3) * 5, y0 + 7);
        ctx.lineTo(x0 + 17 + (k % 4) * 4, y0 + 4);
        ctx.stroke();
      }
      return cv;
    },
    // Batu bata/balok abu-abu: garis mortar horizontal & sambung vertikal.
    stoneBrick: function () {
      var n = makeTileFbm(155, 20, 2), n2 = makeTileFbm(156, 5, 1);
      var cv = drawGray(128, function (x, y, s) {
        return 0.83 + n(x, y, s) * 0.11 + n2(x, y, s) * 0.045;
      });
      var ctx = cv.ctx;
      ctx.strokeStyle = 'rgba(28,26,24,0.34)';
      ctx.lineWidth = 1.5;
      for (var yy = 0; yy <= 128; yy += 16) {
        ctx.beginPath(); ctx.moveTo(0, yy + 0.5); ctx.lineTo(128, yy + 0.5); ctx.stroke();
        if (yy >= 128) break;
        var off = ((yy / 16) % 2) ? 16 : 0;
        for (var xx = off; xx <= 128; xx += 32) {
          ctx.beginPath(); ctx.moveTo(xx + 0.5, yy); ctx.lineTo(xx + 0.5, yy + 16); ctx.stroke();
        }
      }
      return cv;
    },
    // Jalan batu bulat (cobblestone): kerikil besar dengan nat gelap.
    cobble: function () {
      var n = makeTileFbm(157, 16, 2);
      var cv = drawGray(128, function (x, y, s) {
        return 0.80 + n(x, y, s) * 0.09;
      });
      var ctx = cv.ctx;
      var cells = [
        [8, 10, 13], [34, 7, 10], [57, 12, 14], [87, 6, 11], [112, 13, 12],
        [6, 40, 11], [29, 35, 14], [57, 42, 9], [81, 34, 13], [111, 40, 15],
        [10, 71, 13], [38, 68, 10], [64, 74, 14], [96, 66, 10], [119, 76, 11],
        [4, 104, 10], [28, 101, 13], [55, 108, 11], [85, 100, 14], [113, 109, 10]
      ];
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        ctx.fillStyle = 'rgba(30,28,26,0.20)';
        ctx.beginPath(); ctx.ellipse(c[0] + 1.5, c[1] + 2, c[2] * 0.9, c[2] * 0.64, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(20,19,18,0.48)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(c[0], c[1], c[2] * 0.92, c[2] * 0.66, 0.4, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath(); ctx.ellipse(c[0] - 1, c[1] - 1, c[2] * 0.68, c[2] * 0.42, 0.4, 0, Math.PI * 2); ctx.fill();
      }
      return cv;
    },
    // Sirap atap: baris genting kayu/batu tumpang tindih.
    shingle: function () {
      var n = makeTileFbm(158, 24, 2), n2 = makeTileFbm(159, 5, 1);
      var cv = drawGray(128, function (x, y, s) {
        return 0.82 + n(x, y, s) * 0.08 + n2(x, y, s) * 0.055;
      });
      var ctx = cv.ctx;
      for (var row = 0; row < 8; row++) {
        var yy = row * 16;
        ctx.fillStyle = 'rgba(20,18,16,0.28)';
        ctx.fillRect(0, yy + 14, 128, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.055)';
        ctx.fillRect(0, yy + 1, 128, 1);
        var off = (row % 2) ? 12 : 0;
        ctx.strokeStyle = 'rgba(24,21,18,0.24)';
        ctx.lineWidth = 1;
        for (var xx = off; xx < 128; xx += 24) {
          ctx.beginPath(); ctx.moveTo(xx + 0.5, yy + 1); ctx.lineTo(xx + 0.5, yy + 16); ctx.stroke();
        }
      }
      return cv;
    },
    // Ijuk atap: serat miring panjang + lapisan
    thatch: function () {
      var n = makeTileFbm(151, 22, 2), n2 = makeTileFbm(152, 5, 1);
      var cv = drawGray(128, function (x, y, s) {
        var d = n(x * 0.32 + y * 0.32, y * 1.9, s); // serat ~45 derajat
        return 0.84 + d * 0.09 + n2(x, y, s) * 0.07;
      });
      var ctx = cv.ctx;
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (var yy = 0; yy < 128; yy += 16) ctx.fillRect(0, yy, 128, 1);
      return cv;
    },
    // Kain: tenunan kotak halus
    cloth: function () {
      var n = makeTileFbm(161, 16, 1);
      var cv = drawGray(64, function (x, y, s) {
        var weave = ((x % 4 < 2) === (y % 4 < 2)) ? 0 : -0.045;
        return 0.965 + n(x, y, s) * 0.035 + weave;
      });
      return cv;
    },
    // Kulit (sepatu, tali, ikat pinggang)
    leather: function () {
      var n = makeTileFbm(171, 12, 2), n2 = makeTileFbm(172, 4, 1);
      return drawGray(64, function (x, y, s) {
        return 0.90 + n(x, y, s) * 0.06 + n2(x, y, s) * 0.04;
      });
    },
    // Logam terasah (bilah pedang)
    metal: function () {
      var n = makeTileFbm(181, 30, 2);
      return drawGray(64, function (x, y, s) {
        return 0.93 + n(x * 1.6, y * 0.22, s) * 0.05 + n(x, y, s) * 0.02;
      });
    },
    // Bulu kasar (babi hutan)
    fur: function () {
      var n = makeTileFbm(191, 5, 2);
      return drawGray(128, function (x, y, s) {
        return 0.80 + n(x * 0.55, y * 2.4, s) * 0.13 + n(x, y, s) * 0.07;
      });
    },
    // Daun: bercak gelap-terang
    leaf: function () {
      var n = makeTileFbm(201, 20, 2), n2 = makeTileFbm(202, 5, 2);
      return drawGray(128, function (x, y, s) {
        return 0.86 + n(x, y, s) * 0.09 + n2(x, y, s) * 0.05;
      });
    },
    // Batu: bercak + retakan
    rock: function () {
      var n = makeTileFbm(211, 18, 2), n2 = makeTileFbm(212, 5, 1);
      var cv = drawGray(128, function (x, y, s) {
        return 0.85 + n(x, y, s) * 0.09 + n2(x, y, s) * 0.06;
      });
      var ctx = cv.ctx;
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1;
      for (var k = 0; k < 8; k++) {
        var x0 = (k * 47) % 128, y0 = (k * 71) % 128;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + 14 + (k % 3) * 9, y0 + 5 - (k % 4) * 3);
        ctx.lineTo(x0 + 26 + (k % 5) * 4, y0 + 12 + (k % 2) * 5);
        ctx.stroke();
      }
      return cv;
    },
    // Lendir slime: dasar lembut + gelembung
    gel: function () {
      var n = makeTileFbm(221, 14, 2);
      var cv = drawGray(64, function (x, y, s) {
        return 0.94 + n(x, y, s) * 0.05;
      });
      var ctx = cv.ctx;
      for (var k = 0; k < 7; k++) {
        var x0 = (k * 31) % 60 + 2, y0 = (k * 43) % 60 + 2, r = 3 + (k % 3) * 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(x0, y0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath(); ctx.arc(x0 - 1, y0 - 1, r * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      return cv;
    }
  };

  /* Normal map air: riak silang dari gelombang sinus + noise. */
  function waterNormalTexture() {
    var n = makeTileFbm(231, 9, 2);
    var cv = drawNormal(256, function (x, y, s) {
      var u = x / s * Math.PI * 2, v = y / s * Math.PI * 2;
      return Math.sin(u * 3 + v) * 0.5 + Math.sin(v * 4 - u * 2) * 0.4 +
             Math.sin((u + v) * 5) * 0.25 + n(x, y, s) * 0.5;
    }, 3.2);
    return cv;
  }

  /* Normal map tanah: gumpalan lembut + serpihan kerikil. */
  function soilNormalTexture() {
    var n = makeTileFbm(241, 12, 2), n2 = makeTileFbm(242, 3, 1);
    return drawNormal(256, function (x, y, s) {
      return n(x, y, s) * 0.72 + n2(x, y, s) * 0.28;
    }, 2.4);
  }

  /* ---------- API ---------- */
  function get(name) {
    if (!allow()) return null;
    if (cache[name]) return cache[name];
    var cv = null;
    if (name === 'waterNormal') cv = waterNormalTexture();
    else if (name === 'soilNormal') cv = soilNormalTexture();
    else if (GEN[name]) cv = GEN[name]();
    if (!cv) return null;
    cache[name] = makeTexture(cv.cv);
    return cache[name];
  }

  /* Pasang tekstur ke material dengan skala ulang tertentu (klon per-material). */
  function apply(mat, name, rx, ry) {
    if (!allow() || !mat) return mat;
    var t = get(name);
    if (!t) return mat;
    var map = t.clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(rx || 1, (ry === undefined) ? (rx || 1) : ry);
    map.anisotropy = aniso;
    mat.map = map;
    mat.needsUpdate = true;
    return mat;
  }

  function setAnisotropy(max) {
    aniso = Math.max(1, Math.min(max || 1, 8));
    for (var k in cache) {
      if (cache[k]) cache[k].anisotropy = aniso;
    }
  }

  /* Pasang normal map ke material (klon per-material). scale = kekuatan relief. */
  function applyNormal(mat, name, rx, ry, scale) {
    if (!allow() || !mat) return mat;
    var t = get(name);
    if (!t) return mat;
    var map = t.clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(rx || 1, (ry === undefined) ? (rx || 1) : ry);
    map.anisotropy = aniso;
    mat.normalMap = map;
    if (scale !== undefined) mat.normalScale = new THREE.Vector2(scale, scale);
    mat.needsUpdate = true;
    return mat;
  }

  global.TexLib = {
    get: get,
    apply: apply,
    applyNormal: applyNormal,
    setAnisotropy: setAnisotropy,
    hasCanvas: allow
  };
})(typeof window !== 'undefined' ? window : globalThis);
