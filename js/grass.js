/* Rumput & bunga (Fase 2; Fase 5: per potongan/chunk mengikuti pemain).
   Dunia Fase 5 ±10× lebih luas, jadi rumput hanya dibangun di sekitar pemain
   (5×5 potongan @36 m). Tetap 2 draw call per potongan — ringan untuk perangkat lemah. */
(function (global) {
  'use strict';
  var U = global.Utils;
  var C = global.CONFIG;

  var CHUNK = 36;        // ukuran potongan (m)
  var RADIUS = 2;        // 5×5 potongan aktif di sekitar pemain (±90 m)
  var TUFT_N = 56;       // rumpun per potongan
  var FLOWER_N = 8;      // bunga per potongan
  var SLOTS = (RADIUS * 2 + 1) * (RADIUS * 2 + 1);
  var FILL_PER_FRAME = 2;

  var GREENS = [0x3F5A32, 0x4A6939, 0x344C2A, 0x577741, 0x2E4528];
  var PETALS = [0xE8E4D5, 0xD8B85A, 0xA8B6D6, 0xB98B5A, 0xE6D58C];

  function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  function GrassField(scene, world) {
    this.scene = scene;
    this.world = world;
    this.uniforms = { uTime: { value: 0 } };
    this.counts = { tufts: 0, flowers: 0 };
    this.chunks = Object.create(null); // key "cx,cz" → catatan potongan
    this.slots = [];                   // key potongan per slot instance
    this.slotRec = [];                 // catatan potongan per slot
    this.meshes = null;
    this._t = 0;
    this._dummy = null;
    this._color = null;
  }

  /* Satu rumpun rumput: 6 helai (segitiga) menyebar dari satu akar. */
  function makeTuftGeometry(rng) {
    var pos = [], idx = [], v = 0, blades = 6;
    for (var b = 0; b < blades; b++) {
      var ang = (b / blades) * Math.PI * 2 + rng() * 0.9;
      var lean = 0.10 + rng() * 0.18;
      var h = 0.30 + rng() * 0.26;
      var w = 0.05 + rng() * 0.025;
      var dx = Math.cos(ang), dz = Math.sin(ang);
      pos.push(-dz * w * 0.5, 0, dx * w * 0.5,
               dz * w * 0.5, 0, -dx * w * 0.5,
               dx * lean, h, dz * lean);
      idx.push(v, v + 1, v + 2);
      v += 3;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /* Bunga kecil: 3 kelopak berbentuk quad saling silang di ujung tangkai pendek. */
  function makeFlowerGeometry(rng) {
    var pos = [], idx = [], v = 0;
    for (var p = 0; p < 3; p++) {
      var ang = (p / 3) * Math.PI + rng() * 0.4;
      var h = 0.16 + rng() * 0.10;
      var w = 0.055 + rng() * 0.02;
      var dx = Math.cos(ang) * w, dz = Math.sin(ang) * w;
      pos.push(-dx, h - 0.05, -dz,
                dx, h - 0.05, dz,
                dx, h + 0.05, dz,
               -dx, h + 0.05, -dz);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /* Tambahkan goyangan angin ke shader material (akar helai tetap di tanah). */
  function patchSway(mat, uniforms, amp) {
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          '#ifdef USE_INSTANCING',
          '  vec2 iw = instanceMatrix[3].xz;',
          '  float swayF = clamp(position.y * 2.4, 0.0, 1.0);',
          '  transformed.x += sin(uTime * 1.7 + iw.x * 0.5 + iw.y * 0.37) * ' + amp.toFixed(3) + ' * swayF;',
          '  transformed.z += cos(uTime * 1.2 + iw.x * 0.41 + iw.y * 0.53) * ' + (amp * 0.8).toFixed(3) + ' * swayF;',
          '#endif'
        ].join('\n'));
    };
    mat.customProgramCacheKey = function () { return 'sway' + amp; };
  }

  /* Tempat layak tumbuh: daratan hijau agak landai, bukan area desa.
     Mengembalikan tinggi tanah, atau NaN bila tidak layak. */
  function spotHeight(world, x, z) {
    var S = world.scale || 1;
    var h = world.groundHeight(x, z);
    if (h < 1.3 * S || h > 32 * S) return NaN;
    if (world._slopeAt(x, z) > 0.5) return NaN;
    if (world.nearRoad && world.nearRoad(x, z, 0.7)) return NaN; // jalan tetap bersih
    var spots = world.villageSpots || [];
    for (var i = 0; i < spots.length; i++) {
      var dx = x - spots[i].x, dz = z - spots[i].z;
      var rr = spots[i].r + 2;
      if (dx * dx + dz * dz < rr * rr) return NaN;
    }
    return h;
  }

  /* Acak deterministik per potongan (potongan sama → rumput sama). */
  function chunkRng(cx, cz) {
    var a = ((cx | 0) * 73856093) ^ ((cz | 0) * 19349663) ^ (C.WORLD.seed + 2027);
    return U.mulberry32(a >>> 0);
  }

  GrassField.prototype.build = function () {
    var tuftMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF, roughness: 0.95, metalness: 0, side: THREE.DoubleSide
    });
    patchSway(tuftMat, this.uniforms, 0.06);
    var tuftMesh = new THREE.InstancedMesh(makeTuftGeometry(U.mulberry32(C.WORLD.seed + 2031)), tuftMat, SLOTS * TUFT_N);
    tuftMesh.receiveShadow = true;
    tuftMesh.frustumCulled = false; // instance tersebar — jangan culling salah

    var flowerMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF, roughness: 0.9, metalness: 0, side: THREE.DoubleSide
    });
    patchSway(flowerMat, this.uniforms, 0.05);
    var flowerMesh = new THREE.InstancedMesh(makeFlowerGeometry(U.mulberry32(C.WORLD.seed + 2033)), flowerMat, SLOTS * FLOWER_N);
    flowerMesh.frustumCulled = false;

    // Semua instance mulai tersembunyi (skala nol), lalu diisi per potongan.
    var dummy = new THREE.Object3D();
    dummy.position.set(0, -100, 0);
    dummy.scale.set(0.0001, 0.0001, 0.0001);
    dummy.updateMatrix();
    var i;
    for (i = 0; i < tuftMesh.count; i++) tuftMesh.setMatrixAt(i, dummy.matrix);
    for (i = 0; i < flowerMesh.count; i++) flowerMesh.setMatrixAt(i, dummy.matrix);
    tuftMesh.instanceMatrix.needsUpdate = true;
    flowerMesh.instanceMatrix.needsUpdate = true;

    this.scene.add(tuftMesh);
    this.scene.add(flowerMesh);
    this.meshes = [tuftMesh, flowerMesh];
    this._tuftMesh = tuftMesh;
    this._flowerMesh = flowerMesh;
    this.counts = { tufts: SLOTS * TUFT_N, flowers: SLOTS * FLOWER_N };
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    for (i = 0; i < SLOTS; i++) { this.slots.push(null); this.slotRec.push(null); }
  };

  /* Dibangun bertahap (2 potongan per frame) — tidak ada jeda mendadak. */
  GrassField.prototype.update = function (dt, target) {
    if (!this.meshes || !target || !target.position) return;
    this.uniforms.uTime.value = this.world.elapsed;
    var px = target.position.x, pz = target.position.z;
    var cx = Math.floor(px / CHUNK), cz = Math.floor(pz / CHUNK);
    var need = [];
    var needSet = Object.create(null);
    var i, j, k;

    for (j = -RADIUS; j <= RADIUS; j++) {
      for (i = -RADIUS; i <= RADIUS; i++) {
        k = (cx + i) + ',' + (cz + j);
        var rec = this.chunks[k];
        if (!rec) {
          rec = { key: k, cx: cx + i, cz: cz + j, slot: -1, ready: false };
          this.chunks[k] = rec;
        }
        rec.last = this._t;
        need.push(rec);
        needSet[k] = true;
      }
    }
    this._t++;

    // Potongan terdekat lebih dahulu
    need.sort(function (a, b) {
      var ax = a.cx - cx, az = a.cz - cz, bx = b.cx - cx, bz = b.cz - cz;
      return (ax * ax + az * az) - (bx * bx + bz * bz);
    });

    var budget = FILL_PER_FRAME;
    for (i = 0; i < need.length && budget > 0; i++) {
      var r = need[i];
      if (r.ready) continue;
      if (r.slot < 0) {
        r.slot = this._acquireSlot(needSet);
        this.slots[r.slot] = r.key;
        this.slotRec[r.slot] = r;
      }
      this._fillChunk(r);
      r.ready = true;
      budget--;
    }

    // Bersihkan catatan potongan yang sudah lama ditinggalkan
    if (this._t % 240 === 0) {
      for (var kk in this.chunks) {
        if (this._t - this.chunks[kk].last > 900) delete this.chunks[kk];
      }
    }
  };

  GrassField.prototype._acquireSlot = function (needSet) {
    for (var i = 0; i < this.slots.length; i++) {
      var key = this.slots[i];
      if (key === null || !needSet[key]) {
        var old = this.slotRec[i];
        if (old) { old.slot = -1; old.ready = false; }
        this.slots[i] = null;
        this.slotRec[i] = null;
        return i;
      }
    }
    return 0;
  };

  GrassField.prototype._fillChunk = function (rec) {
    var world = this.world;
    var rng = chunkRng(rec.cx, rec.cz);
    var dummy = this._dummy, tmpC = this._color;
    var i, x, z, h;

    // Rumpun rumput
    var base = rec.slot * TUFT_N;
    for (i = 0; i < TUFT_N; i++) {
      var rx = rng(), rz = rng(), rs = rng(), rr = rng(), rh = rng(), rc = rng();
      x = (rec.cx + rx) * CHUNK;
      z = (rec.cz + rz) * CHUNK;
      h = spotHeight(world, x, z);
      if (isNaN(h)) {
        dummy.position.set(0, -100, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
      } else {
        var s = 0.8 + rs * 0.55;
        dummy.position.set(x, h - 0.02, z);
        dummy.rotation.set(0, rr * Math.PI * 2, 0);
        dummy.scale.set(s, s * (0.85 + rh * 0.4), s);
      }
      dummy.updateMatrix();
      this._tuftMesh.setMatrixAt(base + i, dummy.matrix);
      if (!isNaN(h)) {
        tmpC.setHex(GREENS[(rc * GREENS.length) | 0]).convertSRGBToLinear().multiplyScalar(0.85 + rh * 0.35);
        this._tuftMesh.setColorAt(base + i, tmpC);
      }
    }
    this._tuftMesh.instanceMatrix.needsUpdate = true;
    if (this._tuftMesh.instanceColor) this._tuftMesh.instanceColor.needsUpdate = true;

    // Bunga
    var fbase = rec.slot * FLOWER_N;
    for (i = 0; i < FLOWER_N; i++) {
      var fxr = rng(), fzr = rng(), fs = rng(), fr = rng(), fc = rng();
      x = (rec.cx + fxr) * CHUNK;
      z = (rec.cz + fzr) * CHUNK;
      h = spotHeight(world, x, z);
      if (isNaN(h)) {
        dummy.position.set(0, -100, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
      } else {
        dummy.position.set(x, h, z);
        dummy.rotation.set(0, fr * Math.PI * 2, 0);
        dummy.scale.set(fs * 0.8 + 0.45, fs * 0.8 + 0.45, fs * 0.8 + 0.45);
      }
      dummy.updateMatrix();
      this._flowerMesh.setMatrixAt(fbase + i, dummy.matrix);
      if (!isNaN(h)) {
        tmpC.setHex(PETALS[(fc * PETALS.length) | 0]).convertSRGBToLinear();
        this._flowerMesh.setColorAt(fbase + i, tmpC);
      }
    }
    this._flowerMesh.instanceMatrix.needsUpdate = true;
    if (this._flowerMesh.instanceColor) this._flowerMesh.instanceColor.needsUpdate = true;
  };

  global.GrassField = GrassField;
})(typeof window !== 'undefined' ? window : globalThis);
