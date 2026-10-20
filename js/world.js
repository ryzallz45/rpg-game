/* Dunia (low-poly): terrain warna prosedural, laut, langit, vegetasi/batu, tabrakan.
   Menyusut-aman untuk Node (tanpa document/fetch) — dipakai tools/test-build.js */
(function (global) {
  'use strict';
  var U = global.Utils;
  var C = global.CONFIG;

  // Warna sRGB -> linear (akurat dengan tone mapping + output sRGB)
  function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

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

      var center = 1 - U.smoothstep(0.22, 0.80, r);
      var ridge = Math.max(0, fbmRidge(u * 0.0075 + 7.3, v * 0.0075 + 2.1) + 0.15);
      h += ridge * 58 * center * center;

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

    // Ketinggian akhir = bentuk besar + kerutan halus permukaan daratan
    function full(x, z) {
      var m = macro(x, z);
      m += fbmDetail(x * (0.058 / S), z * (0.058 / S)) * 0.42 * S * U.smoothstep(-S, 1.5 * S, m);
      return m;
    }

    full.macro = macro;
    full.fbmColor = fbmColor;
    full.islands = islands;
    full.scale = S;
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
      } else {
        var depth = U.smoothstep(0.3 * S, 9 * S, -y);
        col.copy(COLORS.sandWet).lerp(COLORS.seabed, depth);
      }
      col.multiplyScalar(shade);

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    var mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0
    });
    if (global.TexLib) {
      global.TexLib.apply(mat, 'soil', 110, 110);                       // tekstur tanah
      global.TexLib.applyNormal(mat, 'soilNormal', 110, 110, 0.5);      // relief tanah halus
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
    return mesh;
  };

  /* Pasang/lepas peta lingkungan (PMREM langit) pada material air.
     Fase 5: hanya air yang memakai IBL — material lain tetap hemat. */
  World.prototype.setWaterEnv = function (tex) {
    var t = tex || null;
    if (this._envTex === t) return;
    var had = !!this._envTex;
    this._envTex = t;
    var mats = [this.waterMat, this.oceanMat];
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
      if (blocked) continue;
      if (!this._spotFree(x, z, minDist)) continue;
      return { x: x, z: z, h: h };
    }
    return null;
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

  /* --- Vegetasi & batu: penempatan prosedural (instanced) --- */
  World.prototype.buildEnvironment = function () {
    var rng = U.mulberry32(C.WORLD.seed + 909);
    this.villageSpots = this.pickVillageSpots();
    this.villageSpot = this.villageSpots[0];
    this._placed = [];
    this._spawn = null;
    this.islandSites = this.pickIslandSites();
    this.harborSpot = this.pickHarborSpot();
    this.landmarkSites = this.pickLandmarkSites();
    this._placeProcedural(rng);
    this.buildLandmarks();
  };

  World.prototype._placeProcedural = function (rng) {
    var S = this.scale || 1;
    var trees = [], rocks = [];
    var i, p;

    // Preset grafis memengaruhi kerimbunan vegetasi (batang/daun tetap instanced).
    var q = (C.RENDER && C.RENDER.quality) || 'hd';
    var vegMul = q === 'cepat' ? 0.70 : (q === 'ultra' ? 1.0 : 0.85);

    var treeN = Math.round(430 * vegMul);   // pohon rimbun (pedalaman, tinggi)
    var palmN = Math.round(36 * vegMul);    // kelapa pesisir (sangat jarang)
    var pineN = Math.round(720 * vegMul);   // cemara (punggung bukit & lereng)
    var rockN = Math.round(390 * vegMul);   // batu

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
    var canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, canopyItems.length);
    canopyMesh.castShadow = true;
    for (i = 0; i < canopyItems.length; i++) {
      var c = canopyItems[i];
      dummy.position.set(c.px, c.py, c.pz);
      dummy.rotation.set(c.rx, c.ry, c.rz, 'YXZ');
      dummy.scale.set(c.sx, c.sy, c.sz);
      dummy.updateMatrix();
      canopyMesh.setMatrixAt(i, dummy.matrix);
      tmpC.setHex(c.hex).convertSRGBToLinear().multiplyScalar(c.shade);
      canopyMesh.setColorAt(i, tmpC);
    }

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
    if (global.TexLib) global.TexLib.apply(rockMat, 'rock', 1.6, 1.6);
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
    this.scene.add(canopyMesh);
    this.scene.add(rockMesh);
    this.envMeshes = [trunkMesh, palmTrunkMesh, canopyMesh, rockMesh];
    this.envCounts = {
      trees: trees.length, rocks: rocks.length, canopyParts: canopyItems.length,
      pines: pineItems.length, fronds: frondItems.length
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
