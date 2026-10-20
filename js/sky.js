/* Langit (low-poly): kubah gradasi siang–malam + matahari/bulan/bintang/awan + cahaya. */
(function (global) {
  'use strict';
  var U = global.Utils;
  var C = global.CONFIG;

  function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  var NIGHT = { top: srgb(0x0B1030), bot: srgb(0x18244F) };
  var DAY = { top: srgb(0x3F7FD6), bot: srgb(0xA9D9F2) };
  var DUSK = { top: srgb(0x3D4A9E), bot: srgb(0xFF9D5C) };
  var SUN_WARM = srgb(0xFFB066);
  var SUN_WHITE = srgb(0xFFFFFF);

  function WorldSky(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer || null;
    this.rig = new THREE.Group();
    scene.add(this.rig);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.fogColor = new THREE.Color(0xA8D8F0).convertSRGBToLinear();
    this._tmpColor = new THREE.Color();
    this._tmpColor2 = new THREE.Color();
    this._cloudT = 0;
    this._cloudRng = U.mulberry32(C.WORLD.seed + 555);
    // Fase 5 (optimasi): texture IBL dipakai HANYA oleh material air/logam,
    // bukan scene.environment global — menghemat ±16 FPS di iGPU kelas bawah.
    this.envTexture = null;
    this.onEnvReady = null;
  }

  WorldSky.prototype.build = function () {
    var rig = this.rig;
    this._envEnabled = !!this.renderer; // refleksi lingkungan (PMREM) — dimatikan di preset Cepat
    this._envTimer = 0.5;
    this._envPeriod = 6;
    this._envRT = null;
    this._pmrem = null;
    this._envScene = null;

    // --- Kubah langit gradasi (warnanya dianimasikan mengikuti waktu) ---
    // Fase 5: gradasi dihitung dari arah lokal (bukan posisi dunia) agar tetap
    // benar meski pemain menjelajah jauh dari pusat pulau.
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: DAY.top.clone() },
        bottomColor: { value: DAY.bot.clone() },
        offset: { value: 60 },
        exponent: { value: 0.9 }
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main() {',
        '  vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 topColor;',
        'uniform vec3 bottomColor;',
        'uniform float offset;',
        'uniform float exponent;',
        'varying vec3 vDir;',
        'void main() {',
        '  float hgt = normalize(vDir + vec3(0.0, offset, 0.0) / 2100.0).y;',
        '  float t = pow(max(hgt, 0.0), exponent);',
        '  gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n'),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(2100, 32, 20), this.skyMat);
    this.skyDome.renderOrder = -1001;
    this.skyDome.name = 'sky';
    rig.add(this.skyDome);

    // --- Bintang ---
    var starCount = 700;
    var starPos = new Float32Array(starCount * 3);
    var rng = U.mulberry32(777);
    for (var i = 0; i < starCount; i++) {
      var theta = rng() * Math.PI * 2;
      var phi = Math.acos(rng() * 2 - 1);
      var r = 2050;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    var starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2.6, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false, fog: false
    });
    this.stars = new THREE.Points(starGeo, starMat);
    rig.add(this.stars);

    // --- Matahari & bulan ---
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(40, 12, 12),
      new THREE.MeshBasicMaterial({ color: srgb(0xFFF3C4), fog: false })
    );
    this.sunMesh.renderOrder = -999;
    rig.add(this.sunMesh);

    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(24, 12, 12),
      new THREE.MeshBasicMaterial({ color: srgb(0xE8F0FF), fog: false })
    );
    this.moonMesh.renderOrder = -999;
    rig.add(this.moonMesh);

    // Pendar matahari (canvas; dilewati di Node)
    if (typeof document !== 'undefined' && document.createElement) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      var ctx = cv.getContext('2d');
      var grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,250,230,1)');
      grad.addColorStop(0.3, 'rgba(255,240,200,0.45)');
      grad.addColorStop(1, 'rgba(255,235,180,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      var tex = new THREE.CanvasTexture(cv);
      var gmat = new THREE.SpriteMaterial({
        map: tex, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, fog: false
      });
      this.sunGlow = new THREE.Sprite(gmat);
      this.sunGlow.scale.set(520, 520, 1);
      this.sunGlow.renderOrder = -998;
      rig.add(this.sunGlow);
    }

    // --- Awan (tertiup angin; alasnya rata supaya rapi) ---
    var cloudMat = new THREE.MeshLambertMaterial({
      color: srgb(0xFFFFFF),
      // Emissive dingin menutup pantulan hijau hemisphere di alas awan agar
      // tidak tampak seperti pulau melayang.
      emissive: srgb(0xAFC4D8), emissiveIntensity: 0.42,
      transparent: true, opacity: 0.92, fog: false
    });
    var puffGeo = new THREE.SphereGeometry(1, 7, 5);
    var clouds = new THREE.Group();
    var cloudData = [];
    var crand = U.mulberry32(C.WORLD.seed + 313);
    for (var ci = 0; ci < 16; ci++) {
      var cluster = new THREE.Group();
      var puffs = 5 + ((crand() * 4) | 0);
      for (var p = 0; p < puffs; p++) {
        var puff = new THREE.Mesh(puffGeo, cloudMat);
        var sc = 26 + crand() * 46;                   // Fase 5: awan lebih besar (dunia luas)
        var px = (crand() - 0.5) * 210;
        // Puff duduk di alas datar cluster (bukan bola acak) — siluet lebih rapi
        puff.position.set(px, sc * 0.12 + crand() * sc * 0.26, (crand() - 0.5) * 110);
        puff.scale.set(sc * (1 + crand() * 0.6), sc * 0.34, sc * (0.8 + crand() * 0.5));
        cluster.add(puff);
      }
      var ang = crand() * Math.PI * 2;
      var dist = 420 + crand() * 1350;                // menjauh: tetap di atas cakrawala
      cluster.position.set(Math.cos(ang) * dist, 420 + crand() * 260, Math.sin(ang) * dist);
      clouds.add(cluster);
      cloudData.push({ obj: cluster, speed: 7 + crand() * 9, baseY: cluster.position.y, bob: crand() * Math.PI * 2 });
    }
    this.clouds = clouds;
    this.cloudData = cloudData;
    this.scene.add(clouds);

    // --- Cahaya ---
    this.hemi = new THREE.HemisphereLight(srgb(0xBFD9F5), srgb(0x6F9A5F), 0.5);
    this.scene.add(this.hemi);

    this.sunLight = new THREE.DirectionalLight(0xFFFFFF, 1.15);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = (C.RENDER && C.RENDER.shadowMap) || 1024;
    this.sunLight.shadow.mapSize.height = this.sunLight.shadow.mapSize.width;
    var sc2 = this.sunLight.shadow.camera;
    sc2.left = -62; sc2.right = 62; sc2.top = 62; sc2.bottom = -62; // Fase 5: cukup untuk medan sekitar pemain
    sc2.near = 1; sc2.far = 560;
    sc2.updateProjectionMatrix();
    this.sunLight.shadow.bias = -0.0002;
    this.sunLight.shadow.normalBias = 0.4;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.moonLight = new THREE.DirectionalLight(srgb(0x9FB4FF), 0);
    this.scene.add(this.moonLight);
    this.scene.add(this.moonLight.target);
  };

  /* ---------- Refleksi lingkungan (PMREM) dari kubah langit ----------
     Dipakai scene.environment agar air & logam memantulkan langit.
     Diperbarui berkala (murah: hanya kubah langit yang di-render). */
  WorldSky.prototype.setEnvEnabled = function (on) {
    this._envEnabled = !!on && !!this.renderer && !!THREE.PMREMGenerator;
    if (this._envEnabled) {
      this._envTimer = 0.1;
    } else {
      if (this.scene) this.scene.environment = null;
      this.envTexture = null;
      if (this.onEnvReady) this.onEnvReady(null);
    }
  };

  WorldSky.prototype._buildEnv = function () {
    if (!this.renderer || !THREE.PMREMGenerator) return;
    try {
      if (!this._envScene) {
        this._envScene = new THREE.Scene();
        this._envDome = new THREE.Mesh(this.skyDome.geometry, this.skyMat);
        this._envScene.add(this._envDome);
      }
      if (!this._pmrem) this._pmrem = new THREE.PMREMGenerator(this.renderer);
      var old = this._envRT;
      this._envRT = this._pmrem.fromScene(this._envScene, 0.02, 1, 4000);
      if (old) old.dispose();
      // Fase 5: jangan pasang ke scene.environment (IBL global mahal di iGPU).
      // Simpan teksturnya; world.js memberikannya ke material air saja.
      this.scene.environment = null;
      this.envTexture = this._envRT.texture;
      if (this.onEnvReady) this.onEnvReady(this.envTexture);
    } catch (e) {
      this._envEnabled = false; // jangan coba lagi kalau gagal
      if (window.console) console.warn('[Pulau Nusantara] Env map gagal:', e && e.message);
    }
  };

  WorldSky.prototype.update = function (dt, camera, timeOfDay) {
    var ang = (timeOfDay - 0.25) * Math.PI * 2;
    var sd = this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.32).normalize();
    var sunY = sd.y;

    var day = U.smoothstep(-0.06, 0.28, sunY);
    var dusk = 1 - U.smoothstep(0.06, 0.45, Math.abs(sunY));
    var night = 1 - day;

    // Kubah langit: malam → siang → senja
    var topN = this._tmpColor.copy(NIGHT.top).lerp(DAY.top, day).lerp(DUSK.top, dusk * 0.6);
    var botN = this._tmpColor2.copy(NIGHT.bot).lerp(DAY.bot, day).lerp(DUSK.bot, dusk * 0.9);
    this.skyMat.uniforms.topColor.value.copy(topN);
    this.skyMat.uniforms.bottomColor.value.copy(botN);

    // Matahari & bulan
    this.sunMesh.position.copy(sd).multiplyScalar(2000);
    this.sunMesh.visible = sunY > -0.18;
    if (this.sunGlow) {
      this.sunGlow.position.copy(this.sunMesh.position);
      this.sunGlow.visible = sunY > 0.02;
    }
    this.moonMesh.position.copy(sd).multiplyScalar(-2000);
    this.moonMesh.visible = sunY < 0.18;
    this.stars.material.opacity = U.clamp(night * 1.5 - 0.25, 0, 0.9) * 0.9;

    // Awan tertiup angin (+x), naik-turun pelan, lalu berputar ulang di sisi lain
    if (this.clouds) {
      this._cloudT += dt;
      var span = 2600;
      for (var ci2 = 0; ci2 < this.cloudData.length; ci2++) {
        var cd = this.cloudData[ci2];
        cd.obj.position.x += cd.speed * dt;
        cd.obj.position.y = cd.baseY + Math.sin(this._cloudT * 0.1 + cd.bob) * 10;
        if (cd.obj.position.x > span) {
          cd.obj.position.x = -span;
          cd.obj.position.z = (this._cloudRng() * 2 - 1) * 1900;
          cd.baseY = 420 + this._cloudRng() * 260;
          cd.speed = 7 + this._cloudRng() * 9;
        }
      }
    }

    // Kabut mengikuti cakrawala
    var bot = this._tmpColor2.set(NIGHT.bot.r, NIGHT.bot.g, NIGHT.bot.b)
      .lerp(DAY.bot, day).lerp(DUSK.bot, dusk * 0.9);
    this.fogColor.copy(bot).lerp(topN, 0.22);

    // Cahaya utama
    var anchor = camera.position;
    var sunIntensity = U.smoothstep(-0.02, 0.12, sunY) * 1.7;
    this.sunLight.intensity = sunIntensity;
    this.sunLight.visible = sunIntensity > 0.01;
    this.sunLight.color.copy(SUN_WARM).lerp(SUN_WHITE, U.smoothstep(0.12, 0.5, sunY));
    this.sunLight.position.copy(anchor).addScaledVector(sd, 260);
    this.sunLight.target.position.copy(anchor);

    this.moonLight.intensity = 0.16 * night;
    this.moonLight.visible = night > 0.05;
    this.moonLight.position.copy(anchor).addScaledVector(sd, -180);
    this.moonLight.target.position.copy(anchor);

    this.hemi.intensity = 0.08 + 0.22 * day;
    this.hemi.color.copy(bot);

    // Rig mengikuti kamera
    this.rig.position.copy(camera.position);

    // Refleksi lingkungan diperbarui berkala (langit berubah mengikuti waktu)
    if (this._envEnabled) {
      this._envTimer -= dt;
      if (this._envTimer <= 0) {
        this._envTimer = this._envPeriod;
        this._buildEnv();
      }
    }
  };

  global.WorldSky = WorldSky;
})(typeof window !== 'undefined' ? window : globalThis);
