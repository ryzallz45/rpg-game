/* Pelabuhan & perahu (Fase 5): dermaga kayu di pantai + perahu cadik yang bisa
   dinaiki (E) dan dikemudikan (W/S/A/D). Perahu memakai gelombang air yang sama
   dengan shader laut (world.waveHeight). Tanpa DOM — aman diuji di Node. */
(function (global) {
  'use strict';
  var U = global.Utils;
  var C = global.CONFIG;

  function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function smat(hex, rough) {
    return new THREE.MeshStandardMaterial({
      color: srgb(hex),
      roughness: rough === undefined ? 0.9 : rough,
      metalness: 0
    });
  }

  var DECK_Y = 1.15;   // tinggi permukaan dek dermaga di atas air
  var RIDER_Y = 0.30;  // kaki pemain di atas titik pusat lambung

  function Boat(scene, world) {
    this.scene = scene;
    this.world = world;
    this.spot = world.harborSpot || { x: 380, z: 0, ang: 0, dirX: 1, dirZ: 0, coast: 380, dockLen: 26 };
    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    this.position = this.group.position;
    this.yaw = Math.atan2(this.spot.dirX || 1, this.spot.dirZ || 0);
    this.dockYaw = this.yaw; // arah tetap dermaga (spot.ang = sudut polar pantai)
    this.speed = 0;
    this.boarded = false;
    this.dockGroup = null;
    this.dockPlatform = null;
    this.lampMat = null;
    this._wakeT = 0;

    // Tambatan awal: sejajar dermaga, di sisi kanan (lokal +x), agak ke ujung.
    var s = this.spot;
    var fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    var rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    this.moor = {
      x: s.x + fx * 23.5 + rx * 2.6,
      z: s.z + fz * 23.5 + rz * 2.6,
      yaw: this.yaw
    };
  }

  Boat.prototype.build = function () {
    this._buildDock();
    this._buildBoatMesh();
    this.scene.add(this.group);
    this.setPose(this.moor.x, this.moor.z, this.moor.yaw, false);
    this._sampleWaves();
  };

  /* ---------- Dermaga ---------- */
  Boat.prototype._buildDock = function () {
    var world = this.world, s = this.spot;
    var ry = this.dockYaw;
    var g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    g.rotation.y = ry;

    var wood = smat(0x8A6A46, 0.95);
    var woodDark = smat(0x6E5236, 0.95);
    var plank = smat(0x9A7850, 0.95);
    if (global.TexLib) {
      global.TexLib.apply(wood, 'wood', 1, 3);
      global.TexLib.apply(woodDark, 'wood', 1, 2);
      global.TexLib.apply(plank, 'plank', 2, 6);
    }

    function box(mat, w, h, d, x, y, z, ry2) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (ry2) m.rotation.y = ry2;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    }

    // Dek: dari ujung jembatan (lokal z = -2) sampai ujung (z = +26)
    var len = 28, hd = len / 2, zc = (s.dockLen - 2) / 2; // pusat lokal z = 12
    box(plank, 3.2, 0.16, len, 0, DECK_Y - 0.08, zc);
    box(wood, 0.16, 0.24, len, -1.55, DECK_Y + 0.1, zc);   // bibir kayu kiri
    box(wood, 0.16, 0.24, len, 1.55, DECK_Y + 0.1, zc);    // bibir kayu kanan

    // Jembatan dari pasir ke dek. Dermaga lama mulai 4,5 m di atas air tanpa
    // sambungan ke pantai (tangga kecilnya pun berada di atas air), sehingga
    // pelabuhan terasa seperti dinding tak terlihat. Jembatan ini menghubungkan
    // garis pantai (lokal z ≈ -8,6) ke dek utama (lokal z = -2).
    var landingLx = 0, landingLz = -5.0;
    var landingTop = 0.82, landingHw = 1.6, landingHd = 3.6;
    box(plank, landingHw * 2, 0.16, landingHd * 2, landingLx, landingTop - 0.08, landingLz);
    box(wood, 0.16, 0.2, landingHd * 2, landingLx - landingHw + 0.08, landingTop + 0.04, landingLz);
    box(wood, 0.16, 0.2, landingHd * 2, landingLx + landingHw - 0.08, landingTop + 0.04, landingLz);
    var landingPostGeo = new THREE.CylinderGeometry(0.13, 0.16, 3.4, 7);
    var landingPosts = [
      [landingLx - landingHw + 0.2, landingLz - landingHd + 0.2],
      [landingLx - landingHw + 0.2, landingLz + landingHd - 0.2],
      [landingLx + landingHw - 0.2, landingLz - landingHd + 0.2],
      [landingLx + landingHw - 0.2, landingLz + landingHd - 0.2]
    ];
    for (var lp = 0; lp < landingPosts.length; lp++) {
      var lpost = new THREE.Mesh(landingPostGeo, woodDark);
      lpost.position.set(landingPosts[lp][0], landingTop - 1.62, landingPosts[lp][1]);
      lpost.castShadow = true;
      g.add(lpost);
    }

    // Tiang pancang
    var postGeo = new THREE.CylinderGeometry(0.17, 0.2, 6.4, 8);
    for (var pi = 0; pi <= 5; pi++) {
      var pz = -1 + pi * 5.4;
      for (var side = -1; side <= 1; side += 2) {
        var post = new THREE.Mesh(postGeo, woodDark);
        post.position.set(side * 1.4, DECK_Y - 3.2, pz);
        post.castShadow = true;
        g.add(post);
      }
    }

    // Perabot dermaga: peti, tong, tiang lampu
    box(wood, 0.8, 0.8, 0.8, -0.95, DECK_Y + 0.4, 6.2, 0.3);
    var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.95, 10), woodDark);
    barrel.position.set(0.95, DECK_Y + 0.48, 5.1);
    barrel.castShadow = true;
    g.add(barrel);

    var lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.6, 8), woodDark);
    lampPost.position.set(-1.35, DECK_Y + 1.3, 24.4);
    lampPost.castShadow = true;
    g.add(lampPost);
    this.lampMat = new THREE.MeshStandardMaterial({
      color: srgb(0xFFE2A8), emissive: srgb(0xFFA64D), emissiveIntensity: 0.3, roughness: 0.5, metalness: 0
    });
    var lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), this.lampMat);
    lampHead.position.set(-1.35, DECK_Y + 2.66, 24.4);
    g.add(lampHead);

    this.scene.add(g);
    this.dockGroup = g;

    function at(lx, lz) {
      return { x: s.x + Math.cos(ry) * lx + Math.sin(ry) * lz, z: s.z - Math.sin(ry) * lx + Math.cos(ry) * lz };
    }

    // Platform jembatan didorong lebih dulu agar dek utama (lebih tinggi)
    // menang saat keduanya bersinggungan di tepi.
    var landingPos = at(landingLx, landingLz);
    this.dockLanding = {
      x: landingPos.x, z: landingPos.z, top: landingTop,
      hw: landingHw, hd: landingHd
    };
    world.platforms.push({
      x: landingPos.x, z: landingPos.z, hw: landingHw, hd: landingHd,
      cos: Math.cos(ry), sin: Math.sin(ry),
      top: landingTop, ceil: landingTop + 2.4, open: true
    });

    // Platform: dek bisa dipijak pemain (open: true → bukan ruang rumah)
    this.dockPlatform = {
      x: s.x + Math.sin(ry) * zc, z: s.z + Math.cos(ry) * zc,
      hw: 1.6, hd: hd,
      cos: Math.cos(ry), sin: Math.sin(ry),
      top: DECK_Y, ceil: DECK_Y + 2.6, open: true
    };
    world.platforms.push(this.dockPlatform);

    // Tabrakan: peti, tong, tiang lampu (dermaga tetap lapang untuk berjalan)
    var c1 = at(-0.95, 6.2), c2 = at(0.95, 5.1), c3 = at(-1.35, 24.4);
    world.colliders.push({ x: c1.x, z: c1.z, r: 0.7 });
    world.colliders.push({ x: c2.x, z: c2.z, r: 0.6 });
    world.colliders.push({ x: c3.x, z: c3.z, r: 0.3 });
  };

  /* ---------- Perahu cadik ---------- */
  Boat.prototype._buildBoatMesh = function () {
    var hull = smat(0x8A5A34, 0.92);
    var trim = smat(0x6B4A2F, 0.92);
    var seat = smat(0x9A7850, 0.95);
    var floatMat = smat(0xA9855C, 0.95);
    if (global.TexLib) {
      global.TexLib.apply(hull, 'wood', 1, 2);
      global.TexLib.apply(trim, 'wood', 1, 1.5);
      global.TexLib.apply(seat, 'plank', 1.5, 1);
      global.TexLib.apply(floatMat, 'wood', 1, 3);
    }
    var g = this.group;

    function add(geo, mat, x, y, z, patch) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      if (patch) patch(m);
      g.add(m);
      return m;
    }

    // Lambung + haluan/buritan lancip (kerucut 4 sisi, diputar rata)
    add(new THREE.BoxGeometry(1.05, 0.62, 3.5), hull, 0, 0.05, 0);
    var bowGeo = new THREE.ConeGeometry(0.68, 1.35, 4);
    bowGeo.rotateX(Math.PI / 2);
    bowGeo.rotateZ(Math.PI / 4);
    add(bowGeo, hull, 0, 0.05, 2.4);
    add(bowGeo, hull, 0, 0.05, -2.4, function (m) { m.rotation.y = Math.PI; });

    // Geladak tepi & bangku
    add(new THREE.BoxGeometry(0.1, 0.14, 3.4), trim, -0.5, 0.36, 0);
    add(new THREE.BoxGeometry(0.1, 0.14, 3.4), trim, 0.5, 0.36, 0);
    add(new THREE.BoxGeometry(0.98, 0.07, 0.3), seat, 0, 0.32, -1.15);
    add(new THREE.BoxGeometry(0.98, 0.07, 0.3), seat, 0, 0.32, 0.05);
    add(new THREE.BoxGeometry(0.98, 0.07, 0.3), seat, 0, 0.32, 1.2);

    // Kemudi & dayung cadangan
    add(new THREE.BoxGeometry(0.09, 0.09, 1.5), trim, 0, 0.5, -2.2, function (m) { m.rotation.x = 0.7; });
    add(new THREE.BoxGeometry(0.1, 0.03, 1.4), trim, 0.25, 0.4, -0.55, function (m) { m.rotation.y = 0.9; });

    // Cadik (satu pelampung di sisi laut) + palang
    add(new THREE.BoxGeometry(2.5, 0.12, 0.14), trim, 1.05, 0.34, -1.2);
    add(new THREE.BoxGeometry(2.5, 0.12, 0.14), trim, 1.05, 0.34, 1.2);
    add(new THREE.BoxGeometry(0.26, 0.26, 3.4), floatMat, 2.2, -0.06, 0);

    // Lentera haluan
    if (!this.lampMat) {
      this.lampMat = new THREE.MeshStandardMaterial({
        color: srgb(0xFFE2A8), emissive: srgb(0xFFA64D), emissiveIntensity: 0.3, roughness: 0.5, metalness: 0
      });
    }
    add(new THREE.CylinderGeometry(0.035, 0.05, 0.62, 6), trim, 0, 0.62, 1.95);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), this.lampMat);
    head.position.set(0, 0.96, 1.95);
    g.add(head);
  };

  /* Tinggi gelombang di sekitar lambung → naik-turun + oleng halus. */
  Boat.prototype._sampleWaves = function () {
    var w = this.world;
    if (!w || typeof w.waveHeight !== 'function') {
      this.position.y = 0;
      this.group.rotation.x = 0;
      this.group.rotation.z = 0;
      return;
    }
    var t = w.elapsed || 0;
    var fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    var rx = fz, rz = -fx; // vektor kanan (lokal +x)
    var x = this.position.x, z = this.position.z;
    var hF = w.waveHeight(x + fx * 2.1, z + fz * 2.1, t);
    var hB = w.waveHeight(x - fx * 2.1, z - fz * 2.1, t);
    var hR = w.waveHeight(x + rx * 0.6, z + rz * 0.6, t);
    var hL = w.waveHeight(x - rx * 0.6, z - rz * 0.6, t);
    var base = (hF + hB + hR + hL) / 4;
    var pitch = Math.atan2(hB - hF, 4.2) * 0.8;
    var roll = Math.atan2(hR - hL, 1.2) * 0.5;
    this.position.y = base + 0.06;
    this.group.rotation.y = this.yaw;
    this.group.rotation.x = U.clamp(pitch, -0.14, 0.14);
    this.group.rotation.z = U.clamp(roll, -0.12, 0.12);
  };

  /* Titik dek dermaga terdekat dari perahu (untuk turun dari perahu). */
  Boat.prototype._dockPoint = function () {
    var s = this.spot;
    // Dermaga tidak ikut berputar saat perahu berbelok: pakai arah dermaga,
    // bukan yaw perahu (bug lama membuat "dinding" maya ikut berputar).
    var ry = this.dockYaw;
    var cos = Math.cos(ry), sin = Math.sin(ry);
    var dx = this.position.x - s.x, dz = this.position.z - s.z;
    var lx = dx * cos - dz * sin;
    var lz = dx * sin + dz * cos;
    lx = U.clamp(lx, -1.1, 1.1);
    lz = U.clamp(lz, -1.2, (s.dockLen || 26) - 1.4);
    return {
      x: s.x + cos * lx + sin * lz,
      z: s.z - sin * lx + cos * lz,
      y: DECK_Y
    };
  };

  /* Boleh berlayar ke titik ini? (air cukup dalam + tidak menembus dermaga) */
  Boat.prototype._canMoveTo = function (x, z) {
    var w = this.world;
    var lim = C.BOAT.minDepth;
    var fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    var rx = fz, rz = -fx;
    var pts = [[0, 0], [2.0, 0], [-2.0, 0], [0, 0.7], [0, -0.7]];
    for (var i = 0; i < pts.length; i++) {
      var sx = x + fx * pts[i][0] + rx * pts[i][1];
      var sz = z + fz * pts[i][0] + rz * pts[i][1];
      if (w.groundHeight(sx, sz) > lim) return false;
    }
    // Dermaga = dinding fisik: jangan tembus dek. Orientasi memakai arah
    // dermaga (dockYaw), bukan yaw perahu yang berubah saat berbelok.
    var s = this.spot;
    var ry = this.dockYaw;
    var cos = Math.cos(ry), sin = Math.sin(ry);
    var dx = x - s.x, dz = z - s.z;
    var lx = dx * cos - dz * sin;
    var lz = dx * sin + dz * cos;
    if (Math.abs(lx) < 1.95 && lz > -2.4 && lz < 26.4) return false;
    return true;
  };

  /* Titik untuk turun: dek dermaga terdekat, air dangkal di sekitar perahu,
     atau laut terbuka (pemain akan berenang). */
  Boat.prototype._stepOffSpot = function () {
    var d = this._dockPoint();
    var dx = this.position.x - d.x, dz = this.position.z - d.z;
    if (dx * dx + dz * dz < 8 * 8) return { kind: 'dermaga', x: d.x, y: d.y, z: d.z };

    var w = this.world;
    var lim = C.BOAT.minDepth - 0.05;
    var fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    var rx = fz, rz = -fx;
    var cand = [
      [0, 0], [2.4, 0], [-2.4, 0], [0, 1.1], [0, -1.1], [1.7, 1.1], [1.7, -1.1]
    ];
    var i, x, z, g;
    for (i = 0; i < cand.length; i++) {
      x = this.position.x + fx * cand[i][0] + rx * cand[i][1];
      z = this.position.z + fz * cand[i][0] + rz * cand[i][1];
      g = w.groundHeight(x, z);
      if (g > lim) return { kind: 'air', x: x, y: g, z: z };
    }

    // Air dalam bukan lagi penghalang: turun ke sisi perahu lalu berenang.
    var waterY = w.waterLevelAt
      ? w.waterLevelAt(this.position.x, this.position.z, w.elapsed || 0)
      : (w.waveHeight
        ? w.waveHeight(this.position.x, this.position.z, w.elapsed || 0)
        : (C.WATER.level || 0));
    var sides = [[2.3, 0], [-2.3, 0], [0, 1.9], [0, -1.9], [1.9, 1.6], [1.9, -1.6]];
    for (i = 0; i < sides.length; i++) {
      x = this.position.x + fx * sides[i][0] + rx * sides[i][1];
      z = this.position.z + fz * sides[i][0] + rz * sides[i][1];
      g = w.groundHeight(x, z);
      if (g < waterY - 0.2) {
        return { kind: 'laut', x: x, y: waterY + C.PLAYER.swimOffset, z: z };
      }
    }
    return { kind: 'laut', x: this.position.x + rx * 2.3, z: this.position.z + rz * 2.3,
      y: waterY + C.PLAYER.swimOffset };
  };

  /* ---------- Naik / turun (tombol E) ---------- */
  Boat.prototype.findInteraction = function (player) {
    if (this.boarded) {
      return { kind: 'boat', prompt: 'Tekan <b class="ekey">E</b> — turun dari perahu (dermaga / laut)' };
    }
    var p = player.position;
    var dx = p.x - this.position.x, dz = p.z - this.position.z;
    var dy = p.y - this.position.y;
    var r = C.BOAT.boardRange;
    if (dx * dx + dz * dz < r * r && dy > -3.4 && dy < 3.4) {
      return { kind: 'boat', prompt: 'Tekan <b class="ekey">E</b> — naiki perahu' };
    }
    return null;
  };

  Boat.prototype.interact = function (player) {
    if (this.boarded) this.exit(player);
    else this.board(player);
  };

  Boat.prototype.board = function (player) {
    this.boarded = true;
    this.speed = 0;
    this._placeRider(player);
    player.velocity.set(0, 0, 0);
    player.grounded = true;
    if (global.AudioMan) global.AudioMan.sfx('click');
    if (global.UI) global.UI.toast('🛶 Perahu siap berlayar — W/S maju-mundur, A/D belok, E turun');
  };

  Boat.prototype.exit = function (player) {
    var spot = this._stepOffSpot();
    if (!spot) return false;
    player.position.set(spot.x, spot.y, spot.z);
    player.velocity.set(0, 0, 0);
    player.swimming = spot.kind === 'laut';
    player.grounded = !player.swimming;
    if (player.swimming) player.groundedTimer = 0;
    this.boarded = false;
    this.speed = 0;
    if (global.AudioMan) global.AudioMan.sfx('click');
    if (global.UI) {
      global.UI.toast(spot.kind === 'dermaga' ? '⚓ Turun di dermaga' :
        spot.kind === 'air' ? '🏝️ Turun di air dangkal — menepilah' :
        '🌊 Turun di laut — berenang');
    }
    return true;
  };

  /* Paksa turun (mis. pemain tewas / kembali ke pantai) — perahu tetap di tempat. */
  Boat.prototype.forceExit = function () {
    this.boarded = false;
    this.speed = 0;
  };

  /* Atur posisi & arah perahu (muat simpanan). */
  Boat.prototype.setPose = function (x, z, yaw, boarded) {
    if (isFinite(x) && isFinite(z)) { this.position.x = x; this.position.z = z; }
    if (isFinite(yaw)) {
      this.yaw = yaw;
      this.group.rotation.y = yaw;
    }
    // Jangan biarkan tersimpan di darat (simpanan lama/rusak) — kembalikan ke tambatan.
    if (this.world && typeof this.world.groundHeight === 'function' &&
        this.world.groundHeight(this.position.x, this.position.z) > C.BOAT.minDepth) {
      this.position.x = this.moor.x;
      this.position.z = this.moor.z;
      this.yaw = this.moor.yaw;
      this.group.rotation.y = this.yaw;
    }
    this.speed = 0;
    this.boarded = !!boarded;
  };

  Boat.prototype._placeRider = function (player) {
    var fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    player.position.set(
      this.position.x - fx * 0.45,
      this.position.y + RIDER_Y,
      this.position.z - fz * 0.45
    );
    player.yaw = this.yaw;
    player.group.rotation.y = this.yaw;
  };

  /* ---------- Update tiap frame ---------- */
  Boat.prototype.update = function (dt, player, driving, input) {
    var B = C.BOAT;
    if (driving && input) {
      var f = 0, s = 0;
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) f += 1;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) f -= 1;
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) s += 1;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) s -= 1;

      // Maju-mundur dengan akselerasi/deselerasi halus
      if (f > 0) this.speed = Math.min(this.speed + B.accel * dt, B.maxSpeed);
      else if (f < 0) this.speed = Math.max(this.speed - B.accel * dt, -B.maxReverse);
      else this.speed = U.approach(this.speed, 0, B.brake * dt);

      // Kemudi butuh laju
      if (s !== 0 && Math.abs(this.speed) > 0.25) {
        var grip = U.clamp(Math.abs(this.speed) / 3.5, 0.15, 1);
        this.yaw += s * B.turnRate * grip * dt * (this.speed < 0 ? -1 : 1);
      }

      var fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      var nx = this.position.x + fx * this.speed * dt;
      var nz = this.position.z + fz * this.speed * dt;

      // Tidak ada batas lingkaran: perahu bebas menyeberangi samudra terbuka.

      // Kandas / menembus dermaga → meluncur di sisinya, atau memantul pelan
      if (!this._canMoveTo(nx, nz)) {
        if (this._canMoveTo(nx, this.position.z)) {
          nz = this.position.z;
          this.speed *= 0.86;
        } else if (this._canMoveTo(this.position.x, nz)) {
          nx = this.position.x;
          this.speed *= 0.86;
        } else {
          nx = this.position.x;
          nz = this.position.z;
          this.speed = -this.speed * 0.25;
        }
      }
      this.position.x = nx;
      this.position.z = nz;

      // Jejak air di buritan saat melaju
      if (Math.abs(this.speed) > 2.5 && global.Effects) {
        this._wakeT -= dt;
        if (this._wakeT <= 0) {
          this._wakeT = 0.16;
          global.Effects.burst(
            this.position.x - fx * 2.3, 0.12, this.position.z - fz * 2.3,
            { color: 0xD8F2FF, count: 3, speed: 1.1, up: 1.6, gravity: 3, life: 0.6 }
          );
        }
      }
    } else {
      this.speed = U.approach(this.speed, 0, C.BOAT.brake * dt);
    }

    this._sampleWaves();
    if (this.boarded && player) this._placeRider(player);
  };

  Boat.DECK_Y = DECK_Y;
  global.Boat = Boat;
})(typeof window !== 'undefined' ? window : globalThis);
