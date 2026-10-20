/* Pustaka model 3D (Tahap G5) — KayKit Adventurers (manusia) & Quaternius
   (babi hutan), keduanya CC0. Perlu server lokal (jalankan.bat): di mode
   file:// peramban memblokir pembacaan berkas, jadi pemuatan dilewati dan
   game memakai bentuk prosedural seperti semula (fallback mulus). */
(function (global) {
  'use strict';

  var FILES = {
    barbarian: 'assets/models/Barbarian.glb',
    knight: 'assets/models/Knight.glb',
    mage: 'assets/models/Mage.glb',
    rogue: 'assets/models/Rogue.glb',
    hooded: 'assets/models/Rogue_Hooded.glb',
    boar: 'assets/models/Boar.glb'
  };

  /* Koreksi orientasi menghadap per-model (digeser bila hasil uji visual perlu). */
  var FIX = {
    barbarian: { yaw: 0 }, knight: { yaw: 0 }, mage: { yaw: 0 },
    rogue: { yaw: 0 }, hooded: { yaw: 0 }, boar: { yaw: 0 }
  };

  /* Cari klip animasi berdasarkan daftar pola regex (berurut prioritas). */
  function findClip(clips, patterns) {
    if (!clips || !clips.length || !patterns) return null;
    for (var p = 0; p < patterns.length; p++) {
      var re = new RegExp(patterns[p], 'i');
      for (var i = 0; i < clips.length; i++) {
        if (re.test(clips[i].name)) return clips[i];
      }
    }
    return null;
  }

  function AssetLibrary() {
    this.models = {};
    this.ready = false;
    this.failed = [];
    this.error = null;
  }

  AssetLibrary.prototype.has = function (name) { return !!this.models[name]; };

  /* Muat semua model (Promise — dipakai sistem pemuatan bertahap main.js). */
  AssetLibrary.prototype.load = function (onProgress) {
    var self = this;
    return new Promise(function (resolve) {
      try {
        if (typeof location !== 'undefined' && location.protocol === 'file:') {
          self.error = 'file';
          console.warn('[Aetheria] Mode file:// — model 3D dilewati. Jalankan jalankan.bat untuk grafis penuh.');
          resolve(self);
          return;
        }
        if (!THREE.GLTFLoader) { self.error = 'lib'; resolve(self); return; }
        var loader = new THREE.GLTFLoader();
        var names = Object.keys(FILES);
        var pending = names.length, done = 0;
        var step = function () {
          if (--pending > 0) return;
          self.ready = true;
          console.log('[Aetheria] Model 3D siap: ' + Object.keys(self.models).length + '/' + names.length +
            (self.failed.length ? ' (gagal: ' + self.failed.join(', ') + ')' : ''));
          resolve(self);
        };
        names.forEach(function (name) {
          loader.load(FILES[name], function (gltf) {
            var src = gltf.scene;
            src.updateMatrixWorld(true);
            self.models[name] = {
              scene: src,
              clips: gltf.animations || [],
              box: new THREE.Box3().setFromObject(src)
            };
            done++;
            if (onProgress) onProgress(done, names.length, name);
            step();
          }, undefined, function () {
            self.failed.push(name);
            step();
          });
        });
      } catch (e) {
        self.error = (e && e.message) || 'gagal';
        if (global.console) console.warn('[Aetheria] Model 3D gagal dimuat:', self.error);
        resolve(self);
      }
    });
  };

  /* Klon satu model untuk dipakai di dunia.
     opts: { height, tint, cloneMaterials, yaw }
     Mengembalikan { root, clips, mats } — root = grup pembungkus (kaki di y=0,
     tinggi ternormalisasi, menghadap +Z). mats format kedip-merah musuh. */
  AssetLibrary.prototype.spawn = function (name, opts) {
    var src = this.models[name];
    if (!src || !THREE.SkeletonUtils) return null;
    opts = opts || {};
    var root = THREE.SkeletonUtils.clone(src.scene);
    var box = src.box;
    var h = Math.max(0.01, box.max.y - box.min.y);
    var s = (opts.height || h) / h;
    root.scale.setScalar(s);
    root.position.set(
      -((box.min.x + box.max.x) / 2) * s,
      -box.min.y * s,
      -((box.min.z + box.max.z) / 2) * s
    );
    root.rotation.y = opts.yaw !== undefined ? opts.yaw : (FIX[name] ? FIX[name].yaw : 0);

    var tint = opts.tint !== undefined ? new THREE.Color(opts.tint) : null;
    var mats = [];
    root.traverse(function (o) {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false; // rangka bergerak — jangan salah pangkas
      var mat = o.material;
      if (mat) {
        if (opts.cloneMaterials || tint) {
          mat = mat.clone();
          o.material = mat;
        }
        if (tint) mat.color.copy(tint);
        mats.push({
          m: mat,
          hex: mat.emissive ? mat.emissive.getHex() : 0,
          int: mat.emissiveIntensity === undefined ? 1 : mat.emissiveIntensity
        });
      }
    });

    var wrap = new THREE.Group();
    wrap.add(root);
    return { root: wrap, model: root, clips: src.clips, mats: mats, scale: s };
  };

  AssetLibrary.findClip = findClip;
  AssetLibrary.prototype.findClip = function (name, patterns) {
    var src = this.models[name];
    return src ? findClip(src.clips, patterns) : null;
  };

  global.AssetLibrary = AssetLibrary;
})(typeof window !== 'undefined' ? window : globalThis);
