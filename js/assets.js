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
    boar: 'assets/models/Boar.glb',
    /* Vegetasi GLB (CC-BY-4.0): dua varian pohon rimbun + satu pohon pinus.
       Geometri diekstrak sebagai bagian terpisah lalu di-instance oleh world.js. */
    tree_oak: 'assets/models/tree_low_poly_lowpoly.glb',
    tree_pine: 'assets/models/pine_tree_low-poly.glb',
    /* Quaternius Medieval Village MegaKit (Free) — modular buildings.
       Semua sudah dikonversi ke .glb mandiri (tanpa .bin / PNG terpisah)
       lewat tools/gltf-to-glb.js — satu request per model, tidak ada
       dialog unduh berkas biner di peramban. */
    // Walls
    'wall_plaster_straight': 'assets/models/buildings/Wall_Plaster_Straight.glb',
    'wall_plaster_door_flat': 'assets/models/buildings/Wall_Plaster_Door_Flat.glb',
    'wall_plaster_window_wide_round': 'assets/models/buildings/Wall_Plaster_Window_Wide_Round.glb',
    'wall_unevenbrick_straight': 'assets/models/buildings/Wall_UnevenBrick_Straight.glb',
    'wall_plaster_woodgrid': 'assets/models/buildings/Wall_Plaster_WoodGrid.glb',
    'wall_unevenbrick_door_flat': 'assets/models/buildings/Wall_UnevenBrick_Door_Flat.glb',
    'wall_unevenbrick_window_wide_round': 'assets/models/buildings/Wall_UnevenBrick_Window_Wide_Round.glb',
    'wall_arch': 'assets/models/buildings/Wall_Arch.glb',
    // Floors
    'floor_brick': 'assets/models/buildings/Floor_Brick.glb',
    'floor_wooddark': 'assets/models/buildings/Floor_WoodDark.glb',
    'floor_woodlight': 'assets/models/buildings/Floor_WoodLight.glb',
    'floor_redbrick': 'assets/models/buildings/Floor_RedBrick.glb',
    'floor_unevenbrick': 'assets/models/buildings/Floor_UnevenBrick.glb',
    // Roofs
    'roof_roundtiles_4x4': 'assets/models/buildings/Roof_RoundTiles_4x4.glb',
    'roof_wooden_2x1': 'assets/models/buildings/Roof_Wooden_2x1.glb',
    'roof_tower_roundtiles': 'assets/models/buildings/Roof_Tower_RoundTiles.glb',
    'roof_roundtiles_6x6': 'assets/models/buildings/Roof_RoundTiles_6x6.glb',
    'roof_roundtiles_8x8': 'assets/models/buildings/Roof_RoundTiles_8x8.glb',
    // Stairs
    'stairs_exterior_straight': 'assets/models/buildings/Stairs_Exterior_Straight.glb',
    'stairs_exterior_platform': 'assets/models/buildings/Stairs_Exterior_Platform.glb',
    'stairs_interior_simple': 'assets/models/buildings/Stairs_Exterior_Straight.glb',
    // Props
    'prop_chimney': 'assets/models/buildings/Prop_Chimney.glb',
    'prop_crate': 'assets/models/buildings/Prop_Crate.glb',
    'prop_woodenfence_single': 'assets/models/buildings/Prop_WoodenFence_Single.glb',
    'prop_metalfence_simple': 'assets/models/buildings/Prop_MetalFence_Simple.glb',
    'prop_wagon': 'assets/models/buildings/Prop_Wagon.glb',
    'prop_vine1': 'assets/models/buildings/Prop_Vine1.glb',
    // Doors & Windows
    'door_1_flat': 'assets/models/buildings/Door_1_Flat.glb',
    'doorframe_flat_brick': 'assets/models/buildings/DoorFrame_Flat_Brick.glb',
    'window_wide_round1': 'assets/models/buildings/Window_Wide_Round1.glb',
    'windowshutters_wide_round_open': 'assets/models/buildings/WindowShutters_Wide_Round_Open.glb',
    // Overhangs
    'overhang_plaster_long': 'assets/models/buildings/Overhang_Plaster_Long.glb',
    'overhang_plaster_corner': 'assets/models/buildings/Overhang_Plaster_Corner.glb',
    'overhang_unevenbrick_long': 'assets/models/buildings/Overhang_UnevenBrick_Long.glb'
  };

  /* Koreksi orientasi menghadap per-model (digeser bila hasil uji visual perlu). */
  var FIX = {
    barbarian: { yaw: 0 }, knight: { yaw: 0 }, mage: { yaw: 0 },
    rogue: { yaw: 0 }, hooded: { yaw: 0 }, boar: { yaw: 0 },
    // Building models typically face +Z, centered at base
    'wall_plaster_straight': { yaw: 0 }, 'wall_plaster_door_flat': { yaw: 0 },
    'wall_plaster_window_wide_round': { yaw: 0 }, 'wall_unevenbrick_straight': { yaw: 0 },
    'floor_brick': { yaw: 0 }, 'floor_wooddark': { yaw: 0 }, 'floor_woodlight': { yaw: 0 },
    'roof_roundtiles_4x4': { yaw: 0 }, 'roof_wooden_2x1': { yaw: 0 }, 'roof_tower_roundtiles': { yaw: 0 },
    'stairs_exterior_straight': { yaw: 0 }, 'prop_chimney': { yaw: 0 }, 'prop_crate': { yaw: 0 }
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
    var tintMix = opts.tintMix === undefined ? 1 : Math.max(0, Math.min(1, opts.tintMix));
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
        if (tint) {
          if (tintMix >= 0.999) mat.color.copy(tint);
          else mat.color.lerp(tint, tintMix);
        }
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

  /* Klon model statis (bangunan, prop) tanpa skeleton — untuk InstancedMesh.
     opts: { height, tint, cloneMaterials, yaw }
     Mengembalikan { geometry, materials, box } — geometry sudah diskalakan & diposisikan. */
  AssetLibrary.prototype.spawnStatic = function (name, opts) {
    var src = this.models[name];
    if (!src) return null;
    opts = opts || {};
    var geo = src.scene.clone(true);
    var box = src.box;
    var h = Math.max(0.01, box.max.y - box.min.y);
    var s = (opts.height || h) / h;
    geo.scale.setScalar(s);
    geo.position.set(
      -((box.min.x + box.max.x) / 2) * s,
      -box.min.y * s,
      -((box.min.z + box.max.z) / 2) * s
    );
    geo.rotation.y = opts.yaw !== undefined ? opts.yaw : (FIX[name] ? FIX[name].yaw : 0);
    geo.updateMatrixWorld(true);

    var mats = [];
    var tint = opts.tint !== undefined ? new THREE.Color(opts.tint) : null;
    var tintMix = opts.tintMix === undefined ? 1 : Math.max(0, Math.min(1, opts.tintMix));
    geo.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      var mat = o.material;
      if (mat) {
        if (opts.cloneMaterials || tint) {
          mat = mat.clone();
          o.material = mat;
        }
        if (tint) {
          if (tintMix >= 0.999) mat.color.copy(tint);
          else mat.color.lerp(tint, tintMix);
        }
        mats.push(mat);
      }
    });

    var wrappedGeo = new THREE.BufferGeometry();
    // Merge geometries per material for instancing (simplified: single material per model)
    // For now, return the group with its meshes for manual instancing
    return { group: geo, materials: mats, box: box, scale: s };
  };

  /* Pecah model statis menjadi bagian geometri siap-instance.
     Setiap mesh di scene dikonversi ke ruang dunia, dipusatkan di sumbu X/Z,
     diletakkan dengan kaki di y=0, lalu dinormalisasi ke tinggi `opts.height`
     (default 1). Model seperti tree_low_poly berisi dua pohon; masing-masing
     mesh menjadi varian terpisah sehingga tidak muncul berpasangan.
     opts: { height, alphaTest }
     Mengembalikan [{ geometry, material, width, height, widthRatio, source }]. */
  AssetLibrary.prototype.staticParts = function (name, opts) {
    var src = this.models[name];
    if (!src || !src.scene) return null;
    opts = opts || {};
    var targetH = opts.height || 1;
    var parts = [];
    src.scene.updateMatrixWorld(true);
    src.scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.material) return;
      var geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);

      // Cermin (determinan negatif) membalik winding; balik urutan indeks.
      if (o.matrixWorld.determinant() < 0) {
        if (geo.index) {
          var ia = geo.index.array;
          for (var ii = 0; ii + 2 < ia.length; ii += 3) {
            var tmp = ia[ii + 1]; ia[ii + 1] = ia[ii + 2]; ia[ii + 2] = tmp;
          }
          geo.index.needsUpdate = true;
        } else if (geo.attributes.position) {
          var pa = geo.attributes.position.array;
          for (var pi = 0; pi + 8 < pa.length; pi += 9) {
            for (var pk = 0; pk < 3; pk++) {
              var t0 = pa[pi + 3 + pk]; pa[pi + 3 + pk] = pa[pi + 6 + pk]; pa[pi + 6 + pk] = t0;
            }
          }
          geo.attributes.position.needsUpdate = true;
        }
      }

      geo.computeBoundingBox();
      var bb = geo.boundingBox;
      var h = bb.max.y - bb.min.y;
      if (!(h > 0.00001)) return;
      var s = targetH / h;
      geo.translate(
        -(bb.min.x + bb.max.x) * 0.5,
        -bb.min.y,
        -(bb.min.z + bb.max.z) * 0.5
      );
      geo.scale(s, s, s);
      geo.computeBoundingBox();
      geo.computeBoundingSphere();

      var mat = o.material;
      if (mat && opts.alphaTest !== undefined) {
        mat = mat.clone();
        mat.side = THREE.DoubleSide;
        mat.transparent = false;
        mat.opacity = 1;
        mat.alphaTest = opts.alphaTest;
        mat.depthWrite = true;
        mat.needsUpdate = true;
      }

      var w = geo.boundingBox.max.x - geo.boundingBox.min.x;
      var d = geo.boundingBox.max.z - geo.boundingBox.min.z;
      parts.push({
        geometry: geo,
        material: mat,
        width: w,
        depth: d,
        widthRatio: w / targetH,
        height: targetH,
        source: o.name || name
      });
    });
    return parts.length ? parts : null;
  };

  AssetLibrary.findClip = findClip;
  AssetLibrary.prototype.findClip = function (name, patterns) {
    var src = this.models[name];
    return src ? findClip(src.clips, patterns) : null;
  };

  global.AssetLibrary = AssetLibrary;
})(typeof window !== 'undefined' ? window : globalThis);
