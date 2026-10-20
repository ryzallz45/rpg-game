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
        sand: srgb(0xD9C08A),
        sandWet: srgb(0xBFA265),
        seabed: srgb(0x7E9360),
        grassBase: srgb(0x5E9C48),
        grassLight: srgb(0x86C263),
        grassDark: srgb(0x4A8039),
        grassDry: srgb(0xA9A55C),
        dirt: srgb(0x8A6B4A),
        rock: srgb(0x8C8C92),
        rockDark: srgb(0x6F6F76)
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
    this.fogColor = new THREE.Color(0xA8D8F0).convertSRGBToLinear();
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

        // Bercak rumput kering dekat pantai — halus dan berpola, tidak satu bidang besar
        var dry = U.smoothstep(0.70, 0.95, fbmColor(x * (0.012 / S) + 300, z * (0.012 / S) + 300) * 0.5 + 0.5) *
                  (1 - U.smoothstep(9 * S, 20 * S, y));
        col.lerp(COLORS.grassDry, dry * 0.42);

        var damp = U.smoothstep(0.58, 0.9, fbmColor(x * (0.011 / S) + 90, z * (0.011 / S) + 90) * 0.5 + 0.5);
        col.lerp(COLORS.grassDark, damp * 0.55);

        var beachT = 1 - U.smoothstep(1.0 * S, 3.5 * S, y);
        col.lerp(COLORS.sand, beachT);

        var dirtT2 = U.smoothstep(0.32, 0.58, slope) * (1 - U.smoothstep(38 * S, 50 * S, y));
        col.lerp(COLORS.dirt, dirtT2 * 0.75);

        var rockT2 = U.smoothstep(0.5, 0.78, slope);
        this._tmpColor.copy(COLORS.rock).lerp(COLORS.rockDark, gm * 0.5);
        col.lerp(this._tmpColor, rockT2);
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
    var shallow = srgb(0x5FD0C4), mid = srgb(0x2E9FC4), deep = srgb(0x12608F);
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
      if (blocked) continue;
      if (!this._spotFree(x, z, minDist)) continue;
      return { x: x, z: z, h: h };
    }
    return null;
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
    this._placeProcedural(rng);
  };

  World.prototype._placeProcedural = function (rng) {
    var S = this.scale || 1;
    var trees = [], rocks = [];
    var i, p;

    // Preset grafis memengaruhi kerimbunan vegetasi (batang/daun tetap instanced).
    var q = (C.RENDER && C.RENDER.quality) || 'hd';
    var vegMul = q === 'cepat' ? 0.70 : (q === 'ultra' ? 1.0 : 0.85);

    var treeN = Math.round(460 * vegMul);   // pohon rimbun (pedalaman, tinggi)
    var palmN = Math.round(200 * vegMul);   // kelapa (sabuk pantai)
    var pineN = Math.round(300 * vegMul);   // cemara (punggung bukit & lereng)
    var rockN = Math.round(340 * vegMul);   // batu

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
      var trunkColor = st.type === 2 ? 0x54402C : 0x6E523A;
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
      tmpC.setHex(0x9C7C54).convertSRGBToLinear().multiplyScalar(0.92 + rng() * 0.22);
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
    var greens = [0x4E8C3C, 0x5A9C46, 0x437B34, 0x66A852];
    var pineGreens = [0x2F6136, 0x3A7342, 0x27512E];
    var frondGreens = [0x4E9440, 0x5AA64A, 0x3F8236, 0x67B052];
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
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    for (i = 0; i < rocks.length; i++) {
      var rk = rocks[i];
      dummy.position.set(rk.x, rk.gy + rk.s * 0.3, rk.z);
      dummy.rotation.set(rng() * 0.6, rk.ry, rng() * 0.6);
      dummy.scale.set(rk.s * (1.0 + rng() * 0.5), rk.s * (0.7 + rng() * 0.5), rk.s * (1.0 + rng() * 0.4));
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
      tmpC.setHex(0x8C8F94).convertSRGBToLinear().multiplyScalar(rk.shade);
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
