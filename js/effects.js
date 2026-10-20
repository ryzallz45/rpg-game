/* Fase 4: efek partikel sederhana — percikan saat menebas, debu langkah,
   pendar naik level, dan gelombang cincin. Satu THREE.Points berisi pool
   partikel (tanpa tekstur berkas) + tiga cincin; aman diuji di Node. */
(function (global) {
  'use strict';

  var MAX = 260;
  var RINGS = 3;
  var THREE = global.THREE || null;

  function Effects() {
    this.scene = null;
    this.points = null;
    this.rings = [];
    this._t = 0;
    this._cursor = 0;

    this.pos = null;
    this.vel = null;
    this.life = null;
    this.maxLife = null;
    this.grav = null;
    this.colR = null;
    this.colG = null;
    this.colB = null;
  }

  function makeSprite() {
    if (typeof document === 'undefined') return null;
    try {
      var cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 64;
      var c = cv.getContext('2d');
      var grad = c.createRadialGradient(32, 32, 0, 32, 32, 31);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.82)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grad;
      c.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(cv);
    } catch (e) {
      return null;
    }
  }

  Effects.prototype.init = function (scene) {
    if (!THREE || !scene) return false;
    if (this.scene === scene && this.points) return true;
    this.scene = scene;

    var i, n = MAX;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.colR = new Float32Array(n);
    this.colG = new Float32Array(n);
    this.colB = new Float32Array(n);
    var colors = new Float32Array(n * 3);
    for (i = 0; i < n; i++) this.pos[i * 3 + 1] = -9999;

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.colors = colors;

    var mat = new THREE.PointsMaterial({
      size: 0.26,
      map: makeSprite(),
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.scene.add(this.points);

    var ringGeo = new THREE.RingGeometry(0.72, 1, 44);
    for (i = 0; i < RINGS; i++) {
      var rm = new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false
      });
      var mesh = new THREE.Mesh(ringGeo, rm);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      this.scene.add(mesh);
      this.rings.push({ mesh: mesh, mat: rm, life: 0, max: 0.7, size: 2.4 });
    }
    this._cursor = 0;
    return true;
  };

  /* Satu ledakan partikel. opts: color, count, speed, up, gravity, life. */
  Effects.prototype.burst = function (x, y, z, opts) {
    if (!this.points || !this.pos) return;
    opts = opts || {};
    var count = Math.max(1, Math.min(opts.count || 10, MAX));
    var color = new THREE.Color(opts.color !== undefined ? opts.color : 0xffb36b);
    var speed = opts.speed !== undefined ? opts.speed : 3;
    var up = opts.up !== undefined ? opts.up : 2;
    var gravity = opts.gravity !== undefined ? opts.gravity : 9;
    var life = opts.life !== undefined ? opts.life : 0.6;
    var spread = opts.spread !== undefined ? opts.spread : 1;

    for (var k = 0; k < count; k++) {
      var i = this._cursor;
      this._cursor = (this._cursor + 1) % MAX;
      var a = Math.random() * Math.PI * 2;
      var r = 0.35 + Math.random() * 0.65;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.22;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.16;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.22;
      this.vel[i * 3] = Math.cos(a) * speed * r * spread;
      this.vel[i * 3 + 1] = up * (0.4 + Math.random() * 0.75);
      this.vel[i * 3 + 2] = Math.sin(a) * speed * r * spread;
      this.maxLife[i] = life * (0.7 + Math.random() * 0.6);
      this.life[i] = this.maxLife[i];
      this.grav[i] = gravity;
      this.colR[i] = color.r;
      this.colG[i] = color.g;
      this.colB[i] = color.b;
    }
  };

  /* Debu kecil di kaki (dipanggil saat berjalan/berlari). */
  Effects.prototype.dust = function (x, y, z, count) {
    this.burst(x, y, z, {
      color: 0xbaa681,
      count: count || 2,
      speed: 0.35,
      up: 0.45,
      gravity: 0.45,
      life: 0.65
    });
  };

  /* Cincin gelombang horizontal (naik level / musuh tumbang). */
  Effects.prototype.ring = function (x, y, z, color, size) {
    if (!this.rings.length) return;
    var pick = null;
    for (var i = 0; i < this.rings.length; i++) {
      if (this.rings[i].life <= 0) { pick = this.rings[i]; break; }
    }
    if (!pick) pick = this.rings[0];
    pick.mesh.position.set(x, y, z);
    pick.mesh.scale.set(0.6, 0.6, 0.6);
    pick.mesh.visible = true;
    pick.mat.color.setHex(color !== undefined ? color : 0xffd166);
    pick.mat.opacity = 0.6;
    pick.life = 0.65;
    pick.max = 0.65;
    pick.size = size !== undefined ? size : 2.4;
  };

  Effects.prototype.levelUp = function (x, y, z) {
    this.burst(x, y + 1.1, z, {
      color: 0xffd166, count: 34, speed: 2.8, up: 5.2,
      gravity: 2.2, life: 1.15
    });
    this.ring(x, y + 0.12, z, 0xffd166, 3.2);
  };

  Effects.prototype.hit = function (x, y, z, died) {
    if (died) {
      this.burst(x, y + 0.85, z, {
        color: 0xffcf6b, count: 18, speed: 4.4, up: 3.2,
        gravity: 10, life: 0.7
      });
      this.ring(x, y + 0.12, z, 0xffd166, 1.9);
    } else {
      this.burst(x, y + 0.9, z, {
        color: 0xffa15c, count: 9, speed: 3.2, up: 2.1,
        gravity: 10, life: 0.48
      });
    }
  };

  Effects.prototype.update = function (dt) {
    if (!this.points || !this.pos) return;
    this._t += dt;
    var p = this.pos, v = this.vel, life = this.life, max = this.maxLife;
    var g = this.grav, cr = this.colR, cg = this.colG, cb = this.colB;
    var colors = this.colors;
    var n = MAX;

    for (var i = 0; i < n; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) {
        life[i] = 0;
        p[i * 3 + 1] = -9999;
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0;
        continue;
      }
      v[i * 3 + 1] -= g[i] * dt;
      // Redaman horizontal ringan agar percikan tidak melesat terlalu jauh.
      var damp = Math.max(0, 1 - 1.6 * dt);
      v[i * 3] *= damp;
      v[i * 3 + 2] *= damp;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      var f = life[i] / (max[i] || 1);
      f = f * f;
      colors[i * 3] = cr[i] * f;
      colors[i * 3 + 1] = cg[i] * f;
      colors[i * 3 + 2] = cb[i] * f;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    for (var r = 0; r < this.rings.length; r++) {
      var ring = this.rings[r];
      if (ring.life <= 0) continue;
      ring.life -= dt;
      if (ring.life <= 0) {
        ring.life = 0;
        ring.mesh.visible = false;
        ring.mat.opacity = 0;
        continue;
      }
      var t = 1 - ring.life / ring.max;
      var sc = 0.6 + t * ring.size;
      ring.mesh.scale.set(sc, sc, sc);
      ring.mat.opacity = Math.max(0, 0.55 * (1 - t) * (1 - t));
    }
  };

  Effects.prototype.countActive = function () {
    var n = 0;
    if (!this.life) return 0;
    for (var i = 0; i < this.life.length; i++) if (this.life[i] > 0) n++;
    return n;
  };

  Effects.prototype.clear = function () {
    if (!this.pos) return;
    for (var i = 0; i < MAX; i++) {
      this.life[i] = 0;
      this.pos[i * 3 + 1] = -9999;
      this.colors[i * 3] = this.colors[i * 3 + 1] = this.colors[i * 3 + 2] = 0;
    }
    for (var r = 0; r < this.rings.length; r++) {
      this.rings[r].life = 0;
      this.rings[r].mesh.visible = false;
      this.rings[r].mat.opacity = 0;
    }
    if (this.points) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  };

  global.Effects = new Effects();
  global.EffectSystem = Effects;
})(typeof window !== 'undefined' ? window : globalThis);
