/* Desa & penduduk (Fase 2): desa utama yang besar + pendukuhan kecil tersebar
   di pulau — rumah panggung, sumur, alun-alun, pagar, api unggun, NPC dengan
   dialog Bahasa Indonesia, dan dua tugas kecil (kelapa & keranjang Mira). */
(function (global) {
  'use strict';
  var U = global.Utils;
  var C = global.CONFIG;

  function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function smat(hex, rough) {
    return new THREE.MeshStandardMaterial({ color: srgb(hex), roughness: rough, metalness: 0 });
  }

  /* Prisma atap: bubungan sepanjang X, satuan (setengah lebar 1, tinggi 1, setengah dalam 1). */
  function makePrismGeometry() {
    var tris = [
      // segitiga ujung -X dan +X
      [-1, 0, -1], [-1, 0, 1], [-1, 1, 0],
      [1, 0, 1], [1, 0, -1], [1, 1, 0],
      // bidang landai -Z
      [-1, 0, -1], [1, 1, 0], [1, 0, -1],
      [-1, 0, -1], [-1, 1, 0], [1, 1, 0],
      // bidang landai +Z
      [1, 0, 1], [1, 1, 0], [-1, 0, 1],
      [1, 0, 1], [-1, 1, 0], [-1, 0, 1],
      // alas
      [1, 0, 1], [-1, 0, -1], [1, 0, -1],
      [1, 0, 1], [-1, 0, 1], [-1, 0, -1]
    ];
    var pos = new Float32Array(tris.length * 3);
    var i;
    for (i = 0; i < tris.length; i++) {
      pos[i * 3] = tris[i][0]; pos[i * 3 + 1] = tris[i][1]; pos[i * 3 + 2] = tris[i][2];
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // UV sederhana (pemetaan planar) agar tekstur ijuk bisa dipasang
    var uv = new Float32Array(tris.length * 2);
    for (i = 0; i < tris.length; i++) {
      uv[i * 2] = (tris[i][0] + 1) * 0.5;
      uv[i * 2 + 1] = (tris[i][2] + 1) * 0.5;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return geo;
  }

  /* ---------- Warga desa ---------- */
  /* village: 0 = desa utama, 1..3 = pendukuhan (sesuai world.villageSpots),
     4..5 = pondok di pulau-pulau kecil (world.islandSites) */

  var NPC_DEFS = [
    { name: 'Pak Raka', role: 'kepala', village: 0, home: { x: -2.8, z: 2.8 }, wanderR: 3.0, speed: 1.6,
      pal: { shirt: 0x3E7C8F, pants: 0x4C5A6B, skin: 0xD9A878, hair: 0x2A2118, hat: true } },
    { name: 'Bu Sari', role: 'pedagang', village: 0, home: { x: 4.1, z: -2.8 }, wanderR: 3.4, speed: 1.8,
      pal: { shirt: 0xC96A6A, pants: 0x6B4A8F, skin: 0xE0B08A, hair: 0x1E1A16, dress: true } },
    { name: 'Mira', role: 'mira', village: 0, home: { x: -5.3, z: -3.7 }, wanderR: 4.6, speed: 2.0,
      pal: { shirt: 0xE8D06A, pants: 0x7A5A98, skin: 0xE8C098, hair: 0x3A2A1A, longHair: true } },
    { name: 'Adi', role: 'nelayan', village: 0, home: { x: 5.8, z: 4.1 }, wanderR: 3.8, speed: 2.1,
      pal: { shirt: 0x6FB3A8, pants: 0x3E4A56, skin: 0xC98F62, hair: 0x14100C } },
    { name: 'Kakek Bimo', role: 'kakek', village: 0, home: { x: 0.7, z: -5.5 }, wanderR: 2.0, speed: 1.1,
      pal: { shirt: 0x9A8F7A, pants: 0x5A5148, skin: 0xD9B48C, hair: 0xD8D8D8 } },
    { name: 'Bu Nia', role: 'pedagang', village: 1, home: { x: 2.3, z: -1.8 }, wanderR: 2.2, speed: 1.7,
      pal: { shirt: 0xE08A4A, pants: 0x4A6B8F, skin: 0xE0B08A, hair: 0x2E1E14, dress: true } },
    { name: 'Joni', role: 'nelayan', village: 2, home: { x: -2.4, z: 1.6 }, wanderR: 2.4, speed: 2.0,
      pal: { shirt: 0x4A8F6B, pants: 0x3E4A56, skin: 0xB97F52, hair: 0x14100C } },
    { name: 'Kakek Umar', role: 'kakek', village: 3, home: { x: -2.0, z: -1.6 }, wanderR: 1.8, speed: 1.1,
      pal: { shirt: 0x7A8A9A, pants: 0x4E463C, skin: 0xD9B48C, hair: 0xE2E2E2 } },
    // Fase 5: penghuni pulau kecil (pondok di dunia.islandSites)
    { name: 'Paman Dera', role: 'pelaut', village: 4, home: { x: 1.1, z: 0.9 }, wanderR: 2.2, speed: 1.5,
      pal: { shirt: 0x4E7A6A, pants: 0x3E4A56, skin: 0xC98F62, hair: 0x1E1712 } }
  ];

  function buildNpcMesh(pal) {
    var M = {
      skin: smat(pal.skin, 0.8),
      hair: smat(pal.hair, 0.9),
      shirt: smat(pal.shirt, 0.9),
      pants: smat(pal.pants, 0.9),
      boots: smat(0x5C4327, 0.85),
      eye: smat(0x1C1C1E, 0.35)
    };
    if (global.TexLib) {
      global.TexLib.apply(M.shirt, 'cloth', 1.5, 1.2);
      global.TexLib.apply(M.pants, 'cloth', 1.4, 1.4);
      global.TexLib.apply(M.boots, 'leather', 1.2, 1.2);
    }
    var g = new THREE.Group();
    var limbs = {};

    function part(parent, geo, mat, x, y, z) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    }

    part(g, new THREE.BoxGeometry(0.34, 0.2, 0.23), M.pants, 0, 0.88, 0);
    limbs.torso = part(g, new THREE.BoxGeometry(0.4, 0.5, 0.26), M.shirt, 0, 1.21, 0);
    if (pal.dress) {
      var skirt = part(g, new THREE.CylinderGeometry(0.17, 0.36, 0.56, 10), M.pants, 0, 0.68, 0);
      skirt.scale.z = 0.85;
    }
    if (pal.hat) {
      part(g, new THREE.CylinderGeometry(0.34, 0.34, 0.035, 12), M.hair, 0, 1.79, 0);
      part(g, new THREE.CylinderGeometry(0.15, 0.18, 0.17, 12), M.hair, 0, 1.88, 0);
    }
    part(g, new THREE.SphereGeometry(0.155, 12, 10), M.skin, 0, 1.62, 0);
    var hair = part(g, new THREE.SphereGeometry(0.162, 12, 10), M.hair, 0, 1.665, -0.01);
    hair.scale.y = 0.72;
    if (pal.longHair) {
      part(g, new THREE.CylinderGeometry(0.11, 0.14, 0.5, 8), M.hair, 0, 1.42, -0.15);
    }
    part(g, new THREE.SphereGeometry(0.021, 8, 6), M.eye, -0.055, 1.64, 0.136);
    part(g, new THREE.SphereGeometry(0.021, 8, 6), M.eye, 0.055, 1.64, 0.136);

    function makeArm(side) {
      var p = new THREE.Group();
      p.position.set(side * 0.28, 1.42, 0);
      part(p, new THREE.CylinderGeometry(0.075, 0.085, 0.24, 8), M.shirt, 0, -0.12, 0);
      part(p, new THREE.CylinderGeometry(0.058, 0.066, 0.26, 8), M.skin, 0, -0.36, 0);
      part(p, new THREE.SphereGeometry(0.062, 8, 6), M.skin, 0, -0.52, 0);
      g.add(p);
      return p;
    }
    function makeLeg(side) {
      var p = new THREE.Group();
      p.position.set(side * 0.145, 0.80, 0);
      part(p, new THREE.CylinderGeometry(0.072, 0.084, 0.62, 8), M.pants, 0, -0.31, 0);
      part(p, new THREE.BoxGeometry(0.15, 0.11, 0.24), M.boots, 0, -0.66, 0.04);
      g.add(p);
      return p;
    }
    limbs.armL = makeArm(-1);
    limbs.armR = makeArm(1);
    limbs.legL = makeLeg(-1);
    limbs.legR = makeLeg(1);
    return { group: g, limbs: limbs };
  }

  function Npc(def, index, world, site) {
    this.name = def.name;
    this.role = def.role;
    this.home = { x: site.x + def.home.x, z: site.z + def.home.z };
    this.home.y = world.groundHeight(this.home.x, this.home.z);
    this.wanderR = def.wanderR;
    this.speed = def.speed;
    this.rng = U.mulberry32(C.WORLD.seed + 4001 + index * 977);
    var built = buildNpcMesh(def.pal);
    this.group = built.group;
    this.limbs = built.limbs;
    this.group.position.set(this.home.x, this.home.y, this.home.z);
    this.group.rotation.y = this.rng() * Math.PI * 2;
    this.state = 'idle';
    this.timer = 0.5 + this.rng() * 2.5;
    this.target = null;
    this.walkPhase = this.rng() * 10;
    this.currentSpeed = 0;
    this.talking = false;
    this.lineIdx = 0;
  }

  Npc.prototype.update = function (dt, world, player) {
    // Dialog ditutup (selesai / dijeda) → berhenti menghadap pemain
    if (this.talking && global.UI && !global.UI.isDialogOpen()) this.talking = false;

    if (this.talking) {
      var pdx = player.position.x - this.group.position.x;
      var pdz = player.position.z - this.group.position.z;
      var faceYaw = Math.atan2(pdx, pdz);
      this.group.rotation.y = U.lerpAngle(this.group.rotation.y, faceYaw, 1 - Math.exp(-8 * dt));
      this.currentSpeed = 0;
      this._animate(dt, 0);
      return;
    }

    this.timer -= dt;
    if (this.state === 'idle') {
      this.currentSpeed = U.approach(this.currentSpeed, 0, 8 * dt);
      this._animate(dt, 0);
      if (this.timer <= 0) {
        var ang = this.rng() * Math.PI * 2;
        var r = Math.sqrt(this.rng()) * this.wanderR;
        var tx = this.home.x + Math.cos(ang) * r;
        var tz = this.home.z + Math.sin(ang) * r;
        if (world.groundHeight(tx, tz) > 1.0) {
          this.target = { x: tx, z: tz };
          this.state = 'walk';
        } else {
          this.timer = 1.2;
        }
      }
    } else if (this.state === 'walk') {
      var dx = this.target.x - this.group.position.x;
      var dz = this.target.z - this.group.position.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.35) {
        this.state = 'idle';
        this.timer = 1.5 + this.rng() * 3.5;
      } else {
        var vx = (dx / dist) * this.speed;
        var vz = (dz / dist) * this.speed;
        this.currentSpeed = U.approach(this.currentSpeed, this.speed, 6 * dt);
        this.group.position.x += vx * dt;
        this.group.position.z += vz * dt;
        this._collide(world);
        this.group.rotation.y = U.lerpAngle(this.group.rotation.y, Math.atan2(vx, vz), 1 - Math.exp(-7 * dt));
        this._animate(dt, this.currentSpeed);
      }
    }
    this.group.position.y = world.groundHeight(this.group.position.x, this.group.position.z);
  };

  // Dorong NPC keluar dari sumur/tiang rumah/api unggun (collider lingkaran) — tidak menembus.
  Npc.prototype._collide = function (world) {
    var cols = world.colliders;
    if (!cols || !cols.length) return;
    var px = this.group.position.x, pz = this.group.position.z;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      var dx = px - c.x, dz = pz - c.z;
      var rr = c.r + 0.3;
      var d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-8) {
        var d = Math.sqrt(d2);
        var push = (rr - d);
        px += (dx / d) * push;
        pz += (dz / d) * push;
      }
    }
    this.group.position.x = px;
    this.group.position.z = pz;
  };

  Npc.prototype._animate = function (dt, speed) {
    if (this.mixer) { // model 3D aktif
      this.mixer.update(dt);
      var want = speed > 0.25 ? this.act.walk : this.act.idle;
      if (want && want !== this._currentAct) {
        if (this._currentAct) this._currentAct.fadeOut(0.18);
        want.reset().fadeIn(0.18).play();
        this._currentAct = want;
      }
      if (this.act.walk) this.act.walk.timeScale = U.clamp(speed / 1.6, 0.7, 1.6);
      return;
    }
    var ratio = Math.min(speed / this.speed, 1.3);
    if (speed > 0.1) this.walkPhase += dt * (6.5 + 4.5 * ratio);
    else this.walkPhase += dt * 1.8;

    var swing = Math.sin(this.walkPhase) * 0.62 * ratio;
    this.limbs.armL.rotation.x = swing;
    this.limbs.armR.rotation.x = -swing;
    this.limbs.legL.rotation.x = -swing * 1.15;
    this.limbs.legR.rotation.x = swing * 1.15;
    var spread = 0.07 + 0.1 * ratio;
    this.limbs.armL.rotation.z = spread;
    this.limbs.armR.rotation.z = -spread;
    this.limbs.torso.position.y = 1.21 + Math.abs(Math.sin(this.walkPhase)) * 0.022 * ratio;
  };

  /* ---------- Model 3D penduduk (Tahap G5) ---------- */
  var NPC_MODELS = ['knight', 'mage', 'rogue', 'hooded', 'knight', 'mage', 'hooded', 'rogue'];
  var NPC_HEIGHTS = [1.72, 1.60, 1.50, 1.72, 1.50, 1.58, 1.64, 1.52];

  /* Warna pakaian NPC → tint pastel lembut agar tiap warga tampil beda. */
  function tintFromHex(hex) {
    var c = new THREE.Color(hex);
    var hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return new THREE.Color().setHSL(hsl.h, hsl.s * 0.35, 0.92);
  }

  Npc.prototype.attachModel = function (spawned) {
    if (this.mixer) return; // sudah memakai model 3D
    // Sembunyikan bentuk prosedural
    this._procParts = this.group.children.slice();
    for (var i = 0; i < this._procParts.length; i++) this._procParts[i].visible = false;

    this.modelRoot = spawned.root;
    this.group.add(spawned.root);

    this.mixer = new THREE.AnimationMixer(spawned.root);
    var mixer = this.mixer;
    function act(patterns) {
      var clip = global.AssetLibrary.findClip(spawned.clips, patterns);
      return clip ? mixer.clipAction(clip) : null;
    }
    this.act = {
      idle: act(['(^|\\|)Idle$']),
      walk: act(['(^|\\|)Walking_A$', '(^|\\|)Walking_B$', '(^|\\|)Walk$'])
    };
    this._currentAct = null;
    if (this.act.idle) {
      this.act.idle.play();
      this._currentAct = this.act.idle;
    }
  };

  Village.prototype.attachModels = function (lib) {
    if (!lib || !lib.ready) return 0;
    var count = 0;
    for (var i = 0; i < this.npcs.length; i++) {
      var npc = this.npcs[i];
      if (npc.mixer) continue; // sudah memakai model 3D — jangan klon ulang
      var name = NPC_MODELS[i % NPC_MODELS.length];
      if (!lib.has(name)) continue;
      var def = NPC_DEFS[i % NPC_DEFS.length];
      var spawned = lib.spawn(name, {
        height: NPC_HEIGHTS[i % NPC_HEIGHTS.length],
        tint: tintFromHex(def.pal.shirt)
      });
      if (!spawned) continue;
      npc.attachModel(spawned);
      count++;
    }
    if (count) console.log('[Aetheria] Model penduduk aktif: ' + count + ' warga');
    return count;
  };

  /* ---------- Dialog ---------- */

  var FLAVOR = {
    pedagang: [
      ['Aku menjual hasil kebun: ubi, pisang, dan sesekali madu hutan.', 'Desa kami kecil, tapi hatinya lapang.'],
      ['Nanti sore mampir ke pondokku — pisangnya baru matang.'],
      ['Kalau lelah, duduklah di alun-alun. Angin lautnya sejuk sekali.']
    ],
    nelayan: [
      ['Laut hari ini tenang. Ikan-ikan berkumpul dekat karang.'],
      ['Katanya di balik bukit ada air terjun kecil. Belum sempat kudatangi.'],
      ['Perahu kami kecil, tapi cukup untuk mencari rezeki tiap hari.']
    ],
    kakek: [
      ['Dulu dari puncak gunung itu aku bisa melihat seluruh pulau.', 'Kakiku tak lagi kuat mendaki. Naiklah kau ke sana — pemandangannya luar biasa.'],
      ['Jaga pulau ini baik-baik, anak muda. Ia titipan untuk cucu-cucu kita.'],
      ['Senja di pulau ini paling indah dari semua yang pernah kulihat.']
    ],
    pelaut: [
      ['Halo, pengembara! Aku menjaga pondok di pulau kecil ini.', 'Sepi, tenang — hanya suara ombak dan burung laut.'],
      ['Ada perahu di dermaga pelabuhan. Naikilah — dunia ini luas sekali untuk dijelajahi!'],
      ['Pulau-pulau kecil di sekitar sini tak berpenghuni. Mampirlah kalau singgah.']
    ]
  };

  /* ---------- Desa ---------- */

  function Village(scene, world) {
    this.scene = scene;
    this.world = world;
    this.center = null;
    this.sites = [];
    this.npcs = [];
    this.campfires = [];
    this._cfStones = [];
    this._cfLogs = [];
    this._cfFlameMat = null;
    this._parts = null;
    this.quests = {
      kelapa: { state: 'belum', count: 0, need: 5 },
      keranjang: { state: 'belum' }
    };
    this.basket = null;
    this._glowT = 0;
    this._hutAngles = [];
    this.hutMats = {};        // material per bagian rumah (jendela & lampu dipakai ulang)
    this._windowMat = null;   // jendela menyala saat malam
    this._lampMat = null;     // lentera rumah
    this._postLampMat = null; // kepala tiang lampu alun-alun
    this.lampPosts = [];
    this._lampLightList = []; // PointLight nyata (preset HD/Ultra) — diisi pool di build()
    this._glowSpots = [];     // titik cahaya (api unggun/tiang lampu) untuk pool
    this._glowPool = [];      // Fase 5: maksimal 2 PointLight aktif (hemat shader)
    this._lampF = 0;
    this.playerLight = null;  // cahaya ruangan mengikuti pemain
  }

  Village.prototype.build = function () {
    var world = this.world;
    var raw = world.villageSpots && world.villageSpots.length
      ? world.villageSpots
      : [{ x: 205, z: 0, r: 19, main: true }];
    var rng = U.mulberry32(C.WORLD.seed + 777);
    var i;

    this.sites = [];
    for (i = 0; i < raw.length; i++) {
      this.sites.push({
        x: raw[i].x, z: raw[i].z,
        y: world.groundHeight(raw[i].x, raw[i].z),
        main: !!raw[i].main,
        plazaR: raw[i].main ? 12.5 : 5.5
      });
    }
    this.center = this.sites[0]; // desa utama — pusat tugas
    world.villageCenter = this.center;

    // Fase 5 (optimasi): pool 2 cahaya dinamis. Semua api unggun/tiang lampu
    // tetap bercahaya secara emissive; hanya 2 terdekat memakai PointLight
    // sungguhan. Jumlah lampu di shader tetap → tidak memicu kompilasi ulang.
    if (C.RENDER.lampLights && !this._glowPool.length) {
      for (var gp = 0; gp < 2; gp++) {
        var glight = new THREE.PointLight(0xFFFFFF, 0, 18, 2);
        this.scene.add(glight);
        this._glowPool.push(glight);
      }
    }

    this._parts = { stilt: [], floor: [], wall: [], roof: [], door: [], window: [],
      ceiling: [], stair: [], mat: [], table: [], lamp: [] };

    for (i = 0; i < this.sites.length; i++) {
      var site = this.sites[i];
      this._buildPlaza(site);
      if (site.main) {
        this._addHutsAt(site, rng, 10, 15.4, true); // termasuk balai desa (rumah besar)
        this._buildWell(site);
        this._buildFence(site, 18.4);
        this._buildLampPosts(site);
      } else {
        this._addHutsAt(site, rng, 3, 7.9, false);
        this._buildCampfire(site);
      }
    }

    // Fase 5: pondok + api unggun di dua pulau kecil (dunia.islandSites).
    // Situs lanjutan (indeks 4, 5, …) juga menjadi rumah NPC penghuni pulau.
    var islands = world.islandSites || [];
    for (i = 0; i < islands.length; i++) {
      var isite = {
        x: islands[i].x, z: islands[i].z,
        y: world.groundHeight(islands[i].x, islands[i].z),
        main: false, plazaR: 3.0, island: true
      };
      this.sites.push(isite);
      this._addHutsAt(isite, rng, 1, 3.6, false);
      this._buildCampfire(isite);
    }

    this._flushHuts(rng);
    this._flushCampfires();
    this._buildBasketSpot();
    this._spawnNpcs();
    this.updateTracker();
  };

  Village.prototype._buildPlaza = function (site) {
    var world = this.world;
    var R = site.plazaR;
    var geo = new THREE.CircleGeometry(R, site.main ? 48 : 32);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var lx = pos.getX(i), lz = pos.getZ(i);
      pos.setY(i, world.groundHeight(site.x + lx, site.z + lz) - site.y + 0.06);
    }
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({
      color: srgb(0xA0794F), roughness: 0.98, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    if (global.TexLib) global.TexLib.apply(mat, 'dirt', 8, 8);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(site.x, site.y, site.z);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (site.main) this.plaza = mesh;
  };

  /* Tambah rumah panggung di sekeliling satu alun-alun; bagian rumah dikumpulkan
     dulu, lalu dijadikan InstancedMesh sekali jalan di _flushHuts.
     Rumah dibuat cukup besar + berlantai rendah supaya bisa DIMASUKI pemain
     (platform + celah pintu pada dinding depan). */
  Village.prototype._addHutsAt = function (site, rng, count, ringDist, isMain) {
    var world = this.world;
    var parts = this._parts;
    var angles = [];
    var i;

    for (i = 0; i < count; i++) {
      angles.push((i / count) * Math.PI * 2 + (isMain ? 0.35 : 0.8) + (rng() - 0.5) * 0.16);
    }
    if (isMain) this._hutAngles = angles; // dipakai pagar

    var wallColors = [0xB08A5A, 0xC49B69, 0x9F7A4E];
    var roofColors = [0xA9855C, 0xB5623F, 0x8F6B44];

    for (i = 0; i < count; i++) {
      var ang = angles[i];
      var big = isMain && i === 0; // balai desa
      var dist = ringDist + rng() * 0.9;
      var hx = site.x + Math.cos(ang) * dist;
      var hz = site.z + Math.sin(ang) * dist;
      var y0 = world.groundHeight(hx, hz) - 0.5; // ditanam agar tak melayang di lereng
      // Fase 5: rumah seukuran manusia normal, tetapi ruang dalamnya lapang
      // (lantai–langit-langit ±2,8 m; pintu ±2,15 m) agar leluasa dimasuki.
      var hw = big ? 3.4 : 2.6 + rng() * 0.4;     // setengah lebar (menurut X lokal)
      var hd = big ? 2.9 : 2.3 + rng() * 0.3;     // setengah kedalaman (menurut Z lokal)
      var wallH = big ? 3.05 : 2.8;               // tinggi dinding = tinggi ruang dalam
      var roofH = big ? 1.7 : 1.25 + rng() * 0.2;
      var floorY = big ? 1.05 : 0.95;             // lantai panggung rendah, mudah dipijak
      var stiltH = big ? 1.05 : 0.95;
      var doorW = big ? 1.8 : 1.5;
      var doorH = big ? 2.3 : 2.15;               // pintu tinggi — pemain bebas keluar-masuk
      var wt = 0.15;                              // tebal dinding
      var rotY = Math.atan2(site.x - hx, site.z - hz); // pintu menghadap alun-alun
      var wallHex = wallColors[(rng() * wallColors.length) | 0];
      var roofHex = roofColors[(rng() * roofColors.length) | 0];

      var hutM = new THREE.Matrix4().compose(
        new THREE.Vector3(hx, y0, hz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      var wallBase = floorY + 0.07;
      var floorTop = floorY + 0.07;
      (function (hutM) {
        function add(list, lx, ly, lz, sx, sy, sz, hex, ry) {
          var q = new THREE.Quaternion();
          if (ry) q.setFromEuler(new THREE.Euler(0, ry, 0));
          var local = new THREE.Matrix4().compose(
            new THREE.Vector3(lx, ly, lz),
            q,
            new THREE.Vector3(sx, sy, sz)
          );
          list.push({ m: new THREE.Matrix4().multiplyMatrices(hutM, local), hex: hex });
        }
        // tiang (rendah) & lantai panggung
        add(parts.stilt, -(hw - 0.15), 0, -(hd - 0.15), 1, stiltH, 1, 0x7A5836);
        add(parts.stilt, hw - 0.15, 0, -(hd - 0.15), 1, stiltH, 1, 0x7A5836);
        add(parts.stilt, -(hw - 0.15), 0, hd - 0.15, 1, stiltH, 1, 0x7A5836);
        add(parts.stilt, hw - 0.15, 0, hd - 0.15, 1, stiltH, 1, 0x7A5836);
        add(parts.floor, 0, floorY, 0, hw * 2 + 0.34, 0.14, hd * 2 + 0.34, 0x8F6B44);

        // Dinding dipecah: belakang, kiri, kanan, dan depan (dua sisi + ambang pintu)
        add(parts.wall, 0, wallBase + wallH / 2, -hd, hw * 2, wallH, wt, wallHex);
        add(parts.wall, -hw, wallBase + wallH / 2, 0, wt, wallH, hd * 2, wallHex);
        add(parts.wall, hw, wallBase + wallH / 2, 0, wt, wallH, hd * 2, wallHex);
        var frontW = hw - doorW / 2;
        add(parts.wall, -(doorW / 2 + frontW / 2), wallBase + wallH / 2, hd, frontW, wallH, wt, wallHex);
        add(parts.wall, doorW / 2 + frontW / 2, wallBase + wallH / 2, hd, frontW, wallH, wt, wallHex);
        add(parts.wall, 0, wallBase + doorH + (wallH - doorH) / 2, hd, doorW, wallH - doorH, wt, wallHex);

        add(parts.roof, 0, wallBase + wallH, 0, hw + 0.42, roofH, hd + 0.5, roofHex);
        add(parts.ceiling, 0, wallBase + wallH + 0.02, 0, hw * 2, 0.08, hd * 2, 0x9A7A54);

        // Pintu terbuka (diengsel di kusen kiri, membuka keluar ±72°)
        var doorAng = -1.25;
        var dCx = Math.cos(doorAng) * doorW * 0.46, dCz = -Math.sin(doorAng) * doorW * 0.46;
        add(parts.door, -doorW / 2 + dCx, wallBase + doorH / 2, hd + 0.07 + dCz, doorW * 0.92, doorH, 0.07, 0x6B4A2F, doorAng);

        // Tangga kayu menjemput di depan pintu
        add(parts.stair, 0, 0.62, hd + 0.62, doorW + 0.3, 0.24, 0.46, 0x8A6A46);
        add(parts.stair, 0, 0.86, hd + 0.28, doorW + 0.1, 0.2, 0.34, 0x8A6A46);

        // Jendela: dua di fasad + satu di samping (menyala saat malam)
        add(parts.window, -(hw * 0.62), wallBase + wallH * 0.6, hd + 0.02, 0.46, 0.4, 0.06, 0x3A4A56);
        add(parts.window, hw * 0.62, wallBase + wallH * 0.6, hd + 0.02, 0.46, 0.4, 0.06, 0x3A4A56);
        add(parts.window, -(hw + 0.02), wallBase + wallH * 0.6, -hd * 0.3, 0.06, 0.4, 0.5, 0x3A4A56);

        // Perabot dalam: tikar, meja kecil, lentera gantung (di samping, tak menghalangi kamera)
        add(parts.mat, -hw * 0.42, floorTop + 0.06, -hd * 0.34, 1.5, 0.1, 0.72, 0x9A6B4F);
        add(parts.table, hw * 0.48, floorTop + 0.26, -hd * 0.42, 0.6, 0.52, 0.6, 0x8A6A46);
        add(parts.stilt, hw * 0.5, wallBase + wallH - 0.18, -hd * 0.15, 0.018, 0.2, 0.018, 0x6B4A2F);
        add(parts.lamp, hw * 0.5, wallBase + wallH - 0.3, -hd * 0.15, 0.11, 0.12, 0.11, 0xFFE9B0);
        // Lentera beranda (di bawah atap, menggantung di dekat pintu)
        add(parts.stilt, 0, wallBase + wallH - 0.42, hd + 0.4, 0.018, 0.42, 0.018, 0x6B4A2F);
        add(parts.lamp, 0, wallBase + wallH - 0.62, hd + 0.4, 0.15, 0.16, 0.15, 0xFFE9B0);
      })(hutM);

      // Lantai panggung = platform yang bisa dipijak pemain
      world.platforms.push({
        x: hx, z: hz,
        hw: hw + 0.17, hd: hd + 0.17,
        cos: Math.cos(rotY), sin: Math.sin(rotY),
        top: y0 + floorTop,
        ceil: y0 + wallBase + wallH,  // tinggi bawah langit-langit (batas kamera)
        doorW: doorW, doorH: doorH   // Fase 5: dimensi pintu (uji & dokumentasi)
      });

      // Tabrakan: rantai lingkaran mengikuti dinding; ada celah di depan pintu
      this._addWallColliders(hx, hz, rotY, hw, hd, doorW);
    }
  };

  /* Segmen dinding rumah sebagai penghalang (celah di pintu).
     Pakai segmen garis, bukan rantai lingkaran — tetap rapat di fps rendah. */
  Village.prototype._addWallColliders = function (hx, hz, rotY, hw, hd, doorW) {
    var world = this.world;
    var cos = Math.cos(rotY), sin = Math.sin(rotY);
    var R = 0.18;                      // setengah tebal penghalang
    var jamb = doorW / 2 + 0.12;       // ujung dinding di kiri/kanan pintu

    function at(lx, lz) {
      return { x: hx + cos * lx + sin * lz, z: hz - sin * lx + cos * lz };
    }
    function seg(a, b) {
      world.walls.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, r: R });
    }
    var c1 = at(-hw, -hd), c2 = at(hw, -hd), c3 = at(hw, hd), c4 = at(-hw, hd);
    var jL = at(-jamb, hd), jR = at(jamb, hd);
    seg(c1, c2);   // belakang
    seg(c1, c4);   // kiri
    seg(c2, c3);   // kanan
    seg(c4, jL);   // depan kiri (sampai kusen pintu)
    seg(jR, c3);   // depan kanan
  };

  Village.prototype._flushHuts = function (rng) {
    var parts = this._parts;
    var boxGeo = new THREE.BoxGeometry(1, 1, 1);
    var geos = {
      stilt: new THREE.CylinderGeometry(0.09, 0.11, 1, 6).translate(0, 0.5, 0),
      floor: boxGeo,
      wall: boxGeo,
      roof: makePrismGeometry(),
      door: boxGeo,
      window: boxGeo,
      ceiling: boxGeo,
      stair: boxGeo,
      mat: boxGeo,
      table: boxGeo,
      lamp: new THREE.SphereGeometry(1, 8, 6)
    };
    var casts = { stilt: true, floor: true, wall: true, roof: true, door: false, window: false,
      ceiling: false, stair: true, mat: false, table: true, lamp: false };
    var receives = { stilt: false, floor: true, wall: true, roof: true, door: false, window: false,
      ceiling: true, stair: true, mat: true, table: true, lamp: false };
    var texSpec = {
      stilt: ['wood', 1, 2], floor: ['plank', 2.6, 2], wall: ['plank', 2.4, 1.6],
      roof: ['thatch', 3, 1.6], door: ['wood', 1, 1.4], window: ['plank', 1.2, 1],
      ceiling: ['plank', 2.4, 2], stair: ['wood', 1.6, 1], mat: ['cloth', 2, 1], table: ['wood', 1, 1]
    };
    var tmpC = new THREE.Color();
    this.hutMeshes = [];
    this.hutMats = {};

    for (var key in parts) {
      var list = parts[key];
      if (!list.length) continue;
      var mat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.92, metalness: 0 });
      if (global.TexLib && texSpec[key]) global.TexLib.apply(mat, texSpec[key][0], texSpec[key][1], texSpec[key][2]);
      if (key === 'window') {
        // jendela: kaca gelap saat siang, menyala hangat saat malam
        mat.emissive = srgb(0xFFC069);
        mat.emissiveIntensity = 0;
        this._windowMat = mat;
      } else if (key === 'lamp') {
        // lentera: redup saat siang, terang saat malam
        mat.color = srgb(0xFFE9B0);
        mat.emissive = srgb(0xFFB050);
        mat.emissiveIntensity = 0.18;
        this._lampMat = mat;
      }
      var mesh = new THREE.InstancedMesh(geos[key], mat, list.length);
      mesh.castShadow = casts[key];
      mesh.receiveShadow = receives[key];
      for (var i = 0; i < list.length; i++) {
        mesh.setMatrixAt(i, list[i].m);
        tmpC.setHex(list[i].hex).convertSRGBToLinear().multiplyScalar(0.92 + rng() * 0.16);
        mesh.setColorAt(i, tmpC);
      }
      this.scene.add(mesh);
      this.hutMeshes.push(mesh);
      this.hutMats[key] = mat;
    }
  };

  Village.prototype._buildWell = function (site) {
    var world = this.world;
    var wx = site.x + 2.6, wz = site.z + 3.4;
    var wy = world.groundHeight(wx, wz) - 0.08;
    var g = new THREE.Group();

    function add(geo, mat, x, y, z) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    }
    var stone = smat(0x9A9AA0, 0.95);
    var dark = smat(0x22303A, 0.6);
    var wood = smat(0x7A5836, 0.9);
    if (global.TexLib) {
      global.TexLib.apply(stone, 'rock', 2, 2);
      global.TexLib.apply(wood, 'wood', 1, 1.6);
    }
    add(new THREE.CylinderGeometry(0.85, 0.95, 0.78, 10), stone, 0, 0.39, 0);
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 10), dark, 0, 0.79, 0);
    add(new THREE.BoxGeometry(0.1, 1.15, 0.1), wood, -0.72, 1.32, 0);
    add(new THREE.BoxGeometry(0.1, 1.15, 0.1), wood, 0.72, 1.32, 0);
    var roofMat = smat(0xA9855C, 0.95);
    if (global.TexLib) global.TexLib.apply(roofMat, 'thatch', 2, 1);
    var roof = new THREE.Mesh(makePrismGeometry(), roofMat);
    roof.position.set(0, 1.9, 0);
    roof.scale.set(1.0, 0.42, 0.72);
    roof.castShadow = true;
    g.add(roof);

    g.position.set(wx, wy, wz);
    this.scene.add(g);
    world.colliders.push({ x: wx, z: wz, r: 1.15 });
    this.well = g;
  };

  Village.prototype._buildFence = function (site, radius) {
    var world = this.world;
    var posts = [], rails = [], i;

    for (i = 0; i < this._hutAngles.length; i++) {
      var a0 = this._hutAngles[i];
      var a1 = this._hutAngles[(i + 1) % this._hutAngles.length] + (i === this._hutAngles.length - 1 ? Math.PI * 2 : 0);
      var mid = (a0 + a1) / 2;
      var prev = null;
      for (var k = -1; k <= 1; k++) {
        var a = mid + k * 0.14;
        var px = site.x + Math.cos(a) * radius;
        var pz = site.z + Math.sin(a) * radius;
        var py = world.groundHeight(px, pz);
        posts.push({ x: px, y: py, z: pz });
        if (prev) {
          var dx = px - prev.x, dz = pz - prev.z;
          var len = Math.sqrt(dx * dx + dz * dz);
          rails.push({
            x: (px + prev.x) / 2, y: (py + prev.y) / 2 + 0.36, z: (pz + prev.z) / 2,
            ry: Math.atan2(-dz, dx), len: len
          });
          rails.push({
            x: (px + prev.x) / 2, y: (py + prev.y) / 2 + 0.12, z: (pz + prev.z) / 2,
            ry: Math.atan2(-dz, dx), len: len
          });
        }
        prev = { x: px, y: py, z: pz };
      }
    }

    var dummy = new THREE.Object3D();
    var postGeo = new THREE.CylinderGeometry(0.05, 0.065, 0.62, 6);
    postGeo.translate(0, 0.31, 0);
    var postMat = smat(0x8A6742, 0.92);
    if (global.TexLib) global.TexLib.apply(postMat, 'wood', 1, 2);
    var postMesh = new THREE.InstancedMesh(postGeo, postMat, posts.length);
    postMesh.castShadow = true;
    for (i = 0; i < posts.length; i++) {
      dummy.position.set(posts[i].x, posts[i].y, posts[i].z);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postMesh.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(postMesh);

    var railGeo = new THREE.BoxGeometry(1, 1, 1);
    var railMat = smat(0x9A7850, 0.92);
    if (global.TexLib) global.TexLib.apply(railMat, 'wood', 1, 1.4);
    var railMesh = new THREE.InstancedMesh(railGeo, railMat, rails.length);
    railMesh.castShadow = true;
    for (i = 0; i < rails.length; i++) {
      var r = rails[i];
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set(0, r.ry, 0);
      dummy.scale.set(r.len, 0.07, 0.055);
      dummy.updateMatrix();
      railMesh.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(railMesh);
    this.fenceMeshes = [postMesh, railMesh];
  };

  /* Api unggun pendukuhan: batu cincin + kayu + nyala berkedip. */
  Village.prototype._buildCampfire = function (site) {
    var world = this.world;
    var fx = site.x + 1.5, fz = site.z + 2.1;
    var fy = world.groundHeight(fx, fz);
    var k;

    for (k = 0; k < 7; k++) {
      var a = (k / 7) * Math.PI * 2 + 0.3;
      this._cfStones.push({ x: fx + Math.cos(a) * 0.62, y: fy + 0.05, z: fz + Math.sin(a) * 0.62, s: 0.12 + (k % 3) * 0.02, ry: a * 1.7 });
    }
    for (k = 0; k < 3; k++) {
      this._cfLogs.push({ x: fx, y: fy + 0.14, z: fz, ry: (k / 3) * Math.PI + 0.4, len: 0.8 });
    }

    if (!this._cfFlameMat) {
      this._cfFlameMat = new THREE.MeshStandardMaterial({
        color: srgb(0xFFB24A), emissive: srgb(0xFF7A1A), emissiveIntensity: 1.1, roughness: 0.6, metalness: 0
      });
    }
    var flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.85, 6), this._cfFlameMat);
    flame.position.set(fx, fy + 0.55, fz);
    this.scene.add(flame);

    // Titik cahaya api (hanya preset HD/Ultra) — memakai pool 2 lampu di update
    var fireLight = null;
    if (C.RENDER.lampLights) {
      fireLight = { x: fx, y: fy + 1.15, z: fz, color: 0xFF8A3A, kind: 'fire', flick: 1 };
      this._glowSpots.push(fireLight);
    }
    this.campfires.push({ flame: flame, light: fireLight, phase: this.campfires.length * 1.7 });

    world.colliders.push({ x: fx, z: fz, r: 1.0 });
  };

  Village.prototype._flushCampfires = function () {
    var dummy = new THREE.Object3D();
    var i;
    if (this._cfStones.length) {
      var stoneGeo = new THREE.DodecahedronGeometry(1, 0);
      var cfStoneMat = smat(0x8C8F94, 0.95);
      if (global.TexLib) global.TexLib.apply(cfStoneMat, 'rock', 1.5, 1.5);
      var stoneMesh = new THREE.InstancedMesh(stoneGeo, cfStoneMat, this._cfStones.length);
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      for (i = 0; i < this._cfStones.length; i++) {
        var st = this._cfStones[i];
        dummy.position.set(st.x, st.y, st.z);
        dummy.rotation.set(st.ry, st.ry * 0.7, 0);
        dummy.scale.set(st.s, st.s * 0.8, st.s);
        dummy.updateMatrix();
        stoneMesh.setMatrixAt(i, dummy.matrix);
      }
      this.scene.add(stoneMesh);
    }
    if (this._cfLogs.length) {
      var logGeo = new THREE.CylinderGeometry(0.055, 0.062, 1, 6);
      logGeo.rotateZ(Math.PI / 2); // rebah, sumbu X
      var logMat = smat(0x6E4A2E, 0.95);
      if (global.TexLib) global.TexLib.apply(logMat, 'bark', 1, 2);
      var logMesh = new THREE.InstancedMesh(logGeo, logMat, this._cfLogs.length);
      logMesh.castShadow = true;
      for (i = 0; i < this._cfLogs.length; i++) {
        var lg = this._cfLogs[i];
        dummy.position.set(lg.x, lg.y, lg.z);
        dummy.rotation.set(0, lg.ry, 0);
        dummy.scale.set(lg.len, 1, 1);
        dummy.updateMatrix();
        logMesh.setMatrixAt(i, dummy.matrix);
      }
      this.scene.add(logMesh);
    }
  };

  /* Tiang lampu alun-alun: kepala menyala saat malam.
     Bila preset mengizinkan (HD/Ultra), tiap tiang juga menjadi PointLight. */
  Village.prototype._buildLampPosts = function (site) {
    var world = this.world;
    var wood = smat(0x6E523A, 0.9);
    if (global.TexLib) global.TexLib.apply(wood, 'wood', 1, 2);
    if (!this._postLampMat) {
      this._postLampMat = new THREE.MeshStandardMaterial({
        color: srgb(0xFFE2A8), emissive: srgb(0xFFA64D), emissiveIntensity: 0.25, roughness: 0.5, metalness: 0
      });
    }
    var angles = [0.9, 3.05, 5.2];
    for (var i = 0; i < angles.length; i++) {
      var px = site.x + Math.cos(angles[i]) * 10.6;
      var pz = site.z + Math.sin(angles[i]) * 10.6;
      var py = world.groundHeight(px, pz);
      var g = new THREE.Group();
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 2.7, 7), wood);
      post.position.y = 1.35;
      post.castShadow = true;
      g.add(post);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), this._postLampMat);
      head.position.y = 2.82;
      g.add(head);
      g.position.set(px, py, pz);
      this.scene.add(g);
      this.lampPosts.push(g);
      world.colliders.push({ x: px, z: pz, r: 0.3 });

      if (C.RENDER.lampLights) {
        var spot = { x: px, y: py + 2.85, z: pz, color: 0xFFA65A, kind: 'lamp', flick: 1 };
        this._glowSpots.push(spot);
        g.userData.light = spot;
      }
    }

    // Satu cahaya ruangan yang mengikuti pemain saat berada di dalam rumah
    if (C.RENDER.lampLights && !this.playerLight) {
      this.playerLight = new THREE.PointLight(0xFFC080, 0, 9, 2);
      this.playerLight.position.set(site.x, site.y + 3, site.z);
      this.scene.add(this.playerLight);
    }
  };

  /* Keranjang Mira: petunjuk tersembunyi dekat batu besar yang jauh dari desa. */
  Village.prototype._buildBasketSpot = function () {
    var world = this.world, c = this.center;
    var rocks = world.rocks || [];
    var spots = world.villageSpots || [];
    var best = null;
    for (var i = 0; i < rocks.length; i++) {
      var r = rocks[i];
      if (r.s < 1.25 || r.gy < 1.2) continue;
      var dx = r.x - c.x, dz = r.z - c.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < 45 || d > 170) continue;
      var nearVillage = false;
      for (var j = 0; j < spots.length; j++) {
        var sdx = r.x - spots[j].x, sdz = r.z - spots[j].z;
        if (sdx * sdx + sdz * sdz < 14 * 14) { nearVillage = true; break; }
      }
      if (nearVillage) continue;
      if (!best || r.s > best.s) best = r;
    }
    var bx = best ? best.x + 1.7 : c.x + 40;
    var bz = best ? best.z - 1.3 : c.z + 40;
    if (world.groundHeight(bx, bz) < 1.0) { bx = c.x + 40; bz = c.z + 40; }
    this.basketSpot = { x: bx, z: bz };

    var g = new THREE.Group();
    var bodyMat = smat(0x9A6B3A, 0.9);
    var rimMat = new THREE.MeshStandardMaterial({
      color: srgb(0x7A5230), roughness: 0.85, metalness: 0,
      emissive: srgb(0xC98A28), emissiveIntensity: 0.4
    });
    if (global.TexLib) {
      global.TexLib.apply(bodyMat, 'thatch', 1.4, 1);
      global.TexLib.apply(rimMat, 'thatch', 2, 1);
    }
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.44, 8), bodyMat);
    body.position.y = 0.22;
    body.castShadow = true;
    g.add(body);
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.07, 8), rimMat);
    rim.position.y = 0.46;
    rim.castShadow = true;
    g.add(rim);
    g.position.set(bx, world.groundHeight(bx, bz), bz);
    g.visible = false;
    g.userData.mat = rimMat;
    this.scene.add(g);
    this.basket = g;
  };

  Village.prototype._spawnNpcs = function () {
    for (var i = 0; i < NPC_DEFS.length; i++) {
      var def = NPC_DEFS[i];
      var site = this.sites[def.village || 0];
      if (!site) continue; // pendukuhan tidak ada (data dunia berbeda)
      var npc = new Npc(def, i, this.world, site);
      this.scene.add(npc.group);
      this.npcs.push(npc);
    }
  };

  /* ---------- Tugas ---------- */

  Village.prototype.updateTracker = function () {
    var lines = [];
    var q = this.quests.kelapa;
    if (q.state === 'belum') lines.push('📜 Cari desa &amp; bicara dengan <b>Pak Raka</b>');
    else if (q.state === 'cari') lines.push('🥥 Kumpulkan kelapa <b>' + q.count + '/' + q.need + '</b>');
    else if (q.state === 'kembali') lines.push('🥥 Kembalikan kelapa ke <b>Pak Raka</b>');
    else lines.push('✓ Kelapa terkumpul');

    var k = this.quests.keranjang;
    if (k.state === 'cari') lines.push('🧺 Temukan keranjang <b>Mira</b>');
    else if (k.state === 'kembali') lines.push('🧺 Kembalikan keranjang ke <b>Mira</b>');
    else if (k.state === 'selesai') lines.push('✓ Keranjang Mira kembali');

    lines.unshift('<span class="q-title">TUGAS DESA</span>');
    global.UI.setQuest(lines);
  };

  Village.prototype._dialogFor = function (npc) {
    var self = this;
    if (npc.role === 'kepala') {
      var q = this.quests.kelapa;
      if (q.state === 'belum') {
        return {
          lines: [
            'Selamat datang di desa kami, pengembara! Aku Raka, kepala desa ini.',
            'Kami sedang menyiapkan pesta panen, tetapi persediaan kelapa kami kurang.',
            'Maukah kau mengumpulkan 5 kelapa dari pohon-pohon di tepi pantai?',
            'Tekan E di dekat pohon kelapa untuk memetiknya.'
          ],
          after: function () {
            q.state = 'cari';
            global.UI.toast('📜 Tugas baru: kumpulkan 5 kelapa');
            self.updateTracker();
          }
        };
      }
      if (q.state === 'cari') {
        var lv = ['Kelapa tumbuh di pohon-pohon tinggi di tepi pantai. Tekan E di dekatnya.'];
        if (q.count > 0) lv.unshift('Sejauh ini ' + q.count + ' dari ' + q.need + ' kelapa sudah terkumpul. Teruskan!');
        return { lines: lv, after: null };
      }
      if (q.state === 'kembali') {
        return {
          lines: [
            'Ah, kelima kelapa sudah terkumpul! Kau sungguh gesit, pengembara.',
            'Terima kasih! Desa ini berutang budi padamu.',
            'Ambil istirahat di alun-alun — anggap saja desa ini rumahmu.'
          ],
          after: function () {
            q.state = 'selesai';
            global.UI.toast('✓ Tugas selesai: kelapa terkumpul');
            self.updateTracker();
          }
        };
      }
      return {
        lines: ['Terima kasih sekali lagi, pengembara.', 'Nikmati damainya desa kami.'],
        after: null
      };
    }

    if (npc.role === 'mira') {
      var k = this.quests.keranjang;
      if (k.state === 'belum') {
        return {
          lines: [
            'Halo! Aku Mira.',
            'Tadi aku mencari kerang di tepi pantai, tapi keranjang anyamanku hilang!',
            'Rasanya terjatuh di dekat batu-batu besar, jauh di luar desa sana.',
            'Maukah kau mencarikannya? Ada pita merah di pinggirnya.'
          ],
          after: function () {
            k.state = 'cari';
            if (self.basket) self.basket.visible = true;
            global.UI.toast('📜 Tugas baru: cari keranjang Mira');
            self.updateTracker();
          }
        };
      }
      if (k.state === 'cari') {
        return {
          lines: [
            'Keranjangku terbuat dari anyaman pandan, ada pita merahnya.',
            'Coba cari di sekitar batu-batu besar di luar desa.'
          ],
          after: null
        };
      }
      if (k.state === 'kembali') {
        return {
          lines: ['Itu dia keranjangku!', 'Terima kasih banyak, kau baik sekali!'],
          after: function () {
            k.state = 'selesai';
            global.UI.toast('✓ Tugas selesai: keranjang Mira');
            self.updateTracker();
          }
        };
      }
      return { lines: ['Nanti aku ajak kau melihat kerang-kerangku, ya!'], after: null };
    }

    var list = FLAVOR[npc.role];
    if (list) {
      var lines = list[npc.lineIdx % list.length];
      npc.lineIdx++;
      return { lines: lines, after: null };
    }
    return { lines: ['...'], after: null };
  };

  /* ---------- Interaksi (tombol E) ---------- */

  Village.prototype.findInteraction = function (player) {
    var px = player.position.x, pz = player.position.z;
    var best = null;
    var i, d2;

    for (i = 0; i < this.npcs.length; i++) {
      var n = this.npcs[i];
      var dx = n.group.position.x - px, dz = n.group.position.z - pz;
      d2 = dx * dx + dz * dz;
      if (d2 < 2.8 * 2.8 && (!best || d2 < best.d2)) {
        best = { d2: d2, kind: 'npc', npc: n, prompt: 'Tekan <b class="ekey">E</b> — bicara dengan <b>' + n.name + '</b>' };
      }
    }

    if (this.quests.kelapa.state === 'cari') {
      var palms = this.world.palms || [];
      for (i = 0; i < palms.length; i++) {
        var pl = palms[i];
        if (pl.taken) continue;
        var pdx = pl.x - px, pdz = pl.z - pz;
        d2 = pdx * pdx + pdz * pdz;
        if (d2 < 2.4 * 2.4 && (!best || d2 < best.d2)) {
          best = { d2: d2, kind: 'palm', palm: pl, prompt: 'Tekan <b class="ekey">E</b> — ambil kelapa' };
        }
      }
    }

    if (this.basket && this.basket.visible) {
      var bdx = this.basket.position.x - px, bdz = this.basket.position.z - pz;
      d2 = bdx * bdx + bdz * bdz;
      if (d2 < 2.6 * 2.6 && (!best || d2 < best.d2)) {
        best = { d2: d2, kind: 'basket', prompt: 'Tekan <b class="ekey">E</b> — ambil keranjang' };
      }
    }
    return best;
  };

  Village.prototype.interact = function (target) {
    if (!target) return;
    if (target.kind === 'npc') this._talkNpc(target.npc);
    else if (target.kind === 'palm') this._takeCoconut(target.palm);
    else if (target.kind === 'basket') this._takeBasket();
  };

  Village.prototype._talkNpc = function (npc) {
    var d = this._dialogFor(npc);
    npc.talking = true;
    npc.state = 'idle';
    npc.timer = 1.5 + npc.rng() * 2;
    npc.target = null;
    global.UI.showDialog(npc.name, d.lines, function () { if (d.after) d.after(); });
  };

  Village.prototype._takeCoconut = function (palm) {
    var q = this.quests.kelapa;
    if (q.state !== 'cari' || palm.taken) return;
    palm.taken = true;
    q.count++;
    if (q.count >= q.need) {
      q.state = 'kembali';
      global.UI.toast('🥥 Kelapa ' + q.count + '/' + q.need + ' — bawa ke Pak Raka!');
    } else {
      global.UI.toast('🥥 Kelapa ' + q.count + '/' + q.need);
    }
    this.updateTracker();
  };

  Village.prototype._takeBasket = function () {
    var k = this.quests.keranjang;
    if (k.state !== 'cari') return;
    k.state = 'kembali';
    this.basket.visible = false;
    global.UI.toast('🧺 Keranjang Mira ditemukan!');
    this.updateTracker();
  };

  /* ---------- Update tiap frame ---------- */

  Village.prototype.update = function (dt, player) {
    this._glowT += dt;
    if (this.basket && this.basket.visible) {
      this.basket.userData.mat.emissiveIntensity = 0.35 + 0.3 * Math.sin(this._glowT * 2.6);
    }

    // Lampu malam: menyala halus saat senja lalu padam saat fajar
    var sunY = Math.sin((this.world.timeOfDay - 0.25) * Math.PI * 2);
    var lampF = U.smoothstep(0.16, -0.06, sunY);
    this._lampF = lampF;
    if (this._lampMat) this._lampMat.emissiveIntensity = 0.18 + 1.9 * lampF;
    if (this._windowMat) this._windowMat.emissiveIntensity = 1.7 * lampF;
    if (this._postLampMat) this._postLampMat.emissiveIntensity = 0.25 + 2.3 * lampF;

    // Cahaya ruangan mengikuti pemain saat berada di dalam rumah
    if (this.playerLight) {
      var pp = player && player.position;
      if (pp && this.world.isInsideHouse(pp.x, pp.z)) {
        this.playerLight.position.set(pp.x, pp.y + 1.5, pp.z);
        this.playerLight.intensity = 0.55 + 1.05 * lampF;
      } else {
        this.playerLight.intensity = 0;
      }
    }

    // Nyala api unggun berkedip (siang redup, malam menerangi)
    if (this.campfires.length) {
      if (this._cfFlameMat) this._cfFlameMat.emissiveIntensity = 1.0 + 0.35 * Math.sin(this._glowT * 9);
      for (var i = 0; i < this.campfires.length; i++) {
        var cf = this.campfires[i];
        var f = 1 + 0.16 * Math.sin(this._glowT * 8 + cf.phase) + 0.07 * Math.sin(this._glowT * 13.7 + cf.phase * 2.3);
        cf.flame.scale.set(f, 0.85 + 0.3 * f, f);
        if (cf.light) cf.light.flick = f;
      }
    }
    // Pool cahaya: 2 PointLight dipindah ke titik terdekat (api unggun/tiang).
    if (this._glowPool.length) {
      var pp2 = player && player.position;
      var b1 = null, b2 = null, d1 = 1e18, d2 = 1e18;
      if (pp2) {
        for (var si = 0; si < this._glowSpots.length; si++) {
          var sp = this._glowSpots[si];
          var sdx = sp.x - pp2.x, sdz = sp.z - pp2.z;
          var sd = sdx * sdx + sdz * sdz;
          if (sd < d1) { d2 = d1; b2 = b1; d1 = sd; b1 = sp; }
          else if (sd < d2) { d2 = sd; b2 = sp; }
        }
      }
      var near = [b1, b2];
      for (var gi = 0; gi < this._glowPool.length; gi++) {
        var L = this._glowPool[gi], sp2 = near[gi];
        if (sp2) {
          L.position.set(sp2.x, sp2.y, sp2.z);
          L.color.setHex(sp2.color);
          L.intensity = (sp2.kind === 'fire' ? (0.45 + 1.35 * lampF) : 1.8 * lampF) * sp2.flick;
        } else {
          L.intensity = 0;
        }
      }
    }
    for (var n = 0; n < this.npcs.length; n++) this.npcs[n].update(dt, this.world, player);
  };

  global.Village = Village;
})(typeof window !== 'undefined' ? window : globalThis);
