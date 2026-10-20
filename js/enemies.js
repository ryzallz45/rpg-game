/* Fase 3: makhluk pulau (babi hutan, bandit rimba, slime) — AI sederhana
   (jelajah → kejar → serang → terluka → mati → bangkit lagi), jarahan (loot),
   dan bilah HP melayang di atas musuh yang baru dilawan. */
(function (global) {
  'use strict';
  var U = global.Utils;
  var C = global.CONFIG;

  function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function smat(hex, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color: srgb(hex),
      roughness: rough === undefined ? 0.9 : rough,
      metalness: metal || 0
    });
  }

  /* ---------- Bentuk makhluk (low-poly) ----------
     Setiap builder mengembalikan { group, anim, mats }.
     mats mencatat material + warna dasar agar bisa berkedip merah saat terluka. */

  function matsWrap(list, mat) {
    list.push({ m: mat, hex: mat.emissive.getHex(), int: mat.emissiveIntensity });
    return mat;
  }

  function buildBoarMesh() {
    var mats = [];
    function M(hex, rough) { return matsWrap(mats, smat(hex, rough)); }
    var fur = M(0x5B4632, 0.95);
    var furD = M(0x46351F, 0.95);
    var tusk = M(0xEDE6D0, 0.55);
    var eye = M(0x15100B, 0.4);
    var hoof = M(0x2E241A, 0.9);
    if (global.TexLib) {
      global.TexLib.apply(fur, 'fur', 2, 1.6);
      global.TexLib.apply(furD, 'fur', 2, 1.6);
    }

    var g = new THREE.Group();
    function part(geo, mat, x, y, z, parent) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      (parent || g).add(m);
      return m;
    }

    // badan & punuk & ekor
    part(new THREE.BoxGeometry(0.58, 0.5, 1.08), fur, 0, 0.6, 0);
    part(new THREE.BoxGeometry(0.44, 0.26, 0.5), fur, 0, 0.85, 0.22);
    part(new THREE.BoxGeometry(0.07, 0.07, 0.3), furD, 0, 0.72, -0.62);

    // kepala (grup agar bisa menanduk)
    var head = new THREE.Group();
    head.position.set(0, 0.62, 0.6);
    g.add(head);
    part(new THREE.BoxGeometry(0.4, 0.36, 0.38), fur, 0, 0, 0, head);
    part(new THREE.BoxGeometry(0.2, 0.17, 0.2), furD, 0, -0.08, 0.27, head);
    part(new THREE.BoxGeometry(0.11, 0.07, 0.05), eye, 0, -0.03, 0.37, head);
    part(new THREE.SphereGeometry(0.035, 8, 6), eye, -0.13, 0.07, 0.18, head);
    part(new THREE.SphereGeometry(0.035, 8, 6), eye, 0.13, 0.07, 0.18, head);
    part(new THREE.ConeGeometry(0.045, 0.17, 5), tusk, -0.13, -0.13, 0.3, head).rotation.x = 0.85;
    part(new THREE.ConeGeometry(0.045, 0.17, 5), tusk, 0.13, -0.13, 0.3, head).rotation.x = 0.85;
    part(new THREE.BoxGeometry(0.1, 0.12, 0.05), furD, -0.18, 0.2, -0.05, head).rotation.z = 0.3;
    part(new THREE.BoxGeometry(0.1, 0.12, 0.05), furD, 0.18, 0.2, -0.05, head).rotation.z = -0.3;

    // kaki: 4 pivot untuk ayunan saat berjalan
    var legs = [];
    var legPos = [[-0.19, 0.36], [0.19, 0.36], [-0.19, -0.36], [0.19, -0.36]];
    for (var i = 0; i < 4; i++) {
      var pv = new THREE.Group();
      pv.position.set(legPos[i][0], 0.42, legPos[i][1]);
      part(new THREE.BoxGeometry(0.13, 0.36, 0.15), furD, 0, -0.18, 0, pv);
      part(new THREE.BoxGeometry(0.15, 0.09, 0.17), hoof, 0, -0.38, 0.01, pv);
      g.add(pv);
      legs.push(pv);
    }

    return { group: g, anim: { legs: legs, head: head }, mats: mats };
  }

  /* Golok bandit — dipakai bentuk prosedural maupun ditempel ke tangan model 3D. */
  function buildGolok(woodMat, bladeMat) {
    var w = new THREE.Group();
    function gp(geo, mat, x, y, z) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      w.add(m);
      return m;
    }
    gp(new THREE.CylinderGeometry(0.024, 0.028, 0.14, 6), woodMat, 0, -0.04, 0);
    gp(new THREE.BoxGeometry(0.06, 0.48, 0.022), bladeMat, 0, -0.35, 0).rotation.z = 0.06;
    gp(new THREE.ConeGeometry(0.032, 0.12, 4), bladeMat, 0, -0.64, 0).rotation.x = Math.PI;
    return w;
  }

  function buildBanditMesh() {
    var mats = [];
    function M(hex, rough, metal) { return matsWrap(mats, smat(hex, rough, metal)); }
    var shirt = M(0x7A3B30, 0.9);
    var pants = M(0x3A3F4A, 0.9);
    var skin = M(0xC08A5E, 0.8);
    var band = M(0xA03A2A, 0.9);
    var blade = M(0xC6CCD4, 0.35, 0.55);
    var wood = M(0x5A4326, 0.85);
    var eye = M(0x15100B, 0.4);
    if (global.TexLib) {
      global.TexLib.apply(shirt, 'cloth', 1.5, 1.2);
      global.TexLib.apply(pants, 'cloth', 1.4, 1.4);
      global.TexLib.apply(band, 'leather', 1, 1);
      global.TexLib.apply(blade, 'metal', 1, 2.2);
      global.TexLib.apply(wood, 'wood', 1, 1);
    }

    var g = new THREE.Group();
    function part(parent, geo, mat, x, y, z) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    }

    part(g, new THREE.BoxGeometry(0.32, 0.2, 0.22), pants, 0, 0.86, 0);
    part(g, new THREE.BoxGeometry(0.4, 0.5, 0.26), shirt, 0, 1.2, 0);
    part(g, new THREE.SphereGeometry(0.185, 12, 10), skin, 0, 1.58, 0);
    part(g, new THREE.BoxGeometry(0.42, 0.08, 0.34), band, 0, 1.63, 0);
    part(g, new THREE.SphereGeometry(0.024, 8, 6), eye, -0.06, 1.59, 0.165);
    part(g, new THREE.SphereGeometry(0.024, 8, 6), eye, 0.06, 1.59, 0.165);

    function makeArm(side) {
      var p = new THREE.Group();
      p.position.set(side * 0.26, 1.42, 0);
      part(p, new THREE.CylinderGeometry(0.07, 0.08, 0.26, 8), shirt, 0, -0.13, 0);
      part(p, new THREE.CylinderGeometry(0.055, 0.065, 0.28, 8), skin, 0, -0.4, 0);
      part(p, new THREE.SphereGeometry(0.06, 8, 6), skin, 0, -0.55, 0);
      g.add(p);
      return p;
    }
    function makeLeg(side) {
      var p = new THREE.Group();
      p.position.set(side * 0.13, 0.78, 0);
      part(p, new THREE.CylinderGeometry(0.07, 0.08, 0.56, 8), pants, 0, -0.28, 0);
      part(p, new THREE.BoxGeometry(0.15, 0.1, 0.22), M(0x33302B, 0.85), 0, -0.6, 0.03);
      g.add(p);
      return p;
    }
    var armL = makeArm(-1);
    var armR = makeArm(1);
    var legL = makeLeg(-1);
    var legR = makeLeg(1);

    // Golok di tangan kanan
    var w = buildGolok(wood, blade);
    w.position.set(0, -0.56, 0.02);
    armR.add(w);

    return { group: g, anim: { armL: armL, armR: armR, legL: legL, legR: legR }, mats: mats };
  }

  function buildSlimeMesh() {
    var mats = [];
    var gel = new THREE.MeshStandardMaterial({
      color: srgb(0x69BF57), roughness: 0.35, metalness: 0,
      emissive: srgb(0x1E4416), emissiveIntensity: 0.7
    });
    if (global.TexLib) global.TexLib.apply(gel, 'gel', 2, 2);
    matsWrap(mats, gel);
    var eye = matsWrap(mats, smat(0x15100B, 0.4));

    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 7), gel);
    body.scale.set(1.08, 0.72, 1.08);
    body.position.y = 0.3;
    body.castShadow = true;
    g.add(body);

    var e1 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eye);
    e1.position.set(-0.15, 0.12, 0.35);
    var e2 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eye);
    e2.position.set(0.15, 0.12, 0.35);
    body.add(e1);
    body.add(e2);

    return { group: g, anim: { body: body }, mats: mats };
  }

  /* ---------- Jenis makhluk ---------- */

  var TYPES = {
    babi: {
      label: 'Babi Hutan', icon: '🐗',
      hp: 40, dmg: 9, wanderSpeed: 1.6, chaseSpeed: 4.6, detect: 13,
      range: 2.4, cd: 1.5, xp: 12, r: 0.75, height: 1.2, build: buildBoarMesh,
      loot: [
        { id: 'daging', min: 1, max: 3, chance: 1 },
        { id: 'kulit', min: 1, max: 1, chance: 0.5 },
        { id: 'taring', min: 1, max: 1, chance: 0.25 }
      ]
    },
    bandit: {
      label: 'Bandit Rimba', icon: '🗡️',
      hp: 65, dmg: 12, wanderSpeed: 1.4, chaseSpeed: 3.7, detect: 15,
      range: 2.5, cd: 1.9, xp: 20, r: 0.5, height: 1.95, build: buildBanditMesh,
      loot: [
        { id: 'koin', min: 2, max: 5, chance: 1 },
        { id: 'besi', min: 1, max: 2, chance: 0.5 }
      ]
    },
    slime: {
      label: 'Slime Hutan', icon: '🟢',
      hp: 24, dmg: 6, wanderSpeed: 1.2, chaseSpeed: 2.8, detect: 9.5,
      range: 1.8, cd: 1.7, xp: 8, r: 0.55, height: 0.9, build: buildSlimeMesh,
      loot: [
        { id: 'lendir', min: 1, max: 3, chance: 1 }
      ]
    }
  };

  /* ---------- Satu makhluk ---------- */

  function Enemy(typeId, x, z, world, seed) {
    this.typeId = typeId;
    this.def = TYPES[typeId];
    this.world = world;
    this.rng = U.mulberry32(seed);
    this.home = { x: x, z: z };

    var built = this.def.build();
    this.group = built.group;
    this.anim = built.anim;
    this.mats = built.mats;
    this.group.position.set(x, world.groundHeight(x, z), z);

    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.state = 'idle';
    this.timer = this.rng() * 2.5;
    this.target = null;
    this.aggro = false;
    this.cd = 0;
    this.windup = 0;
    this._struck = false;
    this.walkPhase = this.rng() * 8;
    this.hopPhase = this.rng() * 8;
    this.bounceY = 0;
    this.knockX = 0; this.knockZ = 0; this.knockT = 0;
    this.flashT = 0;
    this.deadT = -1;
    this.respawn = 0;
    this.deathY = 0;
    this.deathSpin = this.rng() < 0.5 ? -1 : 1;
    this.active = true;

    this.group.rotation.y = this.rng() * Math.PI * 2;
  }

  Enemy.prototype.update = function (dt, ctx) {
    var world = ctx.world;
    var g = this.group;
    var def = this.def;

    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this._unflash();
    }

    // Mati: rebah lalu tenggelam; bangkit lagi setelah beberapa saat
    if (this.deadT >= 0) {
      this.deadT += dt;
      if (this.mixer) {
        // Model 3D: animasi rebah sendiri, lalu perlahan tenggelam
        this._animateModel(dt);
        if (this.deadT > 0.7) g.position.y = this.deathY - (this.deadT - 0.7) * 0.32;
        if (this.deadT > 2.0) g.visible = false;
      } else {
        var t = Math.min(this.deadT / 0.7, 1);
        g.rotation.z = this.deathSpin * 1.45 * t;
        g.position.y = this.deathY - t * 0.45;
        if (this.deadT > 1.0) g.visible = false;
      }
      this.respawn -= dt;
      if (this.respawn <= 0) this._respawn(world);
      return;
    }

    var p = ctx.player.position;
    var dxP = p.x - g.position.x, dzP = p.z - g.position.z;
    var distP = Math.sqrt(dxP * dxP + dzP * dzP);
    var dxH = this.home.x - g.position.x, dzH = this.home.z - g.position.z;
    var distH = Math.sqrt(dxH * dxH + dzH * dzH);
    if (this.cd > 0) this.cd -= dt;

    // Bangun agresi / lepas agresi
    if (ctx.canFight && !this.aggro && distP < def.detect && distH < 70) {
      this.aggro = true;
      this.state = 'chase';
      if (ctx.hooks && ctx.hooks.onAggro) ctx.hooks.onAggro(this);
    }
    if (this.aggro && (!ctx.canFight || distP > def.detect * 1.9 || distH > 80)) {
      this.aggro = false;
      this.state = 'return';
    }

    if (this.knockT > 0) {
      // Terlempar sesaat oleh tebasan pemain
      this.knockT -= dt;
      var kf = Math.max(this.knockT / 0.22, 0);
      this._move(dt, this.knockX * kf, this.knockZ * kf, world);
    } else if (this.state === 'idle') {
      this.timer -= dt;
      if (this.timer <= 0) this._pickWander();
    } else if (this.state === 'wander' || this.state === 'return') {
      var tx = (this.state === 'wander' && this.target) ? this.target.x : this.home.x;
      var tz = (this.state === 'wander' && this.target) ? this.target.z : this.home.z;
      var dxT = tx - g.position.x, dzT = tz - g.position.z;
      var distT = Math.sqrt(dxT * dxT + dzT * dzT);
      if (distT < 0.4) {
        this.state = 'idle';
        this.timer = 1.2 + this.rng() * 3.2;
      } else {
        this._move(dt, (dxT / distT) * def.wanderSpeed, (dzT / distT) * def.wanderSpeed, world);
      }
    } else if (this.state === 'chase') {
      if (distP <= def.range && this.cd <= 0) {
        this.state = 'attack';
        this.windup = 0.38;
        this._struck = false;
      } else if (distP > def.range * 0.8) {
        var cs = def.chaseSpeed;
        this._move(dt, (dxP / (distP || 1)) * cs, (dzP / (distP || 1)) * cs, world);
      }
    } else if (this.state === 'attack') {
      this.windup -= dt;
      if (!this._struck && this.windup <= 0.14) {
        this._struck = true;
        if (ctx.canFight && distP < def.range + 0.9) {
          if (ctx.mgr) ctx.mgr.showBar(this);
          if (ctx.hooks && ctx.hooks.onPlayerHurt) {
            ctx.hooks.onPlayerHurt(def.dmg, g.position.x, g.position.z, this);
          }
        }
      }
      if (this.windup <= 0) {
        this.cd = def.cd;
        this.state = this.aggro ? 'chase' : 'idle';
        this.timer = 1 + this.rng();
      }
    }

    // Jangan tumpang-tindih dengan pemain (kecuali saat menyerang / terlempar)
    if (distP < def.r + 0.55 && distP > 1e-4 && this.state !== 'attack' && this.knockT <= 0) {
      var push = def.r + 0.55 - distP;
      g.position.x -= (dxP / distP) * push;
      g.position.z -= (dzP / distP) * push;
    }

    this._animate(dt);
    g.position.y = world.groundHeight(g.position.x, g.position.z) + this.bounceY;
  };

  Enemy.prototype._pickWander = function () {
    var a = this.rng() * Math.PI * 2;
    var r = 4 + this.rng() * 11;
    var tx = this.home.x + Math.cos(a) * r;
    var tz = this.home.z + Math.sin(a) * r;
    if (this.world.groundHeight(tx, tz) > 1.2 && this.world._slopeAt(tx, tz) < 0.6) {
      this.target = { x: tx, z: tz };
      this.state = 'wander';
    } else {
      this.timer = 1.5;
    }
  };

  Enemy.prototype._move = function (dt, vx, vz, world) {
    var g = this.group;
    var nx = g.position.x + vx * dt;
    var nz = g.position.z + vz * dt;
    if (world.groundHeight(nx, g.position.z) > 0.35) g.position.x = nx;
    if (world.groundHeight(g.position.x, nz) > 0.35) g.position.z = nz;
    this._collide(world);
    var sp = Math.sqrt(vx * vx + vz * vz);
    if (sp > 0.15) {
      g.rotation.y = U.lerpAngle(g.rotation.y, Math.atan2(vx, vz), 1 - Math.exp(-7 * dt));
    }
  };

  Enemy.prototype._collide = function (world) {
    var cols = world.colliders;
    if (!cols || !cols.length) return;
    var px = this.group.position.x, pz = this.group.position.z;
    var rr0 = this.def.r * 0.7;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      var dx = px - c.x, dz = pz - c.z;
      var rr = c.r + rr0;
      var d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-8) {
        var d = Math.sqrt(d2);
        px += (dx / d) * (rr - d);
        pz += (dz / d) * (rr - d);
      }
    }
    this.group.position.x = px;
    this.group.position.z = pz;
  };

  Enemy.prototype._animate = function (dt) {
    if (this.mixer) { this._animateModel(dt); return; } // model 3D aktif
    var moving = this.state === 'wander' || this.state === 'return' ||
      this.state === 'chase' || this.knockT > 0;
    var attacking = this.state === 'attack';
    var prog = attacking ? 1 - Math.max(this.windup, 0) / 0.38 : 0; // 0 = siap, 1 = menghantam

    if (this.typeId === 'babi') {
      this.walkPhase += dt * (moving ? (this.state === 'chase' ? 12 : 6.5) : 1.6);
      var sw = Math.sin(this.walkPhase) * (moving ? 0.62 : 0);
      var legs = this.anim.legs;
      legs[0].rotation.x = sw;
      legs[1].rotation.x = -sw;
      legs[2].rotation.x = -sw;
      legs[3].rotation.x = sw;
      this.anim.head.rotation.x = attacking
        ? (prog < 0.6 ? -0.45 * (prog / 0.6) : 0.6)
        : 0;
      this.bounceY = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.03 : 0;
    } else if (this.typeId === 'bandit') {
      this.walkPhase += dt * (moving ? (this.state === 'chase' ? 10.5 : 6) : 1.5);
      var sw2 = Math.sin(this.walkPhase) * (moving ? 0.6 : 0);
      this.anim.legL.rotation.x = sw2;
      this.anim.legR.rotation.x = -sw2;
      this.anim.armL.rotation.x = -sw2 * 0.8;
      this.anim.armR.rotation.x = attacking
        ? (prog < 0.55 ? U.lerp(0, -2.1, prog / 0.55) : U.lerp(-2.1, 0.6, (prog - 0.55) / 0.45))
        : sw2 * 0.8;
      this.bounceY = 0;
    } else { // slime: melompat-lompat kenyal
      this.hopPhase += dt * (moving || attacking ? 6.2 : 2.1);
      var hop = Math.abs(Math.sin(this.hopPhase));
      if (attacking) {
        var sq = Math.sin(prog * Math.PI);
        this.anim.body.scale.set(1.08 + sq * 0.22, 0.72 * (1 - sq * 0.42), 1.08 + sq * 0.22);
        this.bounceY = sq * 0.1;
      } else {
        this.anim.body.scale.set(1.08 - hop * 0.14, 0.72 * (0.85 + 0.42 * hop), 1.08 - hop * 0.14);
        this.bounceY = hop * (moving ? 0.26 : 0.07);
      }
    }
  };

  /* ---------- Model 3D makhluk (Tahap G5) ---------- */

  Enemy.prototype.attachModel = function (lib, name) {
    if (this.mixer) return false; // sudah memakai model 3D
    var spawned = lib.spawn(name, {
      cloneMaterials: true, // tiap ekor punya material sendiri agar bisa berkedip merah
      height: name === 'boar' ? 1.25 : 1.9,
      tint: name === 'boar' ? 0x8F7860 : undefined // babi hutan = coklat lumpur
    });
    if (!spawned) return false;

    this._procParts = this.group.children.slice();
    for (var i = 0; i < this._procParts.length; i++) this._procParts[i].visible = false;

    this.modelRoot = spawned.root;
    this.group.add(spawned.root);
    // Fase 5 (optimasi): makhluk ber-model 3D tidak membuang bayangan —
    // pass skinning kedua untuk 65 ekor jauh lebih mahal daripada manfaatnya.
    spawned.root.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
    this.mats = spawned.mats; // kedip merah kini pada material model
    this.mixer = new THREE.AnimationMixer(spawned.root);

    var mixer = this.mixer;
    function act(patterns, once) {
      var clip = global.AssetLibrary.findClip(spawned.clips, patterns);
      if (!clip) return null;
      var a = mixer.clipAction(clip);
      if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      return a;
    }

    var A;
    if (name === 'boar') {
      A = {
        idle: act(['(^|\\|)Idle$']),
        walk: act(['(^|\\|)Walk$']),
        run: act(['(^|\\|)Run$']),
        attack: act(['Headbutt'], true),
        death: act(['(^|\\|)Death$'], true)
      };
    } else {
      A = {
        idle: act(['(^|\\|)Idle$']),
        walk: act(['(^|\\|)Walking_A$', '(^|\\|)Walking_B$']),
        run: act(['(^|\\|)Running_A$', '(^|\\|)Running_B$']),
        attack: act(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab'], true),
        death: act(['(^|\\|)Death_A$'], true)
      };
      // Golok ditempel ke tangan kanan model bandit
      var hand = null;
      spawned.root.traverse(function (o) {
        if (!hand && /^handslot[._]?r$/i.test(o.name)) hand = o;
      });
      if (!hand) {
        spawned.root.traverse(function (o) { if (!hand && /^hand[._]?r$/i.test(o.name)) hand = o; });
      }
      if (hand) {
        var gm = smat(0x5A4326, 0.85);
        var gb = smat(0xC6CCD4, 0.35, 0.55);
        if (global.TexLib) {
          global.TexLib.apply(gm, 'wood', 1, 1);
          global.TexLib.apply(gb, 'metal', 1, 2.2);
        }
        var golok = buildGolok(gm, gb);
        golok.position.set(0.02, 0.02, 0.0);
        golok.rotation.set(0, 0, Math.PI / 2); // bilah menggantung dari telapak
        hand.add(golok);
        spawned.mats.push({ m: gm, hex: gm.emissive.getHex(), int: gm.emissiveIntensity });
        spawned.mats.push({ m: gb, hex: gb.emissive.getHex(), int: gb.emissiveIntensity });
      }
    }
    if (A.attack) A.attack._fit = U.clamp(A.attack.getClip().duration / 0.42, 1.2, 3.0);

    this.act = A;
    this._currentAct = null;
    this._actMode = '';
    if (A.idle) {
      A.idle.play();
      this._currentAct = A.idle;
    }
    return true;
  };

  Enemy.prototype._animateModel = function (dt) {
    var A = this.act;
    if (!A) return;
    this.mixer.update(dt);

    var attacking = this.state === 'attack';
    var moving = this.state === 'wander' || this.state === 'return' ||
      this.state === 'chase' || this.knockT > 0;
    var mode;
    if (this.deadT >= 0) mode = 'death';
    else if (attacking) mode = 'attack';
    else if (moving) mode = this.state === 'chase' ? 'run' : 'walk';
    else mode = 'idle';
    if (mode === this._actMode) return; // mode ini sudah berjalan

    if (mode === 'death' && A.death) {
      if (this._currentAct) this._currentAct.fadeOut(0.08);
      A.death.reset().fadeIn(0.05).play();
      this._currentAct = A.death;
    } else if (mode === 'attack' && A.attack) {
      A.attack.timeScale = A.attack._fit || 1.8;
      if (this._currentAct) this._currentAct.fadeOut(0.08);
      A.attack.reset().fadeIn(0.05).play();
      this._currentAct = A.attack;
    } else if (mode === 'idle' || mode === 'walk' || mode === 'run') {
      var want = mode === 'idle' ? A.idle : mode === 'walk' ? A.walk : A.run;
      if (want && want !== this._currentAct) {
        if (this._currentAct) this._currentAct.fadeOut(0.18);
        want.reset().fadeIn(0.15).play();
        this._currentAct = want;
      }
    }
    this._actMode = mode;
  };

  Enemy.prototype._flash = function () {
    for (var i = 0; i < this.mats.length; i++) {
      var rec = this.mats[i];
      rec.m.emissive.setHex(0xBB2323);
      rec.m.emissiveIntensity = 1;
    }
    this.flashT = 0.15;
  };

  Enemy.prototype._unflash = function () {
    for (var i = 0; i < this.mats.length; i++) {
      var rec = this.mats[i];
      rec.m.emissive.setHex(rec.hex);
      rec.m.emissiveIntensity = rec.int;
    }
  };

  /* Kena tebasan: kembalikan true bila mati. */
  Enemy.prototype.takeHit = function (dmg, fromX, fromZ) {
    if (this.deadT >= 0) return false;
    this.hp -= dmg;
    this._flash();
    var dx = this.group.position.x - fromX;
    var dz = this.group.position.z - fromZ;
    var d = Math.sqrt(dx * dx + dz * dz) || 1;
    this.knockX = (dx / d) * 4.2;
    this.knockZ = (dz / d) * 4.2;
    this.knockT = 0.22;
    this.aggro = true;
    if (this.hp <= 0) {
      this._die();
      return true;
    }
    this.state = 'chase';
    this.cd = Math.max(this.cd, 0.35);
    return false;
  };

  Enemy.prototype._die = function () {
    this.deadT = 0;
    this.deathY = this.group.position.y;
    this.respawn = 75;
    this.aggro = false;
    this.knockT = 0;
    this.bounceY = 0;
  };

  Enemy.prototype._respawn = function (world) {
    this.deadT = -1;
    this.hp = this.maxHp;
    this.aggro = false;
    this.state = 'idle';
    this.timer = 1 + this.rng() * 2;
    this.group.rotation.z = 0;
    this.group.visible = true;
    this.group.position.set(
      this.home.x, world.groundHeight(this.home.x, this.home.z), this.home.z
    );
    if (this.mixer && this.act) {
      this._actMode = '';
      this._currentAct = null;
      if (this.act.idle) {
        this.act.idle.reset().play();
        this._currentAct = this.act.idle;
      }
    }
  };

  /* ---------- Pengelola semua makhluk + jarahan + bilah HP ---------- */

  function Enemies(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.loot = [];
    this.hooks = null;
    this.counts = { babi: 0, bandit: 0, slime: 0 };
    this.introBoar = null;
    this._lootT = 0;
    this._lootGeo = null;
    this._lootMats = null;
    this._barGroup = null;
    this._barFill = null;
    this._barTarget = null;
    this._barT = 0;
  }

  Enemies.prototype.build = function () {
    var world = this.world;
    var rng = U.mulberry32(C.WORLD.seed + 5150);
    this.rng = U.mulberry32(C.WORLD.seed + 9091);
    var spawn = world.findSpawnPoint();
    var spots = world.villageSpots || [];
    var placed = [];
    var S = world.scale || 1;

    function tryPlace(minVillage, minSpawn) {
      for (var a = 0; a < 80; a++) {
        var span = C.WORLD.size * 0.40;
        var x = (rng() * 2 - 1) * span;
        var z = (rng() * 2 - 1) * span;
        var h = world.height(x, z);
        if (h < 1.6 * S || h > 26 * S) continue;
        if (world._slopeAt(x, z) > 0.45) continue;
        var ok = true;
        for (var s = 0; s < spots.length; s++) {
          var vs = spots[s];
          var ddx = x - vs.x, ddz = z - vs.z;
          var lim = vs.r + minVillage;
          if (ddx * ddx + ddz * ddz < lim * lim) { ok = false; break; }
        }
        if (!ok) continue;
        var sdx = x - spawn.x, sdz = z - spawn.z;
        if (sdx * sdx + sdz * sdz < minSpawn * minSpawn) continue;
        var near = false;
        for (var q = 0; q < placed.length; q++) {
          var qdx = x - placed[q].x, qdz = z - placed[q].z;
          if (qdx * qdx + qdz * qdz < 18 * 18) { near = true; break; }
        }
        if (near) continue;
        return { x: x, z: z };
      }
      return null;
    }

    var plan = [
      { id: 'babi', n: 26, mv: 34, ms: 40 },
      { id: 'slime', n: 22, mv: 28, ms: 36 },
      { id: 'bandit', n: 16, mv: 80, ms: 60 }
    ];
    var idx = 0;
    for (var i = 0; i < plan.length; i++) {
      for (var k = 0; k < plan[i].n; k++) {
        var pos = tryPlace(plan[i].mv, plan[i].ms);
        if (!pos) continue;
        placed.push(pos);
        var en = new Enemy(plan[i].id, pos.x, pos.z, world, C.WORLD.seed + 6000 + idx * 131);
        this.scene.add(en.group);
        this.list.push(en);
        this.counts[plan[i].id]++;
        idx++;
      }
    }

    // Satu babi "pembuka" di jalur pedalaman dekat pantai awal — perkenalan tempur.
    // Titik dicari bertahap ke arah pedalaman agar tetap valid di medan apa pun.
    var len = Math.sqrt(spawn.x * spawn.x + spawn.z * spawn.z) || 1;
    var ux = spawn.x / len, uz = spawn.z / len;
    var ibPos = null;
    for (var bd = 34 * S; bd <= 76 * S && !ibPos; bd += 6 * S) {
      var bx = spawn.x - ux * bd;
      var bz = spawn.z - uz * bd;
      if (world.height(bx, bz) <= 1.5 * S || world._slopeAt(bx, bz) >= 0.45) continue;
      var okV = true;
      for (var s2 = 0; s2 < spots.length; s2++) {
        var v2 = spots[s2];
        var ddx2 = bx - v2.x, ddz2 = bz - v2.z;
        var lim2 = v2.r + 6;
        if (ddx2 * ddx2 + ddz2 * ddz2 < lim2 * lim2) { okV = false; break; }
      }
      if (okV) ibPos = { x: bx, z: bz };
    }
    if (ibPos) {
      var ib = new Enemy('babi', ibPos.x, ibPos.z, world, C.WORLD.seed + 7777);
      this.scene.add(ib.group);
      this.list.push(ib);
      this.counts.babi++;
      this.introBoar = ib;
    }

    this._buildBar();
  };

  Enemies.prototype.attachModels = function (lib) {
    if (!lib || !lib.ready) return 0;
    var count = 0;
    for (var i = 0; i < this.list.length; i++) {
      var e = this.list[i];
      var name = e.typeId === 'bandit' ? 'hooded' : (e.typeId === 'babi' ? 'boar' : null);
      if (!name || !lib.has(name)) continue;
      if (e.attachModel(lib, name)) count++;
    }
    if (count) console.log('[Aetheria] Model makhluk aktif: ' + count + ' ekor');
    return count;
  };

  Enemies.prototype.update = function (dt, player, camera, canFight, stats) {
    var ctx = {
      world: this.world, player: player, camera: camera,
      canFight: canFight, stats: stats, hooks: this.hooks, mgr: this
    };
    var px = player.position.x, pz = player.position.z;
    this._lootT += dt;

    for (var i = 0; i < this.list.length; i++) {
      var e = this.list[i];
      var dx = e.home.x - px, dz = e.home.z - pz;
      var gx = e.group.position.x - px, gz = e.group.position.z - pz;
      e.active = (dx * dx + dz * dz) < 140 * 140 || (gx * gx + gz * gz) < 140 * 140;
      if (e.active) {
        if (e.deadT < 0) e.group.visible = true;
        if (e.deadT < 0 || e.deadT < 1.0) e.update(dt, ctx);
        else if (e.respawn > 0) {
          // tetap hitung waktu kebangkitan walau sudah tersembunyi
          e.respawn -= dt;
          if (e.respawn <= 0) e._respawn(this.world);
        }
      } else {
        e.group.visible = false;
      }
    }

    this._updateLoot(dt, ctx);
    this._updateBar(dt, camera);
  };

  /* Tebasan pemain: kenai musuh di busur depan. Kembalikan jumlah yang kena. */
  Enemies.prototype.playerHit = function (x, z, yaw, dmg, stats) {
    var fx = Math.sin(yaw), fz = Math.cos(yaw);
    var cosArc = Math.cos(1.05);
    var hits = 0;
    for (var i = 0; i < this.list.length; i++) {
      var e = this.list[i];
      if (e.deadT >= 0) continue;
      var dx = e.group.position.x - x, dz = e.group.position.z - z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > 2.8 + e.def.r * 0.4) continue;
      if (d > 0.001) {
        var dot = (dx * fx + dz * fz) / d;
        if (dot < cosArc) continue;
      }
      var died = e.takeHit(dmg, x, z);
      hits++;
      this.showBar(e);
      if (this.hooks && this.hooks.onHitEnemy) this.hooks.onHitEnemy(e, died);
      if (died) {
        this.spawnLoot(e);
        if (stats) {
          var ups = stats.gainXp(e.def.xp);
          if (ups && this.hooks && this.hooks.onLevelUp) this.hooks.onLevelUp(stats);
        }
        if (this.hooks && this.hooks.onKill) this.hooks.onKill(e);
      }
    }
    return hits;
  };

  Enemies.prototype.spawnLoot = function (e) {
    if (this.loot.length > 90) {
      var old = this.loot.shift();
      this.scene.remove(old.mesh);
    }
    var pos = e.group.position;
    var loot = e.def.loot;
    for (var i = 0; i < loot.length; i++) {
      var L = loot[i];
      if (this.rng() > L.chance) continue;
      var n = L.min + Math.floor(this.rng() * (L.max - L.min + 1));
      for (var k = 0; k < n; k++) {
        this._makeLoot(L.id, pos.x + (this.rng() - 0.5) * 1.4, pos.z + (this.rng() - 0.5) * 1.4);
      }
    }
  };

  Enemies.prototype._makeLoot = function (id, x, z) {
    var ITEMS = global.RPG.ITEMS;
    var it = ITEMS[id];
    if (!this._lootGeo) this._lootGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    if (!this._lootMats) this._lootMats = {};
    var mat = this._lootMats[id];
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: srgb(it.color), emissive: srgb(it.color), emissiveIntensity: 0.4,
        roughness: 0.45, metalness: (id === 'koin' || id === 'besi') ? 0.6 : 0.1
      });
      this._lootMats[id] = mat;
    }
    var m = new THREE.Mesh(this._lootGeo, mat);
    var gy = this.world.groundHeight(x, z);
    m.position.set(x, gy + 0.3, z);
    m.rotation.y = this.rng() * Math.PI * 2;
    this.scene.add(m);
    this.loot.push({ id: id, mesh: m, life: 75, phase: this.rng() * Math.PI * 2 });
  };

  Enemies.prototype._updateLoot = function (dt, ctx) {
    var px = ctx.player.position.x, pz = ctx.player.position.z;
    for (var i = this.loot.length - 1; i >= 0; i--) {
      var L = this.loot[i];
      L.life -= dt;
      L.mesh.rotation.y += dt * 2.4;
      var mx = L.mesh.position.x, mz = L.mesh.position.z;
      var dx = px - mx, dz = pz - mz;
      var d2 = dx * dx + dz * dz;
      if (d2 < 2.2 * 2.2 && d2 > 1e-6) {
        var d = Math.sqrt(d2);
        var sp = d > 0.6 ? 7.5 : 3.5;
        mx += (dx / d) * sp * dt;
        mz += (dz / d) * sp * dt;
        L.mesh.position.x = mx;
        L.mesh.position.z = mz;
        dx = px - mx; dz = pz - mz; d2 = dx * dx + dz * dz;
      }
      var gy = this.world.groundHeight(mx, mz);
      L.mesh.position.y = gy + 0.3 + Math.sin(this._lootT * 3 + L.phase) * 0.07;

      if (d2 < 0.55 * 0.55) {
        if (ctx.stats) ctx.stats.addItem(L.id, 1);
        if (ctx.hooks && ctx.hooks.onLoot) ctx.hooks.onLoot(L.id, 1);
        this.scene.remove(L.mesh);
        this.loot.splice(i, 1);
        continue;
      }
      if (L.life <= 0) {
        this.scene.remove(L.mesh);
        this.loot.splice(i, 1);
      }
    }
  };

  Enemies.prototype.showBar = function (e) {
    this._barTarget = e;
    this._barT = 4;
  };

  Enemies.prototype._buildBar = function () {
    var g = new THREE.Group();
    var bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.13),
      new THREE.MeshBasicMaterial({
        color: srgb(0x0A1622), transparent: true, opacity: 0.78,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false
      })
    );
    bg.renderOrder = 5;
    var fillGeo = new THREE.PlaneGeometry(0.92, 0.075);
    fillGeo.translate(0.46, 0, 0);
    this._barFill = new THREE.Mesh(
      fillGeo,
      new THREE.MeshBasicMaterial({
        color: srgb(0x7CE88C), depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false
      })
    );
    this._barFill.position.set(-0.46, 0, 0.002);
    this._barFill.renderOrder = 6;
    g.add(bg);
    g.add(this._barFill);
    g.visible = false;
    this.scene.add(g);
    this._barGroup = g;
  };

  Enemies.prototype._updateBar = function (dt, camera) {
    if (!this._barGroup) return;
    var e = this._barTarget;
    if (this._barT > 0 && e && e.deadT < 0) {
      this._barT -= dt;
      var ratio = U.clamp(e.hp / e.maxHp, 0, 1);
      this._barFill.scale.x = Math.max(ratio, 0.001);
      var col = ratio > 0.5 ? 0x7CE88C : (ratio > 0.25 ? 0xF2D468 : 0xF08A7A);
      this._barFill.material.color.setHex(col).convertSRGBToLinear();
      this._barGroup.position.set(
        e.group.position.x,
        e.group.position.y + e.def.height + 0.45,
        e.group.position.z
      );
      this._barGroup.quaternion.copy(camera.quaternion);
      this._barGroup.visible = true;
    } else {
      this._barGroup.visible = false;
    }
  };

  global.Enemies = Enemies;
  global.EnemyTypes = TYPES;
})(typeof window !== 'undefined' ? window : globalThis);
