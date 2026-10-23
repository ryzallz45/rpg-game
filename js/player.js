/* Pemain: karakter low-poly halus, gerak, gravitasi, animasi, tabrakan. */
(function (global) {
  'use strict';
  var U = global.Utils;
  var C = global.CONFIG;

  // Warna sRGB -> linear (agar akurat dengan tone mapping + output sRGB)
  function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  function smat(hex, rough) {
    return new THREE.MeshStandardMaterial({
      color: srgb(hex),
      roughness: rough === undefined ? 0.85 : rough,
      metalness: 0
    });
  }

  function Player(scene, world) {
    this.world = world;
    this.group = new THREE.Group();
    this.position = this.group.position;
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.walkPhase = 0;
    this.grounded = true;
    this.groundedTimer = 0.12;
    this.currentSpeed = 0;
    this.swimming = false; // Fase 5 lanjutan: laut terbuka bisa dijelajahi
    this.sprintLock = false; // R: kunci lari cepat agar eksplorasi tidak melelahkan

    this._wish = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._focus = new THREE.Vector3();
    this._bodyScale = 1;

    // Fase 3: pertarungan pedang
    this.attackTimer = 0;
    this.attackDuration = 0.36;
    this.attackCooldown = 0;
    this.combo = 0;
    this._comboTimer = 0;
    this._hitDone = true;
    this.onSwingHit = null; // dipasang oleh main.js → enemies.playerHit

    this._buildMesh();
    scene.add(this.group);

    var spawn = world.findSpawnPoint();
    this.position.set(spawn.x, world.groundHeight(spawn.x, spawn.z), spawn.z);
    this.yaw = Math.atan2(-spawn.x, -spawn.z); // menghadap ke tengah pulau
    this.group.rotation.y = this.yaw;
  }

  Player.prototype.toggleSprint = function () {
    this.sprintLock = !this.sprintLock;
    return this.sprintLock;
  };

  /* ---------- Bentuk karakter ---------- */
  Player.prototype._buildMesh = function () {
    var M = {
      skin: smat(0xE2B185, 0.8),
      skinDark: smat(0xCE9C72, 0.8),
      hair: smat(0x35261B, 0.9),
      shirt: smat(0x2F3B52, 0.9),
      stripe: smat(0x8C2F33, 0.9),
      armor: smat(0x9AA1A6, 0.42),
      trim: smat(0xB28C43, 0.5),
      pants: smat(0x3B3831, 0.9),
      boots: smat(0x4A3524, 0.85),
      belt: smat(0x3C2C1E, 0.85),
      strap: smat(0x5B4329, 0.85),
      glove: smat(0x53402C, 0.85),
      eye: smat(0x1C1C1E, 0.35)
    };
    M.armor.metalness = 0.42;
    M.trim.metalness = 0.35;
    if (global.TexLib) {
      global.TexLib.apply(M.shirt, 'cloth', 1.6, 1.2);
      global.TexLib.apply(M.stripe, 'cloth', 1.4, 1);
      global.TexLib.apply(M.armor, 'metal', 1.2, 1.2);
      global.TexLib.apply(M.trim, 'metal', 1, 1);
      global.TexLib.apply(M.pants, 'cloth', 1.4, 1.4);
      global.TexLib.apply(M.boots, 'leather', 1.2, 1.2);
      global.TexLib.apply(M.belt, 'leather', 1, 1);
      global.TexLib.apply(M.strap, 'leather', 1, 1);
      global.TexLib.apply(M.glove, 'leather', 1, 1);
    }

    var g = this.group;

    function part(parent, geo, mat, x, y, z, noShadow) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (!noShadow) m.castShadow = true;
      parent.add(m);
      return m;
    }

    function sph(r, ws, hs) { return new THREE.SphereGeometry(r, ws || 12, hs || 10); }
    function cyl(rt, rb, h) { return new THREE.CylinderGeometry(rt, rb, h, 10); }
    function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }

    // Pinggul & ikat pinggang dengan gesper logam
    part(g, box(0.36, 0.20, 0.24), M.pants, 0, 0.88, 0);
    part(g, box(0.41, 0.09, 0.29), M.belt, 0, 0.97, 0);
    part(g, box(0.09, 0.11, 0.04), M.trim, 0, 0.97, 0.155);

    // Torso: jubah perang, pelat dada, tabard, tali selempang
    this.torso = part(g, box(0.44, 0.55, 0.28), M.shirt, 0, 1.26, 0);
    part(g, box(0.46, 0.4, 0.15), M.armor, 0, 1.31, 0.1);
    part(g, box(0.46, 0.42, 0.08), M.armor, 0, 1.3, -0.1);
    part(g, box(0.1, 0.1, 0.05), M.trim, 0, 1.35, 0.205);
    part(g, box(0.16, 0.46, 0.03), M.stripe, 0, 1.22, 0.182);
    // Surcoat punggung dan jubah perang merah tua — ksatria tetap terbaca dari belakang.
    part(g, box(0.18, 0.44, 0.03), M.stripe, 0, 1.22, -0.17);
    var cape = part(g, box(0.52, 0.82, 0.045), M.stripe, 0, 1.07, -0.195);
    cape.rotation.x = -0.075;
    part(g, box(0.55, 0.06, 0.055), M.trim, 0, 0.665, -0.23);
    part(g, box(0.13, 0.07, 0.07), M.trim, 0, 1.48, -0.2);
    var strap = part(g, box(0.58, 0.07, 0.025), M.strap, 0, 1.36, 0.145);
    strap.rotation.z = 0.55;
    part(g, box(0.17, 0.15, 0.09), M.strap, 0.20, 1.04, 0.14);
    part(g, box(0.1, 0.08, 0.05), M.trim, 0.2, 1.04, 0.19);

    // Bahu: pauldron baja berlapis
    var pauldL = part(g, sph(0.125, 10, 8), M.armor, -0.275, 1.46, 0);
    pauldL.scale.set(1.15, 0.72, 1.05);
    var pauldR = part(g, sph(0.125, 10, 8), M.armor, 0.275, 1.46, 0);
    pauldR.scale.set(1.15, 0.72, 1.05);
    part(g, box(0.16, 0.03, 0.12), M.trim, -0.275, 1.52, 0);
    part(g, box(0.16, 0.03, 0.12), M.trim, 0.275, 1.52, 0);

    // Leher & kepala
    part(g, cyl(0.06, 0.075, 0.12), M.skin, 0, 1.60, 0);
    part(g, cyl(0.13, 0.155, 0.09, 12), M.armor, 0, 1.55, 0); // gorget
    var head = part(g, sph(0.215, 14, 12), M.skin, 0, 1.76, 0);
    head.scale.set(1, 1.06, 1);
    // Rambut: tutup belakang-atas kepala
    var hair = part(g, sph(0.225, 14, 12), M.hair, 0, 1.80, -0.045);
    hair.scale.set(1.02, 0.92, 1.02);
    // Tutup kepala baja ringan; wajah tetap terbuka agar mudah dikenali.
    part(g, new THREE.SphereGeometry(0.245, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.34),
      M.armor, 0, 1.79, -0.01);
    // Lingkaran baja pelindung dahi (ksatria tanpa helm tertutup)
    var band = part(g, new THREE.TorusGeometry(0.208, 0.032, 8, 18), M.armor, 0, 1.84, 0);
    band.rotation.x = Math.PI / 2;
    part(g, box(0.035, 0.1, 0.05), M.armor, 0, 1.79, 0.205, true);
    // Wajah: mata & hidung
    part(g, sph(0.03, 8, 8), M.eye, -0.08, 1.78, 0.185, true);
    part(g, sph(0.03, 8, 8), M.eye, 0.08, 1.78, 0.185, true);
    part(g, box(0.045, 0.055, 0.05), M.skinDark, 0, 1.72, 0.215, true);

    // Lengan: pivot di bahu — lengan baju, lengan bawah, tangan
    this.armL = this._limb(g, -0.30, 1.45, 0, M, false);
    this.armR = this._limb(g, 0.30, 1.45, 0, M, false);

    // Pedang di tangan kanan (bilah menghadap ke depan saat lengan terangkat)
    var bladeMat = smat(0xD9E0E8, 0.3);
    bladeMat.metalness = 0.6;
    var hiltMat = smat(0x6B4A2F, 0.85);
    if (global.TexLib) {
      global.TexLib.apply(bladeMat, 'metal', 1, 2.2);
      global.TexLib.apply(hiltMat, 'leather', 1, 1);
    }
    var sword = new THREE.Group();
    sword.position.set(0, -0.60, 0.02);
    this.sword = sword; // disimpan agar bisa dipindah ke tangan model 3D
    this.armR.add(sword);
    (function (sword) {
      function sous(geo, mat, x, y, z) {
        var m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        sword.add(m);
        return m;
      }
      sous(new THREE.CylinderGeometry(0.028, 0.032, 0.16, 8), hiltMat, 0, 0.02, 0);   // gagang
      sous(new THREE.BoxGeometry(0.22, 0.035, 0.06), hiltMat, 0, -0.07, 0);           // pelindung
      sous(new THREE.BoxGeometry(0.085, 0.5, 0.028), bladeMat, 0, -0.335, 0);         // bilah
      var tip = sous(new THREE.ConeGeometry(0.052, 0.16, 4), bladeMat, 0, -0.665, 0); // ujung mata
      tip.rotation.x = Math.PI;
    })(sword);

    // Kaki: pivot di pinggul — celana, sepatu
    this.legL = this._limb(g, -0.155, 0.82, 0, M, true);
    this.legR = this._limb(g, 0.155, 0.82, 0, M, true);
  };

  // Membuat lengan (isArm=true) atau kaki (isArm=false) dengan pivot.
  Player.prototype._limb = function (parent, px, py, pz, M, isLeg) {
    var pivot = new THREE.Group();
    pivot.position.set(px, py, pz);
    parent.add(pivot);

    function add(geo, mat, x, y, z) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      pivot.add(m);
      return m;
    }

    if (isLeg) {
      add(new THREE.CylinderGeometry(0.075, 0.088, 0.70, 10), M.pants, 0, -0.35, 0);
      var knee = add(new THREE.SphereGeometry(0.082, 10, 8), M.armor, 0, -0.36, 0.03);
      knee.scale.set(1.05, 0.75, 1.05);
      add(new THREE.BoxGeometry(0.17, 0.12, 0.27), M.boots, 0, -0.70, 0.04);
    } else {
      add(new THREE.CylinderGeometry(0.078, 0.088, 0.26, 10), M.shirt, 0, -0.13, 0);   // lengan baju
      add(new THREE.CylinderGeometry(0.062, 0.075, 0.30, 10), M.armor, 0, -0.40, 0);   // pelindung lengan bawah
      add(new THREE.SphereGeometry(0.072, 10, 8), M.glove, 0, -0.585, 0);              // sarung tangan
    }
    return pivot;
  };

  Player.prototype.getFocus = function (out) {
    return out.set(this.position.x, this.position.y + C.CAMERA.height, this.position.z);
  };

  /* Mulai ayunan pedang (kombo bergantian: tebas atas → samping → tusuk). */
  Player.prototype.attack = function () {
    if (this.attackCooldown > 0 || this.attackTimer > 0) return false;
    this.attackTimer = this.attackDuration;
    this.attackCooldown = 0.46;
    this._hitDone = false;
    if (this._comboTimer > 0) this.combo = (this.combo + 1) % 3;
    else this.combo = 0;
    this._comboTimer = 1.2;
    this._playAttackAnim(); // Tahap G5: animasi model 3D (bila model aktif)
    return true;
  };

  /* Terlempar menjauh (mis. dipukul babi hutan). */
  Player.prototype.knockback = function (dx, dz, force) {
    var d = Math.sqrt(dx * dx + dz * dz) || 1;
    this.velocity.x += (dx / d) * force;
    this.velocity.z += (dz / d) * force;
  };

  /* ---------- Update tiap frame ---------- */
  Player.prototype.update = function (dt, cameraYaw, controlsEnabled) {
    var P = C.PLAYER;
    var f = 0, s = 0;
    if (controlsEnabled) {
      if (Input.isDown('KeyW') || Input.isDown('ArrowUp')) f += 1;
      if (Input.isDown('KeyS') || Input.isDown('ArrowDown')) f -= 1;
      if (Input.isDown('KeyD') || Input.isDown('ArrowRight')) s += 1;
      if (Input.isDown('KeyA') || Input.isDown('ArrowLeft')) s -= 1;
    }
    var run = controlsEnabled &&
      (this.sprintLock || Input.isDown('ShiftLeft') || Input.isDown('ShiftRight'));

    // Arah relatif kamera. "Kanan layar" = f x up = (-cos, 0, sin).
    this._forward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    this._right.set(-Math.cos(cameraYaw), 0, Math.sin(cameraYaw));
    this._wish.set(0, 0, 0)
      .addScaledVector(this._forward, f)
      .addScaledVector(this._right, s);
    var moving = this._wish.lengthSq() > 0.0001;
    if (moving) this._wish.normalize();

    var wasSwimming = this.swimming;
    var targetSpeed = moving
      ? (wasSwimming ? (run ? P.swimRunSpeed : P.swimSpeed) : (run ? P.runSpeed : P.walkSpeed))
      : 0;
    var accel = (wasSwimming ? P.swimAccel : P.accel) * (moving ? 1 : 1.8);
    this.velocity.x = U.approach(this.velocity.x, this._wish.x * targetSpeed, accel * dt);
    this.velocity.z = U.approach(this.velocity.z, this._wish.z * targetSpeed, accel * dt);

    // Lompat (tidak bisa melompat saat mengambang)
    if (controlsEnabled && Input.isDown('Space') && this.groundedTimer > 0 && !wasSwimming) {
      this.velocity.y = P.jumpSpeed;
      this.grounded = false;
      this.groundedTimer = 0;
    }

    var dx = this.velocity.x * dt;
    var dz = this.velocity.z * dt;
    // Pecah langkah saat lari cepat / fps rendah agar tidak menembus dinding
    // tipis. Pada kecepatan normal biasanya hanya satu sub-langkah.
    var stepLen = Math.sqrt(dx * dx + dz * dz);
    var steps = Math.max(1, Math.ceil(stepLen / 0.35));
    for (var step = 0; step < steps; step++) {
      // Laut terbuka: tidak ada dinding kedalaman maupun batas peta. Perahu,
      // pulau kecil, dan samudra luar semuanya dapat dijelajahi.
      this.position.x += dx / steps;
      this.position.z += dz / steps;
      this._collide();
    }

    var terrain = this.world.groundHeight(this.position.x, this.position.z);
    var waterY = this.world.waterLevelAt
      ? this.world.waterLevelAt(this.position.x, this.position.z, this.world.elapsed || 0)
      : (this.world.waveHeight
        ? this.world.waveHeight(this.position.x, this.position.z, this.world.elapsed || 0)
        : ((C.WATER && C.WATER.level) || 0));
    var support = this.world.supportHeight
      ? this.world.supportHeight(this.position.x, this.position.z, this.position.y)
      : terrain;
    var deepWater = terrain < waterY - P.swimDepth && support <= terrain + 0.05;

    // Naik otomatis ke dek rendah (dermaga/pelabuhan) saat berenang di sisinya.
    var climbTop = null;
    if (wasSwimming && this.position.y < waterY + 0.35) {
      var probe = this.world.supportHeight
        ? this.world.supportHeight(this.position.x, this.position.z, waterY + P.swimClimb)
        : terrain;
      if (probe > waterY + 0.12 && probe <= waterY + P.swimClimb) climbTop = probe;
    }

    if (climbTop !== null) {
      this.position.y = climbTop;
      this.velocity.y = 0;
      this.swimming = false;
      this.grounded = true;
      this.groundedTimer = 0.12;
    } else if (deepWater) {
      // Berenang: dada di atas air, kaki di bawah permukaan, mengikuti ombak.
      this.swimming = true;
      var swimY = waterY + P.swimOffset;
      if (this.position.y > swimY + 0.15) {
        // Masih jatuh dari ketinggian → masuk air, jangan berhenti di udara.
        this.velocity.y = Math.min(this.velocity.y, 0) - P.gravity * dt;
        this.position.y += this.velocity.y * dt;
        if (this.position.y <= swimY) {
          this.position.y = swimY;
          this.velocity.y = 0;
        }
      } else {
        this.velocity.y = 0;
        this.position.y += (swimY - this.position.y) * (1 - Math.exp(-8 * dt));
      }
      this.grounded = false;
      this.groundedTimer = 0;
    } else {
      this.swimming = false;
      this.velocity.y -= P.gravity * dt;
      this.position.y += this.velocity.y * dt;
      var ground = support;
      if (this.position.y <= ground) {
        // Naik ke lantai panggung/anak tangga: dihaluskan agar tidak menyentak
        var step = ground - this.position.y;
        if (this.grounded && step > 0.02 && step < 0.9) {
          this.position.y = Math.min(ground, this.position.y + Math.max(step * 9, 2.0) * dt);
        } else {
          this.position.y = ground;
        }
        if (this.position.y > ground) this.position.y = ground;
        this.velocity.y = 0;
        this.grounded = true;
        this.groundedTimer = 0.12;
      } else {
        var drop = this.position.y - ground;
        if (this.grounded && drop < 0.62 && this.velocity.y <= 0.01) {
          // Turun dari lantai panggung: tetap menempel tanah, tidak melayang
          this.position.y = Math.max(ground, this.position.y - Math.max(drop * 9, 2.0) * dt);
          this.velocity.y = 0;
          this.groundedTimer = 0.12;
        } else {
          this.grounded = false;
          this.groundedTimer -= dt;
        }
      }
    }

    // Hadapkan karakter ke arah gerak
    this.currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    if (moving && this.currentSpeed > 0.4) {
      var targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.yaw = U.lerpAngle(this.yaw, targetYaw, 1 - Math.exp(-P.turnSmooth * dt));
    }
    this.group.rotation.y = this.yaw;

    // Serangan: hitung waktu & picu momen tebasan di tengah ayunan
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (!this._hitDone && this.attackTimer <= this.attackDuration * 0.55) {
        this._hitDone = true;
        if (this.onSwingHit) this.onSwingHit();
      }
      if (this.attackTimer < 0) this.attackTimer = 0;
    }
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this._comboTimer > 0) this._comboTimer -= dt;

    this._animate(dt, run);
  };

  /* Naik perahu (Fase 5): posisi diatur perahu (Boat._placeRider); di sini
     hanya menghitung waktu serangan dan animasi berdiri di atas geladak. */
  Player.prototype.updateRiding = function (dt) {
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;
    this.swimming = false;
    this.grounded = true;
    this.groundedTimer = 0.12;

    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (!this._hitDone && this.attackTimer <= this.attackDuration * 0.55) {
        this._hitDone = true;
        if (this.onSwingHit) this.onSwingHit();
      }
      if (this.attackTimer < 0) this.attackTimer = 0;
    }
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this._comboTimer > 0) this._comboTimer -= dt;

    this._animate(dt, false);
  };

  // Dorong pemain keluar dari pohon/batu (lingkaran) & dinding rumah (segmen).
  Player.prototype._collide = function () {
    var cols = this.world.colliders;
    var px = this.position.x, pz = this.position.z;
    var i, c, dx, dz, rr, d2, d, push;
    if (cols && cols.length) {
      for (i = 0; i < cols.length; i++) {
        c = cols[i];
        dx = px - c.x; dz = pz - c.z;
        rr = c.r + 0.34;
        d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-8) {
          d = Math.sqrt(d2);
          push = (rr - d);
          px += (dx / d) * push;
          pz += (dz / d) * push;
        }
      }
    }
    var walls = this.world.walls;
    if (walls && walls.length) {
      for (i = 0; i < walls.length; i++) {
        var s = walls[i];
        var ex = s.x2 - s.x1, ez = s.z2 - s.z1;
        var len2 = ex * ex + ez * ez;
        var tt = len2 > 1e-8 ? ((px - s.x1) * ex + (pz - s.z1) * ez) / len2 : 0;
        tt = tt < 0 ? 0 : (tt > 1 ? 1 : tt);
        dx = px - (s.x1 + ex * tt);
        dz = pz - (s.z1 + ez * tt);
        rr = s.r + 0.34;
        d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) {
          if (d2 > 1e-8) {
            d = Math.sqrt(d2);
            push = (rr - d);
            px += (dx / d) * push;
            pz += (dz / d) * push;
          } else {
            // tepat di garis dinding: dorong tegak lurus
            d = Math.sqrt(len2) || 1;
            px += (-ez / d) * rr;
            pz += (ex / d) * rr;
          }
        }
      }
    }
    this.position.x = px;
    this.position.z = pz;
  };

  /* ---------- Animasi ---------- */
  Player.prototype._animate = function (dt, run) {
    if (this.mixer) { this._animateModel(dt, run); return; } // model 3D aktif
    var speedRatio = U.clamp(this.currentSpeed / C.PLAYER.walkSpeed, 0, 1.5);

    if (this.grounded && speedRatio > 0.05) {
      this.walkPhase += dt * (7 + 6 * speedRatio) * (run ? 1.15 : 1);
    } else if (this.grounded) {
      this.walkPhase += dt * 2;
    }

    var swing = Math.sin(this.walkPhase) * 0.8 * U.clamp(speedRatio, 0, 1.2);

    if (this.swimming) {
      // Gaya dada sederhana: lengan ke depan bergantian, kaki menendang.
      this.walkPhase += dt * (3.5 + 5.5 * U.clamp(speedRatio, 0, 1.2));
      var stroke = Math.sin(this.walkPhase);
      this.armL.rotation.x = U.lerp(this.armL.rotation.x, -1.25 + stroke * 0.55, 0.24);
      this.armR.rotation.x = U.lerp(this.armR.rotation.x, -1.25 - stroke * 0.55, 0.24);
      this.armL.rotation.z = U.lerp(this.armL.rotation.z, 0.34, 0.2);
      this.armR.rotation.z = U.lerp(this.armR.rotation.z, -0.34, 0.2);
      this.legL.rotation.x = U.lerp(this.legL.rotation.x, 0.25 + stroke * 0.3, 0.22);
      this.legR.rotation.x = U.lerp(this.legR.rotation.x, 0.25 - stroke * 0.3, 0.22);
    } else if (!this.grounded) {
      this.armL.rotation.x = U.lerp(this.armL.rotation.x, -1.0, 0.2);
      this.armR.rotation.x = U.lerp(this.armR.rotation.x, -1.0, 0.2);
      this.legL.rotation.x = U.lerp(this.legL.rotation.x, 0.45, 0.2);
      this.legR.rotation.x = U.lerp(this.legR.rotation.x, -0.25, 0.2);
    } else {
      this.armL.rotation.x = swing;
      this.armR.rotation.x = -swing;
      this.legL.rotation.x = -swing * 1.15;
      this.legR.rotation.x = swing * 1.15;
      // Lengan sedikit terbuka ke samping agar natural
      var spread = 0.06 + 0.10 * speedRatio;
      this.armL.rotation.z = spread;
      this.armR.rotation.z = -spread;
    }

    // Fase 3: ayunan pedang menimpa pose lengan kanan & putaran badan
    if (this.attackTimer > 0) {
      var t = 1 - this.attackTimer / this.attackDuration; // 0..1
      var armZ = -0.06;
      var torsoY = 0;
      if (this.combo === 0) {
        // tebasan dari atas
        this.armR.rotation.x = t < 0.3
          ? U.lerp(-0.2, -2.35, t / 0.3)
          : U.lerp(-2.35, 0.75, (t - 0.3) / 0.7);
        torsoY = Math.sin(Math.min(t / 0.55, 1) * Math.PI) * 0.3;
      } else if (this.combo === 1) {
        // tebasan menyamping
        this.armR.rotation.x = -1.15;
        armZ = t < 0.3 ? U.lerp(-0.1, -1.05, t / 0.3) : U.lerp(-1.05, 0.5, (t - 0.3) / 0.7);
        torsoY = t < 0.3 ? U.lerp(0, 0.42, t / 0.3) : U.lerp(0.42, -0.48, (t - 0.3) / 0.7);
      } else {
        // tusukan ke depan
        this.armR.rotation.x = t < 0.25
          ? U.lerp(-0.2, -1.5, t / 0.25)
          : U.lerp(-1.5, -0.2, (t - 0.25) / 0.75);
        torsoY = Math.sin(t * Math.PI) * 0.1;
      }
      this.armR.rotation.z = armZ;
      this.torso.rotation.y = torsoY;
    } else {
      this.torso.rotation.y = U.approach(this.torso.rotation.y, 0, 6 * dt);
    }

    var bob = this.grounded
      ? Math.sin(this.walkPhase * 2) * 0.025 * speedRatio
      : 0;
    this.torso.position.y = 1.26 + bob;
  };

  /* ---------- Model 3D (Tahap G5) ----------
     Bila pustaka model tersedia, bentuk prosedural disembunyikan dan animasi
     dikendalikan AnimationMixer. Semua tempo gameplay (ayunan 0,36 dtk, momen
     tebasan 55%) tetap sama — hanya visualnya yang berganti. */

  Player.prototype.attachModel = function (lib, name) {
    if (this.mixer) return false; // sudah memakai model 3D
    if (!lib || !lib.has(name || 'knight')) return false;
    var spawned = lib.spawn(name || 'knight', { height: 1.95 });
    if (!spawned) return false;

    // Sembunyikan bentuk prosedural (disimpan agar bisa dikembalikan)
    this._procParts = this.group.children.slice();
    for (var i = 0; i < this._procParts.length; i++) this._procParts[i].visible = false;

    this.modelRoot = spawned.root;
    this.group.add(this.modelRoot);

    // Pedang dipindah ke tulang tangan kanan model (nama tulang tanpa titik:
    // three.js menyaring "handslot.r" menjadi "handslotr")
    var hand = null;
    spawned.root.traverse(function (o) {
      if (!hand && /^handslot[._]?r$/i.test(o.name)) hand = o;
    });
    if (!hand) {
      spawned.root.traverse(function (o) { if (!hand && /^hand[._]?r$/i.test(o.name)) hand = o; });
    }
    if (hand && this.sword) {
      this.armR.remove(this.sword);
      this.sword.position.set(0.02, 0.02, 0.0);
      this.sword.rotation.set(0, 0, Math.PI / 2); // bilah menggantung ke bawah dari telapak
      hand.add(this.sword);
    }

    // Animasi: idle / jalan / lari / lompat / tiga tebasan kombo
    this.mixer = new THREE.AnimationMixer(spawned.root);
    var mixer = this.mixer;
    function act(patterns, once) {
      var clip = global.AssetLibrary.findClip(spawned.clips, patterns);
      if (!clip) return null;
      var a = mixer.clipAction(clip);
      if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      return a;
    }
    var A = {
      idle: act(['(^|\\|)Idle$']),
      walk: act(['(^|\\|)Walking_A$', '(^|\\|)Walking_B$', '(^|\\|)Walk$']),
      run: act(['(^|\\|)Running_A$', '(^|\\|)Running_B$', '(^|\\|)Run$']),
      jump: act(['(^|\\|)Jump_Full_Short$', '(^|\\|)Jump_Start$'], true),
      attacks: [
        act(['1H_Melee_Attack_Chop'], true),
        act(['1H_Melee_Attack_Slice_Diagonal'], true),
        act(['1H_Melee_Attack_Stab'], true)
      ].filter(Boolean)
    };
    // Sesuaikan tempo klip agar pas dengan tempo tempur permainan
    for (var k = 0; k < A.attacks.length; k++) {
      A.attacks[k]._fit = U.clamp(A.attacks[k].getClip().duration / this.attackDuration, 1.4, 3.0);
    }
    this.act = A;
    this._currentAct = null;
    this._locoState = null;
    this._atkAction = null;
    if (A.idle) this._fadeTo(A.idle, 0.01);
    console.log('[Aetheria] Model pemain aktif (KayKit Knight — ksatria fajar)');
    return true;
  };

  Player.prototype._fadeTo = function (action, dur) {
    if (!action || action === this._currentAct) return;
    if (this._currentAct) this._currentAct.fadeOut(dur);
    action.reset().setEffectiveWeight(1).fadeIn(dur).play();
    this._currentAct = action;
  };

  Player.prototype._playAttackAnim = function () {
    if (!this.mixer || !this.act || !this.act.attacks.length) return;
    var a = this.act.attacks[this.combo % this.act.attacks.length];
    a.timeScale = a._fit || 2.2; // ayunan selesai tepat saat attackTimer habis
    a.reset();
    if (this._currentAct) this._currentAct.fadeOut(0.06);
    a.fadeIn(0.05).play();
    this._currentAct = a;
    this._atkAction = a;
  };

  Player.prototype._animateModel = function (dt, run) {
    var A = this.act;
    if (!A) return;
    this.mixer.update(dt);

    // Ayunan selesai → kembali ke gerak biasa
    if (this._atkAction && this.attackTimer <= 0) {
      this._atkAction = null;
      this._locoState = null;
    }
    if (this.attackTimer > 0) return; // pose serangan menguasai tubuh

    var speed = this.currentSpeed;
    var state;
    if (this.swimming) state = 'swim';
    else if (!this.grounded) state = 'air';
    else if (speed > C.PLAYER.walkSpeed * 1.02) state = 'run';
    else if (speed > 0.4) state = 'walk';
    else state = 'idle';

    if (state !== this._locoState) {
      var next = state === 'idle' ? A.idle : state === 'walk' ? A.walk :
                 state === 'run' ? A.run :
                 state === 'swim' ? (A.walk || A.idle) : A.jump;
      if (next) {
        this._fadeTo(next, state === 'air' ? 0.09 : 0.16);
        this._locoState = state;
      } else if (A.idle) {
        this._fadeTo(A.idle, 0.16);
        this._locoState = 'idle';
      }
    }

    // Sinkronkan langkah dengan kecepatan sebenarnya (biar tidak meluncur)
    if (this._locoState === 'walk' && A.walk) {
      A.walk.timeScale = U.clamp(speed / 3.6, 0.65, 1.7);
    } else if (this._locoState === 'run' && A.run) {
      A.run.timeScale = U.clamp(speed / 8.0, 0.7, 1.7);
    } else if (this._locoState === 'swim' && A.walk) {
      A.walk.timeScale = 0.72;
    }
  };

  global.Player = Player;
})(typeof window !== 'undefined' ? window : globalThis);
