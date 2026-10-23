/* Dunia (low-poly): terrain warna prosedural, laut, langit, vegetasi/batu, tabrakan.
   Menyusut-aman untuk Node (tanpa document/fetch) — dipakai tools/test-build.js */
(function (global) {
  'use strict';
  var U = global.Utils;
  var C = global.CONFIG;

  // Warna sRGB -> linear (akurat dengan tone mapping + output sRGB)
  function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  /* ---------- Alur sungai panjang ----------
     Koordinat dasar (dikali S seperti bentuk pulau lain). Sungai mengalir dari
     dataran tinggi utara, melewati lembah di antara kerajaan dan kekaisaran,
     lalu bermuara di pantai selatan. Karena dipotong langsung ke fungsi
     ketinggian, terrain, peta kecil, penempatan desa, jalan, dan vegetasi
     otomatis menghormati alurnya. */
  var RIVER_BASE = [
    { x: 55, z: -305 },
    { x: 42, z: -235 },
    { x: 12, z: -150 },
    { x: -36, z: -62 },
    { x: -66, z: 32 },
    { x: -58, z: 122 },
    { x: -20, z: 212 },
    { x: 14, z: 300 },
    { x: 40, z: 390 }
  ];

  /* ---------- Generator ketinggian pulau (murni matematika, tanpa THREE) ----------
     Fase 5: dunia diperbesar seragam S× (S = size/baseSize). Semua bentuk dihitung
     pada koordinat lama (baseSize) lalu dikalikan S — medan tetap identik bentuknya,
     hanya lebih besar. Ditambah 8–12 pulau kecil di lautan sekitar. */
  function createHeightFunction() {
    var seed = C.WORLD.seed;
    var S = (C.WORLD.size / (C.WORLD.baseSize || C.WORLD.size)) || 1;
    var baseHalf = (C.WORLD.baseSize || C.WORLD.size) / 2;
    var half = C.WORLD.size / 2;
    var fbmCoast = U.makeFbm(U.createNoise2D(seed + 11), 3);
    var fbmLand = U.makeFbm(U.createNoise2D(seed + 22), 4);
    var fbmHill = U.makeFbm(U.createNoise2D(seed + 33), 4);
    var fbmRidge = U.makeRidged(U.createNoise2D(seed + 44), 4);
    var fbmSea = U.makeFbm(U.createNoise2D(seed + 55), 4);
    var fbmColor = U.makeFbm(U.createNoise2D(seed + 66), 3);
    var fbmDetail = U.makeFbm(U.createNoise2D(seed + 77), 3);

    // --- Alur sungai panjang (koordinat dunia) ---
    // Alur dihaluskan (Chaikin 2×) SEBELUM dipakai galian & pita air, supaya
    // keduanya persis sama dan air tidak terpotong-potong di tikungan.
    var riverPts = [];
    for (var ri = 0; ri < RIVER_BASE.length; ri++) {
      riverPts.push({ x: RIVER_BASE[ri].x * S, z: RIVER_BASE[ri].z * S });
    }
    for (var rsmooth = 0; rsmooth < 2; rsmooth++) {
      var rsm = [riverPts[0]];
      for (var rsi = 0; rsi < riverPts.length - 1; rsi++) {
        var rs0 = riverPts[rsi], rs1 = riverPts[rsi + 1];
        rsm.push({ x: rs0.x * 0.75 + rs1.x * 0.25, z: rs0.z * 0.75 + rs1.z * 0.25 });
        rsm.push({ x: rs0.x * 0.25 + rs1.x * 0.75, z: rs0.z * 0.25 + rs1.z * 0.75 });
      }
      rsm.push(riverPts[riverPts.length - 1]);
      riverPts = rsm;
    }
    var riverMinX = Infinity, riverMaxX = -Infinity, riverMinZ = Infinity, riverMaxZ = -Infinity;
    for (var rbi = 0; rbi < riverPts.length; rbi++) {
      var rbp = riverPts[rbi];
      if (rbp.x < riverMinX) riverMinX = rbp.x;
      if (rbp.x > riverMaxX) riverMaxX = rbp.x;
      if (rbp.z < riverMinZ) riverMinZ = rbp.z;
      if (rbp.z > riverMaxZ) riverMaxZ = rbp.z;
    }
    var RIVER_PAD = 96; // jarak maksimum pengaruh lembah sungai (m)

    // Jarak titik ke poligon sungai (m). Tolak cepat di luar kotak pembatas.
    function riverDistance(x, z) {
      if (x < riverMinX - RIVER_PAD || x > riverMaxX + RIVER_PAD ||
          z < riverMinZ - RIVER_PAD || z > riverMaxZ + RIVER_PAD) return 1e9;
      var best = 1e9;
      for (var i = 0; i < riverPts.length - 1; i++) {
        var ax = riverPts[i].x, az = riverPts[i].z;
        var bx = riverPts[i + 1].x, bz = riverPts[i + 1].z;
        var vx = bx - ax, vz = bz - az;
        var wx = x - ax, wz = z - az;
        var L2 = vx * vx + vz * vz;
        var t = L2 > 0 ? U.clamp((wx * vx + wz * vz) / L2, 0, 1) : 0;
        var px = ax + vx * t, pz = az + vz * t;
        var dx = x - px, dz = z - pz;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < best) best = d;
      }
      return best;
    }

    // Bentuk besar pulau utama (koordinat dunia lama → dikali S)
    function main(x, z) {
      var u = x / S, v = z / S;
      var r = Math.sqrt(u * u + v * v) / baseHalf;
      var ang = Math.atan2(v, u);
      var wobble = Math.sin(ang * 3) * 0.05 + Math.sin(ang * 7 + 1.7) * 0.03;
      var coast = 0.66 + wobble + fbmCoast(u * 0.004, v * 0.004) * 0.10;
      var mask = 1 - U.smoothstep(coast - 0.20, coast + 0.04, r);

      var land = fbmLand(u * 0.0055, v * 0.0055);
      var hills = fbmHill(u * 0.018, v * 0.018);
      var h = (land * 24 + hills * 7 + 15) * mask - 3.0;

      var center = 1 - U.smoothstep(0.12, 0.66, r);
      // Hanya punggung bukit terkuat yang menjadi pegunungan — jadi jumlah
      // gunung jauh lebih sedikit, sementara pulau tetap punya beberapa puncak.
      var ridge = Math.max(0, fbmRidge(u * 0.0075 + 7.3, v * 0.0075 + 2.1));
      var massif = U.smoothstep(0.34, 0.72, ridge);
      h += (14 + massif * 50) * center * center;

      var sea = 1 - mask;
      h -= sea * (9 + 7 * (fbmSea(u * 0.004 + 40, v * 0.004 + 40) * 0.5 + 0.5));
      return h * S;
    }

    /* --- Pulau-pulau kecil di lautan sekitar --- */
    var islands = [];
    (function () {
      var count = Math.max(0, (C.WORLD.islands != null ? C.WORLD.islands : 10) | 0);
      var rng = U.mulberry32(seed + 88);
      for (var i = 0; i < count; i++) {
        var ang = (i + 0.5) * (Math.PI * 2 / count) + (rng() - 0.5) * 0.34;
        var dx = Math.cos(ang), dz = Math.sin(ang);
        var R = 62 + rng() * 116;            // radius daratan (m)
        var H = 9 + rng() * 13;              // puncak (m)
        // Pantai pulau utama pada sudut ini → jaga jarak aman dari daratan utama.
        var coastR = 0;
        for (var t = 520; t <= half * 0.99; t += 12) {
          if (main(dx * t, dz * t) > 0.6) coastR = t;
        }
        var cx = Math.max(coastR + R + 72, 1180);
        var maxC = half - R - 60;
        if (cx > maxC) {
          // Ruang kurang: kecilkan pulau agar tetap di dalam dunia.
          var room = half - 60 - coastR - 72;
          if (room < 55) { continue; } // tak ada ruang di sudut ini
          if (R > room) R = room;
          cx = coastR + R + 72;
        }
        islands.push({ x: dx * cx, z: dz * cx, r: R, h: H, ang: ang });
      }
    })();

    function islandValue(x, z) {
      var best = -1e9;
      for (var i = 0; i < islands.length; i++) {
        var is = islands[i];
        var dx = x - is.x, dz = z - is.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d > is.r * 1.3) continue;
        // Tepi tidak bulat sempurna — sedikit bergelombang.
        var wob = 1 + 0.17 * fbmDetail(dx * 0.014 + i * 13.7, dz * 0.014 - i * 8.1);
        var f = 1 - U.smoothstep(is.r * 0.40, is.r * wob, d);
        var h = -34 + (is.h + 34) * f;
        if (f > 0.02) h += fbmHill(dx * 0.03 + i * 21, dz * 0.03 - i * 9) * 2.4 * f;
        if (h > best) best = h;
      }
      return best;
    }

    // Bentuk besar akhir = pulau utama atau pulau kecil, mana yang lebih tinggi.
    function macro(x, z) {
      var m = main(x, z);
      var iv = islandValue(x, z);
      return iv > m ? iv : m;
    }

    // Ketinggian dasar (sebelum sungai): bentuk besar + kerutan halus daratan.
    function baseFull(x, z) {
      var m = macro(x, z);
      m += fbmDetail(x * (0.058 / S), z * (0.058 / S)) * 0.42 * S * U.smoothstep(-S, 1.5 * S, m);
      return m;
    }

    /* --- Isi danau pedalaman ---
       Cekungan tertutup di tengah pulau (air yang tidak tersambung ke laut)
       dinaikkan menjadi daratan rendah. Dengan begitu satu-satunya air tawar
       adalah sungai panjang, dan jalan tidak perlu jembatan raksasa. */
    var lakeFills = [];
    (function findLakes() {
      var step = 20;
      var half = C.WORLD.size / 2;
      var W = Math.ceil(C.WORLD.size / step) + 1;
      var H = W;
      var water = new Uint8Array(W * H);
      var ocean = new Uint8Array(W * H);
      var hh = new Float32Array(W * H);
      var i, j, id;
      for (j = 0; j < H; j++) {
        for (i = 0; i < W; i++) {
          var x = -half + i * step, z = -half + j * step;
          var h = baseFull(x, z);
          hh[j * W + i] = h;
          if (h < -0.05) water[j * W + i] = 1;
        }
      }
      // Banjiri dari tepi peta: semua air yang tersambung laut ditandai.
      var stack = [];
      function seed(id2) {
        if (!ocean[id2] && water[id2]) { ocean[id2] = 1; stack.push(id2); }
      }
      for (i = 0; i < W; i++) { seed(i); seed((H - 1) * W + i); }
      for (j = 0; j < H; j++) { seed(j * W); seed(j * W + W - 1); }
      while (stack.length) {
        id = stack.pop();
        var ix = id % W, iz = (id / W) | 0;
        if (ix > 0) seed(id - 1);
        if (ix < W - 1) seed(id + 1);
        if (iz > 0) seed(id - W);
        if (iz < H - 1) seed(id + W);
      }
      // Komponen air yang tidak tersambung laut = danau → kumpulkan disk.
      var seen = new Uint8Array(W * H);
      for (j = 0; j < H; j++) {
        for (i = 0; i < W; i++) {
          id = j * W + i;
          if (!water[id] || ocean[id] || seen[id]) continue;
          var comp = [id]; seen[id] = 1;
          var sumX = 0, sumZ = 0, n = 0;
          for (var ci = 0; ci < comp.length; ci++) {
            var cid = comp[ci];
            var cix = cid % W, ciz = (cid / W) | 0;
            sumX += cix; sumZ += ciz; n++;
            for (var k = 0; k < 4; k++) {
              var nx = cix + (k === 0 ? -1 : k === 1 ? 1 : 0);
              var nz = ciz + (k === 2 ? -1 : k === 3 ? 1 : 0);
              if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
              var nid = nz * W + nx;
              if (!water[nid] || ocean[nid] || seen[nid]) continue;
              seen[nid] = 1;
              comp.push(nid);
            }
          }
          if (n < 3) continue;
          var mx = sumX / n, mz = sumZ / n;
          var maxD = 0;
          for (var cj = 0; cj < comp.length; cj++) {
            var c2 = comp[cj];
            var dx2 = (c2 % W) - mx, dz2 = ((c2 / W) | 0) - mz;
            var dd = Math.sqrt(dx2 * dx2 + dz2 * dz2);
            if (dd > maxD) maxD = dd;
          }
          lakeFills.push({
            x: -half + mx * step,
            z: -half + mz * step,
            r: maxD * step + 4
          });
        }
      }
    })();

    // Ketinggian akhir = bentuk besar + kerutan halus permukaan daratan
    function full(x, z) {
      var m = baseFull(x, z);
      // Isi danau tertutup (bertahap di tepian agar tidak berupa tebing).
      for (var lf = 0; lf < lakeFills.length; lf++) {
        var L = lakeFills[lf];
        var ldx = x - L.x, ldz = z - L.z;
        var lr = L.r + 16;
        if (ldx * ldx + ldz * ldz > lr * lr) continue;
        var lt = 1 - U.smoothstep(L.r * 0.55, lr, Math.sqrt(ldx * ldx + ldz * ldz));
        if (lt > 0) m = m * (1 - lt) + Math.max(m, 2.0) * lt;
      }
      // Lembah sungai lebar: dataran rendah bergelombang di kiri-kanan air,
      // lalu channel sempit yang dipotong sampai di bawah permukaan laut.
      var rd = riverDistance(x, z);
      if (rd < 230) {
        var valley = 1 - U.smoothstep(20, 230, rd);
        if (valley > 0) {
          var target = Math.max(3.5, m * 0.10);
          m = m * (1 - valley * 0.92) + target * (valley * 0.92);
        }
        var bed = 1 - U.smoothstep(8, 24, rd);
        if (bed > 0) m = m * (1 - bed) - 3.3 * bed;
      }
      return m;
    }

    full.macro = macro;
    full.fbmColor = fbmColor;
    full.islands = islands;
    full.scale = S;
    full.river = riverPts;
    full.riverDistance = riverDistance;
    full.lakeFills = lakeFills;
    return full;
  }

  /* Titik awal pemain: daratan pertama saat mencari dari tepi ke pusat (dekat pantai).
     Pulau-pulau kecil diabaikan agar pemain selalu mulai di pulau utama. */
  function nearIsland(heightFn, x, z) {
    var isls = heightFn.islands;
    if (!isls) return false;
    for (var i = 0; i < isls.length; i++) {
      var dx = x - isls[i].x, dz = z - isls[i].z;
      var rr = isls[i].r * 1.5;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  function findSpawnPoint(heightFn) {
    var S = heightFn.scale || (C.WORLD.size / (C.WORLD.baseSize || C.WORLD.size)) || 1;
    for (var r = C.WORLD.size * 0.45; r > 30 * S; r -= 2 * S) {
      if (nearIsland(heightFn, r, 0)) continue;
      if (heightFn(r, 0) > 2 * S && heightFn(r + 8 * S, 0) < 3.5 * S) {
        return { x: r, y: heightFn(r, 0), z: 0 };
      }
    }
    for (var r2 = 30 * S; r2 < C.WORLD.size * 0.45; r2 += 2 * S) {
      if (nearIsland(heightFn, r2, 0)) continue;
      if (heightFn(r2, 0) > 2 * S) {
        return { x: r2, y: heightFn(r2, 0), z: 0 };
      }
    }
    return { x: 0, y: Math.max(2 * S, heightFn(0, 0)), z: 0 };
  }

  /* ---------- Palet warna terrain (prosedural) ---------- */
  var COLORS = null;
  function getColors() {
    if (!COLORS) {
      COLORS = {
        sand: srgb(0xBFB08A),
        sandWet: srgb(0x948B68),
        seabed: srgb(0x586B59),
        grassBase: srgb(0x526B3C),
        grassLight: srgb(0x738B52),
        grassDark: srgb(0x354A2C),
        grassDry: srgb(0x8C8254),
        dirt: srgb(0x705B43),
        rock: srgb(0x73756F),
        rockDark: srgb(0x4B4D4A),
        snow: srgb(0xD7DCD8),
        moss: srgb(0x4C6641)
      };
    }
    return COLORS;
  }

  /* ---------- Objek World ---------- */
  /* ---------- Geometri vegetasi (low-poly, bentuk organik) ---------- */
  // Bola dedaunan berbentuk gumpalan tidak beraturan (bukan bola sempurna).
  function makeLeafBlobGeometry() {
    var geo = new THREE.IcosahedronGeometry(1, 1);
    var pos = geo.attributes.position;
    var v = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var n = 1
        + 0.15 * Math.sin(v.x * 3.1 + v.y * 2.3 + 1.2)
        + 0.09 * Math.sin(v.y * 5.7 - v.z * 3.9 + 2.4)
        + 0.06 * Math.cos(v.x * 7.1 + v.z * 5.3 + 0.7);
      v.multiplyScalar(n);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Pelepah kelapa: pita melengkung ke bawah dengan tepi bergerigi (anak daun).
  function makePalmFrondGeometry() {
    var SEG = 8;
    var verts = [], uvs = [];
    var L = 1, W = 0.235, DROOP = 0.5;
    function push(x, y, z, u, v) { verts.push(x, y, z); uvs.push(u, v); }
    var prev = null;
    for (var i = 0; i <= SEG; i++) {
      var t = i / SEG;
      var z = t * L;
      var y = -DROOP * t * t;
      var w = W * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.08)), 0.62);
      if (i % 2 === 1) w *= 0.58; // gerigi anak daun
      var edgeY = y - w * 0.8;
      var cur = {
        l: [-w, edgeY, z - w * 0.55],
        r: [w, edgeY, z - w * 0.55],
        c: [0, y, z]
      };
      if (prev) {
        var v0 = (i - 1) / SEG, v1 = i / SEG;
        // sisi kiri
        push(prev.l[0], prev.l[1], prev.l[2], 0, v0);
        push(prev.c[0], prev.c[1], prev.c[2], 0.5, v0);
        push(cur.c[0], cur.c[1], cur.c[2], 0.5, v1);
        push(prev.l[0], prev.l[1], prev.l[2], 0, v0);
        push(cur.c[0], cur.c[1], cur.c[2], 0.5, v1);
        push(cur.l[0], cur.l[1], cur.l[2], 0, v1);
        // sisi kanan
        push(prev.c[0], prev.c[1], prev.c[2], 0.5, v0);
        push(prev.r[0], prev.r[1], prev.r[2], 1, v0);
        push(cur.r[0], cur.r[1], cur.r[2], 1, v1);
        push(prev.c[0], prev.c[1], prev.c[2], 0.5, v0);
        push(cur.r[0], cur.r[1], cur.r[2], 1, v1);
        push(cur.c[0], cur.c[1], cur.c[2], 0.5, v1);
      }
      prev = cur;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  // Batang kelapa melengkung (local +X); dipakai bersama semua instance.
  var PALM_BEND = 11;
  function makePalmTrunkGeometry() {
    var geo = new THREE.CylinderGeometry(0.6, 1, 1, 7, 10);
    geo.translate(0, 0.5, 0);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i);
      pos.setX(i, pos.getX(i) + PALM_BEND * Math.pow(y, 1.85));
    }
    geo.computeVertexNormals();
    return geo;
  }

  function World(scene, options) {
    options = options || {};
    this.scene = scene;
    this._renderer = options.renderer || null;
    this.height = createHeightFunction();
    this.scale = this.height.scale || (C.WORLD.size / (C.WORLD.baseSize || C.WORLD.size)) || 1;
    this.islands = (this.height.islands || []).slice(); // pulau-pulau kecil (Fase 5)
    this.timeOfDay = C.DAY.startTime;
    this.elapsed = 0;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.fogColor = new THREE.Color(0xB8C3BE).convertSRGBToLinear();
    this.colliders = [];   // { x, z, r } untuk tabrakan pemain
    this.platforms = [];   // { x, z, hw, hd, cos, sin, top } lantai yang bisa dipijak (rumah panggung)
    this.walls = [];       // { x1, z1, x2, z2, r } segmen dinding rumah (tabrakan, tahan terhadap fps rendah)
    this.terrain = null;
    this.water = null;
    this.sky = null;       // WorldSky (js/sky.js)
    this.clouds = null;
    this.sunGlow = null;
    this.envMeshes = [];
    this.envCounts = { trees: 0, rocks: 0, canopyParts: 0 };
    this.palms = [];       // { x, z, taken } — untuk tugas kelapa (Fase 2)
    this.rocks = [];       // daftar batu (untuk penempatan benda tugas)
    this.villageSpots = [];    // lokasi desa utama + pendukuhan (Fase 2)
    this.villageSpot = null;   // desa utama (kompatibilitas)
    this.villageCenter = null;
    this.islandSites = [];     // lokasi pondok di pulau kecil (Fase 5)
    this.harborSpot = null;    // pelabuhan di pesisir dekat desa utama (Fase 5)
    this.landmarkSites = [];   // situs bangunan batu tua (kastil, kapel, menara, batu berdiri)
    this.landmarks = [];       // grup bangunan yang sudah dibangun (dipakai peta)
    this.kingdomSite = null;   // kerajaan pusat (Fase 6)
    this.empireSite = null;    // kekaisaran agung (Fase 6)
    this.kingdomBuilt = null;
    this.empireBuilt = null;
    this.townSpots = [];       // titik NPC warga kota (kerajaan + kekaisaran)
    this.river = (this.height.river || []).slice(); // alur sungai panjang (Fase 6)
    this.roads = [];           // jaringan jalan desa–kerajaan–kekaisaran
    this.bridges = [];         // jembatan di persimpangan jalan & sungai
    this.forests = [];         // kantong hutan rimbun (titik + radius)
    this._roadGrid = null;     // indeks spasial segmen jalan (pencarian cepat)
    this._placed = [];
    this._spawn = null;
    this._tmpColor = new THREE.Color();
    this._tmpColor2 = new THREE.Color();
  }

  World.createHeightFunction = createHeightFunction;
  World.findSpawnPoint = findSpawnPoint;

  World.prototype.heightAt = function (x, z) { return this.height(x, z); };
  World.prototype.findSpawnPoint = function () { return findSpawnPoint(this.height); };

  /* --- Terrain: mesh pulau + warna vertex prosedural (low-poly) --- */
  World.prototype.buildTerrain = function () {
    var size = C.WORLD.size, seg = C.WORLD.segments;
    var geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);

    var pos = geo.attributes.position;
    var count = pos.count;
    var colors = new Float32Array(count * 3);
    var rockness = new Float32Array(count);
    var col = new THREE.Color();
    var COLORS = getColors();
    var fbmColor = this.height.fbmColor;
    var full = this.height;
    var macro = this.height.macro;
    var S = this.scale || 1;
    var E = 6 * S, R = 12 * S;

    for (var i = 0; i < count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var y = full(x, z);
      pos.setY(i, y);

      // Kemiringan dari bentuk besar saja (agar kerutan mikro tidak jadi bintik batu)
      var gx = macro(x + E, z) - macro(x - E, z);
      var gz = macro(x, z + E) - macro(x, z - E);
      var slope = U.clamp(Math.sqrt(gx * gx + gz * gz) / (2 * E) / 1.1, 0, 1);

      // Peneduhan lembut: lembah sedikit gelap, punggung bukit sedikit terang
      var avg = (macro(x + R, z) + macro(x - R, z) + macro(x, z + R) + macro(x, z - R)) * 0.25;
      var shade = 1 + U.clamp((y - avg) * (0.05 / S), -0.16, 0.09);

      // Warna prosedural penuh (low-poly)
      var rockAmt = 0;
      if (y > 0.4 * S) {
        var gm = fbmColor(x * (0.025 / S), z * (0.025 / S)) * 0.5 + 0.5;
        col.copy(COLORS.grassBase).lerp(COLORS.grassLight, gm * 0.9);

        // Bercak rumput kering dekat pantai — sempit dan lembut agar padang
        // pesisir tetap hijau zaitun, bukan gumuk pasir yang luas.
        var dry = U.smoothstep(0.70, 0.95, fbmColor(x * (0.012 / S) + 300, z * (0.012 / S) + 300) * 0.5 + 0.5) *
                  (1 - U.smoothstep(5 * S, 14 * S, y));
        col.lerp(COLORS.grassDry, dry * 0.3);

        var damp = U.smoothstep(0.58, 0.9, fbmColor(x * (0.011 / S) + 90, z * (0.011 / S) + 90) * 0.5 + 0.5);
        col.lerp(COLORS.grassDark, damp * 0.55);
        col.lerp(COLORS.moss, damp * 0.18);

        // Pasir hanya di bibir pantai; padang rumput mulai beberapa meter dari air.
        var beachT = 1 - U.smoothstep(0.8 * S, 2.2 * S, y);
        col.lerp(COLORS.sand, beachT);

        var dirtT2 = U.smoothstep(0.32, 0.58, slope) * (1 - U.smoothstep(38 * S, 50 * S, y));
        col.lerp(COLORS.dirt, dirtT2 * 0.78);

        var rockT2 = U.smoothstep(0.5, 0.78, slope);
        this._tmpColor.copy(COLORS.rock).lerp(COLORS.rockDark, gm * 0.5);
        col.lerp(this._tmpColor, rockT2);

        // Pegunungan kerajaan: batu telanjang lalu puncak bersalju tipis.
        var highRock = U.smoothstep(34 * S, 62 * S, y) * (0.55 + gm * 0.4);
        col.lerp(this._tmpColor.copy(COLORS.rock).lerp(COLORS.rockDark, gm * 0.35), highRock);
        var snowT = U.smoothstep(62 * S, 88 * S, y) * (0.72 + gm * 0.28);
        col.lerp(COLORS.snow, snowT * 0.9);

        // Seberapa kuat detail batu gunung menimpa detail tanah/rumput.
        rockAmt = U.clamp(Math.max(rockT2, highRock) * (1 - snowT * 0.85), 0, 1);
      } else {
        var depth = U.smoothstep(0.3 * S, 9 * S, -y);
        col.copy(COLORS.sandWet).lerp(COLORS.seabed, depth);
      }
      rockness[i] = rockAmt;
      col.multiplyScalar(shade);

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aRock', new THREE.BufferAttribute(rockness, 1));
    geo.computeVertexNormals();

    var mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0
    });
    if (global.TexLib) {
      global.TexLib.apply(mat, 'soil', 110, 110);                       // cadangan prosedural
      global.TexLib.applyNormal(mat, 'soilNormal', 110, 110, 0.5);      // relief tanah halus
      global.TexLib.apply(mat, 'forestGround', 110, 110);               // detail tanah hutan
      var rockDetail = global.TexLib.get('rockyGround');
      if (rockDetail) {
        // Tambahkan detail batu hanya pada lereng/gunung, tanpa mengurangi
        // warna vertex yang sudah menjadi identitas visual dunia.
        mat.onBeforeCompile = function (shader) {
          shader.uniforms.uRockMap = { value: rockDetail };
          shader.uniforms.uRockRepeat = { value: new THREE.Vector2(72, 72) };
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', [
              '#include <common>',
              'attribute float aRock;',
              'varying float vRock;'
            ].join('\n'))
            .replace('#include <begin_vertex>', [
              '#include <begin_vertex>',
              'vRock = aRock;'
            ].join('\n'));
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', [
              '#include <common>',
              'uniform sampler2D uRockMap;',
              'uniform vec2 uRockRepeat;',
              'varying float vRock;'
            ].join('\n'))
            .replace('#include <map_fragment>', [
              '#include <map_fragment>',
              'vec3 rockDetail = texture2D(uRockMap, vUv * uRockRepeat).rgb;',
              'diffuseColor.rgb *= mix(vec3(1.0), rockDetail, vRock);'
            ].join('\n'));
        };
        mat.customProgramCacheKey = function () { return 'terrain-rock-detail'; };
      }
    }

    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = 'terrain';
    this.terrain = mesh;
    this.scene.add(mesh);
    return mesh;
  };

  /* --- Laut: warna kedalaman + gelombang naik-turun + busa berdenyut.
     Fase 5: dua lapis — mesh beriak di sekitar pulau (busa + ombak) dan samudra
     luar yang datar dan jauh (tertutup kabut terhadap jangkauan pandang). --- */
  var WAVE_F1 = 0.045, WAVE_F2 = 0.052, WAVE_F3 = 0.055, WAVE_FX = 0.018;
  var WAVE_A1 = 0.14, WAVE_A2 = 0.11, WAVE_A3 = 0.06, WAVE_A0 = 0.04;

  /* Tinggi gelombang di titik (x,z) pada waktu t — cermin dari shader air. */
  World.prototype.waveHeight = function (x, z, t) {
    var S = this.scale || 1;
    var f1 = WAVE_F1 / S, f2 = WAVE_F2 / S, f3 = WAVE_F3 / S, fx = WAVE_FX / S;
    return Math.sin(x * f1 + t * 0.85) * WAVE_A1 +
           Math.sin(z * f2 - t * 0.70 + x * fx) * WAVE_A2 +
           Math.sin((x + z) * f3 + t * 1.05) * WAVE_A3 +
           Math.sin(t * 0.55) * WAVE_A0;
  };

  World.prototype.buildWater = function () {
    var w = C.WATER;
    var S = this.scale || 1;
    var geo = new THREE.PlaneGeometry(w.size, w.size, w.segments || 96, w.segments || 96);
    geo.rotateX(-Math.PI / 2);

    var pos = geo.attributes.position;
    var count = pos.count;
    var colors = new Float32Array(count * 3);
    var shore = new Float32Array(count);
    var shallow = srgb(0x5C9E9B), mid = srgb(0x2E6F8E), deep = srgb(0x123B59);
    var col = new THREE.Color();
    var full = this.height;

    for (var i = 0; i < count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var th = full(x, z);
      var depth = Math.max(0, -th);
      if (depth < 6 * S) {
        col.copy(shallow).lerp(mid, depth / (6 * S));
      } else {
        col.copy(mid).lerp(deep, U.smoothstep(0, 1, (depth - 6 * S) / (18 * S)));
      }
      // Kekuatan busa garis pantai (denyutnya diatur shader, mengikuti gelombang)
      shore[i] = Math.max(0, 1 - Math.abs(th) / (1.2 * S));

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('shore', new THREE.BufferAttribute(shore, 1));
    geo.computeVertexNormals();

    var mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.13,
      metalness: 0,
      transparent: true,
      opacity: 0.93,
      depthWrite: false
    });

    // Gelombang: vertex digeser naik-turun mengikuti waktu + busa berdenyut.
    // Normal map air memberi riak halus yang memantulkan cahaya matahari.
    var waterNormal = global.TexLib ? global.TexLib.get('waterNormal') : null;
    this.waterUniforms = { uTime: { value: 0 }, uNormalMap: { value: waterNormal } };
    var uni = this.waterUniforms;
    var f1 = (WAVE_F1 / S).toFixed(6), f2 = (WAVE_F2 / S).toFixed(6);
    var f3 = (WAVE_F3 / S).toFixed(6), fx = (WAVE_FX / S).toFixed(6);
    var foamFreq = (0.06 / S).toFixed(6);
    var nUvFreq = (0.045 / S).toFixed(6);
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uTime = uni.uTime;
      shader.uniforms.uNormalMap = uni.uNormalMap;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', [
          '#include <common>',
          'uniform float uTime;',
          'attribute float shore;',
          'varying float vShore;',
          'varying vec2 vWavePos;'
        ].join('\n'))
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'vShore = shore;',
          'vWavePos = position.xz;',
          'float waveA = sin(position.x * ' + f1 + ' + uTime * 0.85);',
          'float waveB = sin(position.z * ' + f2 + ' - uTime * 0.70 + position.x * ' + fx + ');',
          'float waveC = sin((position.x + position.z) * ' + f3 + ' + uTime * 1.05);',
          'transformed.y += waveA * ' + WAVE_A1 + ' + waveB * ' + WAVE_A2 + ' + waveC * ' + WAVE_A3 +
            ' + sin(uTime * 0.55) * ' + WAVE_A0 + ';'
        ].join('\n'));
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', [
          '#include <common>',
          'uniform float uTime;',
          waterNormal ? 'uniform sampler2D uNormalMap;' : '',
          'varying float vShore;',
          'varying vec2 vWavePos;'
        ].join('\n'))
        .replace('#include <color_fragment>', [
          '#include <color_fragment>',
          'float foamPulse = 0.60 + 0.40 * sin(uTime * 1.35 + (vWavePos.x - vWavePos.y) * ' + foamFreq + ');',
          'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.96, 0.95), clamp(vShore, 0.0, 1.0) * foamPulse * 0.75);'
        ].join('\n'));
      if (waterNormal) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', [
          '#include <normal_fragment_begin>',
          'vec2 nUv = vWavePos * ' + nUvFreq + ' + vec2(uTime * 0.016, -uTime * 0.024);',
          'vec3 nTex = texture2D(uNormalMap, nUv).xyz * 2.0 - 1.0;',
          'vec4 nWorld = vec4(nTex.x, 0.0, nTex.y, 0.0);',
          'normal = normalize(normal + (viewMatrix * nWorld).xyz * 0.55);'
        ].join('\n'));
      }
    };

    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = w.level;
    mesh.name = 'water';
    mesh.renderOrder = 5;
    this.water = mesh;
    this.waterMat = mat;
    this.scene.add(mesh);

    // Samudra luar: cincin datar luas mulai dari tepi mesh beriak. Cukup warna
    // laut dalam + kabut; material dasar (tanpa PBR/IBL) jauh lebih murah dan
    // tidak menutupi dua kali seluruh layar air di dekat pantai.
    var oGeo = new THREE.RingGeometry(w.size * 0.47, (w.oceanSize || 12000) * 0.5, 40, 1);
    oGeo.rotateX(-Math.PI / 2);
    var oMat = new THREE.MeshBasicMaterial({
      color: deep.clone(), transparent: true, opacity: 0.96, depthWrite: false, fog: true
    });
    var ocean = new THREE.Mesh(oGeo, oMat);
    ocean.position.y = w.level - 0.35; // sedikit di bawah mesh beriak agar tidak berkedip
    ocean.name = 'ocean';
    ocean.renderOrder = 4;
    this.ocean = ocean;
    this.oceanMat = oMat;
    this.scene.add(ocean);
    this.buildRiver();
    return mesh;
  };

  /* --- Sungai panjang: pita air khusus ---
     Mesh laut global hanya punya ±28 m per simpul, terlalu kasar untuk alur
     sungai selebar ±26 m (busa pantainya jadi segitiga besar). Pita sungai
     ini mengikuti alur dengan resolusi ±3 m, permukaannya sedikit di atas
     gelombang laut, dan ujungnya menyatu dengan laut di muara. */
  World.prototype.buildRiver = function () {
    var river = this.river || [];
    if (river.length < 2) return null;
    // Alur sudah dihaluskan di createHeightFunction (sama dengan galian terrain).
    var pts = river.slice();
    // Resample tiap ±3 m.
    var samples = [{ x: pts[0].x, z: pts[0].z }];
    var since = 0;
    for (var si = 1; si < pts.length; si++) {
      var a = pts[si - 1], b = pts[si];
      var dx = b.x - a.x, dz = b.z - a.z;
      var seg = Math.sqrt(dx * dx + dz * dz);
      if (seg < 1e-4) continue;
      var t0 = 0;
      var remain = seg;
      while (since + remain >= 3) {
        var need = 3 - since;
        t0 += need;
        remain -= need;
        samples.push({ x: a.x + dx * (t0 / seg), z: a.z + dz * (t0 / seg) });
        since = 0;
      }
      since += remain;
    }
    samples.push({ x: pts[pts.length - 1].x, z: pts[pts.length - 1].z });

    var n = samples.length;
    var pos = [], colArr = [], uv = [], idx = [];
    var shoreC = srgb(0x8FD3C8), deepC = srgb(0x2E6F8E);
    var totalLen = 0;
    var maxH = 18.5;
    for (var k = 0; k < n; k++) {
      var p = samples[k];
      var prev = samples[Math.max(0, k - 1)];
      var next = samples[Math.min(n - 1, k + 1)];
      var tx = next.x - prev.x, tz = next.z - prev.z;
      var tl = Math.sqrt(tx * tx + tz * tz) || 1;
      tx /= tl; tz /= tl;
      var nx = -tz, nz = tx;
      if (k > 0) totalLen += Math.hypot(p.x - samples[k - 1].x, p.z - samples[k - 1].z);
      var remaining = (n - 1 - k) * 3;
      var mouthT = U.clamp((220 - remaining) / 220, 0, 1);
      var headT = U.clamp((60 - totalLen) / 60, 0, 1);
      var taper = (1 - mouthT) * (1 - headT * 0.85);
      var hw = maxH * (0.55 + 0.45 * taper) + mouthT * 8;
      var y = 0.38 * taper + 0.02;
      // Tiga verteks: tepi kiri (busa), tengah (dalam), tepi kanan (busa).
      pos.push(p.x + nx * hw, y, p.z + nz * hw);
      pos.push(p.x, y + 0.03, p.z);
      pos.push(p.x - nx * hw, y, p.z - nz * hw);
      colArr.push(shoreC.r, shoreC.g, shoreC.b);
      colArr.push(deepC.r, deepC.g, deepC.b);
      colArr.push(shoreC.r, shoreC.g, shoreC.b);
      var v = totalLen / 8;
      uv.push(0, v, 0.5, v, 1, v);
    }
    for (var q = 0; q < n - 1; q++) {
      var a0 = q * 3, b0 = a0 + 1, c0 = a0 + 2;
      var a1 = a0 + 3, b1 = a1 + 1, c1 = a1 + 2;
      idx.push(a0, a1, b0, b0, a1, b1);
      idx.push(b0, b1, c0, c0, b1, c1);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.14, metalness: 0,
      transparent: false, depthWrite: true
    });
    if (global.TexLib) global.TexLib.applyNormal(mat, 'waterNormal', 0.05, 0.05, 0.45);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'riverWater';
    mesh.renderOrder = 6;
    this.riverMesh = mesh;
    this.riverMat = mat;
    this.riverSurfaceY = 0.38;
    this.scene.add(mesh);
    return mesh;
  };

  /* Tinggi permukaan air di titik tertentu: sungai sedikit di atas laut. */
  World.prototype.waterLevelAt = function (x, z, t) {
    if (this.height && this.height.riverDistance) {
      var d = this.height.riverDistance(x, z);
      if (d < 17 && this.riverSurfaceY) return this.riverSurfaceY;
    }
    return this.waveHeight(x, z, t || 0);
  };

  /* Pasang/lepas peta lingkungan (PMREM langit) pada material air.
     Fase 5: hanya air yang memakai IBL — material lain tetap hemat. */
  World.prototype.setWaterEnv = function (tex) {
    var t = tex || null;
    if (this._envTex === t) return;
    var had = !!this._envTex;
    this._envTex = t;
    var mats = [this.waterMat, this.oceanMat, this.riverMat];
    for (var i = 0; i < mats.length; i++) {
      if (!mats[i]) continue;
      mats[i].envMap = t;
      if (had !== !!t) mats[i].needsUpdate = true; // kompilasi ulang hanya saat IBL nyala/mati
    }
  };

  /* --- Langit & cahaya: delegasi ke WorldSky (js/sky.js) --- */
  World.prototype.buildSky = function () {
    var Sky = global.WorldSky;
    if (Sky) {
      this.sky = new Sky(this.scene, this._renderer);
      this.sky.build();
      var self = this;
      this.sky.onEnvReady = function (tex) { self.setWaterEnv(tex); };
      this.setWaterEnv(this.sky.envTexture);
      // Referensi kompatibilitas (dipakai HUD & pengujian)
      this.sunLight = this.sky.sunLight;
      this.moonLight = this.sky.moonLight;
      this.hemi = this.sky.hemi;
      this.sunMesh = this.sky.sunMesh;
      this.moonMesh = this.sky.moonMesh;
      this.stars = this.sky.stars;
      this.sunGlow = this.sky.sunGlow;
      this.clouds = this.sky.clouds;
      this.fogColor.copy(this.sky.fogColor);
    } else {
      // Cadangan minimal bila js/sky.js tidak dimuat
      this.sunLight = new THREE.DirectionalLight(0xFFFFFF, 1.1);
      this.sunLight.castShadow = true;
      this.scene.add(this.sunLight);
      this.moonLight = new THREE.DirectionalLight(srgb(0x9FB4FF), 0);
      this.scene.add(this.moonLight);
      this.hemi = new THREE.HemisphereLight(srgb(0xBFD9F5), srgb(0x6F9A5F), 0.6);
      this.scene.add(this.hemi);
    }
    this.scene.fog = new THREE.FogExp2(this.fogColor.getHex(), (C.FOG && C.FOG.density) || 0.0011);
  };

  /* ---------- Penempatan: bantu ---------- */
  /* Kemiringan lereng diukur dari bentuk besar pulau. Langkah E ikut skala
     dunia sehingga nilainya tidak berubah terhadap pembesaran (Fase 5). */
  World.prototype._slopeAt = function (x, z) {
    var E = 6 * (this.scale || 1);
    var gx = this.height.macro(x + E, z) - this.height.macro(x - E, z);
    var gz = this.height.macro(x, z + E) - this.height.macro(x, z - E);
    return Math.sqrt(gx * gx + gz * gz) / (2 * E);
  };

  /* Tinggi permukaan terrain yang benar-benar tampil di layar (interpolasi grid).
     Dipakai agar pohon/batu/pemain menempel pas ke tanah — tidak melayang. */
  World.prototype.groundHeight = function (x, z) {
    var size = C.WORLD.size, seg = C.WORLD.segments;
    var half = size / 2, step = size / seg;
    /* Di luar mesh terrain tetap ada samudra. Hitung fungsi ketinggian asli
       (bukan menjepit ke tepi peta) supaya perahu/pemain dapat berlayar dan
       berenang melewati batas peta tanpa dinding tak terlihat. */
    if (x < -half || x > half || z < -half || z > half) return this.height(x, z);
    var fx = U.clamp((x + half) / step, 0, seg - 0.0001);
    var fz = U.clamp((z + half) / step, 0, seg - 0.0001);
    var i0 = Math.floor(fx), j0 = Math.floor(fz);
    var tx = fx - i0, tz = fz - j0;
    var x0 = i0 * step - half, z0 = j0 * step - half;
    var x1 = x0 + step, z1 = z0 + step;
    var h = this.height;
    var h00 = h(x0, z0), h10 = h(x1, z0), h01 = h(x0, z1), h11 = h(x1, z1);
    var a = h00 + (h10 - h00) * tx;
    var b = h01 + (h11 - h01) * tx;
    return a + (b - a) * tz;
  };

  /* Titik dalam denah platform yang diputar (dipakai rumah panggung). */
  function inPlantRect(p, x, z) {
    var dx = x - p.x, dz = z - p.z;
    var lx = dx * p.cos - dz * p.sin;
    var lz = dx * p.sin + dz * p.cos;
    return (lx >= -p.hw && lx <= p.hw && lz >= -p.hd && lz <= p.hd);
  }

  /* Tinggi pijakan: terrain atau lantai panggung (rumah yang bisa dimasuki).
     Platform hanya "menangkap" bila kaki pemain sudah dekat dengan lantainya. */
  World.prototype.supportHeight = function (x, z, y) {
    var g = this.groundHeight(x, z);
    var ps = this.platforms;
    if (!ps || !ps.length) return g;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p.top <= g) continue;
      if (y < p.top - 0.85) continue;
      if (inPlantRect(p, x, z)) g = p.top;
    }
    return g;
  };

  /* Pemain berada di dalam denah rumah? (dipakai kamera saat di dalam rumah) */
  World.prototype.isInsideHouse = function (x, z) {
    var ps = this.platforms;
    if (!ps || !ps.length) return false;
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].open) continue; // dermaga bukan rumah
      if (inPlantRect(ps[i], x, z)) return true;
    }
    return false;
  };

  /* Platform rumah yang melingkupi titik (untuk batas kamera dalam rumah). */
  World.prototype.insidePlatform = function (x, z) {
    var ps = this.platforms;
    if (!ps || !ps.length) return null;
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].open) continue; // dermaga: kamera bebas
      if (inPlantRect(ps[i], x, z)) return ps[i];
    }
    return null;
  };

  /* Tinggi terendah di sekitar titik (radius r) — dasar objek ditanam
     mengikuti sisi lereng terendah supaya tidak ada celah melayang. */
  World.prototype._groundMin = function (x, z, r) {
    var m = this.groundHeight(x, z);
    m = Math.min(m, this.groundHeight(x + r, z), this.groundHeight(x - r, z),
                    this.groundHeight(x, z + r), this.groundHeight(x, z - r));
    return m;
  };

  World.prototype._spotFree = function (x, z, minDist) {
    if (!this._spawn) this._spawn = this.findSpawnPoint();
    var dsx = x - this._spawn.x, dsz = z - this._spawn.z;
    if (dsx * dsx + dsz * dsz < 36) return false; // area titik awal tetap lapang
    var placed = this._placed;
    for (var i = 0; i < placed.length; i++) {
      var dx = x - placed[i].x, dz = z - placed[i].z;
      if (dx * dx + dz * dz < minDist * minDist) return false;
    }
    return true;
  };

  /* Cari lokasi desa: satu desa utama (dekat titik awal) + pendukuhan kecil
     yang tersebar di bagian pulau lain. Semua di daratan yang landai.
     Fase 5: semua jarak relatif terhadap pulau ikut skala (S), sedangkan
     ukuran fisik desa/rumah tetap seukuran manusia. */
  World.prototype.pickVillageSpots = function () {
    var S = this.scale || 1;
    var step = 12 * S, R = 400 * S;
    var cands = [];
    for (var x = -R; x <= R; x += step) {
      for (var z = -R; z <= R; z += step) {
        if (x * x + z * z > R * R) continue;
        // Desa hanya di pulau utama — bukan di pulau-pulau kecil sekitar —
        // supaya semua desa bisa dihubungkan jalan darat.
        if (nearIsland(this.height, x, z)) continue;
        var h = this.height(x, z);
        if (h < 3 * S || h > 22 * S) continue;
        var s = Math.max(
          this._slopeAt(x, z),
          this._slopeAt(x + 9 * S, z), this._slopeAt(x - 9 * S, z),
          this._slopeAt(x, z + 9 * S), this._slopeAt(x, z - 9 * S)
        );
        if (s > 0.30) continue;
        cands.push({ x: x, z: z, h: h, s: s });
      }
    }

    // Desa utama: condong ke pedalaman dekat pantai timur (titik awal pemain)
    var main = null, mainScore = Infinity;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var sc = c.s * 12 + Math.abs(c.x - 210 * S) * (0.01 / S) + Math.abs(c.z) * (0.006 / S);
      if (sc < mainScore) { mainScore = sc; main = c; }
    }
    if (!main) main = { x: 205 * S, z: 0, h: 5 * S };

    var spots = [{ x: main.x, z: main.z, r: 20, main: true }];

    // Pendukuhan: lahan paling datar, tersebar merata (jarak minimum dilonggarkan bertahap)
    cands.sort(function (a, b) { return a.s - b.s || a.x - b.x || a.z - b.z; });
    var mins = [150 * S, 130 * S, 110 * S, 95 * S];
    for (var m = 0; m < mins.length && spots.length < 4; m++) {
      for (var k = 0; k < cands.length && spots.length < 4; k++) {
        var cd = cands[k];
        var ok = true;
        for (var j = 0; j < spots.length; j++) {
          var dx = cd.x - spots[j].x, dz = cd.z - spots[j].z;
          if (dx * dx + dz * dz < mins[m] * mins[m]) { ok = false; break; }
        }
        if (!ok) continue;
        if (Math.pow(cd.x - 283 * S, 2) + cd.z * cd.z < (45 * S) * (45 * S)) continue; // jangan menempel titik awal
        spots.push({ x: cd.x, z: cd.z, r: 13, main: false });
      }
    }
    return spots;
  };

  /* Lokasi pelabuhan (Fase 5): pantai landai di dekat titik awal pemain dengan
     air cukup dalam di ujung dermaga. Dipilih deterministik dari bentuk pulau. */
  World.prototype.pickHarborSpot = function () {
    var S = this.scale || 1;
    if (!this._spawn) this._spawn = this.findSpawnPoint();
    var spawn = this._spawn;
    var baseAng = Math.atan2(spawn.z, spawn.x);
    var best = null, bestScore = Infinity;

    for (var d = -0.5; d <= 0.5001; d += 0.03125) {
      var ang = baseAng + d;
      var dx = Math.cos(ang), dz = Math.sin(ang);
      // Susuri berkas sinar dari darat ke laut: temukan garis pantai.
      var wasLand = false, coast = -1;
      for (var t = 300 * S; t < C.WORLD.size * 0.5; t += 5 * S) {
        var h = this.height(dx * t, dz * t);
        if (h > 1.5 * S) wasLand = true;
        if (wasLand && h < 0.1) { coast = t; break; }
      }
      if (coast < 0) continue;
      var dockLen = 26;
      var end = coast + dockLen;
      var depthEnd = this.height(dx * end, dz * end);   // negatif = kedalaman laut
      if (depthEnd > -0.9) continue;                     // air terlalu dangkal di ujung dermaga
      var beach = this.height(dx * (coast - 12), dz * (coast - 12));
      if (beach < 0.4 || beach > 8 * S) continue;        // harus pantai berpasir rendah
      var s1 = this._slopeAt(dx * (coast - 25), dz * (coast - 25));
      if (s1 > 0.34) continue;
      // Skor: sedekat mungkin dengan arah titik awal + air makin dalam makin baik
      var score = Math.abs(d) * 260 - depthEnd;
      if (score < bestScore) {
        bestScore = score;
        best = { x: dx * coast, z: dz * coast, ang: ang, dirX: dx, dirZ: dz, coast: coast, dockLen: dockLen };
      }
    }

    if (!best) {
      // Cadangan: pantai tepat di arah titik awal
      var cdx = Math.cos(baseAng), cdz = Math.sin(baseAng);
      var cCoast = 300 * S;
      for (var t2 = 300 * S; t2 < C.WORLD.size * 0.5; t2 += 5 * S) {
        if (this.height(cdx * t2, cdz * t2) < 0.1) { cCoast = t2; break; }
      }
      best = { x: cdx * cCoast, z: cdz * cCoast, ang: baseAng, dirX: cdx, dirZ: cdz, coast: cCoast, dockLen: 26 };
    }
    return best;
  };

  /* Dua pulau kecil terpilih mendapat pondok penghuni (Fase 5). */
  World.prototype.pickIslandSites = function () {
    var sites = [];
    var isls = this.islands || [];
    for (var i = 0; i < isls.length && sites.length < 2; i++) {
      var is = isls[i];
      if (is.r < 95) continue;
      // Cari titik dataran rendah dekat puncak pulau untuk pondok.
      var best = null, bestScore = Infinity;
      for (var a = 0; a < 14; a++) {
        var ang = a / 14 * Math.PI * 2;
        for (var rr = 0; rr <= is.r * 0.62; rr += is.r * 0.155) {
          var x = is.x + Math.cos(ang) * rr;
          var z = is.z + Math.sin(ang) * rr;
          var h = this.groundHeight(x, z);
          if (h < 2.5 || h > Math.min(is.h, 14)) continue;
          var s = this._slopeAt(x, z);
          if (s > 0.26) continue;
          var score = s * 20 + Math.abs(h - 5.5) * 0.3 + rr * 0.01;
          if (score < bestScore) { bestScore = score; best = { x: x, z: z, h: h }; }
        }
      }
      if (best) {
        sites.push({ x: best.x, z: best.z, y: best.h, r: 9, main: false, island: true, islandIndex: i });
      }
    }
    return sites;
  };

  World.prototype._pickSpot = function (rng, minH, maxH, maxSlope, minDist, attempts) {
    var span = C.WORLD.size * 0.46;
    for (var a = 0; a < attempts; a++) {
      var x = (rng() * 2 - 1) * span;
      var z = (rng() * 2 - 1) * span;
      var h = this.height(x, z);
      if (h < minH || h > maxH) continue;
      if (this._slopeAt(x, z) > maxSlope) continue;
      var blocked = false;
      for (var vi = 0; vi < this.villageSpots.length; vi++) {
        var vs = this.villageSpots[vi];
        var dvx = x - vs.x, dvz = z - vs.z;
        if (dvx * dvx + dvz * dvz < vs.r * vs.r) { blocked = true; break; } // area desa tetap lapang
      }
      if (!blocked && this.islandSites) {
        for (var ii = 0; ii < this.islandSites.length; ii++) {
          var isd = this.islandSites[ii];
          var dix = x - isd.x, diz = z - isd.z;
          if (dix * dix + diz * diz < 16 * 16) { blocked = true; break; }   // pondok pulau kecil
        }
      }
      if (!blocked && this.harborSpot) {
        var hdx = x - this.harborSpot.x, hdz = z - this.harborSpot.z;
        if (hdx * hdx + hdz * hdz < 30 * 30) blocked = true;                // area pelabuhan
      }
      if (!blocked && this.landmarkSites) {
        for (var li = 0; li < this.landmarkSites.length; li++) {
          var ld = this.landmarkSites[li];
          var ldx = x - ld.x, ldz = z - ld.z;
          if (ldx * ldx + ldz * ldz < ld.r * ld.r) { blocked = true; break; }
        }
      }
      if (!blocked && this.kingdomSite) {
        var ks = this.kingdomSite;
        var kdx = x - ks.x, kdz = z - ks.z;
        var kr = ks.r + 6;
        if (kdx * kdx + kdz * kdz < kr * kr) blocked = true;   // dalam tembok kerajaan
      }
      if (!blocked && this.empireSite) {
        var es = this.empireSite;
        var edx = x - es.x, edz = z - es.z;
        var er = es.r + 10;
        if (edx * edx + edz * edz < er * er) blocked = true;   // dalam tembok kekaisaran
      }
      // Jangan menanam pohon/batu di atas jalan penghubung.
      if (!blocked && this._roadGrid && this.nearRoad(x, z, 1.4)) blocked = true;
      if (blocked) continue;
      if (!this._spotFree(x, z, minDist)) continue;
      return { x: x, z: z, h: h };
    }
    return null;
  };

  /* Penghalang fisik: segmen dinding & titik lingkaran.
     Dipakai semua builder (landmark MegaKit, prosedural, kerajaan). */
  World.prototype.wall = function (x1, z1, x2, z2, r) {
    this.walls.push({ x1: x1, z1: z1, x2: x2, z2: z2, r: r === undefined ? 0.5 : r });
  };
  World.prototype.collider = function (x, z, r) {
    this.colliders.push({ x: x, z: z, r: r === undefined ? 0.5 : r });
  };

  /* ---------- Bangunan batu tua: kastil, kapel, menara, batu berdiri ----------
     Struktur dibuat dari balok batu instanced (satu draw call per bahan) agar
     tetap ringan di perangkat lemah. Semua tetap bisa didekati/dimasuki lewat
     celah dinding yang sengaja dibuat runtuh. */

  World.prototype._scanRingSpot = function (cx, cz, dmin, dmax, minH, maxH, maxSlope, rng) {
    var S = this.scale || 1;
    var best = null, bestScore = Infinity;
    for (var ring = 0; ring < 5; ring++) {
      var d = dmin + (dmax - dmin) * ((ring + 0.5) / 5);
      for (var a = 0; a < 24; a++) {
        var ang = (a / 24) * Math.PI * 2 + rng() * 0.08;
        var x = cx + Math.cos(ang) * d;
        var z = cz + Math.sin(ang) * d;
        var h = this.groundHeight(x, z);
        if (h < minH || h > maxH) continue;
        var s = this._slopeAt(x, z);
        if (s > maxSlope) continue;
        var score = s * 80 + Math.abs(d - (dmin + dmax) * 0.5) * 0.015 + rng() * 0.08;
        if (score < bestScore) {
          bestScore = score;
          best = { x: x, z: z, y: h - 0.35, d: d, slope: s };
        }
      }
    }
    return best;
  };

  World.prototype.pickLandmarkSites = function () {
    var S = this.scale || 1;
    var rng = U.mulberry32(C.WORLD.seed + 4242);
    var village = this.villageSpots && this.villageSpots[0];
    if (!village) return [];
    var sites = [];
    var self = this;

    function farEnough(x, z, r) {
      for (var i = 0; i < sites.length; i++) {
        var dx = x - sites[i].x, dz = z - sites[i].z;
        var lim = r + sites[i].r;
        if (dx * dx + dz * dz < lim * lim) return false;
      }
      for (var j = 0; j < self.villageSpots.length; j++) {
        var v = self.villageSpots[j];
        var vx = x - v.x, vz = z - v.z;
        var vl = r + v.r + 12;
        if (vx * vx + vz * vz < vl * vl) return false;
      }
      if (self.harborSpot) {
        var hx = x - self.harborSpot.x, hz = z - self.harborSpot.z;
        if (hx * hx + hz * hz < (r + 26) * (r + 26)) return false;
      }
      // Jangan membangun landmark di dalam kerajaan besar.
      if (self.kingdomSite) {
        var kx = x - self.kingdomSite.x, kz = z - self.kingdomSite.z;
        var kl = r + self.kingdomSite.r + 8;
        if (kx * kx + kz * kz < kl * kl) return false;
      }
      // ...atau kekaisaran agung.
      if (self.empireSite) {
        var ex = x - self.empireSite.x, ez = z - self.empireSite.z;
        var el = r + self.empireSite.r + 10;
        if (ex * ex + ez * ez < el * el) return false;
      }
      return true;
    }

    // 1) Kapel tua dekat desa — pintu menghadap alun-alun.
    var chapel = this._scanRingSpot(village.x, village.z, 34, 58, 2.2 * S, 20 * S, 0.25, rng);
    if (chapel && farEnough(chapel.x, chapel.z, 13)) {
      chapel.id = 'chapel'; chapel.r = 17;
      chapel.yaw = Math.atan2(village.x - chapel.x, village.z - chapel.z);
      sites.push(chapel);
    }

    // 2) Lingkaran batu berdiri di padang rumput, agak jauh dari desa.
    var stones = this._scanRingSpot(village.x, village.z, 72, 128, 2.5 * S, 26 * S, 0.22, rng);
    if (stones && farEnough(stones.x, stones.z, 11)) {
      stones.id = 'stones'; stones.r = 14; stones.yaw = rng() * Math.PI * 2;
      sites.push(stones);
    }

    // 3) Menara jaga di jalur dari pelabuhan menuju desa.
    if (this.harborSpot) {
      var hs = this.harborSpot;
      var bestT = null, bestTD = Infinity;
      for (var k = 0; k < 34; k++) {
        var d = 18 + rng() * 30;
        var side = (rng() - 0.5) * 22;
        var tx = hs.x - (hs.dirX || 1) * d + (hs.dirZ || 0) * side;
        var tz = hs.z - (hs.dirZ || 0) * d - (hs.dirX || 1) * side;
        var th = this.groundHeight(tx, tz);
        if (th < 1.6 * S || th > 28 * S) continue;
        if (this._slopeAt(tx, tz) > 0.28) continue;
        if (!farEnough(tx, tz, 8)) continue;
        var td = Math.abs(d - 30) + this._slopeAt(tx, tz) * 40;
        if (td < bestTD) { bestTD = td; bestT = { x: tx, z: tz, y: th - 0.35 }; }
      }
      if (bestT) {
        bestT.id = 'tower'; bestT.r = 12; bestT.yaw = Math.atan2(village.x - bestT.x, village.z - bestT.z);
        sites.push(bestT);
      }
    }

    // 4) Reruntuhan kastil di punggung bukit tinggi — landmark utama dunia.
    var bestC = null, bestScore = -Infinity;
    var half = C.WORLD.size * 0.5;
    var step = 34 * S;
    for (var x = -half * 0.56; x <= half * 0.56; x += step) {
      for (var z = -half * 0.56; z <= half * 0.56; z += step) {
        var h = this.height(x, z);
        if (h < 20 * S || h > 78 * S) continue;
        var sl = this._slopeAt(x, z);
        if (sl > 0.46) continue;
        var vdx = x - village.x, vdz = z - village.z;
        if (vdx * vdx + vdz * vdz < (160 * S) * (160 * S)) continue;
        var score = h * 0.018 - sl * 30 + rng() * 2.5;
        if (score > bestScore && farEnough(x, z, 24)) {
          bestScore = score;
          bestC = { x: x, z: z, y: this.groundHeight(x, z) - 0.45, slope: sl };
        }
      }
    }
    if (bestC) {
      bestC.id = 'castle'; bestC.r = 44;
      bestC.yaw = Math.atan2(village.x - bestC.x, village.z - bestC.z);
      sites.push(bestC);
    }

    // 5) Kerajaan Besar ditentukan terpisah oleh pickKingdomSite() (lihat
    //    buildEnvironment + buildGreatKingdom) agar selalu ada, baik dengan
    //    model MegaKit maupun fallback prosedural.
    return sites;
  };

  function RuinBuilder(world, site, materials) {
    this.world = world;
    this.site = site;
    this.materials = materials;
    this.group = new THREE.Group();
    this.group.position.set(site.x, site.y, site.z);
    this.group.rotation.y = site.yaw || 0;
    this.stone = [];
    this.timber = [];
    this.cloth = [];
    this.iron = [];
    this.fire = [];
    this.cylinders = [];
    this.runes = [];
    this._cos = Math.cos(site.yaw || 0);
    this._sin = Math.sin(site.yaw || 0);
  }

  RuinBuilder.prototype.box = function (kind, x, y, z, sx, sy, sz, ry, hex) {
    var list = this[kind] || this.stone;
    list.push({ x: x, y: y, z: z, sx: sx, sy: sy, sz: sz, ry: ry || 0, hex: hex });
  };

  RuinBuilder.prototype.cyl = function (x, y, z, r, h, hex) {
    this.cylinders.push({ x: x, y: y, z: z, r: r, h: h, hex: hex });
  };

  RuinBuilder.prototype.at = function (lx, lz) {
    return {
      x: this.site.x + this._cos * lx + this._sin * lz,
      z: this.site.z - this._sin * lx + this._cos * lz
    };
  };

  RuinBuilder.prototype.wall = function (x1, z1, x2, z2, r) {
    var a = this.at(x1, z1), b = this.at(x2, z2);
    this.world.walls.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, r: r || 0.38 });
  };

  RuinBuilder.prototype.collider = function (lx, lz, r) {
    var p = this.at(lx, lz);
    this.world.colliders.push({ x: p.x, z: p.z, r: r });
  };

  RuinBuilder.prototype.rune = function (x, y, z, sx, sy, sz, ry) {
    this.runes.push({ x: x, y: y, z: z, sx: sx, sy: sy, sz: sz, ry: ry || 0 });
  };

  RuinBuilder.prototype.flush = function () {
    var unitBox = new THREE.BoxGeometry(1, 1, 1);
    var unitCyl = new THREE.CylinderGeometry(1, 1.045, 1, 10);
    unitCyl.translate(0, 0.5, 0);
    var tmp = new THREE.Object3D();
    var col = new THREE.Color();
    var defs = [
      { key: 'stone', geo: unitBox, mat: this.materials.stone },
      { key: 'timber', geo: unitBox, mat: this.materials.timber },
      { key: 'cloth', geo: unitBox, mat: this.materials.cloth },
      { key: 'iron', geo: unitBox, mat: this.materials.iron },
      { key: 'fire', geo: unitBox, mat: this.materials.fire }
    ];
    for (var d = 0; d < defs.length; d++) {
      var list = this[defs[d].key];
      if (!list || !list.length) continue;
      var mesh = new THREE.InstancedMesh(defs[d].geo, defs[d].mat, list.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        tmp.position.set(p.x, p.y, p.z);
        tmp.rotation.set(0, p.ry || 0, 0);
        tmp.scale.set(p.sx, p.sy, p.sz);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
        col.setHex(p.hex || 0x6C6D66).convertSRGBToLinear().multiplyScalar(0.9 + (i % 5) * 0.025);
        mesh.setColorAt(i, col);
      }
      this.group.add(mesh);
    }
    if (this.cylinders.length) {
      var cm = new THREE.InstancedMesh(unitCyl, this.materials.stoneCyl, this.cylinders.length);
      cm.castShadow = true;
      cm.receiveShadow = true;
      for (var c = 0; c < this.cylinders.length; c++) {
        var cy = this.cylinders[c];
        tmp.position.set(cy.x, cy.y, cy.z);
        tmp.rotation.set(0, 0, 0);
        tmp.scale.set(cy.r, cy.h, cy.r);
        tmp.updateMatrix();
        cm.setMatrixAt(c, tmp.matrix);
        col.setHex(cy.hex || 0x686963).convertSRGBToLinear();
        cm.setColorAt(c, col);
      }
      this.group.add(cm);
    }
    for (var r = 0; r < this.runes.length; r++) {
      var rn = this.runes[r];
      var rune = new THREE.Mesh(unitBox, this.materials.rune);
      rune.position.set(rn.x, rn.y, rn.z);
      rune.rotation.y = rn.ry || 0;
      rune.scale.set(rn.sx, rn.sy, rn.sz);
      this.group.add(rune);
    }
    this.world.scene.add(this.group);
    return this.group;
  };

  function buildChapelRuin(b) {
    var base = 0.42;
    // fondasi & lantai batu
    b.box('stone', 0, -0.55, 0, 10.2, 1.95, 14.2, 0, 0x55564F);
    b.box('stone', 0, base - 0.08, 0, 8.6, 0.18, 12.4, 0, 0x77766C);
    var hw = 4.0, hd = 6.0, wh = 4.9, wt = 0.52;
    // dinding belakang & samping (sisi kanan sengaja runtuh sebagian)
    b.box('stone', 0, base + wh / 2, -hd, hw * 2, wh, wt, 0, 0x6A6B63);
    b.box('stone', -hw, base + wh / 2, 0, wt, wh, hd * 2, 0, 0x63645D);
    b.box('stone', hw, base + 1.65, -hd * 0.18, wt, 3.3, hd * 1.55, 0, 0x5E5F58);
    b.box('stone', hw, base + 0.8, -hd * 0.92, wt, 1.6, hd * 0.55, 0, 0x5A5B54);
    // fasad depan dengan gapura bergaya gotik
    b.box('stone', -2.5, base + wh / 2, hd, 3.0, wh, wt, 0, 0x6C6D65);
    b.box('stone', 2.5, base + wh / 2, hd, 3.0, wh, wt, 0, 0x6C6D65);
    b.box('stone', 0, base + wh - 0.2, hd, 2.9, 0.4, wt, 0, 0x686961);
    // Ambang batu dan undakan lengkung runcing di atas pintu.
    b.box('stone', 0, base + 3.38, hd, 2.18, 0.28, wt + 0.04, 0, 0x6A6B63);
    for (var ai = 1; ai <= 2; ai++) {
      var aw = 0.7 - (ai - 1) * 0.12;
      var ax = 0.8 - (ai - 1) * 0.35;
      var ay = base + 3.72 + (ai - 1) * 0.32;
      b.box('stone', -ax, ay, hd, aw, 0.52, wt + 0.06, 0, 0x696A62);
      b.box('stone', ax, ay, hd, aw, 0.52, wt + 0.06, 0, 0x696A62);
    }
    b.box('stone', 0, base + 4.53, hd, 0.5, 0.42, wt + 0.08, 0, 0x5E5F58);
    // Tympanum batu menutup ruang lengkung di atas pintu, dengan relung salib.
    b.box('stone', 0, base + 3.98, hd, 2.06, 0.82, wt - 0.08, 0, 0x686961);
    b.box('stone', 0, base + 4.48, hd, 1.62, 0.38, wt - 0.06, 0, 0x65665E);
    b.box('stone', 0, base + 4.02, hd + 0.24, 0.16, 0.58, 0.035, 0, 0x1F2220);
    b.box('stone', 0, base + 4.08, hd + 0.24, 0.56, 0.16, 0.035, 0, 0x1F2220);
    // Jendela lancip di kiri-kanan portal.
    for (var wi = -1; wi <= 1; wi += 2) {
      b.box('stone', wi * 2.95, base + 2.85, hd + wt / 2 + 0.01, 0.44, 1.45, 0.09, 0, 0x1E211F);
      b.box('stone', wi * 2.95, base + 3.7, hd + wt / 2 + 0.01, 0.24, 0.34, 0.09, 0, 0x1E211F);
      b.box('stone', wi * 2.95, base + 2.08, hd + wt / 2 + 0.02, 0.62, 0.1, 0.12, 0, 0x5C5D56);
    }
    // Puncak gapura bergerigi (retak) dan atap pelana batu yang runtuh.
    b.box('stone', -3.1, base + wh + 0.28, hd, 1.4, 0.55, wt + 0.1, 0, 0x5D5E57);
    b.box('stone', 3.05, base + wh + 0.14, hd, 1.2, 0.28, wt + 0.1, 0, 0x5D5E57);
    b.box('stone', 0, base + wh + 0.2, hd, 7.1, 0.7, wt, 0, 0x66675F);
    b.box('stone', 0, base + wh + 0.68, hd, 5.2, 0.62, wt, 0, 0x64655D);
    b.box('stone', 0, base + wh + 1.12, hd, 3.5, 0.56, wt, 0, 0x606159);
    b.box('stone', 0, base + wh + 1.52, hd, 1.9, 0.5, wt, 0, 0x5C5D56);
    b.box('stone', 0, base + wh + 1.35, hd + wt / 2 + 0.02, 0.42, 0.95, 0.1, 0, 0x1E211F);
    b.box('iron', 0, base + wh + 2.12, hd, 0.14, 0.7, 0.15, 0, 0x3B3C3A);
    b.box('iron', 0, base + wh + 2.17, hd, 0.66, 0.14, 0.15, 0, 0x3B3C3A);
    // jendela sempit berujung runcing
    b.box('stone', -hw - 0.03, base + 2.7, -2.0, 0.1, 1.55, 0.72, 0, 0x1E211F);
    b.box('stone', -hw - 0.03, base + 3.58, -2.0, 0.1, 0.34, 0.38, 0, 0x1E211F);
    b.box('stone', hw + 0.03, base + 2.7, -3.2, 0.1, 1.55, 0.72, 0, 0x1E211F);
    b.box('stone', hw + 0.03, base + 3.58, -3.2, 0.1, 0.34, 0.38, 0, 0x1E211F);
    // pintu kayu berat berlapis besi
    b.box('timber', 0, base + 1.65, hd + 0.02, 2.0, 3.05, 0.16, 0, 0x4A3524);
    b.box('iron', 0, base + 0.75, hd + 0.12, 1.85, 0.12, 0.07, 0, 0x38393A);
    b.box('iron', 0, base + 2.0, hd + 0.12, 1.85, 0.12, 0.07, 0, 0x38393A);
    b.box('iron', 0, base + 2.85, hd + 0.12, 1.85, 0.12, 0.07, 0, 0x38393A);
    b.box('iron', 0.7, base + 1.55, hd + 0.13, 0.16, 0.16, 0.08, 0, 0x4A4B4C);
    // penyangga luar
    for (var i = -1; i <= 1; i += 2) {
      b.box('stone', -hw - 0.38, base + 1.6, -3.7, 0.55, 3.2, 0.65, 0, 0x5B5C55);
      b.box('stone', -hw - 0.38, base + 1.6, 0.6, 0.55, 3.2, 0.65, 0, 0x5B5C55);
      b.box('stone', hw + 0.38, base + 1.2, 1.8, 0.55, 2.4, 0.65, 0, 0x5B5C55);
      break;
    }
    // altar & rune fajar
    b.box('stone', 0, base + 0.55, -4.2, 2.3, 1.1, 1.05, 0, 0x77766B);
    b.rune(0, base + 1.16, -4.2, 1.2, 0.06, 0.46);
    // balok atap runtuh di lantai
    b.box('timber', -1.4, base + 0.18, -1.3, 4.1, 0.2, 0.26, 0.55, 0x4A3524);
    b.box('timber', 1.7, base + 0.18, 1.5, 3.4, 0.2, 0.24, -0.8, 0x4A3524);
    b.box('timber', 0.2, base + 0.18, -3.2, 2.8, 0.2, 0.24, 0.2, 0x4A3524);
    // gapura kuburan yang patah
    b.box('stone', -6.2, base + 1.45, 7.2, 0.72, 2.9, 0.72, 0, 0x66675F);
    b.box('stone', -3.6, base + 1.15, 7.2, 0.72, 2.3, 0.72, 0, 0x606159);
    b.box('stone', -4.9, base + 2.5, 7.2, 3.4, 0.55, 0.72, 0.12, 0x65665E);
    // batu nisan di sisi kapel
    var graves = [
      [-6.4, 2.2, 0.55, 1.35], [-7.6, 4.0, 0.5, 1.0], [-5.5, 4.7, 0.42, 0.9],
      [-7.2, 7.0, 0.46, 1.15], [-5.8, 8.2, 0.4, 0.8], [6.1, 2.6, 0.5, 1.1], [7.0, 5.3, 0.44, 0.95]
    ];
    for (var g = 0; g < graves.length; g++) {
      var gr = graves[g];
      b.box('stone', gr[0], base + gr[3] / 2, gr[1], gr[2], gr[3], 0.26, (g % 3 - 1) * 0.16, 0x696A62);
    }
    // runtuhan
    b.box('stone', -5.0, base + 0.22, -7.7, 1.5, 0.45, 1.1, 0.4, 0x5D5E57);
    b.box('stone', 4.6, base + 0.18, 7.9, 1.2, 0.36, 0.8, 0.9, 0x606159);
    b.box('stone', 0.7, base + 0.16, -7.2, 0.9, 0.32, 0.7, 0.1, 0x575851);
    // tabrakan dinding (celah pintu di depan)
    b.wall(-hw, -hd, hw, -hd);
    b.wall(-hw, -hd, -hw, hd);
    b.wall(hw, -hd, hw, -1.0);
    b.wall(hw, 2.4, hw, hd);
    b.wall(-hw, hd, -1.0, hd);
    b.wall(1.0, hd, hw, hd);
    b.collider(-4.9, 7.2, 0.7);
    b.collider(-3.6, 7.2, 0.7);
  }

  function buildTowerRuin(b) {
    var base = 0.35;
    b.box('stone', 0, -0.8, 0, 8.2, 2.4, 8.2, 0, 0x5E5F57);
    b.cyl(0, base - 0.15, 0, 2.75, 9.8, 0x7C7B72);
    b.cyl(0, base + 2.6, 0, 2.79, 0.16, 0x8B887D);
    b.cyl(0, base + 5.4, 0, 2.79, 0.16, 0x8B887D);
    b.cyl(0, base + 9.55, 0, 2.2, 1.05, 0x71716A);
    // puncak menara yang patah
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      if (i === 2 || i === 5) continue;
      b.box('stone', Math.cos(a) * 2.45, base + 9.9 + (i % 3) * 0.12, Math.sin(a) * 2.45,
        0.62, 0.9 + (i % 3) * 0.22, 0.62, -a, 0x5B5C55);
    }
    // pintu & tangga
    b.box('stone', 0, base + 1.45, 2.7, 1.65, 2.9, 0.22, 0, 0x242521);
    b.box('timber', 0, base + 1.2, 2.85, 1.3, 2.2, 0.14, 0, 0x4B3625);
    b.box('stone', 0, base + 0.2, 3.75, 2.7, 0.4, 1.9, 0, 0x77776C);
    b.box('stone', 0, base + 0.06, 5.1, 2.2, 0.24, 1.0, 0, 0x6D6E65);
    // celah panah
    for (var k = 0; k < 5; k++) {
      var ang = k / 5 * Math.PI * 2 + 0.3;
      b.box('stone', Math.cos(ang) * 2.77, base + 4.2 + (k % 2) * 1.6, Math.sin(ang) * 2.77,
        0.16, 1.15, 0.34, -ang, 0x1E211F);
    }
    // brazier tua di puncak
    b.box('iron', 0, base + 10.4, 0, 0.7, 0.25, 0.7, 0, 0x343537);
    b.box('fire', 0, base + 10.72, 0, 0.46, 0.38, 0.46, 0, 0xFFB05A);
    b.rune(0, base + 10.62, 0, 0.42, 0.08, 0.42);
    // puing
    b.box('stone', -2.4, base + 0.15, 2.9, 1.2, 0.35, 0.9, 0.6, 0x5C5D55);
    b.box('stone', 2.2, base + 0.18, -2.4, 0.9, 0.4, 1.1, 0.2, 0x62635B);
    b.collider(0, 0, 2.9);
  }

  function buildStandingStones(b) {
    var base = 0.15;
    b.box('stone', 0, base - 0.45, 0, 7.5, 1.1, 7.5, 0, 0x7B7D73);
    var n = 8;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + 0.22;
      var r = 5.1 + (i % 3) * 0.24;
      var h = 3.2 + (i % 4) * 0.42;
      if (i === 4) h = 1.9;
      if (i === 2 || i === 3) h = 3.9;
      b.box('stone', Math.cos(a) * r, base + h / 2, Math.sin(a) * r,
        0.92, h, 0.68, Math.PI / 2 - a, i === 4 ? 0x85877D : 0x9A9C91);
      if (i !== 4) {
        b.rune(Math.cos(a) * (r + 0.36), base + h * 0.55, Math.sin(a) * (r + 0.36),
          0.56, 0.62, 0.03, Math.PI / 2 - a);
      }
    }
    // Gerbang trilithon: dua batu tinggi dengan ambang batu melintang.
    var la = 2 / n * Math.PI * 2 + 0.22;
    var lb = 3 / n * Math.PI * 2 + 0.22;
    var lr1 = 5.1 + (2 % 3) * 0.24;
    var lr2 = 5.1 + (3 % 3) * 0.24;
    var lx1 = Math.cos(la) * lr1, lz1 = Math.sin(la) * lr1;
    var lx2 = Math.cos(lb) * lr2, lz2 = Math.sin(lb) * lr2;
    var ldx = lx2 - lx1, ldz = lz2 - lz1;
    var llen = Math.sqrt(ldx * ldx + ldz * ldz);
    var lry = Math.atan2(-ldz, ldx);
    var lmx = (lx1 + lx2) / 2, lmz = (lz1 + lz2) / 2;
    b.box('stone', lmx, base + 3.9 + 0.24, lmz,
      llen + 1.0, 0.48, 0.78, lry, 0x7E8076);
    var lside = Math.cos(lry) >= 0 ? 0.45 : -0.45;
    b.rune(lmx + Math.sin(lry) * lside, base + 4.16, lmz + Math.cos(lry) * lside,
      1.8, 0.22, 0.04, lry);
    // altar tengah, batu tumbang, dan lempeng rune yang menghadap pendaki
    b.box('stone', 0, base + 0.35, 0, 2.1, 0.7, 1.25, 0, 0x9C9D92);
    b.rune(0, base + 0.73, 0, 1.1, 0.05, 0.48);
    b.rune(0, base + 0.5, 0.66, 0.78, 0.5, 0.04);
    b.box('stone', 2.7, base + 0.3, -1.3, 2.8, 0.58, 0.78, 0.75, 0x6F7168);
    for (var j = 0; j < n; j++) {
      var ang = j / n * Math.PI * 2 + 0.22;
      b.collider(Math.cos(ang) * 5.1, Math.sin(ang) * 5.1, 0.64);
    }
  }

  function buildCastleRuin(b) {
    var base = 0.62;
    // pelataran & fondasi besar
    b.box('stone', 0, -0.8, 0, 28, 3.0, 23, 0, 0x53544D);
    b.box('stone', 0, base - 0.1, 0, 25.6, 0.26, 20.4, 0, 0x706F65);
    var wx = 12, wz = 9, wh = 4.7, wt = 0.75;
    // tirai dinding luar dengan gerbang di +Z dan bagian runtuh di -X
    b.box('stone', 0, base + wh / 2, -wz, wx * 2, wh, wt, 0, 0x676860);
    b.box('stone', -wx, base + wh / 2, -3.0, wt, wh, 6.0, 0, 0x61625A);
    b.box('stone', -wx, base + wh / 2, 5.7, wt, wh, 6.6, 0, 0x5C5D55);
    b.box('stone', -wx, base + 1.2, 2.0, wt, 2.4, 2.0, 0, 0x565750);
    b.box('stone', wx, base + wh / 2, -2.0, wt, wh, 14.0, 0, 0x64655D);
    b.box('stone', wx, base + 0.7, 6.7, wt, 1.4, 4.6, 0, 0x5B5C54);
    b.box('stone', -4.1, base + wh / 2, wz, 7.8, wh, wt, 0, 0x686961);
    b.box('stone', 4.1, base + wh / 2, wz, 7.8, wh, wt, 0, 0x686961);
    // gerbang: dua menara persegi + badan gerbang batu di atas pintu
    b.box('stone', -2.4, base + 4.9, wz, 3.1, 9.8, 3.0, 0, 0x66675F);
    b.box('stone', 2.4, base + 4.9, wz, 3.1, 9.8, 3.0, 0, 0x66675F);
    b.box('stone', 0, base + 6.85, wz, 2.1, 4.5, 2.9, 0, 0x65665E);
    b.box('stone', 0, base + 9.3, wz, 3.5, 1.3, 2.6, 0, 0x5E5F57);
    for (var mg = -1; mg <= 1; mg++) {
      b.box('stone', mg * 1.15, base + 10.15, wz, 0.55, 0.7, 0.9, 0, 0x5B5C54);
    }
    // Tympanum batu di atas pintu gerbang.
    b.box('stone', 0, base + 3.78, wz, 2.05, 0.72, 2.2, 0, 0x6A6B63);
    b.box('stone', 0, base + 3.78, wz + 1.48, 0.16, 0.5, 0.045, 0, 0x1F2220);
    b.box('stone', 0, base + 3.84, wz + 1.48, 0.5, 0.15, 0.045, 0, 0x1F2220);
    // Pintu kayu ganda yang terbuka ke dalam, agar pelataran kastil bisa dimasuki.
    b.box('timber', -0.67, base + 1.75, wz + 1.09, 0.82, 3.5, 0.14, 1.1, 0x4A3524);
    b.box('timber', 0.67, base + 1.75, wz + 1.09, 0.82, 3.5, 0.14, -1.1, 0x4A3524);
    for (var dl = -1; dl <= 1; dl += 2) {
      b.box('iron', dl * 0.67, base + 2.9, wz + 1.09, 0.74, 0.13, 0.18, dl * 1.1, 0x353638);
      b.box('iron', dl * 0.67, base + 1.1, wz + 1.09, 0.74, 0.13, 0.18, dl * 1.1, 0x353638);
      b.box('iron', dl * 0.85, base + 2.6, wz + 1.45, 0.14, 0.22, 0.2, 0, 0x444547);
      b.box('iron', dl * 0.85, base + 0.9, wz + 1.45, 0.14, 0.22, 0.2, 0, 0x444547);
    }
    // Obor gerbang: besi tua dengan api kecil yang tetap menyala.
    for (var tf = -1; tf <= 1; tf += 2) {
      b.box('iron', tf * 2.4, base + 4.3, wz + 1.58, 0.62, 0.12, 0.3, 0, 0x343537);
      b.box('fire', tf * 2.4, base + 4.55, wz + 1.64, 0.26, 0.34, 0.26, 0, 0xFFB05A);
    }
    // menara sudut silinder
    b.cyl(-wx, base - 0.2, -wz, 2.6, 10.8, 0x696A62);
    b.cyl(wx, base - 0.2, -wz, 2.7, 12.2, 0x63645C);
    b.cyl(-wx, base - 0.2, wz, 2.45, 7.4, 0x606159);
    b.cyl(wx, base - 0.2, wz, 2.55, 9.6, 0x686961);
    for (var t = 0; t < 4; t++) {
      var tx = (t % 2 === 0 ? -wx : wx), tz = (t < 2 ? -wz : wz);
      var topH = t === 0 ? 10.8 : t === 1 ? 12.2 : t === 2 ? 7.4 : 9.6;
      for (var c = 0; c < 8; c++) {
        if ((t === 2 && c > 4) || (t === 0 && c === 6)) continue;
        var ca = c / 8 * Math.PI * 2;
        b.box('stone', tx + Math.cos(ca) * 2.25, base + topH + 0.5, tz + Math.sin(ca) * 2.25,
          0.62, 1.0, 0.62, -ca, 0x5A5B53);
      }
    }
    // benteng mahkota di dinding
    for (var bx = -10.2; bx <= 10.2; bx += 1.65) {
      if ((bx > -3 && bx < 3) || (bx > 5 && bx < 7)) continue;
      b.box('stone', bx, base + wh + 0.35, -wz, 0.8, 0.7, 0.9, 0, 0x5D5E56);
    }
    // benteng depan kiri/kanan gerbang
    for (var fx = -10.2; fx <= 10.2; fx += 1.65) {
      if (fx > -4.2 && fx < 4.2) continue;
      b.box('stone', fx, base + wh + 0.35, wz, 0.8, 0.7, 0.9, 0, 0x5D5E56);
    }
    // keep di belakang pelataran
    var kx = 0, kz = -4.3, khw = 5.0, khd = 3.2, kwh = 8.6;
    b.box('stone', kx, base + kwh / 2, kz - khd, khw * 2, kwh, 0.85, 0, 0x6A6B63);
    b.box('stone', kx - khw, base + kwh / 2, kz, 0.85, kwh, khd * 2, 0, 0x63645C);
    b.box('stone', kx + khw, base + kwh / 2, kz, 0.85, kwh, khd * 2, 0, 0x63645C);
    b.box('stone', kx - 3.0, base + kwh / 2, kz + khd, 3.8, kwh, 0.85, 0, 0x6C6D65);
    b.box('stone', kx + 3.0, base + kwh / 2, kz + khd, 3.8, kwh, 0.85, 0, 0x6C6D65);
    b.box('stone', kx, base + kwh - 0.35, kz + khd, 2.4, 0.7, 0.9, 0, 0x5D5E56);
    // jendela keep
    b.box('stone', kx - 2.3, base + 5.4, kz + khd + 0.44, 0.8, 1.5, 0.08, 0, 0x1D201F);
    b.box('stone', kx + 2.3, base + 5.4, kz + khd + 0.44, 0.8, 1.5, 0.08, 0, 0x1D201F);
    b.box('stone', kx - 2.3, base + 2.0, kz + khd + 0.44, 0.8, 1.4, 0.08, 0, 0x1D201F);
    b.box('timber', kx, base + 1.65, kz + khd + 0.45, 1.8, 3.3, 0.16, 0, 0x493423);
    b.box('iron', kx, base + 1.0, kz + khd + 0.56, 1.65, 0.12, 0.06, 0, 0x353638);
    // panji-panji lusuh
    b.box('timber', -4.2, base + 8.4, kz + khd + 0.5, 0.1, 4.7, 0.1, 0, 0x493423);
    b.box('cloth', -4.2, base + 10.0, kz + khd + 0.62, 1.5, 2.1, 0.06, 0, 0x63252E);
    b.box('timber', 4.2, base + 8.4, kz + khd + 0.5, 0.1, 4.7, 0.1, 0, 0x493423);
    b.box('cloth', 4.2, base + 10.0, kz + khd + 0.62, 1.5, 2.1, 0.06, 0, 0x2E4A66);
    // puing & batu runtuh
    b.box('stone', -7.3, base + 0.25, 4.4, 2.4, 0.55, 1.5, 0.5, 0x5D5E56);
    b.box('stone', 8.1, base + 0.32, 2.2, 1.8, 0.7, 1.2, 0.9, 0x5B5C54);
    b.box('stone', 6.3, base + 0.2, -6.3, 1.2, 0.45, 1.9, 0.3, 0x61625A);
    // tabrakan luar & keep, celah gerbang
    b.wall(-wx, -wz, wx, -wz);
    b.wall(-wx, -wz, -wx, 2.0);
    b.wall(-wx, 4.0, -wx, wz);
    b.wall(-4.1, wz, -1.6, wz);
    b.wall(1.6, wz, 4.1, wz);
    b.wall(4.1, wz, wx, wz);
    b.wall(wx, wz, wx, -wz);
    b.wall(kx - khw, kz - khd, kx + khw, kz - khd);
    b.wall(kx - khw, kz - khd, kx - khw, kz + khd);
    b.wall(kx + khw, kz - khd, kx + khw, kz + khd);
    b.wall(kx - khw, kz + khd, kx - 1.0, kz + khd);
    b.wall(kx + 1.0, kz + khd, kx + khw, kz + khd);
    b.collider(-2.4, wz, 1.8);
    b.collider(2.4, wz, 1.8);
    b.collider(-wx, -wz, 2.8);
    b.collider(wx, -wz, 2.9);
    b.collider(-wx, wz, 2.6);
    b.collider(wx, wz, 2.7);
  }

  World.prototype.buildLandmarks = function () {
    if (!this.landmarkSites || !this.landmarkSites.length) return;
    var self = this;
    var mats = {
      stone: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.96, metalness: 0 }),
      stoneCyl: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.96, metalness: 0 }),
      timber: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.92, metalness: 0 }),
      cloth: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.9, metalness: 0 }),
      iron: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.55, metalness: 0.45 }),
      fire: new THREE.MeshStandardMaterial({
        color: srgb(0xFFC27A), emissive: srgb(0xFF7A2E), emissiveIntensity: 1.6,
        roughness: 0.55, metalness: 0
      }),
      rune: new THREE.MeshStandardMaterial({
        color: srgb(0x7ED7C4), emissive: srgb(0x2A8F83), emissiveIntensity: 1.1,
        roughness: 0.45, metalness: 0.1
      })
    };
    if (global.TexLib) {
      global.TexLib.apply(mats.stone, 'stoneBrick', 2.4, 1.7);
      // Silinder menara butuh ulangan lebih rapat agar bata tidak tampak
      // seperti papan kayu vertikal.
      global.TexLib.apply(mats.stoneCyl, 'stoneBrick', 5, 8);
      global.TexLib.apply(mats.timber, 'wood', 1.4, 2.0);
      global.TexLib.apply(mats.cloth, 'cloth', 2, 2);
      global.TexLib.apply(mats.iron, 'metal', 1.2, 1.2);
    }
    this.landmarks = [];
    for (var i = 0; i < this.landmarkSites.length; i++) {
      var site = this.landmarkSites[i];
      var b = new RuinBuilder(this, site, mats);
      if (site.id === 'chapel') buildChapelRuin(b);
      else if (site.id === 'tower') buildTowerRuin(b);
      else if (site.id === 'stones') buildStandingStones(b);
      else if (site.id === 'castle') buildCastleRuin(b);
      else continue;
      b.flush();
      this.landmarks.push({
        id: site.id, x: site.x, z: site.z, y: site.y, r: site.r,
        group: b.group
      });
    }
    if (global.console) {
      console.log('[Aetheria] Bangunan batu tua: ' + this.landmarks.length +
        ' (kapel, menara, batu berdiri, kastil)');
    }
    self.landmarkCount = this.landmarks.length;
  };

  /* --- Landmarks dari Quaternius MegaKit (modular buildings) --- */
  World.prototype.buildLandmarksFromKit = function (assets) {
    if (!assets || !assets.ready) return false;

    var self = this;
    var km = {
      wall: { mesh: null, list: [], mat: null, geo: null },
      roof: { mesh: null, list: [], mat: null, geo: null },
      floor: { mesh: null, list: [], mat: null, geo: null },
      tower: { mesh: null, list: [], mat: null, geo: null },
      chimney: { mesh: null, list: [], mat: null, geo: null },
      prop: { mesh: null, list: [], mat: null, geo: null },
      stair: { mesh: null, list: [], mat: null, geo: null },
      arch: { mesh: null, list: [], mat: null, geo: null }
    };

    var srgb = function(hex) { return new THREE.Color(hex).convertSRGBToLinear(); };

    // Initialize materials & geometries from loaded models
    function getGeo(name) {
      var spawned = assets.spawnStatic(name);
      if (!spawned || !spawned.group) return null;
      var geo = new THREE.BufferGeometry();
      var firstMesh = null;
      spawned.group.traverse(function(o) {
        if (o.isMesh && !firstMesh) firstMesh = o;
      });
      if (!firstMesh) return null;
      geo.copy(firstMesh.geometry);
      geo.applyMatrix4(firstMesh.matrix);
      return geo;
    }

    // Wall material (stone/brick)
    km.wall.mat = new THREE.MeshStandardMaterial({ color: srgb(0x6A6B63), roughness: 0.96, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.wall.mat, 'stoneBrick', 2.4, 1.7);
    km.wall.geo = getGeo('wall_unevenbrick_straight') || getGeo('wall_plaster_straight') || new THREE.BoxGeometry(4, 3, 0.4);

    // Roof material (tiles)
    km.roof.mat = new THREE.MeshStandardMaterial({ color: srgb(0x5C4E42), roughness: 0.9, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.roof.mat, 'shingle', 3, 1.8);
    km.roof.geo = getGeo('roof_roundtiles_4x4') || new THREE.ConeGeometry(3, 1.5, 4);

    // Floor material
    km.floor.mat = new THREE.MeshStandardMaterial({ color: srgb(0x77766C), roughness: 0.94, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.floor.mat, 'stoneBrick', 2, 1.2);
    km.floor.geo = getGeo('floor_brick') || new THREE.BoxGeometry(4, 0.2, 4);

    // Tower roof (conical)
    km.tower.mat = new THREE.MeshStandardMaterial({ color: srgb(0x5C4E42), roughness: 0.9, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.tower.mat, 'shingle', 5, 8);
    km.tower.geo = getGeo('roof_tower_roundtiles') || new THREE.ConeGeometry(2.5, 3, 8);

    // Chimney
    km.chimney.mat = new THREE.MeshStandardMaterial({ color: srgb(0x66645C), roughness: 0.95, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.chimney.mat, 'stoneBrick', 1.5, 1.5);
    km.chimney.geo = getGeo('prop_chimney') || new THREE.CylinderGeometry(0.5, 0.6, 4, 8);

    // Prop (crates, wagons, etc.)
    km.prop.mat = new THREE.MeshStandardMaterial({ color: srgb(0x59422D), roughness: 0.94, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.prop.mat, 'wood', 1, 2);
    km.prop.geo = getGeo('prop_crate') || new THREE.BoxGeometry(0.5, 0.5, 0.5);

    // Stair
    km.stair.mat = new THREE.MeshStandardMaterial({ color: srgb(0x7E6244), roughness: 0.95, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.stair.mat, 'wood', 1.6, 1);
    km.stair.geo = getGeo('stairs_exterior_straight') || new THREE.BoxGeometry(2, 0.3, 1);

    // Arch
    km.arch.mat = new THREE.MeshStandardMaterial({ color: srgb(0x6A6B63), roughness: 0.96, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.arch.mat, 'stoneBrick', 2.4, 1.7);
    km.arch.geo = getGeo('wall_arch') || new THREE.BoxGeometry(2, 3, 0.5);

    if (!this.landmarkSites || !this.landmarkSites.length) return false;
    this.landmarks = [];

    for (var i = 0; i < this.landmarkSites.length; i++) {
      var site = this.landmarkSites[i];
      var group = new THREE.Group();
      group.position.set(site.x, site.y, site.z);
      group.rotation.y = site.yaw || 0;

      var dummy = new THREE.Object3D();
      var tmpC = new THREE.Color();

      function addInstance(list, lx, ly, lz, sx, sy, sz, hex, ry, materialOverride) {
        var q = new THREE.Quaternion();
        if (ry) q.setFromEuler(new THREE.Euler(0, ry, 0));
        var local = new THREE.Matrix4().compose(
          new THREE.Vector3(lx, ly, lz), q, new THREE.Vector3(sx, sy, sz)
        );
        var worldMat = new THREE.Matrix4().compose(
          new THREE.Vector3(site.x, site.y, site.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, site.yaw || 0, 0)),
          new THREE.Vector3(1, 1, 1)
        );
        list.push({ m: new THREE.Matrix4().multiplyMatrices(worldMat, local), hex: hex, mat: materialOverride });
      }

      if (site.id === 'castle') {
        this._buildCastleFromKit(site, km, addInstance);
      } else if (site.id === 'chapel') {
        this._buildChapelFromKit(site, km, addInstance);
      } else if (site.id === 'tower') {
        this._buildTowerFromKit(site, km, addInstance);
      } else if (site.id === 'stones') {
        this._buildStandingStonesFromKit(site, km, addInstance);
      }

      // Create InstancedMeshes for this landmark
      for (var key in km) {
        var entry = km[key];
        if (!entry.list.length || !entry.geo || !entry.mat) continue;
        var mesh = new THREE.InstancedMesh(entry.geo, entry.mat, entry.list.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(entry.list.length * 3), 3);
        var rng = U.mulberry32(C.WORLD.seed + 4242 + i * 100 + key.length * 10);
        for (var j = 0; j < entry.list.length; j++) {
          mesh.setMatrixAt(j, entry.list[j].m);
          var c = entry.list[j].mat ? entry.list[j].mat.color.clone() : new THREE.Color();
          if (entry.list[j].hex) {
            c.setHex(entry.list[j].hex).convertSRGBToLinear().multiplyScalar(0.9 + rng() * 0.05);
          }
          mesh.setColorAt(j, c);
        }
        group.add(mesh);
        entry.list = []; // reset for next landmark
      }

      this.scene.add(group);
      this.landmarks.push({
        id: site.id, x: site.x, z: site.z, y: site.y, r: site.r,
        group: group
      });
    }

    if (global.console) {
      console.log('[Aetheria] Bangunan batu tua (MegaKit): ' + this.landmarks.length);
    }
    self.landmarkCount = this.landmarks.length;
    return true;
  };

  World.prototype._buildCastleFromKit = function (site, km, addInstance) {
    var base = 0.62;
    var wx = 12, wz = 9, wh = 4.7, wt = 0.75;

    // Foundation & courtyard
    addInstance(km.wall.list, 0, -0.8, 0, 28, 3.0, 23, 0x53544D);
    addInstance(km.floor.list, 0, base - 0.1, 0, 25.6, 0.26, 20.4, 0x706F65);

    // Outer walls (curtain walls)
    addInstance(km.wall.list, 0, base + wh / 2, -wz, wx * 2, wh, wt, 0x676860);
    addInstance(km.wall.list, -wx, base + wh / 2, -3.0, wt, wh, 6.0, 0x61625A);
    addInstance(km.wall.list, -wx, base + wh / 2, 5.7, wt, wh, 6.6, 0x5C5D55);
    addInstance(km.wall.list, wx, base + wh / 2, -2.0, wt, wh, 14.0, 0x64655D);
    addInstance(km.wall.list, wx, base + 0.7, 6.7, wt, 1.4, 4.6, 0x5B5C54);
    addInstance(km.wall.list, -4.1, base + wh / 2, wz, 7.8, wh, wt, 0x686961);
    addInstance(km.wall.list, 4.1, base + wh / 2, wz, 7.8, wh, wt, 0x686961);

    // Gatehouse: two square towers + gate body
    addInstance(km.wall.list, -2.4, base + 4.9, wz, 3.1, 9.8, 3.0, 0x66675F);
    addInstance(km.wall.list, 2.4, base + 4.9, wz, 3.1, 9.8, 3.0, 0x66675F);
    addInstance(km.wall.list, 0, base + 6.85, wz, 2.1, 4.5, 2.9, 0x65665E);
    addInstance(km.wall.list, 0, base + 9.3, wz, 3.5, 1.3, 2.6, 0x5E5F57);
    addInstance(km.arch.list, 0, base + 3.78, wz + 1.5, 2.05, 0.72, 2.2, 0x6A6B63); // arch over gate

    // Corner towers (cylindrical - use tower roof geo)
    addInstance(km.tower.list, -wx, base + 10.8, -wz, 2.6, 10.8, 2.6, 0x696A62);
    addInstance(km.tower.list, wx, base + 12.2, -wz, 2.7, 12.2, 2.7, 0x63645C);
    addInstance(km.tower.list, -wx, base + 7.4, wz, 2.45, 7.4, 2.45, 0x606159);
    addInstance(km.tower.list, wx, base + 9.6, wz, 2.55, 9.6, 2.55, 0x686961);

    // Battlements
    for (var bx = -10.2; bx <= 10.2; bx += 1.65) {
      if ((bx > -3 && bx < 3) || (bx > 5 && bx < 7)) continue;
      addInstance(km.wall.list, bx, base + wh + 0.35, -wz, 0.8, 0.7, 0.9, 0x5D5E56);
    }
    for (var fx = -10.2; fx <= 10.2; fx += 1.65) {
      if (fx > -4.2 && fx < 4.2) continue;
      addInstance(km.wall.list, fx, base + wh + 0.35, wz, 0.8, 0.7, 0.9, 0x5D5E56);
    }

    // Keep (inner stronghold)
    var kx = 0, kz = -4.3, khw = 5.0, khd = 3.2, kwh = 8.6;
    addInstance(km.wall.list, kx, base + kwh / 2, kz - khd, khw * 2, kwh, 0.85, 0x6A6B63);
    addInstance(km.wall.list, kx - khw, base + kwh / 2, kz, 0.85, kwh, khd * 2, 0x63645C);
    addInstance(km.wall.list, kx + khw, base + kwh / 2, kz, 0.85, kwh, khd * 2, 0x63645C);
    addInstance(km.wall.list, kx - 3.0, base + kwh / 2, kz + khd, 3.8, kwh, 0.85, 0x6C6D65);
    addInstance(km.wall.list, kx + 3.0, base + kwh / 2, kz + khd, 3.8, kwh, 0x6C6D65);
    addInstance(km.roof.list, kx, base + kwh - 0.35, kz + khd, 2.4, 0.7, 0.9, 0x5D5E56);

    // Keep windows & door
    addInstance(km.wall.list, kx - 2.3, base + 5.4, kz + khd + 0.44, 0.8, 1.5, 0.08, 0x1D201F);
    addInstance(km.wall.list, kx + 2.3, base + 5.4, kz + khd + 0.44, 0.8, 1.5, 0.08, 0x1D201F);
    addInstance(km.prop.list, kx, base + 1.65, kz + khd + 0.45, 1.8, 3.3, 0.16, 0x493423);

    // Banners
    addInstance(km.prop.list, -4.2, base + 10.0, kz + khd + 0.62, 1.5, 2.1, 0.06, 0x63252E);
    addInstance(km.prop.list, 4.2, base + 10.0, kz + khd + 0.62, 1.5, 2.1, 0.06, 0x2E4A66);

    // Rubble
    addInstance(km.prop.list, -7.3, base + 0.25, 4.4, 2.4, 0.55, 1.5, 0x5D5E56);
    addInstance(km.prop.list, 8.1, base + 0.32, 2.2, 1.8, 0.7, 1.2, 0x5B5C54);

    // Colliders
    this.wall(-wx, -wz, wx, -wz);
    this.wall(-wx, -wz, -wx, 2.0);
    this.wall(-wx, 4.0, -wx, wz);
    this.wall(-4.1, wz, -1.6, wz);
    this.wall(1.6, wz, 4.1, wz);
    this.wall(4.1, wz, wx, wz);
    this.wall(wx, wz, wx, -wz);
    this.wall(kx - khw, kz - khd, kx + khw, kz - khd);
    this.wall(kx - khw, kz - khd, kx - khw, kz + khd);
    this.wall(kx + khw, kz - khd, kx + khw, kz + khd);
    this.wall(kx - khw, kz + khd, kx - 1.0, kz + khd);
    this.wall(kx + 1.0, kz + khd, kx + khw, kz + khd);
    this.collider(-2.4, wz, 1.8);
    this.collider(2.4, wz, 1.8);
    this.collider(-wx, -wz, 2.8);
    this.collider(wx, -wz, 2.9);
    this.collider(-wx, wz, 2.6);
    this.collider(wx, wz, 2.7);

    // Gate torches
    var fireMat = new THREE.MeshStandardMaterial({
      color: srgb(0xFFC27A), emissive: srgb(0xFF7A2E), emissiveIntensity: 1.6,
      roughness: 0.55, metalness: 0
    });
    for (var tf = -1; tf <= 1; tf += 2) {
      addInstance(km.prop.list, tf * 2.4, base + 4.3, wz + 1.58, 0.62, 0.12, 0.3, 0x343537);
      addInstance(km.prop.list, tf * 2.4, base + 4.55, wz + 1.64, 0.26, 0.34, 0.26, 0xFFB05A, 0, fireMat);
    }
  };

  World.prototype._buildChapelFromKit = function (site, km, addInstance) {
    var base = 0.42;

    // Foundation & floor
    addInstance(km.wall.list, 0, -0.55, 0, 10.2, 1.95, 14.2, 0x55564F);
    addInstance(km.floor.list, 0, base - 0.08, 0, 8.6, 0.18, 12.4, 0x77766C);

    var hw = 4.0, hd = 6.0, wh = 4.9, wt = 0.52;

    // Walls: back, sides (right partially ruined)
    addInstance(km.wall.list, 0, base + wh / 2, -hd, hw * 2, wh, wt, 0x6A6B63);
    addInstance(km.wall.list, -hw, base + wh / 2, 0, wt, wh, hd * 2, 0x63645D);
    addInstance(km.wall.list, hw, base + 1.65, -hd * 0.18, wt, 3.3, hd * 1.55, 0x5E5F58);
    addInstance(km.wall.list, hw, base + 0.8, -hd * 0.92, wt, 1.6, hd * 0.55, 0x5A5B54);

    // Facade with gothic arch
    addInstance(km.wall.list, -2.5, base + wh / 2, hd, 3.0, wh, wt, 0x6C6D65);
    addInstance(km.wall.list, 2.5, base + wh / 2, hd, 3.0, wh, wt, 0x6C6D65);
    addInstance(km.arch.list, 0, base + 3.38, hd + 0.3, 2.18, 0.28, wt + 0.04, 0x6A6B63); // pointed arch

    // Tympanum with cross
    addInstance(km.wall.list, 0, base + 4.02, hd + 0.24, 0.16, 0.58, 0.035, 0x1F2220);
    addInstance(km.wall.list, 0, base + 4.08, hd + 0.24, 0.56, 0.16, 0.035, 0x1F2220);

    // Lancet windows
    for (var wi = -1; wi <= 1; wi += 2) {
      addInstance(km.wall.list, wi * 2.95, base + 2.85, hd + wt / 2 + 0.01, 0.44, 1.45, 0.09, 0x1E211F);
      addInstance(km.wall.list, wi * 2.95, base + 3.7, hd + wt / 2 + 0.01, 0.24, 0.34, 0.09, 0x1E211F);
    }

    // Ruined roof
    addInstance(km.roof.list, 0, base + wh + 0.2, hd, 7.1, 0.7, wt, 0x66675F);
    addInstance(km.roof.list, 0, base + wh + 0.68, hd, 5.2, 0.62, wt, 0x64655D);
    addInstance(km.roof.list, 0, base + wh + 1.12, hd, 3.5, 0.56, wt, 0x606159);
    addInstance(km.roof.list, 0, base + wh + 1.52, hd, 1.9, 0.5, wt, 0x5C5D56);

    // Cross on gable
    addInstance(km.prop.list, 0, base + wh + 2.12, hd, 0.14, 0.7, 0.15, 0x3B3C3A);
    addInstance(km.prop.list, 0, base + wh + 2.17, hd, 0.66, 0.14, 0.15, 0x3B3C3A);

    // Side windows (ruined)
    addInstance(km.wall.list, -hw - 0.03, base + 2.7, -2.0, 0.1, 1.55, 0.72, 0x1E211F);
    addInstance(km.wall.list, hw + 0.03, base + 2.7, -3.2, 0.1, 1.55, 0.72, 0x1E211F);

    // Heavy timber door with iron bands
    addInstance(km.prop.list, 0, base + 1.65, hd + 0.02, 2.0, 3.05, 0.16, 0x4A3524);
    addInstance(km.prop.list, 0, base + 0.75, hd + 0.12, 1.85, 0.12, 0.07, 0x38393A);
    addInstance(km.prop.list, 0, base + 2.0, hd + 0.12, 1.85, 0.12, 0.07, 0x38393A);
    addInstance(km.prop.list, 0, base + 2.85, hd + 0.12, 1.85, 0.12, 0.07, 0x38393A);

    // Altar & rune
    addInstance(km.wall.list, 0, base + 0.55, -4.2, 2.3, 1.1, 1.05, 0x77766B);
    var runeMat = new THREE.MeshStandardMaterial({
      color: srgb(0x7ED7C4), emissive: srgb(0x2A8F83), emissiveIntensity: 1.1,
      roughness: 0.45, metalness: 0.1
    });
    addInstance(km.prop.list, 0, base + 1.16, -4.2, 1.2, 0.06, 0.46, 0x7ED7C4, 0, runeMat);

    // Collapsed timbers
    addInstance(km.prop.list, -1.4, base + 0.18, -1.3, 4.1, 0.2, 0.26, 0x4A3524, 0.55);
    addInstance(km.prop.list, 1.7, base + 0.18, 1.5, 3.4, 0.2, 0.24, 0x4A3524, -0.8);
    addInstance(km.prop.list, 0.2, base + 0.18, -3.2, 2.8, 0.2, 0.24, 0x4A3524, 0.2);

    // Broken graveyard gate
    addInstance(km.wall.list, -6.2, base + 1.45, 7.2, 0.72, 2.9, 0.72, 0x66675F);
    addInstance(km.wall.list, -3.6, base + 1.15, 7.2, 0.72, 2.3, 0.72, 0x606159);
    addInstance(km.wall.list, -4.9, base + 2.5, 7.2, 3.4, 0.55, 0.72, 0.12, 0x65665E);

    // Gravestones
    var graves = [
      [-6.4, 2.2, 0.55, 1.35], [-7.6, 4.0, 0.5, 1.0], [-5.5, 4.7, 0.42, 0.9],
      [-7.2, 7.0, 0.46, 1.15], [-5.8, 8.2, 0.4, 0.8], [6.1, 2.6, 0.5, 1.1], [7.0, 5.3, 0.44, 0.95]
    ];
    for (var g = 0; g < graves.length; g++) {
      var gr = graves[g];
      addInstance(km.wall.list, gr[0], base + gr[3] / 2, gr[1], gr[2], gr[3], 0.26, (g % 3 - 1) * 0.16, 0x696A62);
    }

    // Rubble
    addInstance(km.prop.list, -5.0, base + 0.22, -7.7, 1.5, 0.45, 1.1, 0x5D5E57, 0.4);
    addInstance(km.prop.list, 4.6, base + 0.18, 7.9, 1.2, 0.36, 0.8, 0x606159, 0.9);
    addInstance(km.prop.list, 0.7, base + 0.16, -7.2, 0.9, 0.32, 0.7, 0x575851, 0.1);

    // Colliders (gap at front door)
    this.wall(-hw, -hd, hw, -hd);
    this.wall(-hw, -hd, -hw, hd);
    this.wall(hw, -hd, hw, -1.0);
    this.wall(hw, 2.4, hw, hd);
    this.wall(-hw, hd, -1.0, hd);
    this.wall(1.0, hd, hw, hd);
    this.collider(-4.9, 7.2, 0.7);
    this.collider(-3.6, 7.2, 0.7);
  };

  World.prototype._buildTowerFromKit = function (site, km, addInstance) {
    var base = 0.35;

    // Foundation
    addInstance(km.wall.list, 0, -0.8, 0, 8.2, 2.4, 8.2, 0x5E5F57);

    // Cylindrical tower body (use wall geo stacked, or tower geo)
    addInstance(km.tower.list, 0, base + 4.9, 0, 2.75, 9.8, 2.75, 0x7C7B72);

    // Floors
    addInstance(km.floor.list, 0, base + 2.6, 0, 2.79, 0.16, 2.79, 0x8B887D);
    addInstance(km.floor.list, 0, base + 5.4, 0, 2.79, 0.16, 2.79, 0x8B887D);

    // Ruined top
    addInstance(km.tower.list, 0, base + 9.55, 0, 2.2, 1.05, 2.2, 0x71716A);
    for (var i = 0; i < 8; i++) {
      if (i === 2 || i === 5) continue; // gaps in crenellation
      var a = i / 8 * Math.PI * 2;
      addInstance(km.wall.list, Math.cos(a) * 2.45, base + 9.9 + (i % 3) * 0.12, Math.sin(a) * 2.45,
        0.62, 0.9 + (i % 3) * 0.22, 0.62, -a, 0x5B5C55);
    }

    // Door & stairs
    addInstance(km.wall.list, 0, base + 1.45, 2.7, 1.65, 2.9, 0.22, 0x242521);
    addInstance(km.prop.list, 0, base + 1.2, 2.85, 1.3, 2.2, 0.14, 0x4B3625);
    addInstance(km.stair.list, 0, base + 0.2, 3.75, 2.7, 0.4, 1.9, 0x77776C);
    addInstance(km.stair.list, 0, base + 0.06, 5.1, 2.2, 0.24, 1.0, 0x6D6E65);

    // Arrow slits
    for (var k = 0; k < 5; k++) {
      var ang = k / 5 * Math.PI * 2 + 0.3;
      addInstance(km.wall.list, Math.cos(ang) * 2.77, base + 4.2 + (k % 2) * 1.6, Math.sin(ang) * 2.77,
        0.16, 1.15, 0.34, -ang, 0x1E211F);
    }

    // Brazier on top
    var fireMat = new THREE.MeshStandardMaterial({
      color: srgb(0xFFC27A), emissive: srgb(0xFF7A2E), emissiveIntensity: 1.6,
      roughness: 0.55, metalness: 0
    });
    addInstance(km.prop.list, 0, base + 10.4, 0, 0.7, 0.25, 0.7, 0x343537);
    addInstance(km.prop.list, 0, base + 10.72, 0, 0.46, 0.38, 0.46, 0xFFB05A, 0, fireMat);

    // Rune
    var runeMat = new THREE.MeshStandardMaterial({
      color: srgb(0x7ED7C4), emissive: srgb(0x2A8F83), emissiveIntensity: 1.1,
      roughness: 0.45, metalness: 0.1
    });
    addInstance(km.prop.list, 0, base + 10.62, 0, 0.42, 0.08, 0.42, 0x7ED7C4, 0, runeMat);

    // Rubble
    addInstance(km.prop.list, -2.4, base + 0.15, 2.9, 1.2, 0.35, 0.9, 0x5C5D55, 0.6);
    addInstance(km.prop.list, 2.2, base + 0.18, -2.4, 0.9, 0.4, 1.1, 0x62635B, 0.2);

    this.collider(0, 0, 2.9);
  };

  World.prototype._buildStandingStonesFromKit = function (site, km, addInstance) {
    var base = 0.15;

    // Central platform
    addInstance(km.floor.list, 0, base - 0.45, 0, 7.5, 1.1, 7.5, 0x7B7D73);

    var n = 8;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + 0.22;
      var r = 5.1 + (i % 3) * 0.24;
      var h = 3.2 + (i % 4) * 0.42;
      if (i === 4) h = 1.9; // fallen stone
      if (i === 2 || i === 3) h = 3.9; // taller stones

      var x = Math.cos(a) * r;
      var z = Math.sin(a) * r;
      var ry = Math.PI / 2 - a;

      if (i === 4) {
        // Fallen stone (lying down)
        addInstance(km.wall.list, x, base + h / 2, z, 0.92, h, 0.68, ry, i === 4 ? 0x85877D : 0x9A9C91);
      } else {
        addInstance(km.wall.list, x, base + h / 2, z, 0.92, h, 0.68, ry, 0x9A9C91);
      }

      // Runes on standing stones
      if (i !== 4) {
        var runeMat = new THREE.MeshStandardMaterial({
          color: srgb(0x7ED7C4), emissive: srgb(0x2A8F83), emissiveIntensity: 1.1,
          roughness: 0.45, metalness: 0.1
        });
        addInstance(km.prop.list, Math.cos(a) * (r + 0.36), base + h * 0.55, Math.sin(a) * (r + 0.36),
          0.56, 0.62, 0.03, ry, 0x7ED7C4, 0, runeMat);
      }
    }

    // Trilithon gateway (two tall stones with lintel)
    var la = 2 / n * Math.PI * 2 + 0.22;
    var lb = 3 / n * Math.PI * 2 + 0.22;
    var lr1 = 5.1 + (2 % 3) * 0.24;
    var lr2 = 5.1 + (3 % 3) * 0.24;
    var lx1 = Math.cos(la) * lr1, lz1 = Math.sin(la) * lr1;
    var lx2 = Math.cos(lb) * lr2, lz2 = Math.sin(lb) * lr2;
    var ldx = lx2 - lx1, ldz = lz2 - lz1;
    var llen = Math.sqrt(ldx * ldx + ldz * ldz);
    var lry = Math.atan2(-ldz, ldx);
    var lmx = (lx1 + lx2) / 2, lmz = (lz1 + lz2) / 2;

    // Lintel stone
    addInstance(km.wall.list, lmx, base + 3.9 + 0.24, lmz,
      llen + 1.0, 0.48, 0.78, lry, 0x7E8076);

    // Rune on lintel
    var runeMat = new THREE.MeshStandardMaterial({
      color: srgb(0x7ED7C4), emissive: srgb(0x2A8F83), emissiveIntensity: 1.1,
      roughness: 0.45, metalness: 0.1
    });
    var lside = Math.cos(lry) >= 0 ? 0.45 : -0.45;
    addInstance(km.prop.list, lmx + Math.sin(lry) * lside, base + 4.16, lmz + Math.cos(lry) * lside,
      1.8, 0.22, 0.04, lry, 0x7ED7C4, 0, runeMat);

    // Central altar
    addInstance(km.wall.list, 0, base + 0.35, 0, 2.1, 0.7, 1.25, 0, 0x9C9D92);
    addInstance(km.prop.list, 0, base + 0.73, 0, 1.1, 0.05, 0.48, 0, 0x7ED7C4, 0, runeMat);
    addInstance(km.prop.list, 0, base + 0.5, 0.66, 0.78, 0.5, 0.04, 0, 0x7ED7C4, 0, runeMat);

    // Fallen stones around
    addInstance(km.wall.list, 2.7, base + 0.3, -1.3, 2.8, 0.58, 0.78, 0.75, 0x6F7168);

    // Colliders
    for (var j = 0; j < n; j++) {
      var ang = j / n * Math.PI * 2 + 0.22;
      this.collider(Math.cos(ang) * 5.1, Math.sin(ang) * 5.1, 0.64);
    }
  };

  /* ================================================================
     KERAJAAN BESAR (Great Kingdom) — jantung dunia
     Tembok batu melingkar, kastil di tengah, 30 rumah rapi + jalan.
     Dipakai baik dengan model MegaKit (.glb) maupun fallback prosedural:
     setiap geometri model dinormalkan ke kotak 1x1x1 dengan alas di y=0,
     sehingga nilai skala pada add() SELALU dalam meter.
     Seluruh bangunan mengikuti tinggi tanah setempat (tidak melayang /
     terbenam di lereng).
     ================================================================ */

  /* Gabungkan semua primitif satu model menjadi satu geometri lalu normalkan
     ke kotak 1x1x1 (alas y=0, pusat x/z=0). Hasilnya aman dipakai
     InstancedMesh dengan skala meter. */
  function unitGeometryFrom(assets, name) {
    if (!assets || !assets.ready || !assets.has || !assets.has(name)) return null;
    var sp = assets.spawnStatic(name);
    if (!sp || !sp.group) return null;
    var root = sp.group;
    root.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    var pos = [], nor = [], uv = [], idx = [], offset = 0;
    var m4 = new THREE.Matrix4(), m3 = new THREE.Matrix3(), v = new THREE.Vector3();
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      var g = o.geometry;
      m4.multiplyMatrices(inv, o.matrixWorld);
      m3.getNormalMatrix(m4);
      var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      var i;
      for (i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m4);
        pos.push(v.x, v.y, v.z);
      }
      if (n) {
        for (i = 0; i < n.count; i++) {
          v.fromBufferAttribute(n, i).applyMatrix3(m3).normalize();
          nor.push(v.x, v.y, v.z);
        }
      } else {
        for (i = 0; i < p.count; i++) nor.push(0, 1, 0);
      }
      if (u) {
        for (i = 0; i < u.count; i++) uv.push(u.getX(i), u.getY(i));
      } else {
        for (i = 0; i < p.count; i++) uv.push(0, 0);
      }
      if (g.index) {
        for (i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + offset);
      } else {
        for (i = 0; i < p.count; i++) idx.push(i + offset);
      }
      offset += p.count;
    });
    if (!pos.length) return null;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (idx.length) geo.setIndex(idx);
    geo.computeBoundingBox();
    var bb = geo.boundingBox;
    var dx = Math.max(bb.max.x - bb.min.x, 0.0001);
    var dy = Math.max(bb.max.y - bb.min.y, 0.0001);
    var dz = Math.max(bb.max.z - bb.min.z, 0.0001);
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    geo.scale(1 / dx, 1 / dy, 1 / dz);
    geo.computeBoundingSphere();
    return geo;
  }

  /* Titik kerajaan: lahan paling datar & bebas air di sekitar pusat peta. */
  World.prototype.pickKingdomSite = function () {
    var half = C.WORLD.size * 0.5;
    var lim = Math.min(470, half * 0.36);
    var step = 24;
    var best = null, bestScore = Infinity;
    var self = this;
    var spots = this.villageSpots || [];
    for (var x = -lim; x <= lim; x += step) {
      for (var z = -lim; z <= lim; z += step) {
        var d = Math.sqrt(x * x + z * z);
        if (d > lim) continue;
        var mn = Infinity, mx = -Infinity, wet = false;
        for (var a = 0; a < 14; a++) {
          var ang = a / 14 * Math.PI * 2;
          for (var rr = 0; rr <= 74; rr += 14.8) {
            var h = self.groundHeight(x + Math.cos(ang) * rr, z + Math.sin(ang) * rr);
            if (h < 2.0) wet = true;
            if (h < mn) mn = h;
            if (h > mx) mx = h;
          }
        }
        if (wet) continue;
        var diff = mx - mn;
        if (diff > 30) continue;
        var blocked = false;
        for (var i = 0; i < spots.length && !blocked; i++) {
          if (Math.hypot(x - spots[i].x, z - spots[i].z) < 92 + spots[i].r) blocked = true;
        }
        if (!blocked && this.harborSpot) {
          if (Math.hypot(x - this.harborSpot.x, z - this.harborSpot.z) < 120) blocked = true;
        }
        if (blocked) continue;
        var score = diff * 1.2 + d * 0.03;
        if (score < bestScore) {
          bestScore = score;
          best = { x: x, z: z, diff: diff, minH: mn, maxH: mx };
        }
      }
    }
    if (!best) {
      var ch = this.groundHeight(0, 0);
      best = { x: 0, z: 0, diff: 0, minH: ch, maxH: ch };
    }
    best.id = 'great_kingdom';
    best.r = 76;
    best.yaw = 0;
    best.y = this.groundHeight(best.x, best.z);
    return best;
  };

  /* Titik kekaisaran: butuh lahan kering yang JAUH lebih luas (radius ~150 m)
     dan cukup datar untuk tembok raksasa + 100 rumah. Pencarian dua tahap:
     sapuan kasar seluruh peta, lalu penghalusan di sekitar kandidat terbaik. */
  World.prototype.pickEmpireSite = function () {
    var half = C.WORLD.size * 0.5;
    var lim = half - 180;
    var R = 150;
    var self = this;

    function blocked(x, z) {
      var i;
      var spots = self.villageSpots || [];
      for (i = 0; i < spots.length; i++) {
        if (Math.hypot(x - spots[i].x, z - spots[i].z) < 176 + (spots[i].r || 0)) return true;
      }
      if (self.harborSpot && Math.hypot(x - self.harborSpot.x, z - self.harborSpot.z) < 190) return true;
      if (self.kingdomSite && Math.hypot(x - self.kingdomSite.x, z - self.kingdomSite.z) < 345) return true;
      var isl = self.islandSites || [];
      for (i = 0; i < isl.length; i++) {
        if (Math.hypot(x - isl[i].x, z - isl[i].z) < 120) return true;
      }
      return false;
    }

    function measure(x, z, nAng, radii) {
      var mn = Infinity, mx = -Infinity, wet = 0, sum = 0, n = 0;
      for (var a = 0; a < nAng; a++) {
        var ang = a / nAng * Math.PI * 2;
        for (var ri = 0; ri < radii.length; ri++) {
          var h = self.groundHeight(x + Math.cos(ang) * radii[ri], z + Math.sin(ang) * radii[ri]);
          n++; sum += h;
          if (h < 2.4) wet++;
          if (h < mn) mn = h;
          if (h > mx) mx = h;
        }
      }
      return { diff: mx - mn, mn: mn, mx: mx, avg: sum / n, wet: wet };
    }

    // Fase 1 — sapuan kasar.
    var cands = [];
    for (var x = -lim; x <= lim; x += 96) {
      for (var z = -lim; z <= lim; z += 96) {
        if (blocked(x, z)) continue;
        var m = measure(x, z, 8, [0, 75, 150]);
        if (m.wet) continue;
        cands.push({ x: x, z: z, diff: m.diff });
      }
    }
    cands.sort(function (a, b) { return a.diff - b.diff; });

    // Fase 2 — penghalusan.
    var best = null, bestScore = Infinity;
    var top = Math.min(10, cands.length);
    for (var i = 0; i < top; i++) {
      for (var ox = -48; ox <= 48; ox += 48) {
        for (var oz = -48; oz <= 48; oz += 48) {
          var cx2 = cands[i].x + ox, cz2 = cands[i].z + oz;
          if (blocked(cx2, cz2)) continue;
          var mm = measure(cx2, cz2, 16, [0, 40, 80, 110, 130, 150]);
          if (mm.wet) continue;
          var score = mm.diff + Math.hypot(cx2, cz2) * 0.012;
          if (score < bestScore) {
            bestScore = score;
            best = { x: cx2, z: cz2, diff: mm.diff, minH: mm.mn, maxH: mm.mx, avg: mm.avg };
          }
        }
      }
    }
    if (!best) {
      // Longgar: kurangi radius dan izinkan sedikit air.
      for (var x2 = -lim; x2 <= lim; x2 += 96) {
        for (var z2 = -lim; z2 <= lim; z2 += 96) {
          if (blocked(x2, z2)) continue;
          var m2 = measure(x2, z2, 10, [0, 60, 120]);
          var sc = m2.diff + m2.wet * 4;
          if (sc < bestScore) { bestScore = sc; best = { x: x2, z: z2, diff: m2.diff, minH: m2.mn, maxH: m2.mx, avg: m2.avg }; }
        }
      }
    }
    if (!best) {
      var ch = this.groundHeight(0, 0);
      best = { x: 0, z: 0, diff: 0, minH: ch, maxH: ch, avg: ch };
    }
    best.id = 'empire';
    best.r = R + 12;
    best.yaw = 0;
    best.y = this.groundHeight(best.x, best.z);
    return best;
  };

  /* Material + geometri untuk kerajaan (MegaKit bila ada, primitif bila tidak). */
  World.prototype._kingdomParts = function (assets) {
    var srgb = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };
    var box = new THREE.BoxGeometry(1, 1, 1);
    var cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 14).translate(0, 0.5, 0);
    var cone = new THREE.ConeGeometry(0.5, 1, 14).translate(0, 0.5, 0);
    var pyramid = new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);

    function mkMat(hex, tex, rx, ry, rough) {
      // Warna dasar PUTIH: warna sebenarnya datang dari instanceColor (satu
      // material dipakai ratusan instance). Bila dikalikan dua kali, atap dan
      // panji jadi hampir hitam.
      var m = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF, roughness: rough === undefined ? 0.95 : rough, metalness: 0.02,
        // Model MegaKit (tembok, dinding rumah) hanya punya SATU sisi bidang —
        // dari luar terlihat menembus. DoubleSide menutup semua sisi.
        side: THREE.DoubleSide
      });
      if (tex && global.TexLib) global.TexLib.apply(m, tex, rx, ry);
      return m;
    }
    function part(model, fallback, hex, tex, rx, ry, rough) {
      return {
        geo: unitGeometryFrom(assets, model) || fallback,
        mat: mkMat(hex, tex, rx, ry, rough)
      };
    }

    return {
      // Dinding & tembok memakai kotak pejal (bukan model fasad MegaKit yang
      // hanya punya satu bidang) supaya tidak ada sisi yang tembus pandang.
      wall: { geo: box, mat: mkMat(0xC8C2B0, 'stoneBrick', 2.4, 1.7) },
      plaster: { geo: box, mat: mkMat(0xD6CEBB, 'plaster', 2, 1.5) },
      // Kotak pejal + tekstur cobble. Model MegaKit 'floor_unevenbrick' memakai
      // UV sisi yang memetakan ke bagian rumput di atlas → pita hijau di jalan
      // bertingkat (lereng). Kotak pejal selalu sewarna batu.
      floor: { geo: box, mat: mkMat(0x8E8678, 'cobble', 3, 3) },
      woodfloor: part('floor_woodlight', box, 0x9A7A4E, 'wood', 2, 2),
      roof: part('roof_roundtiles_4x4', pyramid, 0x6B4636, 'shingle', 3, 2),
      pyramidRoof: { geo: pyramid, mat: mkMat(0x5A3F32, 'shingle', 3, 2) },
      towerRoof: part('roof_tower_roundtiles', cone, 0x593E31, 'shingle', 6, 5),
      door: part('door_1_flat', box, 0x5B3D26, 'wood', 1.2, 2),
      window: part('window_wide_round1', box, 0x2C3840, null),
      chimney: part('prop_chimney', box, 0x8B8577, 'stoneBrick', 1, 2),
      crate: part('prop_crate', box, 0x8B6A3C, 'wood', 1, 1),
      fence: part('prop_woodenfence_single', box, 0x7A5A36, 'wood', 2, 1),
      stairsP: part('stairs_exterior_straight', box, 0x8A7150, 'wood', 2, 1),
      arch: part('wall_arch', box, 0x8B8577, 'stoneBrick', 2, 2),
      stone: { geo: box, mat: mkMat(0x9C9C92, 'stoneBrick', 2, 2) },
      timber: { geo: box, mat: mkMat(0x5B4128, 'wood', 1.5, 1.5) },
      iron: { geo: box, mat: mkMat(0x3A3C3E, null, 0, 0, 0.5) },
      body: { geo: cyl, mat: mkMat(0xADA79A, 'stoneBrick', 3, 2) },
      cap: { geo: cone, mat: mkMat(0x593E31, 'shingle', 6, 4) }
    };
  };

  /* Bangun kota berbenteng generik (dipakai kerajaan & kekaisaran).
     assets boleh null (mode file:// / fallback). */
  World.prototype._buildCity = function (assets, cfg) {
    var site = cfg.site;
    if (!site) return false;
    var self = this;
    var P = this._kingdomParts(assets);
    var srgb = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };
    var gh = function (x, z) { return self.groundHeight(x, z); };

    var fireMat = new THREE.MeshStandardMaterial({
      color: srgb(0xFFC27A), emissive: srgb(0xFF7A2E), emissiveIntensity: 1.7,
      roughness: 0.55, metalness: 0
    });
    var lampMat = new THREE.MeshStandardMaterial({
      color: srgb(0xFFE2A8), emissive: srgb(0xFFA64D), emissiveIntensity: 0.7,
      roughness: 0.5, metalness: 0
    });
    var clothRed = new THREE.MeshStandardMaterial({ color: srgb(0x8C2F33), roughness: 0.92 });
    if (global.TexLib) global.TexLib.apply(clothRed, 'cloth', 1.5, 1);
    var clothBlue = new THREE.MeshStandardMaterial({ color: srgb(0x2E4A66), roughness: 0.92 });
    if (global.TexLib) global.TexLib.apply(clothBlue, 'cloth', 1.5, 1);

    /* ---------- kumpulan instance per bagian ---------- */
    var bags = {};
    function bag(key, geoKey, material) {
      if (!bags[key]) {
        bags[key] = {
          geo: material ? P[geoKey].geo : P[key].geo,
          mat: material || P[key].mat,
          items: []
        };
      }
      return bags[key];
    }
    var q = new THREE.Quaternion();
    var euler = new THREE.Euler(0, 0, 0);
    function push(target, x, y, z, sx, sy, sz, hex, ry) {
      if (ry) { euler.set(0, ry, 0); q.setFromEuler(euler); } else { q.identity(); }
      target.items.push({
        m: new THREE.Matrix4().compose(
          new THREE.Vector3(x, y, z), q.clone(),
          new THREE.Vector3(Math.max(sx, 0.02), Math.max(sy, 0.02), Math.max(sz, 0.02))
        ),
        hex: hex
      });
    }
    function add(key, x, y, z, sx, sy, sz, hex, ry) {
      push(bag(key), x, y, z, sx, sy, sz, hex, ry);
    }
    function addMat(key, geoKey, material, x, y, z, sx, sy, sz, ry) {
      push(bag(key, geoKey, material), x, y, z, sx, sy, sz, null, ry);
    }

    /* ---------- parameter tata letak (meter) ---------- */
    var R_WALL = cfg.rWall || 60;       // radius tembok luar
    var WALL_H = cfg.wallH || 7.2;      // tinggi tembok
    var WALL_T = cfg.wallT || 0.9;      // tebal tembok
    var SEG = cfg.seg || 48;            // jumlah segmen tembok
    var GATE_W = cfg.gateW || 9;        // lebar gerbang utama
    var SIDE_GATE_W = cfg.sideGateW || 5.4;
    var PLAZA_R = cfg.plazaR || 23;     // radius pelataran kastil
    var RINGS = cfg.rings || [30, 39.5, 49];
    var RING_COUNT = cfg.ringCount || null;
    var RING_HOUSES = cfg.ringHouses || null;
    var ROAD_W = cfg.roadW || 4.6;
    var TOWERS = cfg.towers || 8;
    var TOWER_R = cfg.towerR || 3.4;
    var HS = cfg.houseScale || 1;

    var rng = U.mulberry32(C.WORLD.seed + (cfg.seed || 7777));
    var cx = site.x, cz = site.z;
    var centerY = gh(cx, cz);
    // Gerbang utama menghadap desa Aldenmere (kalau ada), kalau tidak ke timur.
    // Kekaisaran: gerbang utama jangan menghadap lereng curam.
    var mainAng = this._cityGateAngle(site, cfg);
    var gateAngles = [mainAng, mainAng + Math.PI / 2, mainAng + Math.PI, mainAng - Math.PI / 2];
    var QUAD = Math.PI / 2;

    // Lebar bukaan tembok per gerbang (busur, meter) supaya pilar gerbang
    // benar-benar menutup ujung segmen tembok — dulu celahnya tembus pandang.
    function gateArcHalf(gi) {
      return (gi === 0 ? GATE_W : SIDE_GATE_W) / 2 + 3.1;
    }
    function nearGate(a) {
      for (var i = 0; i < gateAngles.length; i++) {
        var d = Math.abs(((a - gateAngles[i] + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (d * R_WALL < gateArcHalf(i)) return true;
      }
      return false;
    }

    /* ---------- 1. TEMBOK LUAR MELINGKAR ---------- */
    var segLen = 2 * R_WALL * Math.sin(Math.PI / SEG);
    for (var s = 0; s < SEG; s++) {
      var a0 = (s / SEG) * Math.PI * 2;
      var a1 = ((s + 1) / SEG) * Math.PI * 2;
      var am = (a0 + a1) / 2;
      if (nearGate(am)) continue;
      var x0 = cx + Math.cos(a0) * R_WALL, z0 = cz + Math.sin(a0) * R_WALL;
      var x1 = cx + Math.cos(a1) * R_WALL, z1 = cz + Math.sin(a1) * R_WALL;
      var mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      // Sampel beberapa titik di sepanjang segmen: di lereng, alas tembok harus
      // mengikuti tanah TERENDAH supaya tidak menggantung.
      var base = Infinity;
      for (var gs = 0; gs <= 4; gs++) {
        var gsx = x0 + (x1 - x0) * gs / 4, gsz = z0 + (z1 - z0) * gs / 4;
        var gsh = gh(gsx, gsz);
        if (gsh < base) base = gsh;
      }
      base -= 0.9;
      var top = Math.max(gh(x0, z0), gh(x1, z1)) + WALL_H;
      var ry = -Math.atan2(z1 - z0, x1 - x0);
      add('wall', mx, (base + top) / 2, mz, segLen * 1.06, top - base, WALL_T, 0xC6C0AE, ry);
      // Wereng (battlements)
      for (var b = -1; b <= 1; b += 2) {
        var bx = mx + (x1 - x0) / segLen * b * (segLen * 0.26);
        var bz = mz + (z1 - z0) / segLen * b * (segLen * 0.26);
        add('stone', bx, top + 0.55, bz, 1.1, 1.1, WALL_T * 1.05, 0xC2BCAA, ry);
      }
      // Jalan setapak di atas tembok (lorong patroli)
      add('floor', mx, top - 0.25, mz, segLen * 1.02, 0.3, WALL_T * 0.85, 0x9A9384, ry);
      // Penghalang fisik
      this.walls.push({ x1: x0, z1: z0, x2: x1, z2: z1, r: 0.55 });
    }

    /* ---------- 2. MENARA (mengelilingi tembok) ---------- */
    var towerAngles = [];
    for (var t = 0; t < TOWERS; t++) {
      var ta = t / TOWERS * Math.PI * 2 + Math.PI / TOWERS;
      if (nearGate(ta)) continue;
      towerAngles.push(ta);
    }
    for (var ti = 0; ti < towerAngles.length; ti++) {
      var aa = towerAngles[ti];
      var tx = cx + Math.cos(aa) * R_WALL, tz = cz + Math.sin(aa) * R_WALL;
      var ty = gh(tx, tz) - 1.3;
      var th = WALL_H + 5.5;
      var tr = TOWER_R;
      add('body', tx, ty, tz, tr * 2, th, tr * 2, 0xC2BCAA);
      add('towerRoof', tx, ty + th, tz, tr * 2.5, 6.2, tr * 2.5, 0x593E31);
      add('floor', tx, ty + th - 0.3, tz, tr * 1.9, 0.3, tr * 1.9, 0x9A9384);
      // Puncak bendera
      add('timber', tx, ty + th + 6.2, tz, 0.16, 3.4, 0.16, 0x5B4128);
      addMat('bannerA', 'timber', clothRed, tx + 1.0, ty + th + 8.0, tz, 1.9, 1.3, 0.06);
      this.colliders.push({ x: tx, z: tz, r: tr + 0.35 });
    }

    /* ---------- 3. GERBANG (utama + 3 samping) ---------- */
    for (var gi = 0; gi < gateAngles.length; gi++) {
      var ga = gateAngles[gi];
      var isMain = gi === 0;
      var gx = cx + Math.cos(ga) * R_WALL, gz = cz + Math.sin(ga) * R_WALL;
      var gy = gh(gx, gz);
      var tang = -(ga + Math.PI / 2);   // rotasi Three.js (X lokal → garis singgung)
      var gw = isMain ? GATE_W : SIDE_GATE_W;
      var ghgt = isMain ? WALL_H + 3.4 : WALL_H + 1.6;
      var openH = isMain ? 5.0 : 4.2;   // tinggi lubang gerbang
      // Pilar kiri/kanan
      for (var side = -1; side <= 1; side += 2) {
        var px = gx + Math.cos(ga + Math.PI / 2) * side * (gw / 2 + 1.7);
        var pz = gz + Math.sin(ga + Math.PI / 2) * side * (gw / 2 + 1.7);
        add('stone', px, gy + ghgt / 2, pz, 3.4, ghgt, 3.4, 0xC6C0AE, tang);
        if (isMain) {
          add('body', px, gy - 0.5, pz, 6.2, ghgt + 5.5, 6.2, 0xC2BCAA);
          add('towerRoof', px, gy + ghgt + 5.0, pz, 8.4, 6.4, 8.4, 0x593E31);
          this.colliders.push({ x: px, z: pz, r: 3.4 });
          // Obor gerbang
          addMat('fire', 'stone', fireMat, px - Math.cos(ga) * 3.4, gy + 4.6, pz - Math.sin(ga) * 3.4, 0.55, 0.7, 0.55);
        } else {
          this.colliders.push({ x: px, z: pz, r: 1.9 });
        }
      }
      // Ambang atas gerbang (tepat di atas lubang, bukan menggantung di puncak).
      // 'stone' (kotak pejal) — model 'arch' MegaKit berlubang sehingga tembus pandang.
      add('stone', gx, gy + openH + 0.7, gz, gw + 6.8, 1.4, 1.2, 0xA8A294, tang);
      // Dinding pengisi di atas ambang → tidak ada lagi lubang tembus pandang
      var fillH = ghgt - openH - 1.4;
      if (fillH > 0.15) {
        add('wall', gx, gy + openH + 1.4 + fillH / 2, gz, gw + 6.8, fillH, 0.9, 0xC6C0AE, tang);
        add('stone', gx, gy + openH + 1.4 + fillH / 2, gz, 0.9, fillH * 0.92, 1.15, 0xCAC4B2, tang);
      }
      // Daun pintu (kayu) — gerbang utama tertutup separuh
      if (isMain) {
        for (var dside = -1; dside <= 1; dside += 2) {
          var dx2 = gx + Math.cos(ga + Math.PI / 2) * dside * (gw / 4 - 0.1);
          var dz2 = gz + Math.sin(ga + Math.PI / 2) * dside * (gw / 4 - 0.1);
          add('timber', dx2, gy + openH / 2, dz2, gw / 2 + 0.15, openH, 0.28, 0x4A3524, tang);
        }
        // Bumbung gerbang + panji
        add('pyramidRoof', gx, gy + ghgt + 0.5, gz, gw + 7, 5.4, gw + 7, 0x6B4636);
        addMat('bannerB', 'timber', clothBlue, gx, gy + ghgt + 3.2, gz, 2.2, 1.5, 0.06, tang);
      }
    }

    /* ---------- 3b. JALAN MASUK DARI LUAR TEMBOK ---------- */
    // Tanpa ini gerbang tampak "menempel" di padang rumput. Ubin pendek supaya
    // jalan ikut naik-turun mengikuti lereng.
    for (var gpi = 0; gpi < gateAngles.length; gpi++) {
      var gpa = gateAngles[gpi];
      var gpw = gpi === 0 ? GATE_W + 1.5 : SIDE_GATE_W + 1.2;
      for (var gps = 0; gps < 10; gps++) {
        var gpd = R_WALL + 2.2 + gps * 3.4;
        var gpx = cx + Math.cos(gpa) * gpd, gpz = cz + Math.sin(gpa) * gpd;
        add('floor', gpx, gh(gpx, gpz) - 0.42, gpz, 4.4, 1.2, gpw, 0x8E8678, -gpa);
      }
    }

    /* ---------- 4. PELATARAN KASTIL ---------- */
    // Pelataran harus lebih tinggi dari tanah tertinggi di dalam lingkarannya,
    // kalau tidak ia terkubur di sisi bukit. Dasarnya turun sampai tanah terendah.
    var plazaMn = Infinity, plazaMx = -Infinity;
    for (var psa = 0; psa < 16; psa++) {
      for (var psr = 0; psr <= 2; psr++) {
        var prad = PLAZA_R * psr / 2;
        var pval = gh(cx + Math.cos(psa / 16 * Math.PI * 2) * prad,
          cz + Math.sin(psa / 16 * Math.PI * 2) * prad);
        if (pval < plazaMn) plazaMn = pval;
        if (pval > plazaMx) plazaMx = pval;
      }
    }
    var plazaTop = Math.max(centerY + 0.6, plazaMx + 0.55);
    var plazaBot = Math.min(centerY - 1.4, plazaMn - 1.8);
    add('body', cx, plazaBot, cz, PLAZA_R * 2, plazaTop - plazaBot, PLAZA_R * 2, 0xA8A296);
    add('body', cx, plazaTop - 0.18, cz, PLAZA_R * 2 - 1.2, 0.36, PLAZA_R * 2 - 1.2, 0x8E8678);
    // Tangga masuk pelataran dari 4 jalan utama
    for (var pst = 0; pst < 4; pst++) {
      var pa = gateAngles[pst];
      var px2 = cx + Math.cos(pa) * (PLAZA_R + 1.4);
      var pz2 = cz + Math.sin(pa) * (PLAZA_R + 1.4);
      add('stairsP', px2, plazaTop - 1.5, pz2, 6.4, 1.9, 3.4, 0x9A9384, -pa + Math.PI / 2);
    }

    /* ---------- 5. JALAN: 4 radial + 4 lingkar ---------- */
    var roadHex = 0x8E8678;
    for (var ri = 0; ri < 4; ri++) {
      var ra = gateAngles[ri];
      for (var rr2 = PLAZA_R + 3; rr2 < R_WALL - 2; rr2 += 4) {
        var rx = cx + Math.cos(ra) * rr2;
        var rz = cz + Math.sin(ra) * rr2;
        add('floor', rx, gh(rx, rz) - 0.32, rz, 4.3, 1.0, ROAD_W, roadHex, -ra);
      }
      // Tiang lampu di sisi jalan (tiap 12 m)
      for (var lp = PLAZA_R + 7; lp < R_WALL - 6; lp += 12) {
        for (var ls = -1; ls <= 1; ls += 2) {
          var lx = cx + Math.cos(ra) * lp + Math.cos(ra + Math.PI / 2) * ls * (ROAD_W / 2 + 0.9);
          var lz = cz + Math.sin(ra) * lp + Math.sin(ra + Math.PI / 2) * ls * (ROAD_W / 2 + 0.9);
          var ly = gh(lx, lz);
          add('timber', lx, ly + 1.55, lz, 0.16, 3.1, 0.16, 0x4A3A28);
          addMat('lamp', 'stone', lampMat, lx, ly + 3.25, lz, 0.42, 0.5, 0.42);
          this.colliders.push({ x: lx, z: lz, r: 0.24 });
        }
      }
    }
    // Jalan lingkar: satu di antara tiap pasang cincin rumah, plus satu di luar
    // cincin terluar dan satu di tepi pelataran.
    var ringRoads = [];
    if (RINGS.length) {
      ringRoads.push(Math.max(PLAZA_R + 2.6, RINGS[0] - (RINGS.length > 1 ? (RINGS[1] - RINGS[0]) / 2 : 5)));
      for (var rgi = 1; rgi < RINGS.length; rgi++) {
        ringRoads.push((RINGS[rgi - 1] + RINGS[rgi]) / 2);
      }
      ringRoads.push(Math.min(R_WALL - 4.5, RINGS[RINGS.length - 1] + 6));
    }
    for (var rri = 0; rri < ringRoads.length; rri++) {
      var rad = ringRoads[rri];
      var nseg = Math.max(24, Math.round(rad * 0.9));
      var stepA = Math.PI * 2 / nseg;
      var chord = 2 * rad * Math.sin(stepA / 2);
      for (var s2 = 0; s2 < nseg; s2++) {
        var aa2 = s2 * stepA + stepA / 2;
        var rx2 = cx + Math.cos(aa2) * rad;
        var rz2 = cz + Math.sin(aa2) * rad;
        add('floor', rx2, gh(rx2, rz2) - 0.32, rz2, chord * 1.08, 1.0, ROAD_W - 1.2, roadHex, -(aa2 + Math.PI / 2));
      }
    }

    /* ---------- 6. RUMAH WARGA (28 unit) ---------- */
    var houses = 0;
    function houseWorld(hx, hz, ry) {
      var cos = Math.cos(ry), sin = Math.sin(ry);
      return function (lx, lz) {
        return { x: hx + cos * lx + sin * lz, z: hz - sin * lx + cos * lz };
      };
    }
    function addHouse(hx, hz, ry, hw, hd, opts) {
      opts = opts || {};
      var wallH = opts.wallH || 3.0;
      var roofH = opts.roofH || 2.6;
      var y0 = gh(hx, hz);
      var at = houseWorld(hx, hz, ry);
      var hex = opts.hex || 0xD9CFB4;
      var floorTop = y0 + 0.72;
      var wallBase = floorTop + 0.08;
      // Dinding dimulai sedikit di bawah bibir pondasi supaya tidak ada celah
      // gelap antara dinding dan pondasi.
      var wallMid = wallBase + wallH / 2 - 0.2;
      var wallHt = wallH + 0.4;
      var doorW = opts.doorW || 1.5;
      var doorH = opts.doorH || 2.2;

      // Pondasi (turun 1.2 m agar menempel di lereng)
      add('stone', hx, y0 - 0.1, hz, hw * 2 + 0.7, 1.6, hd * 2 + 0.7, 0x93897A, ry);
      // Lantai
      add('woodfloor', hx, floorTop - 0.09, hz, hw * 2, 0.18, hd * 2, 0x8B6A42, ry);

      // Dinding belakang
      var bp = at(0, -hd);
      add('plaster', bp.x, wallMid, bp.z, hw * 2, wallHt, 0.3, hex, ry);
      // Dinding samping — model tembok memanjang di sumbu X, jadi diputar 90°
      // agar bidang besarnya menghadap keluar (dulu terbalik → tembok tembus).
      var lp2 = at(-hw, 0);
      add('plaster', lp2.x, wallMid, lp2.z, hd * 2, wallHt, 0.3, hex, ry + Math.PI / 2);
      var rp2 = at(hw, 0);
      add('plaster', rp2.x, wallMid, rp2.z, hd * 2, wallHt, 0.3, hex, ry + Math.PI / 2);

      // Dinding depan dengan lubang pintu
      var panelW = hw - doorW / 2 - 0.15;
      var fl = at(-(doorW / 2 + 0.15 + panelW / 2), hd);
      var fr = at(doorW / 2 + 0.15 + panelW / 2, hd);
      add('plaster', fl.x, wallMid, fl.z, panelW, wallHt, 0.3, hex, ry);
      add('plaster', fr.x, wallMid, fr.z, panelW, wallHt, 0.3, hex, ry);
      var lint = at(0, hd);
      add('plaster', lint.x, wallBase + doorH + (wallH - doorH) / 2, lint.z, doorW + 0.3, wallH - doorH, 0.3, hex, ry);

      // Pintu + kusen + jendela
      var dp = at(0, hd + 0.09);
      add('door', dp.x, wallBase + doorH / 2, dp.z, doorW * 0.94, doorH, 0.14, 0x4F3722, ry);
      add('stone', lint.x, wallBase + doorH + 0.12, lint.z, doorW + 0.9, 0.3, 0.55, 0xA39B8C, ry);
      for (var wsd = -1; wsd <= 1; wsd += 2) {
        var wp = at(wsd * (hw * 0.62), hd + 0.12);
        add('window', wp.x, wallBase + wallH * 0.58, wp.z, 1.15, 1.15, 0.22, 0x2C3840, ry);
      }

      // Atap + cerobong + lis
      add('roof', hx, wallBase + wallH, hz, hw * 2 + 1.6, roofH, hd * 2 + 1.6, opts.roofHex || 0x6B4636, ry);
      // Langit-langit: atap MegaKit berbentuk cangkang terbuka, tanpa ini
      // pemain melihat menembus atap dari dalam rumah.
      add('woodfloor', hx, wallBase + wallH - 0.04, hz, hw * 2 - 0.1, 0.1, hd * 2 - 0.1, 0x8C6C4E, ry);
      var chp = at(hw * 0.52, -hd * 0.42);
      add('chimney', chp.x, wallBase + wallH - 0.4, chp.z, 0.75, 3.4, 0.75, 0x8B8577, ry);

      // Beranda / kanopi kecil di atas pintu
      add('timber', dp.x, wallBase + doorH + 0.55, dp.z + Math.sin(ry) * 0.45, doorW + 1.3, 0.16, 1.1, 0x5B4128, ry);
      // Tangga masuk
      var stp = at(0, hd + 0.95);
      add('stairsP', stp.x, y0 + 0.32, stp.z, 2.3, 0.55, 1.5, 0x9A8B72, ry);
      // Pagar taman kecil di belakang rumah
      if (opts.fence !== false) {
        for (var fi = -1; fi <= 1; fi++) {
          var fp = at(fi * 1.7, -hd - 2.2);
          add('fence', fp.x, y0 + 0.45, fp.z, 3.0, 0.9, 0.14, 0x7A5A36, ry);
        }
      }

      // Platform agar pemain bisa masuk
      this.platforms.push({
        x: hx, z: hz,
        hw: hw + 0.1, hd: hd + 0.1,
        cos: Math.cos(ry), sin: Math.sin(ry),
        top: floorTop, ceil: wallBase + wallH,
        doorW: doorW, doorH: doorH
      });
      // Dinding fisik (celah di pintu)
      this._addKingdomWallColliders(hx, hz, ry, hw + 0.15, hd + 0.15, doorW);
      houses++;
    }

    if (RING_HOUSES) {
      // Cincin penuh (kekaisaran): jumlah rumah persis seperti daftar. Rumah
      // yang jatuh di mulut gerbang digeser sedikit, bukan dibuang.
      for (var ring = 0; ring < RINGS.length; ring++) {
        var rad2 = RINGS[ring];
        var nH = RING_HOUSES[ring] || 0;
        var bigR = ring === 1 || (cfg.grand && (ring === 2 || ring === 3));
        for (var k = 0; k < nH; k++) {
          var ang2 = (k + 0.5) / nH * Math.PI * 2 + ring * 0.13;
          var tries = 0;
          while (nearGate(ang2) && tries++ < 60) ang2 += 0.028;
          var hx = cx + Math.cos(ang2) * rad2;
          var hz = cz + Math.sin(ang2) * rad2;
          var hry = -ang2 - Math.PI / 2;  // pintu menghadap pusat kota
          var hw = (bigR ? 3.4 : (ring === 2 ? 3.0 : 2.8)) * HS;
          var hd = (bigR ? 2.9 : (ring === 2 ? 2.6 : 2.4)) * HS;
          addHouse.call(this, hx, hz, hry, hw, hd, {
            wallH: 3.0 + (bigR ? 0.5 : 0),
            roofH: 2.5 + (bigR ? 0.6 : 0),
            hex: [0xD9CFB4, 0xD2C6A9, 0xE0D8C2][(rng() * 3) | 0],
            roofHex: [0x6B4636, 0x5E4232, 0x744C3A][(rng() * 3) | 0],
            doorW: bigR ? 1.7 : 1.5
          });
        }
      }
    } else {
      for (var ring2 = 0; ring2 < RINGS.length; ring2++) {
        var rad3 = RINGS[ring2];
        for (var qi = 0; qi < 4; qi++) {
          var per = RING_COUNT[ring2][qi];
          var baseAng = gateAngles[qi] + 0.26;
          var span = QUAD - 0.52;
          for (var k2 = 0; k2 < per; k2++) {
            var ang3 = baseAng + span * (k2 + 0.5) / per;
            var hx2 = cx + Math.cos(ang3) * rad3;
            var hz2 = cz + Math.sin(ang3) * rad3;
            var hry2 = -ang3 - Math.PI / 2;  // fasad (pintu) menghadap pusat kota
            var big = ring2 === 1;
            var hw2 = (big ? 3.4 : (ring2 === 2 ? 3.0 : 2.8)) * HS;
            var hd2 = (big ? 2.9 : (ring2 === 2 ? 2.6 : 2.4)) * HS;
            addHouse.call(this, hx2, hz2, hry2, hw2, hd2, {
              wallH: 3.0 + (big ? 0.4 : 0),
              roofH: 2.5 + (big ? 0.5 : 0),
              hex: [0xD9CFB4, 0xD2C6A9, 0xE0D8C2][(rng() * 3) | 0],
              roofHex: [0x6B4636, 0x5E4232, 0x744C3A][(rng() * 3) | 0],
              doorW: big ? 1.7 : 1.5
            });
          }
        }
      }
    }

    /* ---------- 7. KASTIL DI TENGAH ---------- */
    this._buildCastle({ add: add, addMat: addMat, clothRed: clothRed, clothBlue: clothBlue },
      cx, cz, plazaTop, mainAng, cfg.grand ? {
        half: 26, wallH: 12, wallT: 1.5, gateHalf: 4.6, gateH: 7.0,
        keepW: 22, keepH: 34, keepR: 16.0, turretR: 4.2, turretH: 26,
        midTurrets: true, batt: 6, windowRows: [8, 17, 26], roofH: 12,
        banners: true, stair: true
      } : {
        half: 13.2, wallH: 7.5, wallT: 1.0, gateHalf: 2.2, gateH: 4.0,
        keepW: 16, keepH: 20, keepR: 11.2, turretR: 3.2, turretH: 16,
        midTurrets: false, batt: 5, windowRows: [6, 12.5], roofH: 8.5,
        banners: true, stair: false
      });

    /* ---------- 8. PASAR, SUMUR, PATUNG, PENGHIAS ---------- */
    var ma = gateAngles[0];
    var mcx = cx + Math.cos(ma) * 51, mcz = cz + Math.sin(ma) * 51;
    var mcy = gh(mcx, mcz);
    for (var stall = -1; stall <= 1; stall++) {
      var sx2 = mcx + Math.cos(ma + Math.PI / 2) * stall * 5.2;
      var sz2 = mcz + Math.sin(ma + Math.PI / 2) * stall * 5.2;
      add('timber', sx2, mcy + 1.2, sz2, 0.16, 2.4, 0.16, 0x4A3A28);
      add('timber', sx2 + Math.cos(ma + Math.PI / 2) * 1.6, mcy + 1.6, sz2 + Math.sin(ma + Math.PI / 2) * 1.6,
        0.16, 3.2, 0.16, 0x4A3A28);
      addMat('clothA', 'timber', clothRed, sx2, mcy + 2.9, sz2, 4.4, 0.16, 3.2, -ma);
      add('woodfloor', sx2, mcy + 1.0, sz2, 3.4, 0.16, 1.5, 0x8B6A42, -ma);
      add('crate', sx2 + 1.2, mcy + 0.5, sz2, 0.7, 0.7, 0.7, 0x8B6A3C, -ma);
      add('crate', sx2 - 1.0, mcy + 0.42, sz2 + 0.3, 0.58, 0.58, 0.58, 0x93713E, -ma);
      this.colliders.push({ x: sx2, z: sz2, r: 1.1 });
    }
    // Sumur di pelataran (di luar kastil, di atas permukaan pelataran)
    var wrad = Math.max(27, PLAZA_R - 9);
    var wx2 = cx + Math.cos(ma + 0.55) * wrad, wz2 = cz + Math.sin(ma + 0.55) * wrad;
    var wy2 = cfg.grand ? plazaTop : gh(wx2, wz2);
    add('body', wx2, wy2, wz2, 2.6, 0.95, 2.6, 0x8E8678);
    add('body', wx2, wy2 + 0.95, wz2, 2.1, 0.08, 2.1, 0x1B262C);
    add('timber', wx2 - 1.0, wy2 + 1.9, wz2, 0.16, 1.9, 0.16, 0x5B4128);
    add('timber', wx2 + 1.0, wy2 + 1.9, wz2, 0.16, 1.9, 0.16, 0x5B4128);
    add('roof', wx2, wy2 + 2.8, wz2, 3.4, 1.3, 2.9, 0x6B4636);
    this.colliders.push({ x: wx2, z: wz2, r: 1.5 });

    // 4 patung batu di pelataran
    for (var st = 0; st < 4; st++) {
      var sa = gateAngles[st] + Math.PI / 4;
      var stx = cx + Math.cos(sa) * (PLAZA_R - 3.5);
      var stz = cz + Math.sin(sa) * (PLAZA_R - 3.5);
      add('stone', stx, plazaTop + 0.4, stz, 1.5, 0.9, 1.5, 0xA39C8D, -sa);
      add('stone', stx, plazaTop + 2.2, stz, 0.85, 2.8, 0.85, 0xB4AD9C, -sa);
      add('stone', stx, plazaTop + 3.9, stz, 1.2, 0.7, 1.2, 0xA8A192, -sa);
      this.colliders.push({ x: stx, z: stz, r: 0.9 });
    }

    // Api unggun di alun-alun pasar + bendera gerbang
    var fx2 = mcx + Math.cos(ma + Math.PI / 2) * 7.5;
    var fz2 = mcz + Math.sin(ma + Math.PI / 2) * 7.5;
    var fy2 = gh(fx2, fz2);
    add('stone', fx2, fy2 + 0.15, fz2, 1.9, 0.3, 1.9, 0x6E6A60, 0);
    add('timber', fx2, fy2 + 0.42, fz2, 1.5, 0.22, 0.22, 0x4A3A28, 0.6);
    add('timber', fx2, fy2 + 0.42, fz2, 1.5, 0.22, 0.22, 0x4A3A28, -0.6);
    addMat('fire', 'stone', fireMat, fx2, fy2 + 0.85, fz2, 0.85, 1.1, 0.85);
    this.colliders.push({ x: fx2, z: fz2, r: 1.2 });

    /* ---------- 9. POHON HIAS DI SELA-SELA RUMAH ---------- */
    // Apakah titik berada di dalam (atau terlalu dekat) sebuah rumah?
    function inPlatform(x, z, pad) {
      pad = pad === undefined ? 0.6 : pad;
      for (var pi = 0; pi < self.platforms.length; pi++) {
        var pp = self.platforms[pi];
        var pdx = x - pp.x, pdz = z - pp.z;
        if (pdx * pdx + pdz * pdz > 90) continue;
        var plx = pdx * pp.cos - pdz * pp.sin;
        var plz = pdx * pp.sin + pdz * pp.cos;
        if (Math.abs(plx) < pp.hw + pad && Math.abs(plz) < pp.hd + pad) return true;
      }
      return false;
    }
    var nTrees = cfg.trees === undefined ? 22 : cfg.trees;
    for (var tr2 = 0; tr2 < nTrees; tr2++) {
      var tra = rng() * Math.PI * 2;
      var trr = PLAZA_R + 4 + rng() * (R_WALL - PLAZA_R - 8);
      var trx = cx + Math.cos(tra) * trr;
      var trz = cz + Math.sin(tra) * trr;
      var try2 = gh(trx, trz);
      // jangan menimpa jalan
      var nearRoad = false;
      for (var rg = 0; rg < ringRoads.length && !nearRoad; rg++) {
        if (Math.abs(trr - ringRoads[rg]) < ROAD_W * 0.65 + 0.6) nearRoad = true;
      }
      for (var gq = 0; gq < 4 && !nearRoad; gq++) {
        var dd = Math.abs(((tra - gateAngles[gq] + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (dd * trr < ROAD_W * 0.75 + 1.2) nearRoad = true;
      }
      if (nearRoad) continue;
      if (inPlatform(trx, trz, 1.3)) continue;
      add('timber', trx, try2 + 1.1, trz, 0.3, 2.2, 0.3, 0x4E3B26);
      add('stone', trx, try2 + 2.6, trz, 2.6, 1.9, 2.6, 0x4C6B3C, 0.4);
    }

    /* ---------- 10. WARGA KOTA (titik NPC) ---------- */
    if (cfg.npcs) {
      this._cityNpcSpots(cx, cz, PLAZA_R + 3.5, R_WALL - 7, cfg.npcs,
        cfg.id, rng, inPlatform);
    }

    /* ---------- flush ke InstancedMesh ---------- */
    var group = new THREE.Group();
    var cTmp = new THREE.Color();
    var total = 0;
    for (var key in bags) {
      var bd = bags[key];
      if (!bd.items.length) continue;
      var mesh = new THREE.InstancedMesh(bd.geo, bd.mat, bd.items.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bd.items.length * 3), 3);
      for (var ii = 0; ii < bd.items.length; ii++) {
        mesh.setMatrixAt(ii, bd.items[ii].m);
        if (bd.items[ii].hex === null || bd.items[ii].hex === undefined) {
          cTmp.setRGB(1, 1, 1);
        } else {
          cTmp.setHex(bd.items[ii].hex).convertSRGBToLinear().multiplyScalar(0.93 + rng() * 0.09);
        }
        mesh.setColorAt(ii, cTmp);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      group.add(mesh);
      total += bd.items.length;
    }
    this.scene.add(group);

    this.landmarks = this.landmarks || [];
    this.landmarks.push({
      id: cfg.id,
      x: cx, z: cz, y: site.y, r: R_WALL,
      group: group, houses: houses, instances: total
    });
    var built = {
      id: cfg.id, x: cx, z: cz, y: site.y, r: R_WALL, houses: houses,
      instances: total, assets: !!(assets && assets.ready),
      npcs: cfg.npcs || 0, mainAng: mainAng, plazaTop: plazaTop
    };
    if (cfg.id === 'empire') this.empireBuilt = built;
    else this.kingdomBuilt = built;
    if (global.console) {
      console.log('[Aetheria] ' + (cfg.label || cfg.id) + ': ' + houses + ' rumah, ' + total + ' instance, ' +
        (assets && assets.ready ? 'model MegaKit' : 'prosedural') +
        ' @ x=' + cx.toFixed(0) + ' z=' + cz.toFixed(0));
    }
    return true;
  };

  /* Kastil: tembok tirai persegi + menara sudut + benteng (keep) bertingkat.
     Dipakai kerajaan (kecil) dan kekaisaran (megah). */
  World.prototype._buildCastle = function (H, cx, cz, baseY, mainAng, o) {
    var add = H.add, addMat = H.addMat;
    var half = o.half, wallH = o.wallH, wallT = o.wallT || 1.1;
    var keepW = o.keepW, keepH = o.keepH;
    var roofHex = 0x593E31;
    var ry0 = -(mainAng + Math.PI / 2);

    // ---- Tembok tirai: 4 sisi, sisi depan (menghadap gerbang kota) bergerbang ----
    for (var ci = 0; ci < 4; ci++) {
      var ca = mainAng + ci * Math.PI / 2;
      var nx = Math.cos(ca + Math.PI / 2), nz = Math.sin(ca + Math.PI / 2);
      var wx = cx + Math.cos(ca) * half, wz = cz + Math.sin(ca) * half;
      var wry = -(ca + Math.PI / 2);
      if (ci === 0) {
        // dua potong tembok mengapit gerbang
        var segLen = half - o.gateHalf;
        for (var side = -1; side <= 1; side += 2) {
          var mx = wx + nx * side * (o.gateHalf + segLen / 2);
          var mz = wz + nz * side * (o.gateHalf + segLen / 2);
          add('wall', mx, baseY + wallH / 2, mz, segLen, wallH, wallT, 0xA9A28E, wry);
          this.walls.push({
            x1: mx - nx * segLen / 2, z1: mz - nz * segLen / 2,
            x2: mx + nx * segLen / 2, z2: mz + nz * segLen / 2, r: 0.6
          });
        }
        // ambang + pengisi di atas lubang gerbang
        var fillH = wallH - o.gateH;
        if (fillH > 0.2) {
          add('wall', wx, baseY + o.gateH + fillH / 2, wz, o.gateHalf * 2 + 1.2, fillH, wallT, 0xA9A28E, wry);
        }
        add('stone', wx, baseY + o.gateH + 0.4, wz, o.gateHalf * 2 + 1.8, 1.0, wallT + 0.3, 0xA8A294, wry);
        for (var ds = -1; ds <= 1; ds += 2) {
          add('timber', wx + nx * ds * o.gateHalf * 0.5, baseY + o.gateH / 2, wz + nz * ds * o.gateHalf * 0.5,
            o.gateHalf - 0.2, o.gateH, 0.26, 0x4A3524, wry);
        }
        // menara gerbang
        for (var gs = -1; gs <= 1; gs += 2) {
          var gtx = wx + nx * gs * (o.gateHalf + 1.7);
          var gtz = wz + nz * gs * (o.gateHalf + 1.7);
          add('body', gtx, baseY - 0.6, gtz, 7.4, wallH + 7.5, 7.4, 0xB2AB98);
          add('towerRoof', gtx, baseY + wallH + 6.9, gtz, 8.8, 7.0, 8.8, roofHex);
          this.colliders.push({ x: gtx, z: gtz, r: 3.7 });
        }
      } else {
        add('wall', wx, baseY + wallH / 2, wz, half * 2, wallH, wallT, 0xA9A28E, wry);
        this.walls.push({
          x1: wx - nx * half, z1: wz - nz * half,
          x2: wx + nx * half, z2: wz + nz * half, r: 0.6
        });
      }
      // menara sudut
      for (var cs = -1; cs <= 1; cs += 2) {
        var tx = wx + nx * cs * half;
        var tz = wz + nz * cs * half;
        add('body', tx, baseY - 0.6, tz, o.turretR * 2, o.turretH, o.turretR * 2, 0xB6AE9C);
        add('towerRoof', tx, baseY + o.turretH - 0.6, tz, o.turretR * 2.5, o.turretR * 2.7, o.turretR * 2.5, roofHex);
        this.colliders.push({ x: tx, z: tz, r: o.turretR });
        // panji di menara sudut
        add('timber', tx, baseY + o.turretH + o.turretR * 2.1, tz, 0.14, 3.2, 0.14, 0x5B4128);
        addMat('bannerA', 'timber', H.clothRed, tx + 0.9, baseY + o.turretH + o.turretR * 2.1 + 1.6, tz, 1.7, 1.2, 0.06);
      }
      // menara tengah sisi (kekaisaran)
      if (o.midTurrets && ci !== 0) {
        var mtx = wx, mtz = wz;
        add('body', mtx, baseY - 0.6, mtz, o.turretR * 1.7, o.turretH * 0.7, o.turretR * 1.7, 0xC2BCAA);
        add('towerRoof', mtx, baseY + o.turretH * 0.7 - 0.6, mtz, o.turretR * 2.2, o.turretR * 2.2, o.turretR * 2.2, roofHex);
        this.colliders.push({ x: mtx, z: mtz, r: o.turretR * 1.2 });
      }
    }

    // ---- Benteng utama (keep) ----
    // Kaki yang lebih lebar (plinth) + lis tengah: memberi kesan bertingkat.
    add('stone', cx, baseY + 1.7, cz, keepW + 2.8, 3.4, keepW + 2.8, 0xC6C0AE);
    var kMid = baseY + keepH / 2 - 0.3;
    add('stone', cx, kMid, cz, keepW, keepH, keepW, 0xD9D3C1);
    add('stone', cx, baseY + keepH * 0.56, cz, keepW + 1.4, 1.0, keepW + 1.4, 0xC0B9A6);
    // lis puncak
    add('stone', cx, baseY + keepH - 0.7, cz, keepW + 1.9, 1.6, keepW + 1.9, 0xCAC3B0);
    // wereng keliling
    var nb = o.batt || 5;
    for (var kside = 0; kside < 4; kside++) {
      var ka = mainAng + kside * Math.PI / 2;
      for (var kb = 0; kb < nb; kb++) {
        var koff = (kb - (nb - 1) / 2) * (keepW / (nb + 0.4));
        var kx = cx + Math.cos(ka) * (keepW / 2 + 0.55) + Math.cos(ka + Math.PI / 2) * koff;
        var kz = cz + Math.sin(ka) * (keepW / 2 + 0.55) + Math.sin(ka + Math.PI / 2) * koff;
        add('stone', kx, baseY + keepH + 0.45, kz, 1.6, 1.5, 1.6, 0xB8B19E, -(ka + Math.PI / 2));
      }
    }
    // atap limas + tiang panji
    add('pyramidRoof', cx, baseY + keepH + 1.2, cz, keepW + 6, o.roofH, keepW + 6, 0x5A3F32);
    add('timber', cx, baseY + keepH + o.roofH + 0.8, cz, 0.24, 4.8, 0.24, 0x5B4128);
    addMat('bannerB', 'timber', H.clothBlue, cx + 1.5, baseY + keepH + o.roofH + 2.9, cz, 2.6, 1.7, 0.08);
    // turret sudut keep
    for (var kt = 0; kt < 4; kt++) {
      var kta = mainAng + Math.PI / 4 + kt * Math.PI / 2;
      var ktx = cx + Math.cos(kta) * (keepW * 0.62);
      var ktz = cz + Math.sin(kta) * (keepW * 0.62);
      add('body', ktx, baseY - 0.6, ktz, keepW * 0.17, keepH + 5, keepW * 0.17, 0xC6C0AE);
      add('towerRoof', ktx, baseY + keepH + 4.4, ktz, keepW * 0.22, keepW * 0.2, keepW * 0.22, 0x5A3F32);
      this.colliders.push({ x: ktx, z: ktz, r: keepW * 0.1 });
    }
    // jendela berbaris
    var rows = o.windowRows || [6, 12.5];
    for (var kface = 0; kface < 4; kface++) {
      var fa = mainAng + kface * Math.PI / 2;
      var nwin = keepW > 20 ? 3 : 2;
      for (var fw = 0; fw < nwin; fw++) {
        var foff = (fw - (nwin - 1) / 2) * (keepW * 0.26);
        for (var rw = 0; rw < rows.length; rw++) {
          var wx3 = cx + Math.cos(fa) * (keepW / 2 + 0.1) + Math.cos(fa + Math.PI / 2) * foff;
          var wz3 = cz + Math.sin(fa) * (keepW / 2 + 0.1) + Math.sin(fa + Math.PI / 2) * foff;
          add('window', wx3, baseY + rows[rw], wz3, 1.25, 1.7, 0.3, 0x2C3840, -(fa + Math.PI / 2));
        }
      }
      // panji pada fasad
      if (o.banners) {
        var bxx = cx + Math.cos(fa) * (keepW / 2 + 0.35);
        var bzz = cz + Math.sin(fa) * (keepW / 2 + 0.35);
        addMat('bannerA', 'timber', H.clothRed, bxx, baseY + keepH * 0.62, bzz, 2.2, 3.0, 0.09, -(fa + Math.PI / 2));
      }
    }
    // pintu keep
    var kdx = cx + Math.cos(mainAng) * (keepW / 2 + 0.35);
    var kdz = cz + Math.sin(mainAng) * (keepW / 2 + 0.35);
    add('door', kdx, baseY + 2.2, kdz, 4.2, 4.4, 0.26, 0x4F3722, ry0);
    add('stone', kdx, baseY + 4.7, kdz, 5.4, 1.1, 1.0, 0xA8A294, ry0);
    // tangga megah (kekaisaran)
    if (o.stair) {
      for (var st2 = 0; st2 < 4; st2++) {
        add('stairsP', cx + Math.cos(mainAng) * (keepW / 2 + 2.2 + st2 * 1.1),
          baseY + 0.25 - st2 * 0.02,
          cz + Math.sin(mainAng) * (keepW / 2 + 2.2 + st2 * 1.1),
          keepW * 0.42, 0.55, 1.25, 0x9A9384, ry0);
      }
    }
    this.colliders.push({ x: cx, z: cz, r: o.keepR });
  };

  /* Titik NPC warga kota: tersebar di jalan/pelataran, tidak menembus rumah. */
  World.prototype._cityNpcSpots = function (cx, cz, rMin, rMax, count, cityId, rng, inPlatform) {
    var NAMES = ['Adipati', 'Arya', 'Bagas', 'Cakra', 'Danu', 'Eka', 'Galih', 'Harsa', 'Indra', 'Jaka',
      'Kirana', 'Laras', 'Manggala', 'Nala', 'Pramudya', 'Ratna', 'Sena', 'Tanaya', 'Ugra', 'Wira',
      'Yudha', 'Anjani', 'Baskara', 'Candra', 'Dewi', 'Gita', 'Hanura', 'Ismaya', 'Jaya', 'Kencana',
      'Laksmi', 'Mahesa', 'Nirmala', 'Puspa', 'Raka', 'Sagara', 'Tirta', 'Utama', 'Wulan', 'Yasa',
      'Bumi', 'Cahya', 'Dara', 'Fajar', 'Gading', 'Hasta', 'Intan', 'Jatmika', 'Kusuma', 'Lestari'];
    var ROLES = ['warga', 'pedagang', 'penjaga', 'petani', 'pandai besi', 'bangsawan', 'prajurit'];
    var PALS = [
      { shirt: 0x6B5340, pants: 0x3E3A32, skin: 0xD9B48C, hair: 0x3A2A1C },
      { shirt: 0x4E5E6B, pants: 0x34383C, skin: 0xC79A6E, hair: 0x241A12 },
      { shirt: 0x7A4A3C, pants: 0x453B31, skin: 0xE0C0A0, hair: 0x51372A },
      { shirt: 0x4C6248, pants: 0x39392F, skin: 0xB98B60, hair: 0x1D140F, apron: 0x7C6A4A },
      { shirt: 0x8A7B5C, pants: 0x40403A, skin: 0xD2A57C, hair: 0x33241A, dress: true, apron: 0xB9A57C },
      { shirt: 0x5A4A6A, pants: 0x3A3442, skin: 0xC08E64, hair: 0x2A1D16, hood: 0x4A3B57 },
      { shirt: 0x3E4E5E, pants: 0x2F3338, skin: 0xDDBB92, hair: 0x5A4030, cloak: 0x2E3A46 },
      { shirt: 0x6E4A2E, pants: 0x3B3128, skin: 0xA97A52, hair: 0x1A120D, apron: 0x5A4A37 },
      { shirt: 0x7C6A4A, pants: 0x3C3A30, skin: 0xE3C9A4, hair: 0x6B543A, beard: true },
      { shirt: 0x556B4E, pants: 0x373D33, skin: 0xC9946A, hair: 0x211A14, longHair: true }
    ];
    var self = this;
    var list = [];
    var base = this.townSpots.length;
    for (var i = 0; i < count; i++) {
      var spot = null;
      for (var a = 0; a < 40 && !spot; a++) {
        var ang = rng() * Math.PI * 2;
        var rad = rMin + rng() * (rMax - rMin);
        var x = Math.round(cx + Math.cos(ang) * rad);
        var z = Math.round(cz + Math.sin(ang) * rad);
        if (this.groundHeight(x, z) < 3) continue;
        if (inPlatform && inPlatform(x, z, 1.4)) continue;
        var hit = false;
        for (var ci = 0; ci < this.colliders.length; ci++) {
          var cc = this.colliders[ci];
          if (Math.hypot(x - cc.x, z - cc.z) < cc.r + 1.3) { hit = true; break; }
        }
        if (hit) continue;
        for (var pj = 0; pj < list.length; pj++) {
          if (Math.hypot(x - list[pj].x, z - list[pj].z) < 2.6) { hit = true; break; }
        }
        if (hit) continue;
        spot = { x: x, z: z };
      }
      if (!spot) continue;
      var role = ROLES[(i + base) % ROLES.length];
      spot.name = NAMES[(i + base * 3 + cityId.length) % NAMES.length];
      spot.role = role;
      spot.wanderR = 3 + rng() * 4.5;
      spot.speed = 1.2 + rng() * 0.9;
      spot.pal = PALS[(i + base + (cityId === 'empire' ? 3 : 0)) % PALS.length];
      spot.city = cityId;
      list.push(spot);
    }
    for (var ki = 0; ki < list.length; ki++) this.townSpots.push(list[ki]);
    return list;
  };

  /* Wrapper: kerajaan pusat (kota pertama). */
  World.prototype.buildGreatKingdom = function (assets) {
    return this._buildCity(assets, {
      id: 'great_kingdom', label: 'Kerajaan Besar', site: this.kingdomSite,
      seed: 7777, rWall: 60, wallH: 7.2, wallT: 0.9, seg: 48,
      gateW: 9, sideGateW: 5.4, plazaR: 23,
      rings: [30, 39.5, 49],
      ringCount: [[2, 3, 2, 3], [2, 2, 2, 2], [3, 3, 3, 3]],
      roadW: 4.6, towers: 8, towerR: 3.4, trees: 22, npcs: 10
    });
  };

  /* Wrapper: kekaisaran agung — kastil jauh lebih besar + 100 rumah warga. */
  World.prototype.buildEmpire = function (assets) {
    return this._buildCity(assets, {
      id: 'empire', label: 'Kekaisaran Aetheria', site: this.empireSite,
      seed: 9911, rWall: 148, wallH: 10.5, wallT: 1.35, seg: 96,
      gateW: 13, sideGateW: 8.5, plazaR: 52,
      rings: [68, 84, 100, 116, 132],
      ringHouses: [17, 19, 20, 22, 22],
      roadW: 7, towers: 12, towerR: 4.6, trees: 54, npcs: 30,
      houseScale: 1.1, grand: true, flatGate: true
    });
  };

  /* Dinding rumah kerajaan: segmen garis dengan celah pintu. */
  World.prototype._addKingdomWallColliders = function (hx, hz, rotY, hw, hd, doorW) {
    var world = this;
    var cos = Math.cos(rotY), sin = Math.sin(rotY);
    var R = 0.2;
    var jamb = doorW / 2 + 0.14;
    function at(lx, lz) {
      return { x: hx + cos * lx + sin * lz, z: hz - sin * lx + cos * lz };
    }
    function seg(a, b) {
      world.walls.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, r: R });
    }
    var c1 = at(-hw, -hd), c2 = at(hw, -hd), c3 = at(hw, hd), c4 = at(-hw, hd);
    var jL = at(-jamb, hd), jR = at(jamb, hd);
    seg(c1, c2); seg(c1, c4); seg(c2, c3); seg(c4, jL); seg(jR, c3);
  };

  /* --- Vegetasi & batu: penempatan prosedural (instanced) --- */
  /* Arah gerbang utama kota: menghadap desa utama; kekaisaran memutar gerbang
     ke arah paling datar di luar tembok. Dipakai juga oleh pembuat jalan agar
     jalan raya tepat menyambung ke gerbang. */
  World.prototype._cityGateAngle = function (site, cfg) {
    if (!site) return 0;
    var cx = site.x, cz = site.z;
    var rWall = cfg.rWall || 60;
    var village = this.villageSpots && this.villageSpots[0];
    var mainAng = village ? Math.atan2(village.z - cz, village.x - cx) : 0;
    if (cfg.flatGate) {
      var centerY = this.groundHeight(cx, cz);
      var best = 0, bestScore = Infinity;
      for (var i = 0; i < 4; i++) {
        var a = mainAng + i * Math.PI / 2, sum = 0;
        for (var d = 0; d <= 6; d++) {
          var r = rWall + 8 + d * 9;
          sum += Math.abs(this.groundHeight(cx + Math.cos(a) * r, cz + Math.sin(a) * r) - centerY);
        }
        if (sum < bestScore) { bestScore = sum; best = i; }
      }
      mainAng += best * Math.PI / 2;
    }
    return mainAng;
  };

  World.prototype._cityGateOut = function (site, cfg) {
    if (!site) return null;
    var a = this._cityGateAngle(site, cfg);
    var r = (cfg.rWall || 60) + 9;
    return { x: site.x + Math.cos(a) * r, z: site.z + Math.sin(a) * r, ang: a };
  };

  /* ---------- Jaringan jalan: desa ↔ kerajaan ↔ kekaisaran ----------
     Rute dicari dengan A* pada grid kecil yang menghukum lereng curam, air,
     dan pegunungan tinggi. Jalan lalu dihaluskan, diikuti kontur tanah, dan
     diberi jembatan saat melintasi sungai. */
  World.prototype._buildRoadNetwork = function () {
    var self = this;
    this.roads = [];
    this.bridges = [];
    var v = this.villageSpots || [];
    if (!v.length) { this._roadGrid = { cell: 24, map: Object.create(null) }; return; }

    var mainV = { x: v[0].x, z: v[0].z };
    var kingdomGate = this._cityGateOut(this.kingdomSite, { rWall: 60 });
    var empireGate = this._cityGateOut(this.empireSite, { rWall: 148, flatGate: true });
    var pairs = [];
    var i;
    for (i = 1; i < v.length; i++) pairs.push([mainV, { x: v[i].x, z: v[i].z }]);
    if (kingdomGate) pairs.push([mainV, kingdomGate]);
    if (kingdomGate && empireGate) pairs.push([kingdomGate, empireGate]);
    if (this.harborSpot) {
      var hp = this.harborSpot;
      pairs.push([{
        x: hp.x - (hp.dirX || 1) * 7,
        z: hp.z - (hp.dirZ || 0) * 7
      }, mainV]);
    }

    var acc = { pos: [], uv: [], idx: [], n: 0 };
    for (i = 0; i < pairs.length; i++) {
      var a = pairs[i][0], b = pairs[i][1];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 26) continue;
      var pts = this._findRoadPath(a, b);
      if (!pts || pts.length < 2) continue;
      this._buildRoadRibbon(pts, 2.7, acc);
    }
    this._indexRoads();

    if (!acc.n) return;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
    geo.setIndex(acc.idx);
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({
      color: srgb(0x9C8C74), roughness: 0.98, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2
    });
    if (global.TexLib) {
      global.TexLib.apply(mat, 'cobble', 1, 1);        // cadangan prosedural
      global.TexLib.apply(mat, 'roadPebbles', 1, 1);   // kerikil sungai kering
    }
    var mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'roads';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.scene.add(mesh);
    this.roadMesh = mesh;
  };

  World.prototype._findRoadPath = function (a, b) {
    var self = this;
    var pad = 86;
    var minX = Math.min(a.x, b.x) - pad, maxX = Math.max(a.x, b.x) + pad;
    var minZ = Math.min(a.z, b.z) - pad, maxZ = Math.max(a.z, b.z) + pad;
    var cell = Math.max(11, (maxX - minX) / 210, (maxZ - minZ) / 210);
    var cols = Math.max(2, Math.ceil((maxX - minX) / cell) + 1);
    var rows = Math.max(2, Math.ceil((maxZ - minZ) / cell) + 1);
    var total = cols * rows;
    var gScore = new Float32Array(total); gScore.fill(Infinity);
    var came = new Int32Array(total); came.fill(-1);
    var closed = new Uint8Array(total);
    var heap = [];

    function push(id, f) {
      heap.push({ id: id, f: f });
      var i = heap.length - 1;
      while (i > 0) {
        var p = (i - 1) >> 1;
        if (heap[p].f <= heap[i].f) break;
        var tmp = heap[p]; heap[p] = heap[i]; heap[i] = tmp; i = p;
      }
    }
    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        var i = 0;
        for (;;) {
          var l = i * 2 + 1, r = l + 1, m = i;
          if (l < heap.length && heap[l].f < heap[m].f) m = l;
          if (r < heap.length && heap[r].f < heap[m].f) m = r;
          if (m === i) break;
          var tmp = heap[m]; heap[m] = heap[i]; heap[i] = tmp; i = m;
        }
      }
      return top;
    }
    function toX(ix) { return minX + ix * cell; }
    function toZ(iz) { return minZ + iz * cell; }

    function cellCost(ix, iz) {
      var x = toX(ix), z = toZ(iz);
      var h = self.groundHeight(x, z);
      var c = 1;
      if (h < 0.35) c += 20;               // air → jembatan, hindari bila bisa
      else if (h < 1.5) c += 5;
      var sl = self._slopeAt(x, z);
      if (sl > 0.16) c += Math.min(8, (sl - 0.16) * 26);
      if (h > 52) c += Math.min(12, (h - 52) * 0.16);
      // Jangan memotong tembok kota.
      var k = self.kingdomSite;
      if (k && Math.hypot(x - k.x, z - k.z) < (k.r || 76) + 5) c += 500;
      var e = self.empireSite;
      if (e && Math.hypot(x - e.x, z - e.z) < (e.r || 160) + 7) c += 500;
      var lms = self.landmarkSites || [];
      for (var i = 0; i < lms.length; i++) {
        if (Math.hypot(x - lms[i].x, z - lms[i].z) < lms[i].r + 2) { c += 45; break; }
      }
      return c;
    }

    function snapped(x, z) {
      var ix = Math.round((x - minX) / cell), iz = Math.round((z - minZ) / cell);
      ix = Math.max(0, Math.min(cols - 1, ix));
      iz = Math.max(0, Math.min(rows - 1, iz));
      // Cari sel kering terdekat bila titik awal/akhir kebetulan di air.
      if (self.groundHeight(toX(ix), toZ(iz)) > 0.8) return iz * cols + ix;
      var best = iz * cols + ix, bestD = Infinity;
      for (var dz = -3; dz <= 3; dz++) {
        for (var dx = -3; dx <= 3; dx++) {
          var nx = ix + dx, nz = iz + dz;
          if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
          if (self.groundHeight(toX(nx), toZ(nz)) <= 0.8) continue;
          var d = dx * dx + dz * dz;
          if (d < bestD) { bestD = d; best = nz * cols + nx; }
        }
      }
      return best;
    }

    var start = snapped(a.x, a.z), goal = snapped(b.x, b.z);
    var gx0 = goal % cols, gz0 = (goal / cols) | 0;
    function heuristic(id) {
      var dx = (id % cols) - gx0, dz = ((id / cols) | 0) - gz0;
      return Math.sqrt(dx * dx + dz * dz);
    }
    gScore[start] = 0;
    push(start, heuristic(start));
    var found = false;
    while (heap.length) {
      var cur = pop().id;
      if (closed[cur]) continue;
      if (cur === goal) { found = true; break; }
      closed[cur] = 1;
      var cx = cur % cols, cz = (cur / cols) | 0;
      for (var oz = -1; oz <= 1; oz++) {
        for (var ox = -1; ox <= 1; ox++) {
          if (!ox && !oz) continue;
          var nx2 = cx + ox, nz2 = cz + oz;
          if (nx2 < 0 || nz2 < 0 || nx2 >= cols || nz2 >= rows) continue;
          var nid = nz2 * cols + nx2;
          if (closed[nid]) continue;
          var step = (ox && oz ? 1.414 : 1) * cellCost(nx2, nz2);
          var ng = gScore[cur] + step;
          if (ng < gScore[nid]) {
            gScore[nid] = ng;
            came[nid] = cur;
            push(nid, ng + heuristic(nid) * 1.02);
          }
        }
      }
    }
    if (!found) return [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];

    var raw = [];
    for (var id = goal; id >= 0; id = came[id]) {
      var ix2 = id % cols, iz2 = (id / cols) | 0;
      raw.push({ x: toX(ix2), z: toZ(iz2) });
      if (raw.length > 20000) break;
    }
    raw.reverse();
    if (raw.length < 2) return [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];

    // Haluskan (Chaikin 2×) agar tidak bergerigi mengikuti grid.
    var pts = raw;
    for (var it = 0; it < 2; it++) {
      var out = [pts[0]];
      for (var pi = 0; pi < pts.length - 1; pi++) {
        var p0 = pts[pi], p1 = pts[pi + 1];
        out.push({ x: p0.x * 0.75 + p1.x * 0.25, z: p0.z * 0.75 + p1.z * 0.25 });
        out.push({ x: p0.x * 0.25 + p1.x * 0.75, z: p0.z * 0.25 + p1.z * 0.75 });
      }
      out.push(pts[pts.length - 1]);
      pts = out;
    }
    // Resample tiap ±3 m supaya tekstur & tinggi jalan stabil.
    var res = [{ x: pts[0].x, z: pts[0].z }];
    var stepLen = 3, since = 0;
    for (var si = 1; si < pts.length; si++) {
      var q0 = pts[si - 1], q1 = pts[si];
      var dx = q1.x - q0.x, dz = q1.z - q0.z;
      var seg = Math.sqrt(dx * dx + dz * dz);
      if (seg < 1e-4) continue;
      var t0 = 0;
      var remain = seg;
      while (since + remain >= stepLen) {
        var need = stepLen - since;
        t0 += need;
        remain -= need;
        res.push({ x: q0.x + dx * (t0 / seg), z: q0.z + dz * (t0 / seg) });
        since = 0;
      }
      since += remain;
    }
    var lastP = pts[pts.length - 1];
    var lastRes = res[res.length - 1];
    if (Math.hypot(lastP.x - lastRes.x, lastP.z - lastRes.z) > 1.5) res.push({ x: lastP.x, z: lastP.z });
    // Pastikan ujung jalan benar-benar di gerbang/pusat desa.
    res[0] = { x: a.x, z: a.z };
    var endPt = { x: b.x, z: b.z };
    res.push(endPt);
    return res;
  };

  World.prototype._buildRoadRibbon = function (pts, half, acc) {
    var self = this;
    var n = pts.length;
    if (n < 2) return;
    this.roads.push({ pts: pts, half: half });
    var i, ground = [], hgt = [];
    for (i = 0; i < n; i++) ground.push(this.groundHeight(pts[i].x, pts[i].z));
    // Rata-rata bergerak: jalan tidak menyalip setiap gundukan kecil.
    for (i = 0; i < n; i++) {
      var sum = 0, cnt = 0;
      for (var k = -2; k <= 2; k++) {
        var j = i + k;
        if (j < 0 || j >= n) continue;
        sum += ground[j]; cnt++;
      }
      hgt[i] = Math.max(ground[i], sum / cnt) + 0.14;
    }

    // Deteksi penyeberangan sungai → jembatan datar + ramp.
    var spans = [];
    i = 0;
    while (i < n) {
      if (ground[i] >= 0.55) { i++; continue; }
      var j2 = i;
      while (j2 + 1 < n && ground[j2 + 1] < 0.55) j2++;
      spans.push({ s: i, e: j2 });
      i = j2 + 1;
    }
    for (var si = 0; si < spans.length; si++) {
      var sp = spans[si];
      var bs = Math.max(0, sp.s - 2), be = Math.min(n - 1, sp.e + 2);
      var bankA = ground[Math.max(0, sp.s - 4)], bankB = ground[Math.min(n - 1, sp.e + 4)];
      var deckY = Math.max(bankA, bankB, 0.9) + 0.8;
      var ramp = 5; // 5 sampel ≈ 15 m
      for (var rk = 1; rk <= ramp; rk++) {
        var idxA = sp.s - rk, idxB = sp.e + rk;
        var fa = rk / (ramp + 1), fb = rk / (ramp + 1);
        if (idxA >= 0) hgt[idxA] = Math.max(hgt[idxA], deckY * fa + hgt[idxA] * (1 - fa));
        if (idxB < n) hgt[idxB] = Math.max(hgt[idxB], deckY * fb + hgt[idxB] * (1 - fb));
      }
      for (var dk = sp.s; dk <= sp.e; dk++) hgt[dk] = deckY;

      var ax = pts[sp.s].x, az = pts[sp.s].z;
      var bx = pts[sp.e].x, bz = pts[sp.e].z;
      var len = Math.hypot(bx - ax, bz - az) + 4;
      var mx = (ax + bx) / 2, mz = (az + bz) / 2;
      var ang = Math.atan2(bz - az, bx - ax);
      this.bridges.push({
        x: mx, z: mz, len: len, ang: ang, deckY: deckY,
        half: half, ax: ax, az: az, bx: bx, bz: bz
      });
      this._buildBridgeMesh(mx, mz, len, ang, deckY, half, ax, az, bx, bz);
      this.platforms.push({
        x: mx, z: mz, hw: len / 2, hd: half + 0.45,
        cos: Math.cos(ang), sin: Math.sin(ang), top: deckY
      });
    }

    // Geometri pita jalan (2 verteks per potongan melintang).
    var base = acc.n;
    var dist = 0;
    for (i = 0; i < n; i++) {
      var p = pts[i];
      var prev = pts[Math.max(0, i - 1)], next = pts[Math.min(n - 1, i + 1)];
      var dx = next.x - prev.x, dz = next.z - prev.z;
      var dl = Math.hypot(dx, dz) || 1;
      dx /= dl; dz /= dl;
      var nx = -dz, nz = dx;
      if (i > 0) dist += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
      var lh = Math.max(hgt[i], this.groundHeight(p.x + nx * half, p.z + nz * half) + 0.12);
      var rh = Math.max(hgt[i], this.groundHeight(p.x - nx * half, p.z - nz * half) + 0.12);
      // Di atas jembatan, permukaan harus rata.
      for (var bi = 0; bi < this.bridges.length; bi++) {
        var br = this.bridges[bi];
        if (Math.hypot(p.x - br.x, p.z - br.z) < br.len / 2 + half + 1 &&
            Math.abs(hgt[i] - br.deckY) < 0.01) { lh = rh = br.deckY; break; }
      }
      acc.pos.push(p.x + nx * half, lh, p.z + nz * half);
      acc.pos.push(p.x - nx * half, rh, p.z - nz * half);
      acc.uv.push(0, dist / 3.2);
      acc.uv.push(1, dist / 3.2);
    }
    for (i = 0; i < n - 1; i++) {
      var a2 = base + i * 2, b2 = a2 + 1, c2 = a2 + 2, d2 = a2 + 3;
      acc.idx.push(a2, c2, b2, b2, c2, d2);
    }
    acc.n += n * 2;
  };

  World.prototype._buildBridgeMesh = function (x, z, len, ang, deckY, half, ax, az, bx, bz) {
    var wood = new THREE.MeshStandardMaterial({ color: srgb(0x6E4E31), roughness: 0.92 });
    var stone = new THREE.MeshStandardMaterial({ color: srgb(0xB7B2A4), roughness: 0.95 });
    if (global.TexLib) {
      global.TexLib.apply(wood, 'wood', 2, 2);
      global.TexLib.apply(stone, 'rock', 2, 2);
    }
    var ry = -ang;
    var group = new THREE.Group();
    var deck = new THREE.Mesh(new THREE.BoxGeometry(len + 1.6, 0.55, half * 2 + 1.1), stone);
    deck.position.set(x, deckY - 0.32, z);
    deck.rotation.y = ry;
    deck.castShadow = false; deck.receiveShadow = true;
    group.add(deck);

    // Dua pilar batu turun sampai dasar sungai.
    for (var pi = -1; pi <= 1; pi += 2) {
      var px = x + Math.cos(ang) * len * 0.27 * pi;
      var pz = z + Math.sin(ang) * len * 0.27 * pi;
      var bed = this.groundHeight(px, pz);
      var ph = Math.max(1.2, deckY - bed + 0.4);
      var pier = new THREE.Mesh(new THREE.BoxGeometry(2.0, ph, half * 1.9), stone);
      pier.position.set(px, bed + ph / 2 - 0.2, pz);
      pier.rotation.y = ry;
      pier.castShadow = false; pier.receiveShadow = true;
      group.add(pier);
    }

    // Pagar kayu: tiang tiap ±3 m + dua rel memanjang.
    var postGeo = new THREE.BoxGeometry(0.18, 1.12, 0.18);
    var nPost = Math.max(2, Math.round(len / 3.2));
    for (var s = 0; s <= nPost; s++) {
      var t = s / nPost;
      var cx2 = ax + (bx - ax) * t;
      var cz2 = az + (bz - az) * t;
      var nx = -Math.sin(ang), nz = Math.cos(ang);
      for (var side = -1; side <= 1; side += 2) {
        var post = new THREE.Mesh(postGeo, wood);
        post.position.set(cx2 + nx * (half + 0.32) * side, deckY + 0.6, cz2 + nz * (half + 0.32) * side);
        post.castShadow = false;
        group.add(post);
      }
    }
    var railGeo = new THREE.BoxGeometry(len, 0.14, 0.16);
    for (var rs = -1; rs <= 1; rs += 2) {
      var rail = new THREE.Mesh(railGeo, wood);
      var nx2 = -Math.sin(ang), nz2 = Math.cos(ang);
      rail.position.set(x + nx2 * (half + 0.32) * rs, deckY + 1.08, z + nz2 * (half + 0.32) * rs);
      rail.rotation.y = ry;
      rail.castShadow = false;
      group.add(rail);
      // Pagar juga menahan pemain agar tidak jatuh ke sungai.
      this.wall(
        ax + nx2 * (half + 0.3) * rs, az + nz2 * (half + 0.3) * rs,
        bx + nx2 * (half + 0.3) * rs, bz + nz2 * (half + 0.3) * rs, 0.22
      );
    }
    group.name = 'jembatan';
    this.scene.add(group);
    return group;
  };

  /* Indeks spasial segmen jalan agar pengecekan "dekat jalan?" sangat murah
     (dipakai rumput, pohon, batu, dan musuh). */
  World.prototype._indexRoads = function () {
    var cell = 24, map = Object.create(null);
    for (var ri = 0; ri < this.roads.length; ri++) {
      var pts = this.roads[ri].pts, half = this.roads[ri].half;
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        var x0 = Math.min(a.x, b.x) - half - 6, x1 = Math.max(a.x, b.x) + half + 6;
        var z0 = Math.min(a.z, b.z) - half - 6, z1 = Math.max(a.z, b.z) + half + 6;
        var cx0 = Math.floor(x0 / cell), cx1 = Math.floor(x1 / cell);
        var cz0 = Math.floor(z0 / cell), cz1 = Math.floor(z1 / cell);
        for (var cx = cx0; cx <= cx1; cx++) {
          for (var cz = cz0; cz <= cz1; cz++) {
            var key = cx + ',' + cz;
            (map[key] || (map[key] = [])).push(a.x, a.z, b.x, b.z, half);
          }
        }
      }
    }
    this._roadGrid = { cell: cell, map: map };
  };

  World.prototype.nearRoad = function (x, z, pad) {
    var g = this._roadGrid;
    if (!g) return false;
    var cell = g.cell;
    var cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    var lim = pad || 0;
    for (var ix = -1; ix <= 1; ix++) {
      for (var iz = -1; iz <= 1; iz++) {
        var list = g.map[(cx + ix) + ',' + (cz + iz)];
        if (!list) continue;
        for (var i = 0; i < list.length; i += 5) {
          var ax = list[i], az = list[i + 1], bx = list[i + 2], bz = list[i + 3];
          var half = list[i + 4];
          var vx = bx - ax, vz = bz - az;
          var wx = x - ax, wz = z - az;
          var L2 = vx * vx + vz * vz;
          var t = L2 > 0 ? U.clamp((wx * vx + wz * vz) / L2, 0, 1) : 0;
          var px = ax + vx * t, pz = az + vz * t;
          var dx = x - px, dz = z - pz;
          var rr = half + lim;
          if (dx * dx + dz * dz <= rr * rr) return true;
        }
      }
    }
    return false;
  };

  World.prototype.inForest = function (x, z, pad) {
    for (var i = 0; i < this.forests.length; i++) {
      var f = this.forests[i];
      var dx = x - f.x, dz = z - f.z;
      var r = f.r + (pad || 0);
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  };

  /* Kantong hutan rimbun: dipilih di daratan luas, jauh dari kota dan jalan. */
  World.prototype._pickForests = function () {
    this.forests = [];
    var S = this.scale || 1;
    var rng = U.mulberry32(C.WORLD.seed + 7373);
    var half = C.WORLD.size * 0.5;
    var span = half * 0.82;
    var tries = 0;
    while (this.forests.length < 14 && tries < 1400) {
      tries++;
      var x = (rng() * 2 - 1) * span;
      var z = (rng() * 2 - 1) * span;
      var h = this.height(x, z);
      if (h < 2.5 * S || h > 52 * S) continue;
      if (this._slopeAt(x, z) > 0.62) continue;
      if (this.nearRoad(x, z, 14)) continue;
      if (this._inSettlement(x, z, 22)) continue;
      var r = 54 + rng() * 42;
      var ok = true;
      for (var i = 0; i < this.forests.length; i++) {
        if (Math.hypot(x - this.forests[i].x, z - this.forests[i].z) < this.forests[i].r + r * 0.75) { ok = false; break; }
      }
      if (!ok) continue;
      this.forests.push({ x: x, z: z, r: r, tall: 0.55 + rng() * 0.45 });
    }
  };

  World.prototype._inSettlement = function (x, z, pad) {
    var r = pad || 0, i;
    var spots = this.villageSpots || [];
    for (i = 0; i < spots.length; i++) {
      if (Math.hypot(x - spots[i].x, z - spots[i].z) < spots[i].r + r) return true;
    }
    if (this.kingdomSite && Math.hypot(x - this.kingdomSite.x, z - this.kingdomSite.z) < (this.kingdomSite.r || 76) + r) return true;
    if (this.empireSite && Math.hypot(x - this.empireSite.x, z - this.empireSite.z) < (this.empireSite.r || 160) + r) return true;
    var lms = this.landmarkSites || [];
    for (i = 0; i < lms.length; i++) {
      if (Math.hypot(x - lms[i].x, z - lms[i].z) < lms[i].r + r) return true;
    }
    if (this.harborSpot && Math.hypot(x - this.harborSpot.x, z - this.harborSpot.z) < 26 + r) return true;
    return false;
  };

  World.prototype.buildEnvironment = function (assets) {
    var rng = U.mulberry32(C.WORLD.seed + 909);
    this.villageSpots = this.pickVillageSpots();
    this.villageSpot = this.villageSpots[0];
    this._placed = [];
    this._spawn = null;
    this.islandSites = this.pickIslandSites();
    this.harborSpot = this.pickHarborSpot();
    // Kerajaan besar dipilih lebih dulu supaya landmark & vegetasi tidak menimpanya.
    this.kingdomSite = this.pickKingdomSite();
    // Kekaisaran agung butuh lahan jauh lebih luas.
    this.empireSite = this.pickEmpireSite();
    this.townSpots = [];
    this.landmarkSites = this.pickLandmarkSites();
    // Jalan penghubung dibangun sebelum vegetasi: jalan, jembatan, dan pepohonan
    // tepi jalan menjadi acuan tata letak dunia.
    this._buildRoadNetwork();
    this._pickForests();
    this._placeProcedural(rng);

    // Use MegaKit landmarks if assets are loaded and available
    if (assets && assets.ready && assets.has('wall_plaster_straight')) {
      this.buildLandmarksFromKit(assets);
    } else {
      this.buildLandmarks();
    }

    // Kerajaan pusat: selalu dibangun (MegaKit bila ada, prosedural bila tidak).
    this.buildGreatKingdom(assets && assets.ready ? assets : null);
    // Kekaisaran agung dengan 100 rumah warga.
    this.buildEmpire(assets && assets.ready ? assets : null);
  };

  World.prototype._placeProcedural = function (rng) {
    var S = this.scale || 1;
    var self = this;
    var trees = [], rocks = [];
    var i, p;

    // Preset grafis memengaruhi kerimbunan vegetasi (batang/daun tetap instanced).
    var q = (C.RENDER && C.RENDER.quality) || 'hd';
    var vegMul = q === 'cepat' ? 0.70 : (q === 'ultra' ? 1.0 : 0.85);

    var treeN = Math.round(760 * vegMul);   // pohon rimbun (pedalaman, tinggi)
    var palmN = Math.round(42 * vegMul);    // kelapa pesisir (sangat jarang)
    var pineN = Math.round(840 * vegMul);   // cemara (punggung bukit & lereng)
    var rockN = Math.round(860 * vegMul);   // batu
    var roadTreeN = 0, forestTreeN = 0, roadRockN = 0;

    // Penanam pohon seragam: tinggi, rimbun, dan punya tabrakan.
    function addTree(x, z, type, tall) {
      if (self._inSettlement(x, z, 1.5)) return false;
      if (self.nearRoad(x, z, 0.9)) return false;
      var gy = self._groundMin(x, z, 1.1) - 0.2;
      var th = tall ? (15.5 + rng() * 6.5) : (11.5 + rng() * 6.5);
      var tr = tall ? (0.34 + rng() * 0.16) : (0.30 + rng() * 0.13);
      var cr = tall ? (3.5 + rng() * 1.5) : (3.1 + rng() * 1.6);
      trees.push({
        x: x, z: z, gy: gy, type: type,
        trunkH: th, trunkR: tr, canopyR: cr,
        tilt: type === 2 ? (rng() - 0.5) * 0.08 : 0, dir: rng() * Math.PI * 2
      });
      self._placed.push({ x: x, z: z });
      self.colliders.push({ x: x, z: z, r: type === 1 ? 0.7 : 0.85 });
      return true;
    }
    function addRock(x, z, sc) {
      if (self._inSettlement(x, z, 1.0)) return false;
      if (self.nearRoad(x, z, 0.35)) return false;
      var gy = self._groundMin(x, z, sc * 1.4) + sc * 0.15;
      rocks.push({
        x: x, z: z, gy: gy, s: sc,
        ry: rng() * Math.PI * 2, shade: 0.82 + rng() * 0.36
      });
      if (sc > 0.8) self.colliders.push({ x: x, z: z, r: sc * 0.85 });
      return true;
    }

    for (i = 0; i < treeN; i++) {
      p = this._pickSpot(rng, 3.0 * S, 34 * S, 0.55, 15, 70);
      if (!p) continue;
      trees.push({
        x: p.x, z: p.z, gy: this._groundMin(p.x, p.z, 1.1) - 0.2, type: 0,
        trunkH: 11.5 + rng() * 6.5, trunkR: 0.30 + rng() * 0.13,
        canopyR: 3.1 + rng() * 1.6, tilt: 0, dir: rng() * Math.PI * 2
      });
      this._placed.push({ x: p.x, z: p.z });
      this.colliders.push({ x: p.x, z: p.z, r: 0.85 });
    }
    for (i = 0; i < palmN; i++) {           // kelapa (sabuk pantai)
      p = this._pickSpot(rng, 1.15 * S, 3.0 * S, 0.5, 11, 130);
      if (!p) continue;
      trees.push({
        x: p.x, z: p.z, gy: this._groundMin(p.x, p.z, 1.1) - 0.2, type: 1,
        trunkH: 14.5 + rng() * 6.0, trunkR: 0.16 + rng() * 0.04,
        canopyR: 3.3 + rng() * 0.7, tilt: 0, dir: rng() * Math.PI * 2
      });
      this._placed.push({ x: p.x, z: p.z });
      this.colliders.push({ x: p.x, z: p.z, r: 0.7 });
    }
    for (i = 0; i < pineN; i++) {           // cemara (punggung bukit & lereng)
      p = this._pickSpot(rng, 5.0 * S, 50 * S, 0.85, 13, 60);
      if (!p) continue;
      trees.push({
        x: p.x, z: p.z, gy: this._groundMin(p.x, p.z, 1.1) - 0.2, type: 2,
        trunkH: 11.5 + rng() * 7.5, trunkR: 0.20 + rng() * 0.06,
        canopyR: 2.6 + rng() * 1.1, tilt: (rng() - 0.5) * 0.08, dir: rng() * Math.PI * 2
      });
      this._placed.push({ x: p.x, z: p.z });
      this.colliders.push({ x: p.x, z: p.z, r: 0.7 });
    }
    for (i = 0; i < rockN; i++) {           // batu
      p = this._pickSpot(rng, 0.8 * S, 46 * S, 1.2, 11, 40);
      if (!p) continue;
      var sc = 0.65 + rng() * 2.0;
      rocks.push({ x: p.x, z: p.z, gy: this._groundMin(p.x, p.z, sc * 1.4) + sc * 0.15, s: sc, ry: rng() * Math.PI * 2, shade: 0.82 + rng() * 0.36 });
      this.colliders.push({ x: p.x, z: p.z, r: sc * 0.85 });
    }

    /* ---------- Pohon tinggi di kedua sisi setiap jalan ---------- */
    // Setiap ±6 m, kedua sisi jalan raya ditanami pohon rimbun tinggi sehingga
    // jalan desa–kerajaan–kekaisaran terasa seperti lorong hutan.
    for (var ri = 0; ri < this.roads.length; ri++) {
      var road = this.roads[ri], rpts = road.pts;
      for (var rp = 2; rp < rpts.length - 2; rp += 2) {
        var ra = rpts[rp - 1], rb = rpts[rp + 1];
        var rdx = rb.x - ra.x, rdz = rb.z - ra.z;
        var rdl = Math.hypot(rdx, rdz) || 1;
        rdx /= rdl; rdz /= rdl;
        var rnx = -rdz, rnz = rdx;
        for (var side = -1; side <= 1; side += 2) {
          if (rng() < 0.28) continue; // jarak pohon sedikit tidak beraturan
          var off = road.half + 3.4 + rng() * 4.0;
          var tx = rpts[rp].x + rnx * off * side;
          var tz = rpts[rp].z + rnz * off * side;
          var th = this.groundHeight(tx, tz);
          if (th < 1.4 * S || th > 62 * S) continue;
          if (this._slopeAt(tx, tz) > 0.75) continue;
          if (this.inForest(tx, tz, -6)) continue; // biar diisi hutan rimbun
          if (addTree(tx, tz, rng() < 0.24 ? 2 : 0, true)) roadTreeN++;
        }
      }
    }

    /* ---------- Hutan rimbun (kantong hutan + pohon tinggi) ---------- */
    for (var fi = 0; fi < this.forests.length; fi++) {
      var f = this.forests[fi];
      var area = Math.PI * f.r * f.r;
      var nTrees = Math.round(area / 150 * (0.8 + f.tall * 0.5));
      var placedN = 0;
      for (var attempt = 0; attempt < nTrees * 5 && placedN < nTrees; attempt++) {
        var fa = rng() * Math.PI * 2, fr = Math.sqrt(rng()) * f.r;
        var fx = f.x + Math.cos(fa) * fr, fz = f.z + Math.sin(fa) * fr;
        var fh = this.groundHeight(fx, fz);
        if (fh < 1.4 * S || fh > 64 * S) continue;
        if (this._slopeAt(fx, fz) > 0.85) continue;
        if (this.nearRoad(fx, fz, 1.6)) continue;
        if (!this._spotFree(fx, fz, 6.5)) continue;
        if (addTree(fx, fz, rng() < 0.3 ? 2 : 0, true)) {
          placedN++;
          forestTreeN++;
        }
      }
      // Bebatuan tersebar di dalam hutan.
      var nRocks = Math.round(area / 900);
      for (var rj = 0; rj < nRocks; rj++) {
        var ra2 = rng() * Math.PI * 2, rr2 = Math.sqrt(rng()) * f.r;
        var rx2 = f.x + Math.cos(ra2) * rr2, rz2 = f.z + Math.sin(ra2) * rr2;
        if (this.groundHeight(rx2, rz2) < 1.2 * S) continue;
        if (this.nearRoad(rx2, rz2, 0.6)) continue;
        if (addRock(rx2, rz2, 0.5 + rng() * 1.6)) roadRockN++;
      }
    }

    /* ---------- Bebatuan di tepi jalan ---------- */
    for (var rri = 0; rri < this.roads.length; rri++) {
      var rd = this.roads[rri], rp2 = rd.pts;
      for (var k2 = 2; k2 < rp2.length - 2; k2 += 4) {
        for (var sd = -1; sd <= 1; sd += 2) {
          if (rng() < 0.55) continue;
          var q0 = rp2[k2 - 1], q1 = rp2[k2 + 1];
          var ddx = q1.x - q0.x, ddz = q1.z - q0.z;
          var ddl = Math.hypot(ddx, ddz) || 1;
          var nnx = -ddz / ddl, nnz = ddx / ddl;
          var roff = rd.half + 1.2 + rng() * 2.6;
          var rxp = rp2[k2].x + nnx * roff * sd;
          var rzp = rp2[k2].z + nnz * roff * sd;
          if (this.groundHeight(rxp, rzp) < 1.1 * S) continue;
          if (this._slopeAt(rxp, rzp) > 0.9) continue;
          if (addRock(rxp, rzp, 0.35 + rng() * 0.95)) roadRockN++;
        }
      }
    }

    /* ---------- Bongkahan batu besar di lereng pegunungan ---------- */
    var clusters = 0;
    for (var ci = 0; ci < 70 && clusters < 34; ci++) {
      var cx3 = (rng() * 2 - 1) * C.WORLD.size * 0.42;
      var cz3 = (rng() * 2 - 1) * C.WORLD.size * 0.42;
      var ch = this.height(cx3, cz3);
      if (ch < 26 * S || ch > 92 * S) continue;
      if (this._slopeAt(cx3, cz3) > 1.0) continue;
      if (this._inSettlement(cx3, cz3, 10)) continue;
      if (this.nearRoad(cx3, cz3, 4)) continue;
      clusters++;
      var nB = 4 + ((rng() * 5) | 0);
      for (var b3 = 0; b3 < nB; b3++) {
        var ba = rng() * Math.PI * 2, br = rng() * 11;
        addRock(cx3 + Math.cos(ba) * br, cz3 + Math.sin(ba) * br, 0.8 + rng() * 2.3);
      }
    }

    // --- Susun instance ---
    var dummy = new THREE.Object3D();
    var tmpC = new THREE.Color();

    // --- Batang pohon: lurus (rimbun & cemara) + melengkung (kelapa) ---
    var straightTrees = [], palmTrees = [];
    for (i = 0; i < trees.length; i++) {
      if (trees[i].type === 1) palmTrees.push(trees[i]); else straightTrees.push(trees[i]);
    }

    var trunkGeo = new THREE.CylinderGeometry(0.75, 1, 1, 7);
    trunkGeo.translate(0, 0.5, 0);
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.95, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(trunkMat, 'bark', 2, 2.5);
    var trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, straightTrees.length);
    trunkMesh.castShadow = true;
    for (i = 0; i < straightTrees.length; i++) {
      var st = straightTrees[i];
      dummy.position.set(st.x, st.gy, st.z);
      dummy.rotation.set(0, 0, st.tilt, 'XYZ');
      dummy.scale.set(st.trunkR, st.trunkH, st.trunkR);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      var trunkColor = st.type === 2 ? 0x453527 : 0x5B4631;
      tmpC.setHex(trunkColor).convertSRGBToLinear().multiplyScalar(0.9 + rng() * 0.25);
      trunkMesh.setColorAt(i, tmpC);
    }

    // Kelapa: batang melengkung, puncak batang dipakai untuk menaruh mahkota.
    var palmTrunkGeo = makePalmTrunkGeometry();
    var palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.95, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(palmTrunkMat, 'bark', 2, 5);
    var palmTrunkMesh = new THREE.InstancedMesh(palmTrunkGeo, palmTrunkMat, palmTrees.length);
    palmTrunkMesh.castShadow = true;
    for (i = 0; i < palmTrees.length; i++) {
      var pt = palmTrees[i];
      dummy.position.set(pt.x, pt.gy, pt.z);
      dummy.rotation.set(0, pt.dir, 0, 'YXZ');
      dummy.scale.set(pt.trunkR, pt.trunkH, pt.trunkR);
      dummy.updateMatrix();
      palmTrunkMesh.setMatrixAt(i, dummy.matrix);
      tmpC.setHex(0x826A49).convertSRGBToLinear().multiplyScalar(0.92 + rng() * 0.22);
      palmTrunkMesh.setColorAt(i, tmpC);
      pt.crownX = pt.x + Math.cos(pt.dir) * pt.trunkR * PALM_BEND;
      pt.crownZ = pt.z - Math.sin(pt.dir) * pt.trunkR * PALM_BEND;
      pt.crownY = pt.gy + pt.trunkH;
    }

    // Kanopi: gumpalan dedaunan organik per pohon rimbun, pelepah + kelapa per
    // kelapa (mesh pelepah terpisah), dan cemara = kerucut bertumpuk.
    var canopyItems = [];
    var pineItems = [];
    var frondItems = [];
    function addCanopy(px, py, pz, rx, ry, rz, sx, sy, sz, hex, shade) {
      canopyItems.push({ px: px, py: py, pz: pz, rx: rx, ry: ry, rz: rz, sx: sx, sy: sy, sz: sz, hex: hex, shade: shade });
    }
    function addPine(px, py, pz, rx, ry, rz, sx, sy, sz, hex, shade) {
      pineItems.push({ px: px, py: py, pz: pz, rx: rx, ry: ry, rz: rz, sx: sx, sy: sy, sz: sz, hex: hex, shade: shade });
    }
    function addFrond(px, py, pz, rx, ry, rz, sx, sy, sz, hex, shade) {
      frondItems.push({ px: px, py: py, pz: pz, rx: rx, ry: ry, rz: rz, sx: sx, sy: sy, sz: sz, hex: hex, shade: shade });
    }
    var greens = [0x3F5D32, 0x496A3A, 0x344C2B, 0x547243];
    var pineGreens = [0x233E2A, 0x2A4A31, 0x1C3424, 0x315439];
    var frondGreens = [0x3C6238, 0x476F3E, 0x325430, 0x527B45];
    for (i = 0; i < trees.length; i++) {
      var t = trees[i];
      var topY = t.gy + t.trunkH;
      if (t.type === 0) {
        var g = greens[(rng() * greens.length) | 0];
        // Mahkota: gumpalan puncak + 4 gumpalan rapat + isi bawah (tak beraturan)
        addCanopy(t.x, topY + t.canopyR * 0.48, t.z, rng() * 0.5, rng() * Math.PI, rng() * 0.5,
          t.canopyR * 0.92, t.canopyR * 0.72, t.canopyR * 0.92, g, 0.9 + rng() * 0.25);
        for (var bi = 0; bi < 4; bi++) {
          var ba = t.dir + bi * (Math.PI * 2 / 4) + rng() * 0.42;
          var br = t.canopyR * (0.6 + rng() * 0.25);
          addCanopy(
            t.x + Math.cos(ba) * t.canopyR * 0.52,
            topY + t.canopyR * (0.1 + rng() * 0.4),
            t.z + Math.sin(ba) * t.canopyR * 0.52,
            rng() * 0.8, rng() * Math.PI, rng() * 0.8,
            br, br * (0.72 + rng() * 0.2), br, g, 0.74 + rng() * 0.36
          );
        }
        // Isi bagian bawah agar mahkota tampak padat dari bawah
        addCanopy(
          t.x + (rng() - 0.5) * t.canopyR * 0.4, topY - t.canopyR * 0.02,
          t.z + (rng() - 0.5) * t.canopyR * 0.4,
          rng() * 0.6, rng() * Math.PI, rng() * 0.6,
          t.canopyR * 0.64, t.canopyR * 0.48, t.canopyR * 0.64, g, 0.68 + rng() * 0.24
        );
      } else if (t.type === 1) {
        var fr = frondGreens[(rng() * frondGreens.length) | 0];
        var cx = t.crownX, cz = t.crownZ, cy = t.crownY;
        // 5 pelepah muda (tegak) + 5 tengah + 6 tua (terkulai) = mahkota padat
        for (var k = 0; k < 16; k++) {
          var upper = k < 5;
          var a = t.dir + k * (Math.PI * 2 / 16) + (rng() - 0.5) * 0.25;
          var pitch;
          if (upper) pitch = -0.6 + rng() * 0.3;
          else if (k < 10) pitch = 0.04 + rng() * 0.18;
          else pitch = 0.3 + rng() * 0.32;
          var len = t.canopyR * (upper ? 0.95 : 1.0) * (0.88 + rng() * 0.24);
          addFrond(cx, cy - (upper ? 0.1 : 0.22), cz, pitch, a, 0,
            0.95 + rng() * 0.3, 1, len, fr, 0.8 + rng() * 0.34);
        }
        // 2 pelepah kering menggantung
        for (var dk = 0; dk < 2; dk++) {
          addFrond(cx, cy - 0.34, cz, 1.05 + rng() * 0.3, t.dir + rng() * Math.PI * 2, 0,
            0.8, 1, t.canopyR * (0.62 + rng() * 0.2), 0x8A6B3D, 0.9 + rng() * 0.15);
        }
        // 3 kelapa di pangkal mahkota
        for (var ck = 0; ck < 3; ck++) {
          var ca = rng() * Math.PI * 2;
          var cr = 0.15 + rng() * 0.055;
          addCanopy(cx + Math.cos(ca) * 0.24, cy - 0.42 - rng() * 0.15, cz + Math.sin(ca) * 0.24,
            rng() * 0.5, rng() * Math.PI, 0, cr * 1.15, cr, cr * 1.15, 0x6B4A2F, 0.95 + rng() * 0.1);
        }
      } else {
        // Cemara: batang terlihat jelas, 5 kerucut mengecil ke atas
        var pg = pineGreens[(rng() * pineGreens.length) | 0];
        var layerN = 5;
        var pineBase = t.gy + t.trunkH * 0.42;
        var pineSpan = t.trunkH * 0.62 + t.canopyR * 0.55;
        var pineCH = t.canopyR * 1.25;
        for (var li = 0; li < layerN; li++) {
          var f = li / (layerN - 1); // 0 = bawah, 1 = puncak
          var cr = t.canopyR * (1.0 - 0.6 * f) * (0.9 + rng() * 0.2);
          addPine(
            t.x, pineBase + pineSpan * f, t.z,
            0, t.dir + li * 0.7, 0,
            cr, pineCH * (0.92 + f * 0.25), cr, pg, 0.80 + rng() * 0.26 + f * 0.1
          );
        }
      }
    }

    var canopyGeo = makeLeafBlobGeometry();
    var canopyMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.95, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(canopyMat, 'leaf', 2, 2);
    // Kanopi dipecah per petak agar frustum culling benar-benar bekerja. Di
    // r128, InstancedMesh mematikan culling dan memakai bounding sphere
    // geometri; tiap petak memakai klon geometri dengan bola pembatas sendiri.
    // Ini memangkas ±1,4 juta segitiga kanopi menjadi hanya petak yang terlihat.
    var canopyChunk = 520;
    var canopyBuckets = {};
    for (i = 0; i < canopyItems.length; i++) {
      var ci = canopyItems[i];
      var ckey = Math.floor(ci.px / canopyChunk) + ',' + Math.floor(ci.pz / canopyChunk);
      (canopyBuckets[ckey] || (canopyBuckets[ckey] = [])).push(i);
    }
    var canopyMeshes = [];
    Object.keys(canopyBuckets).forEach(function (ckey) {
      var ids = canopyBuckets[ckey];
      var chunkGeo = canopyGeo.clone();
      var minX = Infinity, minY = Infinity, minZ = Infinity;
      var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      var j;
      for (j = 0; j < ids.length; j++) {
        var cj = canopyItems[ids[j]];
        var ext = Math.max(cj.sx, cj.sy, cj.sz) * 1.5 + 0.5;
        if (cj.px - ext < minX) minX = cj.px - ext;
        if (cj.px + ext > maxX) maxX = cj.px + ext;
        if (cj.py - ext < minY) minY = cj.py - ext;
        if (cj.py + ext > maxY) maxY = cj.py + ext;
        if (cj.pz - ext < minZ) minZ = cj.pz - ext;
        if (cj.pz + ext > maxZ) maxZ = cj.pz + ext;
      }
      var ccx = (minX + maxX) * 0.5, ccy = (minY + maxY) * 0.5, ccz = (minZ + maxZ) * 0.5;
      var cr = Math.sqrt(
        (maxX - ccx) * (maxX - ccx) +
        (maxY - ccy) * (maxY - ccy) +
        (maxZ - ccz) * (maxZ - ccz)
      ) + 1.0;
      chunkGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(ccx, ccy, ccz), cr);
      var cm = new THREE.InstancedMesh(chunkGeo, canopyMat, ids.length);
      cm.castShadow = true;
      for (j = 0; j < ids.length; j++) {
        var c = canopyItems[ids[j]];
        dummy.position.set(c.px, c.py, c.pz);
        dummy.rotation.set(c.rx, c.ry, c.rz, 'YXZ');
        dummy.scale.set(c.sx, c.sy, c.sz);
        dummy.updateMatrix();
        cm.setMatrixAt(j, dummy.matrix);
        tmpC.setHex(c.hex).convertSRGBToLinear().multiplyScalar(c.shade);
        cm.setColorAt(j, tmpC);
      }
      cm.frustumCulled = true;
      canopyMeshes.push(cm);
      self.scene.add(cm);
    });
    this._canopyChunks = canopyMeshes;

    // Pelepah kelapa: mesh terpisah (dua sisi) agar bentuknya seperti daun asli
    var frondMesh = null;
    if (frondItems.length) {
      var frondGeo = makePalmFrondGeometry();
      var frondMat = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF, roughness: 0.9, metalness: 0, side: THREE.DoubleSide
      });
      if (global.TexLib) global.TexLib.apply(frondMat, 'leaf', 1, 1);
      frondMesh = new THREE.InstancedMesh(frondGeo, frondMat, frondItems.length);
      frondMesh.castShadow = true;
      for (i = 0; i < frondItems.length; i++) {
        var fd = frondItems[i];
        dummy.position.set(fd.px, fd.py, fd.pz);
        dummy.rotation.set(fd.rx, fd.ry, fd.rz, 'YXZ');
        dummy.scale.set(fd.sx, fd.sy, fd.sz);
        dummy.updateMatrix();
        frondMesh.setMatrixAt(i, dummy.matrix);
        tmpC.setHex(fd.hex).convertSRGBToLinear().multiplyScalar(fd.shade);
        frondMesh.setColorAt(i, tmpC);
      }
    }

    // Cemara: kerucut bertumpuk (instanced terpisah dari bola dedaunan)
    var pineMesh = null;
    if (pineItems.length) {
      var pineGeo = new THREE.ConeGeometry(1, 1, 8);
      var pineMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.95, metalness: 0 });
      if (global.TexLib) global.TexLib.apply(pineMat, 'leaf', 3, 2);
      pineMesh = new THREE.InstancedMesh(pineGeo, pineMat, pineItems.length);
      pineMesh.castShadow = true;
      for (i = 0; i < pineItems.length; i++) {
        var pn = pineItems[i];
        dummy.position.set(pn.px, pn.py, pn.pz);
        dummy.rotation.set(pn.rx, pn.ry, pn.rz, 'YXZ');
        dummy.scale.set(pn.sx, pn.sy, pn.sz);
        dummy.updateMatrix();
        pineMesh.setMatrixAt(i, dummy.matrix);
        tmpC.setHex(pn.hex).convertSRGBToLinear().multiplyScalar(pn.shade);
        pineMesh.setColorAt(i, tmpC);
      }
    }

    // Batu-batu
    var rockGeo = new THREE.DodecahedronGeometry(1, 0);
    var rockMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.95, metalness: 0 });
    if (global.TexLib) {
      global.TexLib.apply(rockMat, 'rock', 1.6, 1.6);        // cadangan prosedural
      global.TexLib.apply(rockMat, 'rockyGround', 1.6, 1.6); // batu gunung
    }
    var rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
    // Batu tidak melempar bayangan: saat matahari rendah, batu di kejauhan bisa
    // menutup fasad kastil dengan bayangan raksasa yang terbaca seperti lubang.
    rockMesh.castShadow = false;
    rockMesh.receiveShadow = true;
    for (i = 0; i < rocks.length; i++) {
      var rk = rocks[i];
      dummy.position.set(rk.x, rk.gy + rk.s * 0.3, rk.z);
      dummy.rotation.set(rng() * 0.6, rk.ry, rng() * 0.6);
      dummy.scale.set(rk.s * (1.0 + rng() * 0.5), rk.s * (0.7 + rng() * 0.5), rk.s * (1.0 + rng() * 0.4));
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
      tmpC.setHex(0x777A76).convertSRGBToLinear().multiplyScalar(rk.shade);
      rockMesh.setColorAt(i, tmpC);
    }

    this.scene.add(trunkMesh);
    this.scene.add(palmTrunkMesh);
    this.scene.add(rockMesh);
    this.envMeshes = [trunkMesh, palmTrunkMesh].concat(canopyMeshes, [rockMesh]);
    this.envCounts = {
      trees: trees.length, rocks: rocks.length, canopyParts: canopyItems.length,
      pines: pineItems.length, fronds: frondItems.length,
      roadTrees: roadTreeN, forestTrees: forestTreeN, roadRocks: roadRockN
    };
    if (pineMesh) {
      this.scene.add(pineMesh);
      this.envMeshes.push(pineMesh);
    }
    if (frondMesh) {
      this.scene.add(frondMesh);
      this.envMeshes.push(frondMesh);
    }

    // Daftar kelapa & batu untuk kebutuhan desa/tugas (Fase 2)
    this.palms = [];
    for (i = 0; i < trees.length; i++) {
      if (trees[i].type === 1) this.palms.push({ x: trees[i].x, z: trees[i].z, taken: false });
    }
    this.rocks = rocks;
  };

  /* --- Update tiap frame: waktu, langit, air --- */
  World.prototype.update = function (dt, camera) {
    this.elapsed += dt;
    this.timeOfDay = (this.timeOfDay + dt / C.DAY.cycleSeconds) % 1;

    if (this.sky) {
      this.sky.update(dt, camera, this.timeOfDay);
      this.fogColor.copy(this.sky.fogColor);
    }
    if (this.scene.fog) this.scene.fog.color.copy(this.fogColor);

    // Gelombang air berjalan mengikuti waktu
    if (this.waterUniforms) this.waterUniforms.uTime.value = this.elapsed;
    // Riak permukaan sungai (normal map digeser perlahan).
    if (this.riverMat && this.riverMat.normalMap) {
      this.riverMat.normalMap.offset.x = this.elapsed * 0.006;
      this.riverMat.normalMap.offset.y = -this.elapsed * 0.003;
    }

    // Petak kanopi yang jauh disembunyikan: kabut sudah menutupinya, dan ini
    // menghemat baik pass utama maupun pass bayangan. Radius petak ikut
    // diperhitungkan agar tidak ada pop-in di tepi pandang.
    if (camera && this._canopyChunks) {
      var cp = camera.position;
      for (var ci = 0; ci < this._canopyChunks.length; ci++) {
        var cm = this._canopyChunks[ci];
        var bs = cm.geometry.boundingSphere;
        var cdx = cp.x - bs.center.x, cdz = cp.z - bs.center.z;
        var lim = 1150 + bs.radius;
        cm.visible = cdx * cdx + cdz * cdz <= lim * lim;
      }
    }
  };

  World.prototype.getClockInfo = function () {
    var t = this.timeOfDay;
    var hours = t * 24;
    var hh = Math.floor(hours);
    var mm = Math.floor((hours - hh) * 60);
    var phase;
    if (t >= 0.20 && t < 0.34) phase = 'Pagi';
    else if (t >= 0.34 && t < 0.62) phase = 'Siang';
    else if (t >= 0.62 && t < 0.80) phase = 'Sore';
    else phase = 'Malam';
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return { text: pad(hh) + ':' + pad(mm), phase: phase };
  };

  global.World = World;
})(typeof window !== 'undefined' ? window : globalThis);
