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
    { name: 'Raka', role: 'kepala', village: 0, home: { x: -2.8, z: 2.8 }, wanderR: 3.0, speed: 1.6,
      pal: { shirt: 0x4C5B3D, pants: 0x3D372F, skin: 0xC99A70, hair: 0x8D877E,
        cloak: 0x3B342A, beard: true, staff: true } },
    { name: 'Sari', role: 'pedagang', village: 0, home: { x: 4.1, z: -2.8 }, wanderR: 3.4, speed: 1.8,
      pal: { shirt: 0x71463F, pants: 0x3E3830, skin: 0xD8A983, hair: 0x2A2118,
        dress: true, apron: 0xB7A88A, hood: 0x5A3A35 } },
    { name: 'Mira', role: 'mira', village: 0, home: { x: -5.3, z: -3.7 }, wanderR: 4.6, speed: 2.0,
      pal: { shirt: 0x526448, pants: 0x3B3B32, skin: 0xDDBA92, hair: 0x51372A,
        longHair: true, dress: true, apron: 0xB9A57C, satchel: true } },
    { name: 'Adi', role: 'nelayan', village: 0, home: { x: 5.8, z: 4.1 }, wanderR: 3.8, speed: 2.1,
      pal: { shirt: 0x435B66, pants: 0x373D3F, skin: 0xBD865D, hair: 0x211A14, apron: 0x66533D } },
    { name: 'Bimo', role: 'kakek', village: 0, home: { x: 0.7, z: -5.5 }, wanderR: 2.0, speed: 1.1,
      pal: { shirt: 0x5A5346, pants: 0x3B352D, skin: 0xD3AD86, hair: 0xD3D0C8,
        beard: true, cloak: 0x41392E, staff: true } },
    { name: 'Nia', role: 'pedagang', village: 1, home: { x: 2.3, z: -1.8 }, wanderR: 2.2, speed: 1.7,
      pal: { shirt: 0x7A5A36, pants: 0x3E423A, skin: 0xD8A983, hair: 0x33241A,
        dress: true, apron: 0xA99A7A, hood: 0x59462F } },
    { name: 'Joni', role: 'nelayan', village: 2, home: { x: -2.4, z: 1.6 }, wanderR: 2.4, speed: 2.0,
      pal: { shirt: 0x455D4C, pants: 0x373D3F, skin: 0xA97850, hair: 0x19130F, apron: 0x5A4A37 } },
    { name: 'Umar', role: 'kakek', village: 3, home: { x: -2.0, z: -1.6 }, wanderR: 1.8, speed: 1.1,
      pal: { shirt: 0x5E6670, pants: 0x3E3A31, skin: 0xD3AD86, hair: 0xD8D8D2,
        beard: true, cloak: 0x3A3D3B, staff: true } },
    // Fase 5: penghuni pulau kecil (pondok di dunia.islandSites)
    { name: 'Dera', role: 'pelaut', village: 4, home: { x: 1.1, z: 0.9 }, wanderR: 2.2, speed: 1.5,
      pal: { shirt: 0x4A5D5A, pants: 0x373D3F, skin: 0xBD865D, hair: 0x211A14, hood: 0x394A47 } }
  ];

  function buildNpcMesh(pal) {
    var M = {
      skin: smat(pal.skin, 0.8),
      hair: smat(pal.hair, 0.9),
      shirt: smat(pal.shirt, 0.9),
      pants: smat(pal.pants, 0.9),
      boots: smat(0x4E3A28, 0.85),
      belt: smat(0x3A2A1C, 0.88),
      apron: smat(pal.apron || 0xA99A7A, 0.94),
      cloak: smat(pal.cloak || 0x4A4034, 0.94),
      hood: smat(pal.hood || pal.shirt, 0.94),
      eye: smat(0x1C1C1E, 0.35)
    };
    if (global.TexLib) {
      global.TexLib.apply(M.shirt, 'cloth', 1.5, 1.2);
      global.TexLib.apply(M.pants, 'cloth', 1.4, 1.4);
      global.TexLib.apply(M.boots, 'leather', 1.2, 1.2);
      global.TexLib.apply(M.belt, 'leather', 1, 1);
      global.TexLib.apply(M.apron, 'cloth', 1.2, 1.4);
      global.TexLib.apply(M.cloak, 'cloth', 1.4, 1.6);
      global.TexLib.apply(M.hood, 'cloth', 1.2, 1.2);
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
    part(g, new THREE.BoxGeometry(0.42, 0.065, 0.285), M.belt, 0, 1.0, 0);
    part(g, new THREE.BoxGeometry(0.09, 0.09, 0.035), M.belt, 0, 1.0, 0.16);
    if (pal.dress) {
      var skirt = part(g, new THREE.CylinderGeometry(0.17, 0.36, 0.56, 10), M.pants, 0, 0.68, 0);
      skirt.scale.z = 0.85;
    }
    if (pal.apron) {
      var apron = part(g, new THREE.BoxGeometry(0.34, 0.58, 0.025), M.apron, 0, 1.07, 0.145);
      apron.castShadow = false;
    }
    if (pal.cloak) {
      var cloak = part(g, new THREE.BoxGeometry(0.46, 0.7, 0.05), M.cloak, 0, 1.17, -0.165);
      cloak.rotation.x = -0.04;
    }
    if (pal.satchel) {
      part(g, new THREE.BoxGeometry(0.2, 0.17, 0.08), M.belt, 0.24, 1.02, 0.08);
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
    if (pal.hood) {
      var hood = part(g, new THREE.SphereGeometry(0.235, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), M.hood, 0, 1.70, -0.025);
      hood.scale.set(1.06, 1.02, 1.08);
      part(g, new THREE.CylinderGeometry(0.17, 0.31, 0.27, 10), M.hood, 0, 1.44, -0.03);
    }
    if (pal.beard) {
      var beard = part(g, new THREE.ConeGeometry(0.075, 0.27, 6), M.hair, 0, 1.48, 0.115);
      beard.rotation.x = Math.PI;
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
    if (pal.staff) {
      var staffMat = smat(0x59452F, 0.92);
      if (global.TexLib) global.TexLib.apply(staffMat, 'wood', 1, 2);
      var staff = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 1.78, 7), staffMat);
      staff.position.set(0, -0.55, 0.09);
      staff.rotation.z = 0.06;
      staff.castShadow = true;
      limbs.armL.add(staff);
    }
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
  var NPC_MODELS = ['rogue', 'hooded', 'mage', 'rogue', 'hooded', 'mage', 'rogue', 'hooded', 'mage'];
  var NPC_HEIGHTS = [1.72, 1.62, 1.52, 1.70, 1.50, 1.58, 1.64, 1.52, 1.60];

  /* Warna kain desa yang pudar, tetap beragam tetapi tidak pastel. */
  function tintFromHex(hex) {
    var c = new THREE.Color(hex);
    var hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return new THREE.Color().setHSL(hsl.h, hsl.s * 0.62, U.clamp(hsl.l * 0.9, 0.48, 0.7));
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
      // Warga kota kerajaan/kekaisaran tetap low-poly: jumlahnya puluhan,
      // model skinned sebanyak itu akan memberatkan.
      if (npc.town) continue;
      var name = NPC_MODELS[i % NPC_MODELS.length];
      if (!lib.has(name)) continue;
      var def = NPC_DEFS[i % NPC_DEFS.length];
      var spawned = lib.spawn(name, {
        height: NPC_HEIGHTS[i % NPC_HEIGHTS.length],
        tint: tintFromHex(def.pal.shirt),
        tintMix: 0.34
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
      ['Aku membawa gandum, madu, dan kain wol dari jalan raya kerajaan.', 'Aldenmere kecil, tetapi letaknya strategis di pesisir.'],
      ['Barang daganganku datang dari lembah utara. Penjaga jalan raya akhir-akhir ini sibuk mengusir penyamun.'],
      ['Mampirlah ke lapakku nanti sore. Aku menyimpan rempah dan tembikar dari kota pelabuhan.']
    ],
    nelayan: [
      ['Laut timur sedang tenang. Ikan berkumpul di sekitar karang tua.'],
      ['Dulu ada menara jaga di tanjung untuk memandu kapal kerajaan. Sekarang hanya batu yang tersisa.'],
      ['Perahu cadik kami kecil, tetapi cukup membawa hasil laut ke pasar Aldenmere.']
    ],
    kakek: [
      ['Dulu kastil di puncak itu berdiri megah. Kini hanya burung dan kabut yang tinggal di sana.'],
      ['Jaga desa ini baik-baik, anak muda. Kerajaan tidak dibangun oleh raja seorang diri.'],
      ['Senja di lembah ini masih sama seperti saat aku masih muda. Kelak kau akan mengerti.']
    ],
    pelaut: [
      ['Halo, pengembara! Aku menjaga pondok persinggahan pelaut kerajaan di pulau kecil ini.'],
      ['Ada perahu di dermaga pelabuhan. Naikilah - laut di sekitar Aetheria luas untuk dijelajahi!'],
      ['Pulau-pulau kecil di sekitar sini tak berpenghuni. Dulu para pelaut menyalakan api di sana.']
    ],
    warga: [
      ['Kerajaan pusat tumbuh cepat sejak tembok besar selesai dibangun. Kini tak ada penyamun yang berani masuk.'],
      ['Kau melihat kastil itu? Konon rajanya menyimpan peta jalan lama menuju kekaisaran di seberang perbukitan.'],
      ['Pasar ramai setiap pagi. Bila kau butuh cerita, duduklah sebentar di dekat sumur alun-alun.']
    ],
    penjaga: [
      ['Hentikan langkah sebentar, pengembara. Kota ini aman, tetapi tetap jaga pedangmu.'],
      ['Aku berjaga di gerbang sejak fajar. Jalan ke timur menuju kekaisaran sedang ramai kafilah.'],
      ['Bila melihat panji biru di kejauhan, itu benteng kekaisaran. Jangan mudah percaya pada bangsawan di sana.']
    ],
    prajurit: [
      ['Kekaisaran agung berdiri di balik bukit itu. Temboknya lebih tinggi dari menara mana pun di kerajaan ini.'],
      ['Seragamku berasal dari barak kekaisaran. Aku ditugaskan menjaga jalan antara dua kota.'],
      ['Kaisar menambah seratus rumah tahun ini. Kotanya tumbuh, dan para prajurit ikut sibuk.']
    ],
    bangsawan: [
      ['Kerajaan dan kekaisaran memang bersaudara, tetapi tidak selalu sejalan. Politik istana tak untuk telinga rakyat.'],
      ['Kastil kekaisaran punya tiga tingkat menara. Dari puncaknya kau bisa melihat seluruh lembah.'],
      ['Bawalah hasil bumi ke pelabuhan, dan kau akan mendapat harga yang layak. Itu nasihat dariku.']
    ],
    petani: [
      ['Ladang di luar tembok cukup subur. Hanya saja jalan menanjaknya melelahkan.'],
      ['Musim ini gandum tumbuh tinggi. Sebagian hasilnya kami kirim ke dapur kastil.'],
      ['Kalau kau lewat jalan lingkar, hati-hati dengan gerobak petani di pagi hari.']
    ],
    'pandai besi': [
      ['Bilah buatanku dipakai para penjaga gerbang. Bila perlu perbaikan, bawa besimu ke sini.'],
      ['Besi dari lembah selatan paling kuat. Sayangnya kafilahnya jarang datang sejak jalan baru dibuka.'],
      ['Dengar bunyi palu itu? Itulah jantung kota. Selama masih berdenting, kota ini hidup.']
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

    // If 3D assets are loaded and MegaKit models are available, use buildFromKit
    var assets = (typeof window !== 'undefined' ? window.assets : (typeof global !== 'undefined' ? global.assets : null));
    if (assets && assets.ready && assets.has('wall_plaster_straight')) {
      this.buildFromKit(assets);
      return;
    }

    // Fallback to procedural buildings
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

    this._parts = { stilt: [], foundation: [], floor: [], wall: [], roof: [], door: [], window: [],
      ceiling: [], stair: [], mat: [], table: [], lamp: [], timber: [], iron: [], banner: [] };

    for (i = 0; i < this.sites.length; i++) {
      var site = this.sites[i];
      this._buildPlaza(site);
      if (site.main) {
        this._addHutsAt(site, rng, 10, 15.4, true); // termasuk balai desa (rumah besar)
        this._buildWell(site);
        this._buildFence(site, 18.4);
        this._buildLampPosts(site);
        this._buildMarket(site);
        this._buildGate(site);
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

  /* ---------- Bangunan dari Quaternius MegaKit (modular, grid-based) ---------- */
  Village.prototype.buildFromKit = function (assets) {
    if (!assets || !assets.ready) {
      console.warn('[Aetheria] MegaKit models not loaded, falling back to procedural');
      this.build(); // fallback to procedural
      return;
    }
    var world = this.world;
    var raw = world.villageSpots && world.villageSpots.length
      ? world.villageSpots
      : [{ x: 205, z: 0, r: 19, main: true }];
    var rng = U.mulberry32(C.WORLD.seed + 777);

    this.sites = [];
    for (var i = 0; i < raw.length; i++) {
      this.sites.push({
        x: raw[i].x, z: raw[i].z,
        y: world.groundHeight(raw[i].x, raw[i].z),
        main: !!raw[i].main,
        plazaR: raw[i].main ? 12.5 : 5.5
      });
    }
    this.center = this.sites[0];
    world.villageCenter = this.center;

    // Initialize InstancedMesh containers for each module type
    this.kitMeshes = {
      wall: { mesh: null, list: [], mat: null, geo: null },
      floor: { mesh: null, list: [], mat: null, geo: null },
      roof: { mesh: null, list: [], mat: null, geo: null },
      door: { mesh: null, list: [], mat: null, geo: null },
      window: { mesh: null, list: [], mat: null, geo: null },
      stair: { mesh: null, list: [], mat: null, geo: null },
      prop: { mesh: null, list: [], mat: null, geo: null },
      overhang: { mesh: null, list: [], mat: null, geo: null },
      chimney: { mesh: null, list: [], mat: null, geo: null },
      fence_post: { mesh: null, list: [], mat: null, geo: null },
      fence_rail: { mesh: null, list: [], mat: null, geo: null },
      lamp_post: { mesh: null, list: [], mat: null, geo: null }
    };

    // Create materials & geometries from loaded models
    this._initKitMaterials(assets);

    for (i = 0; i < this.sites.length; i++) {
      var site = this.sites[i];
      this._buildPlaza(site);
      if (site.main) {
        this._buildVillageFromKit(site, rng);
        this._buildWellFromKit(site);
        this._buildFenceFromKit(site, 18.4);
        this._buildLampPosts(site); // keep procedural lamp posts
        this._buildMarketFromKit(site);
        this._buildGateFromKit(site);
      } else {
        this._buildHamletFromKit(site, rng);
        this._buildCampfire(site);
      }
    }

    // Fase 5: pondok di pulau kecil
    var islands = world.islandSites || [];
    for (i = 0; i < islands.length; i++) {
      var isite = {
        x: islands[i].x, z: islands[i].z,
        y: world.groundHeight(islands[i].x, islands[i].z),
        main: false, plazaR: 3.0, island: true
      };
      this.sites.push(isite);
      this._buildHamletFromKit(isite, rng, 1);
      this._buildCampfire(isite);
    }

    this._flushKitMeshes();
    this._spawnNpcs();
    this.updateTracker();
  };

  Village.prototype._initKitMaterials = function (assets) {
    var km = this.kitMeshes;
    var srgb = function(hex) { return new THREE.Color(hex).convertSRGBToLinear(); };

    // Helper to extract geometry from spawned model
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

    // Wall material
    km.wall.mat = new THREE.MeshStandardMaterial({ color: srgb(0xC8B898), roughness: 0.92, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.wall.mat, 'plaster', 2.4, 1.6);
    km.wall.geo = getGeo('wall_plaster_straight') || new THREE.BoxGeometry(4, 3, 0.2);

    // Floor material
    km.floor.mat = new THREE.MeshStandardMaterial({ color: srgb(0x795A3C), roughness: 0.94, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.floor.mat, 'plank', 2.6, 2);
    km.floor.geo = getGeo('floor_wooddark') || new THREE.BoxGeometry(4, 0.14, 4);

    // Roof material
    km.roof.mat = new THREE.MeshStandardMaterial({ color: srgb(0x5C4E42), roughness: 0.9, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.roof.mat, 'shingle', 3, 1.8);
    km.roof.geo = getGeo('roof_roundtiles_4x4') || new THREE.ConeGeometry(3, 1.5, 4);

    // Door material
    km.door.mat = new THREE.MeshStandardMaterial({ color: srgb(0x4D3725), roughness: 0.88, metalness: 0.1 });
    if (global.TexLib) global.TexLib.apply(km.door.mat, 'wood', 1, 1.4);
    km.door.geo = getGeo('door_1_flat') || new THREE.BoxGeometry(1.5, 2.2, 0.1);

    // Window material (emissive for night)
    km.window.mat = new THREE.MeshStandardMaterial({
      color: srgb(0x2F3B42), roughness: 0.3, metalness: 0.2,
      emissive: srgb(0xFFC069), emissiveIntensity: 0
    });
    if (global.TexLib) global.TexLib.apply(km.window.mat, 'plank', 1.2, 1);
    km.window.geo = getGeo('window_wide_round1') || new THREE.BoxGeometry(1, 1, 0.1);

    // Stair material
    km.stair.mat = new THREE.MeshStandardMaterial({ color: srgb(0x7E6244), roughness: 0.95, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.stair.mat, 'wood', 1.6, 1);
    km.stair.geo = getGeo('stairs_exterior_straight') || new THREE.BoxGeometry(2, 0.3, 1);

    // Prop material
    km.prop.mat = new THREE.MeshStandardMaterial({ color: srgb(0x59422D), roughness: 0.94, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.prop.mat, 'wood', 1, 2);
    km.prop.geo = getGeo('prop_crate') || new THREE.BoxGeometry(0.5, 0.5, 0.5);

    // Overhang material
    km.overhang.mat = new THREE.MeshStandardMaterial({ color: srgb(0xC8B898), roughness: 0.92, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.overhang.mat, 'plaster', 2.4, 1.6);
    km.overhang.geo = getGeo('overhang_plaster_long') || new THREE.BoxGeometry(4, 0.3, 0.5);

    // Chimney material
    km.chimney.mat = new THREE.MeshStandardMaterial({ color: srgb(0x66645C), roughness: 0.95, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.chimney.mat, 'stoneBrick', 1.5, 1.5);
    km.chimney.geo = getGeo('prop_chimney') || new THREE.CylinderGeometry(0.5, 0.6, 4, 8);

    // Fence materials
    km.fence_post.mat = new THREE.MeshStandardMaterial({ color: srgb(0x5A432C), roughness: 0.92, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.fence_post.mat, 'wood', 1, 2);
    km.fence_post.geo = getGeo('prop_woodenfence_single') || new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6);

    km.fence_rail.mat = new THREE.MeshStandardMaterial({ color: srgb(0x6B5237), roughness: 0.92, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(km.fence_rail.mat, 'wood', 1, 1.4);
    km.fence_rail.geo = new THREE.BoxGeometry(1, 0.07, 0.055);

    // Lamp post material
    km.lamp_post.mat = new THREE.MeshStandardMaterial({ color: srgb(0x343537), roughness: 0.58, metalness: 0.44 });
    if (global.TexLib) global.TexLib.apply(km.lamp_post.mat, 'metal', 1, 2);
    km.lamp_post.geo = new THREE.CylinderGeometry(0.06, 0.085, 2.75, 7);
  };

  Village.prototype._buildVillageFromKit = function (site, rng) {
    var world = this.world;
    var km = this.kitMeshes;
    var parts = km;

    // Building layout: ring around plaza
    var count = 10;
    var ringDist = 15.4;
    var angles = [];
    for (var i = 0; i < count; i++) {
      angles.push((i / count) * Math.PI * 2 + 0.35 + (rng() - 0.5) * 0.16);
    }
    this._hutAngles = angles;

    var wallColors = [0xC3B398, 0xB8A88C, 0xC9BAA0, 0xB1A185];
    var roofColors = [0x57483C, 0x624A3C, 0x4E4238, 0x5C5143];

    for (i = 0; i < count; i++) {
      var ang = angles[i];
      var big = (i === 0); // first is town hall
      var dist = ringDist + rng() * 0.9;
      var hx = site.x + Math.cos(ang) * dist;
      var hz = site.z + Math.sin(ang) * dist;
      var y0 = world.groundHeight(hx, hz) - 0.5;

      var hw = big ? 3.4 : 2.6 + rng() * 0.4;
      var hd = big ? 2.9 : 2.3 + rng() * 0.3;
      var wallH = big ? 3.05 : 2.8;
      var roofH = big ? 2.15 : 1.55 + rng() * 0.25;
      var floorY = big ? 1.05 : 0.95;
      var doorW = big ? 1.8 : 1.5;
      var doorH = big ? 2.3 : 2.15;
      var rotY = Math.atan2(site.x - hx, site.z - hz);
      var wallHex = wallColors[(rng() * wallColors.length) | 0];
      var roofHex = roofColors[(rng() * roofColors.length) | 0];

      var hutM = new THREE.Matrix4().compose(
        new THREE.Vector3(hx, y0, hz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      var wallBase = floorY + 0.07;
      var floorTop = floorY + 0.07;

      var tmpC = new THREE.Color();

      // Helper to add instance
      function addInstance(list, lx, ly, lz, sx, sy, sz, hex, ry, materialOverride) {
        var q = new THREE.Quaternion();
        if (ry) q.setFromEuler(new THREE.Euler(0, ry, 0));
        var local = new THREE.Matrix4().compose(
          new THREE.Vector3(lx, ly, lz), q, new THREE.Vector3(sx, sy, sz)
        );
        list.push({ m: new THREE.Matrix4().multiplyMatrices(hutM, local), hex: hex, mat: materialOverride });
      }

      // Foundation & Floor
      addInstance(parts.floor.list, 0, floorY, 0, hw * 2 + 0.34, 0.14, hd * 2 + 0.34, 0x795A3C);

      // Walls (back, left, right, front with door)
      addInstance(parts.wall.list, 0, wallBase + wallH / 2, -hd, hw * 2, wallH, 0.2, wallHex);
      addInstance(parts.wall.list, -hw, wallBase + wallH / 2, 0, 0.2, wallH, hd * 2, wallHex);
      addInstance(parts.wall.list, hw, wallBase + wallH / 2, 0, 0.2, wallH, hd * 2, wallHex);

      var frontW = hw - doorW / 2;
      var lPanel = -(doorW / 2 + frontW / 2), rPanel = doorW / 2 + frontW / 2;
      addInstance(parts.wall.list, lPanel, wallBase + wallH / 2, hd, frontW, wallH, 0.2, wallHex);
      addInstance(parts.wall.list, rPanel, wallBase + wallH / 2, hd, frontW, wallH, 0.2, wallHex);
      addInstance(parts.wall.list, 0, wallBase + doorH + (wallH - doorH) / 2, hd, doorW, wallH - doorH, 0.2, wallHex);

      // Door
      var doorAng = 0; // facing +Z in local, will be rotated by hutM
      var dCx = 0, dCz = 0;
      var dOx = -doorW / 2, dOz = hd + 0.07;
      addInstance(parts.door.list, dOx, wallBase + doorH / 2, dOz, doorW * 0.92, doorH, 0.07, 0x4D3725);

      // Stairs
      addInstance(parts.stair.list, 0, 0.62, hd + 0.64, doorW + 0.34, 0.24, 0.46, 0x7E6244);
      addInstance(parts.stair.list, 0, 0.86, hd + 0.3, doorW + 0.14, 0.2, 0.34, 0x876B4B);

      // Windows
      var wy = wallBase + wallH * 0.63;
      addInstance(parts.window.list, -(hw * 0.62), wy, hd + 0.03, 0.52, 0.52, 0.06, 0x2F3B42);
      addInstance(parts.window.list, hw * 0.62, wy, hd + 0.03, 0.52, 0.52, 0.06, 0x2F3B42);
      addInstance(parts.window.list, -(hw + 0.03), -hd * 0.3, 0.06, 0.52, 0.6, 0x2F3B42, Math.PI / 2);
      addInstance(parts.window.list, hw + 0.03, -hd * 0.3, 0.06, 0.52, 0.6, 0x2F3B42, Math.PI / 2);
      // Back window
      addInstance(parts.window.list, hw * 0.34, wy, -hd - 0.035, 0.52, 0.52, 0.06, 0x2F3B42);

      // Overhangs (eaves)
      addInstance(parts.overhang.list, 0, wallBase + wallH - 0.15, hd + 0.45, hw * 2 + 0.6, 0.3, 0.5, wallHex);
      addInstance(parts.overhang.list, 0, wallBase + wallH - 0.15, -hd - 0.45, hw * 2 + 0.6, 0.3, 0.5, wallHex);
      addInstance(parts.overhang.list, -hw - 0.3, wallBase + wallH - 0.15, 0, 0.5, 0.3, hd * 2 + 0.6, wallHex, Math.PI / 2);
      addInstance(parts.overhang.list, hw + 0.3, wallBase + wallH - 0.15, 0, 0.5, 0.3, hd * 2 + 0.6, wallHex, Math.PI / 2);

      // Roof
      addInstance(parts.roof.list, 0, wallBase + wallH + roofH * 0.4, 0, hw + 0.55, roofH, hd + 0.62, roofHex);

      // Chimney
      var chx = hw * 0.62, chz = -hd * 0.58;
      var chH = wallH + roofH * 0.72;
      addInstance(parts.chimney.list, chx, wallBase + chH * 0.5, chz, 0.62, chH, 0.62, 0x66645C);

      // Props inside
      addInstance(parts.prop.list, -hw * 0.42, floorTop + 0.2, -hd * 0.34, 0.5, 0.5, 0.5, 0x9A6B3A);
      addInstance(parts.prop.list, hw * 0.48, floorTop + 0.26, -hd * 0.42, 0.6, 0.6, 0.6, 0x725237);

      // Lamp on porch
      var lampMat = new THREE.MeshStandardMaterial({
        color: srgb(0xFFE9B0), emissive: srgb(0xFFB050), emissiveIntensity: 0.18,
        roughness: 0.5, metalness: 0
      });
      addInstance(parts.prop.list, 0, wallBase + wallH - 0.62, hd + 0.48, 0.15, 0.16, 0.15, 0xFFE9B0, 0, lampMat);

      // Platform for player collision
      world.platforms.push({
        x: hx, z: hz,
        hw: hw + 0.17, hd: hd + 0.17,
        cos: Math.cos(rotY), sin: Math.sin(rotY),
        top: y0 + floorTop,
        ceil: y0 + wallBase + wallH,
        doorW: doorW, doorH: doorH
      });

      // Wall colliders (with door gap)
      this._addWallColliders(hx, hz, rotY, hw, hd, doorW);

      // Town hall banner
      if (big) {
        addInstance(parts.prop.list, hw * 0.78, wallBase + wallH + 1.15, hd + 0.67, 0.82, 1.35, 0.045, 0x6B2C32);
      }
    }
  };

  Village.prototype._buildHamletFromKit = function (site, rng, count) {
    count = count || 3;
    var world = this.world;
    var km = this.kitMeshes;
    var parts = km;

    var angles = [];
    for (var i = 0; i < count; i++) {
      angles.push((i / count) * Math.PI * 2 + 0.8 + (rng() - 0.5) * 0.16);
    }

    var wallColors = [0xC3B398, 0xB8A88C, 0xC9BAA0, 0xB1A185];
    var roofColors = [0x57483C, 0x624A3C, 0x4E4238, 0x5C5143];

    for (var i = 0; i < count; i++) {
      var ang = angles[i];
      var dist = 7.9 + rng() * 0.9;
      var hx = site.x + Math.cos(ang) * dist;
      var hz = site.z + Math.sin(ang) * dist;
      var y0 = world.groundHeight(hx, hz) - 0.5;

      var hw = 2.3 + rng() * 0.3;
      var hd = 2.1 + rng() * 0.3;
      var wallH = 2.6;
      var roofH = 1.4 + rng() * 0.25;
      var floorY = 0.85;
      var doorW = 1.4;
      var doorH = 2.0;
      var rotY = Math.atan2(site.x - hx, site.z - hz);
      var wallHex = wallColors[(rng() * wallColors.length) | 0];
      var roofHex = roofColors[(rng() * roofColors.length) | 0];

      var hutM = new THREE.Matrix4().compose(
        new THREE.Vector3(hx, y0, hz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      var wallBase = floorY + 0.07;
      var floorTop = floorY + 0.07;

      function addInstance(list, lx, ly, lz, sx, sy, sz, hex, ry, materialOverride) {
        var q = new THREE.Quaternion();
        if (ry) q.setFromEuler(new THREE.Euler(0, ry, 0));
        var local = new THREE.Matrix4().compose(
          new THREE.Vector3(lx, ly, lz), q, new THREE.Vector3(sx, sy, sz)
        );
        list.push({ m: new THREE.Matrix4().multiplyMatrices(hutM, local), hex: hex, mat: materialOverride });
      }

      // Foundation & Floor
      addInstance(parts.floor.list, 0, floorY, 0, hw * 2 + 0.3, 0.14, hd * 2 + 0.3, 0x795A3C);

      // Walls
      addInstance(parts.wall.list, 0, wallBase + wallH / 2, -hd, hw * 2, wallH, 0.2, wallHex);
      addInstance(parts.wall.list, -hw, wallBase + wallH / 2, 0, 0.2, wallH, hd * 2, wallHex);
      addInstance(parts.wall.list, hw, wallBase + wallH / 2, 0, 0.2, wallH, hd * 2, wallHex);

      var frontW = hw - doorW / 2;
      var lPanel = -(doorW / 2 + frontW / 2), rPanel = doorW / 2 + frontW / 2;
      addInstance(parts.wall.list, lPanel, wallBase + wallH / 2, hd, frontW, wallH, 0.2, wallHex);
      addInstance(parts.wall.list, rPanel, wallBase + wallH / 2, hd, frontW, wallH, 0.2, wallHex);
      addInstance(parts.wall.list, 0, wallBase + doorH + (wallH - doorH) / 2, hd, doorW, wallH - doorH, 0.2, wallHex);

      // Door
      addInstance(parts.door.list, -doorW / 2, wallBase + doorH / 2, hd + 0.07, doorW * 0.92, doorH, 0.07, 0x4D3725);

      // Stairs
      addInstance(parts.stair.list, 0, 0.55, hd + 0.55, doorW + 0.3, 0.24, 0.42, 0x7E6244);

      // Windows (simpler)
      var wy = wallBase + wallH * 0.6;
      addInstance(parts.window.list, -(hw * 0.5), wy, hd + 0.03, 0.45, 0.45, 0.06, 0x2F3B42);
      addInstance(parts.window.list, hw * 0.5, wy, hd + 0.03, 0.45, 0.45, 0.06, 0x2F3B42);

      // Overhangs
      addInstance(parts.overhang.list, 0, wallBase + wallH - 0.12, hd + 0.4, hw * 2 + 0.5, 0.25, 0.45, wallHex);
      addInstance(parts.overhang.list, 0, wallBase + wallH - 0.12, -hd - 0.4, hw * 2 + 0.5, 0.25, 0.45, wallHex);

      // Roof
      addInstance(parts.roof.list, 0, wallBase + wallH + roofH * 0.35, 0, hw + 0.45, roofH, hd + 0.5, roofHex);

      // Chimney (smaller)
      addInstance(parts.chimney.list, hw * 0.5, wallBase + wallH + roofH * 0.5, -hd * 0.4, 0.45, wallH + roofH * 0.6, 0.45, 0x66645C);

      // Platform
      world.platforms.push({
        x: hx, z: hz,
        hw: hw + 0.15, hd: hd + 0.15,
        cos: Math.cos(rotY), sin: Math.sin(rotY),
        top: y0 + floorTop,
        ceil: y0 + wallBase + wallH,
        doorW: doorW, doorH: doorH
      });

      // Wall colliders
      this._addWallColliders(hx, hz, rotY, hw, hd, doorW);
    }
  };

  Village.prototype._buildWellFromKit = function (site) {
    var world = this.world;
    var wx = site.x + 2.6, wz = site.z + 3.4;
    var wy = world.groundHeight(wx, wz) - 0.08;
    var km = this.kitMeshes;

    // Well: use prop_crate as base, add chimney as well shaft
    var wellM = new THREE.Matrix4().compose(
      new THREE.Vector3(wx, wy, wz),
      new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)
    );

    function addInstance(list, lx, ly, lz, sx, sy, sz, hex) {
      var local = new THREE.Matrix4().compose(
        new THREE.Vector3(lx, ly, lz), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)
      );
      list.push({ m: new THREE.Matrix4().multiplyMatrices(wellM, local), hex: hex });
    }

    // Stone base
    addInstance(km.wall.list, 0, 0.39, 0, 1.7, 0.78, 1.7, 0x74736B);
    addInstance(km.wall.list, 0, 0.79, 0, 1.2, 0.06, 1.2, 0x19242A);
    // Wood posts
    addInstance(km.prop.list, -0.72, 1.32, 0, 0.1, 1.15, 0.1, 0x59422D);
    addInstance(km.prop.list, 0.72, 1.32, 0, 0.1, 1.15, 0.1, 0x59422D);
    // Winch
    addInstance(km.prop.list, 0, 1.45, 0, 0.018, 0.75, 0.018, 0x353638);
    // Roof
    var roofMat = new THREE.MeshStandardMaterial({ color: srgb(0x504238), roughness: 0.95, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(roofMat, 'shingle', 2, 1);
    addInstance(km.roof.list, 0, 1.9, 0, 1.0, 0.52, 0.78, 0x504238, 0, roofMat);

    world.colliders.push({ x: wx, z: wz, r: 1.15 });
    this.well = { x: wx, z: wz, y: wy };
  };

  Village.prototype._buildMarketFromKit = function (site) {
    var world = this.world;
    var km = this.kitMeshes;
    var angles = [2.15, 3.78, 5.46];

    for (var s = 0; s < angles.length; s++) {
      var a = angles[s];
      var px = site.x + Math.cos(a) * 8.7;
      var pz = site.z + Math.sin(a) * 8.7;
      var py = world.groundHeight(px, pz);

      var stallM = new THREE.Matrix4().compose(
        new THREE.Vector3(px, py, pz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(site.x - px, site.z - pz), 0)),
        new THREE.Vector3(1, 1, 1)
      );

      function addInstance(list, lx, ly, lz, sx, sy, sz, hex) {
        var local = new THREE.Matrix4().compose(
          new THREE.Vector3(lx, ly, lz), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)
        );
        list.push({ m: new THREE.Matrix4().multiplyMatrices(stallM, local), hex: hex });
      }

      // Posts
      addInstance(km.prop.list, -1.05, 1.12, -0.55, 0.07, 2.25, 0.07, 0x453322);
      addInstance(km.prop.list, 1.05, 1.12, -0.55, 0.07, 2.25, 0.07, 0x453322);
      addInstance(km.prop.list, -1.05, 1.0, 0.6, 0.07, 2.0, 0.07, 0x453322);
      addInstance(km.prop.list, 1.05, 1.0, 0.6, 0.07, 2.0, 0.07, 0x453322);

      // Table & canopy
      addInstance(km.floor.list, 0, 0.96, 0.25, 2.2, 0.14, 0.75, 0x59422D);
      var clothMat = new THREE.MeshStandardMaterial({ color: srgb(0x6E2B30), roughness: 0.92, metalness: 0 });
      if (global.TexLib) global.TexLib.apply(clothMat, 'cloth', 1.4, 1.0);
      addInstance(km.prop.list, 0, 0.62, 0.64, 2.15, 0.7, 0.08, 0x6E2B30, 0, clothMat);
      addInstance(km.floor.list, 0, 0.39, 0.25, 2.2, 0.08, 0.75, 0x453322);

      // Crates & barrels
      addInstance(km.prop.list, -0.72, 1.24, 0.18, 0.58, 0.45, 0.5, 0x7C5B35);
      addInstance(km.prop.list, 0.12, 1.16, 0.18, 0.42, 0.3, 0.34, 0x5F6E3C);
      addInstance(km.prop.list, 0.62, 1.13, 0.2, 0.34, 0.24, 0.28, 0x8E3F36);
      addInstance(km.prop.list, -1.32, 0.3, 0.72, 0.28, 0.55, 0.28, 0x59422D); // barrel

      world.colliders.push({ x: px, z: pz, r: 1.05 });
    }
  };

  Village.prototype._buildGateFromKit = function (site) {
    var world = this.world;
    var sp = world.findSpawnPoint ? world.findSpawnPoint() : { x: site.x, z: site.z + 20 };
    var ang = Math.atan2(sp.x - site.x, sp.z - site.z);
    var px = site.x + Math.sin(ang) * 21.6;
    var pz = site.z + Math.cos(ang) * 21.6;
    var py = world.groundHeight(px, pz);

    var gateM = new THREE.Matrix4().compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0)),
      new THREE.Vector3(1, 1, 1)
    );

    var km = this.kitMeshes;
    var stoneMat = new THREE.MeshStandardMaterial({ color: srgb(0x6D6B62), roughness: 0.96, metalness: 0 });
    if (global.TexLib) global.TexLib.apply(stoneMat, 'stoneBrick', 1.5, 1.6);

    function addInstance(list, lx, ly, lz, sx, sy, sz, hex, ry, materialOverride) {
      var q = new THREE.Quaternion();
      if (ry) q.setFromEuler(new THREE.Euler(0, ry, 0));
      var local = new THREE.Matrix4().compose(
        new THREE.Vector3(lx, ly, lz), q, new THREE.Vector3(sx, sy, sz)
      );
      list.push({ m: new THREE.Matrix4().multiplyMatrices(gateM, local), hex: hex, mat: materialOverride });
    }

    // Pillars
    addInstance(km.wall.list, -2.15, 1.7, 0, 0.9, 3.4, 0.9, 0x6D6B62, 0, stoneMat);
    addInstance(km.wall.list, 2.15, 1.7, 0, 0.9, 3.4, 0.9, 0x6D6B62, 0, stoneMat);
    // Arch top
    addInstance(km.wall.list, 0, 3.72, 0, 5.25, 0.42, 0.7, 0x595850);
    addInstance(km.prop.list, 0, 3.94, 0, 4.2, 0.12, 0.74, 0x323436);
    // Gates (iron)
    addInstance(km.prop.list, 0, 3.18, 0.4, 1.25, 1.55, 0.05, 0x6B2C32);
    addInstance(km.prop.list, 0, 3.8, 0.42, 1.25, 0.14, 0.06, 0xB08A45);

    // Side walls
    addInstance(km.wall.list, -5.55, 0.78, 0, 6.4, 1.55, 0.55, 0x595850, 0, stoneMat);
    addInstance(km.wall.list, 5.55, 0.78, 0, 6.4, 1.55, 0.55, 0x595850, 0, stoneMat);

    // Lanterns
    var lampMat = new THREE.MeshStandardMaterial({ color: srgb(0xFFE2A8), emissive: srgb(0xFFA64D), emissiveIntensity: 0.25, roughness: 0.5, metalness: 0 });
    for (var s = -1; s <= 1; s += 2) {
      addInstance(km.lamp_post.list, s * 2.15, 3.05, 0.52, 0.06, 1.1, 0.06, 0x343537);
      addInstance(km.prop.list, s * 2.15, 2.58, 0.52, 0.28, 0.36, 0.28, 0xFFE2A8, 0, lampMat);
    }

    this.scene.add(new THREE.Group()); // placeholder
    world.colliders.push({ x: px - Math.cos(ang) * 2.15, z: pz + Math.sin(ang) * 2.15, r: 0.72 });
    world.colliders.push({ x: px + Math.cos(ang) * 2.15, z: pz - Math.sin(ang) * 2.15, r: 0.72 });

    // Wall segments for collision
    var wing = 4.1;
    world.walls.push({
      x1: px - Math.cos(ang) * (2.4 + wing), z1: pz + Math.sin(ang) * (2.4 + wing),
      x2: px - Math.cos(ang) * 2.4, z2: pz + Math.sin(ang) * 2.4, r: 0.4
    });
    world.walls.push({
      x1: px + Math.cos(ang) * 2.4, z1: pz - Math.sin(ang) * 2.4,
      x2: px + Math.cos(ang) * (2.4 + wing), z2: pz - Math.sin(ang) * (2.4 + wing), r: 0.4
    });
  };

  Village.prototype._buildFenceFromKit = function (site, radius) {
    var world = this.world;
    var km = this.kitMeshes;
    var posts = [], rails = [], i;

    for (i = 0; i < this._hutAngles.length; i++) {
      var a0 = this._hutAngles[i];
      var a1 = this._hutAngles[(i + 1) % this._hutAngles.length] + (i === this._hutAngles.length - 1 ? Math.PI * 2 : 0);
      var mid = (a0 + a1) / 2;
      var prev = null;
      for (var k = -1; k <= 1; k++) {
        var a = mid + k * 0.14;
        var ppx = site.x + Math.cos(a) * radius;
        var ppz = site.z + Math.sin(a) * radius;
        var ppy = world.groundHeight(ppx, ppz);
        posts.push({ x: ppx, y: ppy, z: ppz });
        if (prev) {
          var dx = ppx - prev.x, dz = ppz - prev.z;
          var len = Math.sqrt(dx * dx + dz * dz);
          rails.push({
            x: (ppx + prev.x) / 2, y: (ppy + prev.y) / 2 + 0.36, z: (ppz + prev.z) / 2,
            ry: Math.atan2(-dz, dx), len: len
          });
          rails.push({
            x: (ppx + prev.x) / 2, y: (ppy + prev.y) / 2 + 0.12, z: (ppz + prev.z) / 2,
            ry: Math.atan2(-dz, dx), len: len
          });
        }
        prev = { x: ppx, y: ppy, z: ppz };
      }
    }

    // Use InstancedMesh for fence posts and rails
    var dummy = new THREE.Object3D();
    for (i = 0; i < posts.length; i++) {
      var p = posts[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      km.fence_post.list.push({ m: dummy.matrix.clone(), hex: 0x5A432C });
    }
    for (i = 0; i < rails.length; i++) {
      var r = rails[i];
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set(0, r.ry, 0);
      dummy.scale.set(r.len, 1, 1);
      dummy.updateMatrix();
      km.fence_rail.list.push({ m: dummy.matrix.clone(), hex: 0x6B5237 });
    }
  };

  Village.prototype._flushKitMeshes = function () {
    var km = this.kitMeshes;
    var tmpC = new THREE.Color();
    var rng = U.mulberry32(C.WORLD.seed + 999);

    for (var key in km) {
      var entry = km[key];
      if (!entry.list.length || !entry.geo || !entry.mat) continue;
      var mesh = new THREE.InstancedMesh(entry.geo, entry.mat, entry.list.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(entry.list.length * 3), 3);
      for (var i = 0; i < entry.list.length; i++) {
        mesh.setMatrixAt(i, entry.list[i].m);
        var c = entry.list[i].mat ? entry.list[i].mat.color.clone() : new THREE.Color();
        if (entry.list[i].hex) {
          c.setHex(entry.list[i].hex).convertSRGBToLinear().multiplyScalar(0.92 + rng() * 0.16);
        }
        mesh.setColorAt(i, c);
      }
      this.scene.add(mesh);
      entry.mesh = mesh;
    }
    this.hutMeshes = []; // for compatibility
    Object.keys(km).forEach(function(k) { if (km[k].mesh) this.hutMeshes.push(km[k].mesh); }, this);
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
      color: srgb(0x83786B), roughness: 0.98, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    if (global.TexLib) global.TexLib.apply(mat, 'cobble', 14, 14);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(site.x, site.y, site.z);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (site.main) {
      this.plaza = mesh;
      // Lingkaran batu & medali tengah agar alun-alun terasa seperti kota lama.
      var ringMat = new THREE.MeshStandardMaterial({
        color: srgb(0x686860), roughness: 0.97, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
      });
      if (global.TexLib) global.TexLib.apply(ringMat, 'stoneBrick', 3, 3);
      var ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.7, R * 0.78, 48), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(site.x, site.y + 0.085, site.z);
      ring.receiveShadow = true;
      this.scene.add(ring);
      var seal = new THREE.Mesh(new THREE.CircleGeometry(R * 0.22, 32), ringMat);
      seal.rotation.x = -Math.PI / 2;
      seal.position.set(site.x, site.y + 0.09, site.z);
      seal.receiveShadow = true;
      this.scene.add(seal);
    }
  };

  /* Pasar desa: tiga lapak kayu beratap kain bergaris, peti, tong, dan
     barang dagangan. Ditempatkan di tepi alun-alun, tidak menutup jalan. */
  Village.prototype._buildMarket = function (site) {
    var world = this.world;
    var wood = smat(0x59422D, 0.94);
    var woodDark = smat(0x453322, 0.94);
    var clothA = smat(0x6E2B30, 0.92);
    var clothB = smat(0xB09A6B, 0.92);
    var gold = smat(0xA9853F, 0.72);
    var goods = [smat(0x7C5B35, 0.95), smat(0x5F6E3C, 0.95), smat(0x8E3F36, 0.95)];
    if (global.TexLib) {
      global.TexLib.apply(wood, 'wood', 1, 2);
      global.TexLib.apply(woodDark, 'wood', 1, 1.4);
      global.TexLib.apply(clothA, 'cloth', 1.4, 1.0);
      global.TexLib.apply(clothB, 'cloth', 1.4, 1.0);
      global.TexLib.apply(gold, 'metal', 1, 1);
      for (var gi = 0; gi < goods.length; gi++) global.TexLib.apply(goods[gi], 'cloth', 1, 1);
    }
    var angles = [2.15, 3.78, 5.46];
    for (var s = 0; s < angles.length; s++) {
      var a = angles[s];
      var px = site.x + Math.cos(a) * 8.7;
      var pz = site.z + Math.sin(a) * 8.7;
      var py = world.groundHeight(px, pz);
      var g = new THREE.Group();
      g.position.set(px, py, pz);
      g.rotation.y = Math.atan2(site.x - px, site.z - pz);

      function part(geo, mat, x, y, z, ry) {
        var m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        if (ry) m.rotation.y = ry;
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
        return m;
      }
      // empat tiang
      part(new THREE.CylinderGeometry(0.07, 0.09, 2.25, 7), woodDark, -1.05, 1.12, -0.55);
      part(new THREE.CylinderGeometry(0.07, 0.09, 2.25, 7), woodDark, 1.05, 1.12, -0.55);
      part(new THREE.CylinderGeometry(0.07, 0.09, 2.0, 7), woodDark, -1.05, 1.0, 0.6);
      part(new THREE.CylinderGeometry(0.07, 0.09, 2.0, 7), woodDark, 1.05, 1.0, 0.6);
      // meja & kain depan
      part(new THREE.BoxGeometry(2.2, 0.14, 0.75), wood, 0, 0.96, 0.25);
      part(new THREE.BoxGeometry(2.15, 0.7, 0.08), clothA, 0, 0.62, 0.64);
      part(new THREE.BoxGeometry(2.2, 0.08, 0.75), woodDark, 0, 0.39, 0.25);
      // atap kain bergaris miring
      var canopy = new THREE.Group();
      canopy.position.set(0, 2.08, 0);
      canopy.rotation.x = -0.1;
      g.add(canopy);
      for (var c = 0; c < 6; c++) {
        var cm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 1.65), c % 2 ? clothB : clothA);
        cm.position.set(-1.05 + c * 0.42, 0, 0);
        cm.castShadow = true;
        canopy.add(cm);
      }
      // barang: peti, tong, sayur, dan kain
      part(new THREE.BoxGeometry(0.58, 0.45, 0.5), wood, -0.72, 1.24, 0.18, 0.2);
      part(new THREE.BoxGeometry(0.42, 0.3, 0.34), goods[0], 0.12, 1.16, 0.18, -0.15);
      part(new THREE.BoxGeometry(0.34, 0.24, 0.28), goods[1], 0.62, 1.13, 0.2, 0.25);
      var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.55, 9), woodDark);
      barrel.position.set(-1.32, 0.3, 0.72);
      barrel.castShadow = true;
      g.add(barrel);
      part(new THREE.BoxGeometry(0.34, 0.08, 0.26), gold, 0.32, 1.28, 0.2, -0.1);
      // bendera kecil di tiang sudut
      part(new THREE.BoxGeometry(0.045, 0.9, 0.045), gold, 1.08, 2.55, -0.55);
      part(new THREE.BoxGeometry(0.55, 0.38, 0.03), clothA, 1.36, 2.75, -0.55);
      this.scene.add(g);
      world.colliders.push({ x: px, z: pz, r: 1.05 });
    }
  };

  /* Gapura batu di jalan masuk desa — dua pilar, ambang batu, panji, dan
     lampu besi. Jalan tengah dibiarkan terbuka agar pemain bebas lewat. */
  Village.prototype._buildGate = function (site) {
    var world = this.world;
    var sp = world.findSpawnPoint ? world.findSpawnPoint() : { x: site.x, z: site.z + 20 };
    var ang = Math.atan2(sp.x - site.x, sp.z - site.z);
    var px = site.x + Math.sin(ang) * 21.6;
    var pz = site.z + Math.cos(ang) * 21.6;
    var py = world.groundHeight(px, pz);
    var g = new THREE.Group();
    g.position.set(px, py, pz);
    g.rotation.y = ang;
    var stone = smat(0x6D6B62, 0.96);
    var stoneDark = smat(0x595850, 0.96);
    var iron = smat(0x323436, 0.55);
    var cloth = smat(0x6B2C32, 0.92);
    iron.metalness = 0.4;
    if (global.TexLib) {
      global.TexLib.apply(stone, 'stoneBrick', 1.5, 1.6);
      global.TexLib.apply(stoneDark, 'stoneBrick', 1.5, 1.6);
      global.TexLib.apply(iron, 'metal', 1, 1);
      global.TexLib.apply(cloth, 'cloth', 1.2, 1.2);
    }
    function add(geo, mat, x, y, z) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    }
    add(new THREE.BoxGeometry(0.9, 3.4, 0.9), stone, -2.15, 1.7, 0);
    add(new THREE.BoxGeometry(0.9, 3.4, 0.9), stone, 2.15, 1.7, 0);
    add(new THREE.BoxGeometry(1.08, 0.22, 1.08), stoneDark, -2.15, 3.48, 0);
    add(new THREE.BoxGeometry(1.08, 0.22, 1.08), stoneDark, 2.15, 3.48, 0);
    add(new THREE.BoxGeometry(5.25, 0.42, 0.7), stoneDark, 0, 3.72, 0);
    add(new THREE.BoxGeometry(4.2, 0.12, 0.74), iron, 0, 3.94, 0);
    add(new THREE.BoxGeometry(1.25, 1.55, 0.05), cloth, 0, 3.18, 0.4);
    add(new THREE.BoxGeometry(1.25, 0.14, 0.06), smat(0xB08A45, 0.7), 0, 3.8, 0.42);
    // Dinding batu rendah menyambung gapura ke pagar desa.
    add(new THREE.BoxGeometry(6.4, 1.55, 0.55), stoneDark, -5.55, 0.78, 0);
    add(new THREE.BoxGeometry(6.4, 1.55, 0.55), stoneDark, 5.55, 0.78, 0);
    // Dua lentera besi di sisi gapura.
    for (var s = -1; s <= 1; s += 2) {
      add(new THREE.BoxGeometry(0.06, 1.1, 0.06), iron, s * 2.15, 3.05, 0.52);
      add(new THREE.BoxGeometry(0.28, 0.36, 0.28), this._postLampMat, s * 2.15, 2.58, 0.52);
    }
    this.scene.add(g);
    world.colliders.push({ x: px - Math.cos(ang) * 2.15, z: pz + Math.sin(ang) * 2.15, r: 0.72 });
    world.colliders.push({ x: px + Math.cos(ang) * 2.15, z: pz - Math.sin(ang) * 2.15, r: 0.72 });
    // Dinding sayap gapura (bukan jalan tengah).
    var wing = 4.1;
    world.walls.push({
      x1: px - Math.cos(ang) * (2.4 + wing), z1: pz + Math.sin(ang) * (2.4 + wing),
      x2: px - Math.cos(ang) * 2.4, z2: pz + Math.sin(ang) * 2.4, r: 0.4
    });
    world.walls.push({
      x1: px + Math.cos(ang) * 2.4, z1: pz - Math.sin(ang) * 2.4,
      x2: px + Math.cos(ang) * (2.4 + wing), z2: pz - Math.sin(ang) * (2.4 + wing), r: 0.4
    });
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

    var wallColors = [0xC3B398, 0xB8A88C, 0xC9BAA0, 0xB1A185];
    var roofColors = [0x57483C, 0x624A3C, 0x4E4238, 0x5C5143];

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
      var roofH = big ? 2.15 : 1.55 + rng() * 0.25;
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
        function addR(list, lx, ly, lz, sx, sy, sz, hex, rx, ry, rz) {
          var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
          var local = new THREE.Matrix4().compose(
            new THREE.Vector3(lx, ly, lz), q, new THREE.Vector3(sx, sy, sz)
          );
          list.push({ m: new THREE.Matrix4().multiplyMatrices(hutM, local), hex: hex });
        }

        // Fondasi batu masif + lantai papan rendah (rumah setengah-kayu).
        add(parts.foundation, 0, stiltH * 0.5, 0, hw * 2 + 0.34, stiltH, hd * 2 + 0.34, 0x68665E);
        add(parts.foundation, 0, stiltH * 0.94, 0, hw * 2 + 0.5, 0.16, hd * 2 + 0.5, 0x777267);
        add(parts.floor, 0, floorY, 0, hw * 2 + 0.34, 0.14, hd * 2 + 0.34, 0x795A3C);

        // Dinding plester dipecah: belakang, kiri, kanan, depan (dua panel + pintu)
        add(parts.wall, 0, wallBase + wallH / 2, -hd, hw * 2, wallH, wt, wallHex);
        add(parts.wall, -hw, wallBase + wallH / 2, 0, wt, wallH, hd * 2, wallHex);
        add(parts.wall, hw, wallBase + wallH / 2, 0, wt, wallH, hd * 2, wallHex);
        var frontW = hw - doorW / 2;
        var lPanel = -(doorW / 2 + frontW / 2), rPanel = doorW / 2 + frontW / 2;
        add(parts.wall, lPanel, wallBase + wallH / 2, hd, frontW, wallH, wt, wallHex);
        add(parts.wall, rPanel, wallBase + wallH / 2, hd, frontW, wallH, wt, wallHex);
        add(parts.wall, 0, wallBase + doorH + (wallH - doorH) / 2, hd, doorW, wallH - doorH, wt, wallHex);

        // Rangka kayu gelap khas rumah abad pertengahan.
        var beam = 0x3B2B1F;
        var post = 0.15;
        var cxi = hw + 0.01, czi = hd + 0.01;
        add(parts.timber, -cxi, wallBase + wallH / 2, -czi, post, wallH + 0.06, post, beam);
        add(parts.timber, cxi, wallBase + wallH / 2, -czi, post, wallH + 0.06, post, beam);
        add(parts.timber, -cxi, wallBase + wallH / 2, czi, post, wallH + 0.06, post, beam);
        add(parts.timber, cxi, wallBase + wallH / 2, czi, post, wallH + 0.06, post, beam);
        add(parts.timber, 0, wallBase + 0.08, hd + 0.035, hw * 2, 0.15, 0.1, beam);
        add(parts.timber, 0, wallBase + wallH - 0.09, hd + 0.035, hw * 2, 0.16, 0.1, beam);
        add(parts.timber, 0, wallBase + 0.08, -hd - 0.035, hw * 2, 0.15, 0.1, beam);
        add(parts.timber, 0, wallBase + wallH - 0.09, -hd - 0.035, hw * 2, 0.16, 0.1, beam);
        add(parts.timber, -hw - 0.035, wallBase + 0.08, 0, 0.1, 0.15, hd * 2, beam);
        add(parts.timber, hw + 0.035, wallBase + 0.08, 0, 0.1, 0.15, hd * 2, beam);
        add(parts.timber, -hw - 0.035, wallBase + wallH - 0.09, 0, 0.1, 0.16, hd * 2, beam);
        add(parts.timber, hw + 0.035, wallBase + wallH - 0.09, 0, 0.1, 0.16, hd * 2, beam);
        // tiang pintu, ambang, dan penyangga diagonal fasad
        add(parts.timber, -doorW / 2 - 0.09, wallBase + doorH / 2, hd + 0.05, 0.13, doorH + 0.18, 0.12, beam);
        add(parts.timber, doorW / 2 + 0.09, wallBase + doorH / 2, hd + 0.05, 0.13, doorH + 0.18, 0.12, beam);
        add(parts.timber, 0, wallBase + doorH + 0.08, hd + 0.05, doorW + 0.3, 0.15, 0.12, beam);
        var braceAng = Math.atan2(wallH * 0.58, frontW * 0.82);
        var braceLen = Math.sqrt(wallH * 0.58 * wallH * 0.58 + frontW * 0.82 * frontW * 0.82);
        addR(parts.timber, lPanel, wallBase + wallH * 0.48, hd + 0.035, braceLen, 0.09, 0.075, beam, 0, 0, braceAng);
        addR(parts.timber, rPanel, wallBase + wallH * 0.48, hd + 0.035, braceLen, 0.09, 0.075, beam, 0, 0, -braceAng);
        // tiang vertikal pada panel fasad
        add(parts.timber, lPanel, wallBase + wallH * 0.5, hd + 0.035, 0.115, wallH, 0.075, beam);
        add(parts.timber, rPanel, wallBase + wallH * 0.5, hd + 0.035, 0.115, wallH, 0.075, beam);

        // Rangka setengah-kayu pada dinding belakang & samping agar rumah tetap
        // terbaca sebagai rumah abad pertengahan dari segala arah, bukan hanya fasad.
        var backAng = Math.atan2(wallH * 0.42, hw * 0.46);
        var backLen = Math.sqrt(wallH * 0.42 * wallH * 0.42 + hw * 0.46 * hw * 0.46);
        for (var bx = -hw * 0.5; bx <= hw * 0.51; bx += hw * 0.5) {
          add(parts.timber, bx, wallBase + wallH * 0.5, -hd - 0.045, 0.12, wallH, 0.075, beam);
          addR(parts.timber, bx, wallBase + wallH * 0.48, -hd - 0.045,
            backLen, 0.085, 0.07, beam, 0, 0, bx < 0 ? backAng : -backAng);
        }
        add(parts.timber, 0, wallBase + wallH * 0.5, -hd - 0.045, hw * 2, 0.09, 0.07, beam);
        var sideAng = Math.atan2(wallH * 0.4, hd * 0.5);
        var sideLen = Math.sqrt(wallH * 0.4 * wallH * 0.4 + hd * 0.5 * hd * 0.5);
        for (var sz = -hd * 0.5; sz <= hd * 0.51; sz += hd * 0.5) {
          add(parts.timber, -hw - 0.045, wallBase + wallH * 0.5, sz, 0.075, wallH, 0.12, beam);
          add(parts.timber, hw + 0.045, wallBase + wallH * 0.5, sz, 0.075, wallH, 0.12, beam);
          addR(parts.timber, -hw - 0.045, wallBase + wallH * 0.48, sz,
            0.07, sideLen, 0.085, beam, sz < 0 ? sideAng : -sideAng, 0, 0);
          addR(parts.timber, hw + 0.045, wallBase + wallH * 0.48, sz,
            0.07, sideLen, 0.085, beam, sz < 0 ? -sideAng : sideAng, 0, 0);
        }
        add(parts.timber, -hw - 0.045, wallBase + wallH * 0.5, 0, 0.07, 0.09, hd * 2, beam);
        add(parts.timber, hw + 0.045, wallBase + wallH * 0.5, 0, 0.07, 0.09, hd * 2, beam);

        // Atap sirap curam, bubungan, dan lis kayu.
        add(parts.roof, 0, wallBase + wallH, 0, hw + 0.55, roofH, hd + 0.62, roofHex);
        add(parts.ceiling, 0, wallBase + wallH + 0.02, 0, hw * 2, 0.08, hd * 2, 0x8C6C4E);
        add(parts.timber, 0, wallBase + wallH + roofH * 0.985, 0, hw * 2 + 0.88, 0.13, 0.13, beam);
        add(parts.timber, 0, wallBase + wallH + 0.06, hd + 0.6, hw * 2 + 0.9, 0.1, 0.1, beam);
        add(parts.timber, 0, wallBase + wallH + 0.06, -hd - 0.6, hw * 2 + 0.9, 0.1, 0.1, beam);

        // Cerobong batu di sisi belakang.
        var chx = hw * 0.62, chz = -hd * 0.58;
        var chH = wallH + roofH * 0.72;
        add(parts.foundation, chx, wallBase + chH * 0.5, chz, 0.62, chH, 0.62, 0x66645C);
        add(parts.foundation, chx, wallBase + chH + 0.08, chz, 0.78, 0.16, 0.78, 0x747168);

        // Pintu berat berlapis besi (terbuka keluar).
        var doorAng = -1.25;
        var dCx = Math.cos(doorAng) * doorW * 0.46, dCz = -Math.sin(doorAng) * doorW * 0.46;
        var dOx = -doorW / 2 + dCx, dOz = hd + 0.07 + dCz;
        add(parts.door, dOx, wallBase + doorH / 2, dOz, doorW * 0.92, doorH, 0.07, 0x4D3725, doorAng);
        add(parts.iron, dOx, wallBase + doorH * 0.32, dOz + 0.015, doorW * 0.8, 0.09, 0.045, 0x303133, doorAng);
        add(parts.iron, dOx, wallBase + doorH * 0.72, dOz + 0.015, doorW * 0.8, 0.09, 0.045, 0x303133, doorAng);
        add(parts.iron, dOx + doorW * 0.25, wallBase + doorH * 0.52, dOz + 0.03, 0.13, 0.13, 0.06, 0x424345, doorAng);

        // Tangga batu/kayu menjemput di depan pintu.
        add(parts.stair, 0, 0.62, hd + 0.64, doorW + 0.34, 0.24, 0.46, 0x7E6244);
        add(parts.stair, 0, 0.86, hd + 0.3, doorW + 0.14, 0.2, 0.34, 0x876B4B);

        // Jendela berpanjang kayu dan kaca hangat saat malam.
        var wy = wallBase + wallH * 0.63;
        function windowFrame(wx, wz, side) {
          if (side) {
            add(parts.window, wx, wy, wz, 0.06, 0.52, 0.6, 0x2F3B42);
            add(parts.timber, wx + 0.01, wy + 0.29, wz, 0.07, 0.09, 0.76, beam);
            add(parts.timber, wx + 0.01, wy - 0.29, wz, 0.07, 0.09, 0.76, beam);
            add(parts.timber, wx + 0.01, wy, wz - 0.34, 0.07, 0.66, 0.09, beam);
            add(parts.timber, wx + 0.01, wy, wz + 0.34, 0.07, 0.66, 0.09, beam);
            add(parts.timber, wx + 0.02, wy, wz, 0.075, 0.56, 0.06, beam);
          } else {
            add(parts.window, wx, wy, wz, 0.52, 0.52, 0.06, 0x2F3B42);
            add(parts.timber, wx, wy + 0.29, wz + 0.02, 0.68, 0.09, 0.07, beam);
            add(parts.timber, wx, wy - 0.29, wz + 0.02, 0.68, 0.09, 0.07, beam);
            add(parts.timber, wx - 0.31, wy, wz + 0.02, 0.09, 0.66, 0.07, beam);
            add(parts.timber, wx + 0.31, wy, wz + 0.02, 0.09, 0.66, 0.07, beam);
            add(parts.timber, wx, wy, wz + 0.03, 0.06, 0.6, 0.07, beam);
          }
        }
        windowFrame(-(hw * 0.62), hd + 0.03, false);
        windowFrame(hw * 0.62, hd + 0.03, false);
        windowFrame(-(hw + 0.03), -hd * 0.3, true);
        windowFrame(hw + 0.03, -hd * 0.3, true);
        // Jendela belakang kecil dengan kusen kayu.
        add(parts.window, hw * 0.34, wy, -hd - 0.035, 0.52, 0.52, 0.06, 0x2F3B42);
        add(parts.timber, hw * 0.34, wy + 0.29, -hd - 0.055, 0.68, 0.09, 0.07, beam);
        add(parts.timber, hw * 0.34, wy - 0.29, -hd - 0.055, 0.68, 0.09, 0.07, beam);
        add(parts.timber, hw * 0.34 - 0.31, wy, -hd - 0.055, 0.09, 0.66, 0.07, beam);
        add(parts.timber, hw * 0.34 + 0.31, wy, -hd - 0.055, 0.09, 0.66, 0.07, beam);
        add(parts.timber, hw * 0.34, wy, -hd - 0.065, 0.06, 0.6, 0.07, beam);

        // Balai desa: panji merah-merah tua di fasad.
        if (big) {
          add(parts.timber, hw * 0.78, wallBase + wallH + 0.82, hd + 0.62, 0.075, 2.64, 0.075, beam);
          add(parts.banner, hw * 0.78 + 0.42, wallBase + wallH + 1.15, hd + 0.67, 0.82, 1.35, 0.045, 0x6B2C32);
          add(parts.banner, hw * 0.78 + 0.42, wallBase + wallH + 0.72, hd + 0.67, 0.82, 0.12, 0.05, 0xB08A45);
        }

        // Perabot dalam: permadani, meja, lentera gantung, ceruk batu.
        add(parts.mat, -hw * 0.42, floorTop + 0.06, -hd * 0.34, 1.5, 0.1, 0.72, 0x8C4A44);
        add(parts.table, hw * 0.48, floorTop + 0.26, -hd * 0.42, 0.6, 0.52, 0.6, 0x725237);
        add(parts.foundation, -hw * 0.62, floorTop + 0.36, -hd * 0.62, 1.15, 0.72, 0.55, 0x5E5C55);
        add(parts.stilt, hw * 0.5, wallBase + wallH - 0.18, -hd * 0.15, 0.018, 0.2, 0.018, 0x5B4328);
        add(parts.lamp, hw * 0.5, wallBase + wallH - 0.3, -hd * 0.15, 0.11, 0.12, 0.11, 0xFFE9B0);
        // Lentera beranda di bawah atap.
        add(parts.stilt, 0, wallBase + wallH - 0.42, hd + 0.48, 0.018, 0.42, 0.018, 0x5B4328);
        add(parts.lamp, 0, wallBase + wallH - 0.62, hd + 0.48, 0.15, 0.16, 0.15, 0xFFE9B0);
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
      foundation: boxGeo,
      floor: boxGeo,
      wall: boxGeo,
      roof: makePrismGeometry(),
      door: boxGeo,
      window: boxGeo,
      ceiling: boxGeo,
      stair: boxGeo,
      mat: boxGeo,
      table: boxGeo,
      timber: boxGeo,
      iron: boxGeo,
      banner: boxGeo,
      lamp: boxGeo
    };
    var casts = { stilt: true, foundation: true, floor: true, wall: true, roof: true, door: false, window: false,
      ceiling: false, stair: true, mat: false, table: true, timber: true, iron: false, banner: false, lamp: false };
    var receives = { stilt: false, foundation: true, floor: true, wall: true, roof: true, door: false, window: false,
      ceiling: true, stair: true, mat: true, table: true, timber: true, iron: true, banner: true, lamp: false };
    var texSpec = {
      stilt: ['wood', 1, 2], foundation: ['stoneBrick', 1.6, 1.2], floor: ['plank', 2.6, 2],
      wall: ['plaster', 2.4, 1.6], roof: ['shingle', 3, 1.8], door: ['wood', 1, 1.4],
      window: ['plank', 1.2, 1], ceiling: ['plank', 2.4, 2], stair: ['wood', 1.6, 1],
      mat: ['cloth', 2, 1], table: ['wood', 1, 1], timber: ['wood', 1.2, 2],
      iron: ['metal', 1, 1], banner: ['cloth', 1.2, 1.2]
    };
    var tmpC = new THREE.Color();
    this.hutMeshes = [];
    this.hutMats = {};

    for (var key in parts) {
      var list = parts[key];
      if (!list.length) continue;
      var mat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.92, metalness: 0 });
      if (global.TexLib && texSpec[key]) global.TexLib.apply(mat, texSpec[key][0], texSpec[key][1], texSpec[key][2]);
      if (key === 'iron') { mat.roughness = 0.55; mat.metalness = 0.42; }
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
    var stone = smat(0x74736B, 0.95);
    var dark = smat(0x19242A, 0.6);
    var wood = smat(0x59422D, 0.9);
    var iron = smat(0x353638, 0.55);
    iron.metalness = 0.4;
    if (global.TexLib) {
      global.TexLib.apply(stone, 'stoneBrick', 2, 1.2);
      global.TexLib.apply(wood, 'wood', 1, 1.6);
      global.TexLib.apply(iron, 'metal', 1, 1);
    }
    add(new THREE.CylinderGeometry(0.85, 0.95, 0.78, 10), stone, 0, 0.39, 0);
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 10), dark, 0, 0.79, 0);
    add(new THREE.BoxGeometry(0.1, 1.15, 0.1), wood, -0.72, 1.32, 0);
    add(new THREE.BoxGeometry(0.1, 1.15, 0.1), wood, 0.72, 1.32, 0);
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 5), iron, 0, 1.45, 0);
    add(new THREE.CylinderGeometry(0.14, 0.11, 0.2, 8), iron, 0, 1.08, 0.02);
    var roofMat = smat(0x504238, 0.95);
    if (global.TexLib) global.TexLib.apply(roofMat, 'shingle', 2, 1);
    var roof = new THREE.Mesh(makePrismGeometry(), roofMat);
    roof.position.set(0, 1.9, 0);
    roof.scale.set(1.0, 0.52, 0.78);
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
    var postMat = smat(0x5A432C, 0.92);
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
    var railMat = smat(0x6B5237, 0.92);
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
    var iron = smat(0x343537, 0.58);
    iron.metalness = 0.44;
    if (global.TexLib) global.TexLib.apply(iron, 'metal', 1, 2);
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
      var base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.18, 8), iron);
      base.position.y = 0.09;
      base.castShadow = true;
      g.add(base);
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.085, 2.75, 7), iron);
      post.position.y = 1.38;
      post.castShadow = true;
      g.add(post);
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.3), this._postLampMat);
      head.position.y = 2.95;
      g.add(head);
      var cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.24, 4), iron);
      cap.position.y = 3.27;
      cap.rotation.y = Math.PI / 4;
      cap.castShadow = true;
      g.add(cap);
      for (var cb = 0; cb < 4; cb++) {
        var bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.035), iron);
        var ca = cb / 4 * Math.PI * 2;
        bar.position.set(Math.cos(ca) * 0.17, 2.95, Math.sin(ca) * 0.17);
        g.add(bar);
      }
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
    // Utamakan lingkaran batu berdiri (landmark batu tua) sebagai lokasi keranjang obat.
    for (var ls = 0; ls < (world.landmarkSites || []).length; ls++) {
      var site = world.landmarkSites[ls];
      if (site.id === 'stones') { best = { x: site.x + 7.0, z: site.z + 2.4, s: 99 }; break; }
    }
    if (!best) {
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
    }
    var bx = best ? best.x + (best.s === 99 ? 0 : 1.7) : c.x + 40;
    var bz = best ? best.z - (best.s === 99 ? 0 : 1.3) : c.z + 40;
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
    this._spawnTownNpcs();
  };

  /* Warga kota kerajaan & kekaisaran (low-poly, tetap bisa diajak bicara). */
  Village.prototype._spawnTownNpcs = function () {
    var spots = this.world.townSpots || [];
    for (var i = 0; i < spots.length; i++) {
      var t = spots[i];
      var def = {
        name: t.name, role: t.role,
        home: { x: t.x, z: t.z },
        wanderR: t.wanderR, speed: t.speed, pal: t.pal
      };
      // site {0,0} → home dipakai apa adanya (koordinat dunia).
      var npc = new Npc(def, NPC_DEFS.length + i, this.world, { x: 0, z: 0 });
      npc.town = t.city || true;
      npc.city = t.city;
      this.scene.add(npc.group);
      this.npcs.push(npc);
    }
  };

  /* ---------- Tugas ---------- */

  Village.prototype.updateTracker = function () {
    var lines = [];
    var q = this.quests.kelapa;
    if (q.state === 'belum') lines.push('📜 Cari desa Aldenmere &amp; bicara dengan <b>Raka</b>');
    else if (q.state === 'cari') lines.push('🥥 Kumpulkan kelapa <b>' + q.count + '/' + q.need + '</b>');
    else if (q.state === 'kembali') lines.push('🥥 Kembalikan kelapa ke <b>Raka</b>');
    else lines.push('✓ Persediaan minyak kelapa cukup');

    var k = this.quests.keranjang;
    if (k.state === 'cari') lines.push('🧺 Temukan keranjang obat <b>Mira</b>');
    else if (k.state === 'kembali') lines.push('🧺 Kembalikan keranjang ke <b>Mira</b>');
    else if (k.state === 'selesai') lines.push('✓ Keranjang obat Mira kembali');

    lines.unshift('<span class="q-title">TUGAS KERAJAAN</span>');
    global.UI.setQuest(lines);
  };

  Village.prototype._dialogFor = function (npc) {
    var self = this;
    if (npc.role === 'kepala') {
      var q = this.quests.kelapa;
      if (q.state === 'belum') {
        return {
          lines: [
            'Selamat datang di Aldenmere, pengembara. Aku Raka, tetua desa ini.',
            'Kami bersiap merayakan Fajar Panen, tetapi tabib kami kekurangan minyak kelapa.',
            'Maukah kau mengumpulkan 5 kelapa dari pohon-pohon tua di tepi pantai?',
            'Tekan E di dekat pohon kelapa untuk memetiknya. Lampu fajar desa bergantung padamu.'
          ],
          after: function () {
            q.state = 'cari';
            global.UI.toast('📜 Tugas kerajaan: kumpulkan 5 kelapa');
            self.updateTracker();
          }
        };
      }
      if (q.state === 'cari') {
        var lv = ['Pohon kelapa tua tumbuh di sepanjang pantai selatan. Tekan E di dekatnya.'];
        if (q.count > 0) lv.unshift('Sejauh ini ' + q.count + ' dari ' + q.need + ' kelapa sudah terkumpul. Teruskan!');
        return { lines: lv, after: null };
      }
      if (q.state === 'kembali') {
        return {
          lines: [
            'Ah, kelima kelapa sudah terkumpul! Para tabib akan menyalakan lampu fajar malam ini.',
            'Kau datang seperti ksatria dari cerita lama. Aldenmere berutang budi padamu.',
            'Beristirahatlah di balai desa. Anggap Aldenmere sebagai rumahmu.'
          ],
          after: function () {
            q.state = 'selesai';
            global.UI.toast('✓ Tugas selesai: minyak kelapa terkumpul');
            self.updateTracker();
          }
        };
      }
      return {
        lines: ['Terima kasih sekali lagi, pengembara.', 'Semoga jalan kerajaan selalu melindungimu.'],
        after: null
      };
    }

    if (npc.role === 'mira') {
      var k = this.quests.keranjang;
      if (k.state === 'belum') {
        return {
          lines: [
            'Halo, pengembara. Aku Mira, tabib Aldenmere.',
            'Tadi aku memetik ramuan di lingkaran batu tua, tetapi keranjang obatku hilang!',
            'Keranjang itu berisi persediaan untuk kapel di luar desa. Tanpanya, orang-orang sakit akan terlantar.',
            'Maukah kau mencarikannya? Anyamannya dari rotan, dengan pita merah di pinggirnya.'
          ],
          after: function () {
            k.state = 'cari';
            if (self.basket) self.basket.visible = true;
            global.UI.toast('📜 Tugas kerajaan: cari keranjang obat Mira');
            self.updateTracker();
          }
        };
      }
      if (k.state === 'cari') {
        return {
          lines: [
            'Keranjangku terbuat dari anyaman rotan, ada pita merahnya.',
            'Coba cari di dekat lingkaran batu berdiri, jauh di luar desa. Rerumputan di sana panjang.'
          ],
          after: null
        };
      }
      if (k.state === 'kembali') {
        return {
          lines: ['Itu dia keranjangku! Ramuan di dalamnya masih utuh.', 'Berkat para leluhur, kau telah menyelamatkan banyak orang.'],
          after: function () {
            k.state = 'selesai';
            global.UI.toast('✓ Tugas selesai: keranjang obat Mira');
            self.updateTracker();
          }
        };
      }
      return { lines: ['Kapel tua di luar desa masih menyimpan rune fajar. Kunjungilah bila kau sempat.'], after: null };
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
        best = { d2: d2, kind: 'basket', prompt: 'Tekan <b class="ekey">E</b> - ambil keranjang obat' };
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
      global.UI.toast('🥥 Kelapa ' + q.count + '/' + q.need + ' — bawa ke Raka!');
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
    var px = player && player.position ? player.position : null;
    for (var n = 0; n < this.npcs.length; n++) {
      var np = this.npcs[n];
      // Warga kota yang jauh (kerajaan vs kekaisaran) dilewati: hemat ribuan
      // pemeriksaan tabrakan per frame.
      if (np.town && px) {
        var ndx = np.group.position.x - px.x, ndz = np.group.position.z - px.z;
        if (ndx * ndx + ndz * ndz > 110 * 110) continue;
      }
      np.update(dt, this.world, player);
    }
  };

  global.Village = Village;
})(typeof window !== 'undefined' ? window : globalThis);
