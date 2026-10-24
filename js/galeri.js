/* Galeri Aset — penjelajah 18 model GLB baru.
   Halaman terpisah dari gameplay: model dimuat satu per satu, aset lama
   di-dispose sebelum aset baru dimuat, dan kamera auto-frame. Tidak menyentuh
   save, UI game, atau registry assets.js. */
(function (global) {
  'use strict';

  var ASSETS = [
    {
      id: 'tree_low_poly',
      title: 'Tree Low Poly',
      file: 'assets/models/tree_low_poly_lowpoly.glb',
      cat: 'vegetation', badge: 'light', size: '173 KB', sizeMB: 0.17,
      tris: 1629, draw: 2, author: '00amza', license: 'CC-BY-4.0', height: 8,
      note: 'Dua pohon dalam satu file; pivot di dasar. Ringan untuk hutan massal.'
    },
    {
      id: 'pine_tree_low_poly',
      title: 'Pine Tree Low-Poly',
      file: 'assets/models/pine_tree_low-poly.glb',
      cat: 'vegetation', badge: 'light', size: '1.7 MB', sizeMB: 1.7,
      tris: 282, draw: 1, author: 'Ricardo Sanchez', license: 'CC-BY-4.0', height: 739.6,
      note: 'Pohon pinus; skala asli sangat besar, dunia menormalkan tinggi lalu meng-instance per petak.'
    },
    {
      id: 'grass_patches',
      title: 'Grass Patches — Circle',
      file: 'assets/models/grass_patches_-_circle.glb',
      cat: 'vegetation', badge: 'medium', size: '12.8 MB', sizeMB: 12.8,
      tris: 204236, draw: 4, author: 'brandon_grey', license: 'CC-BY-4.0', height: 3,
      note: 'Terlalu berat untuk ditanam massal; cocok untuk satu patch dekat kamera.'
    },
    {
      id: 'altar_low_poly',
      title: 'Altar Low Poly',
      file: 'assets/models/altarlow-poly.glb',
      cat: 'props', badge: 'light', size: '4.0 MB', sizeMB: 4.0,
      tris: 10192, draw: 30, author: 'Bitbom', license: 'CC-BY-4.0', height: 6,
      note: 'Altar low-poly; ada plane UV checker yang perlu dibuang dan draw call yang bisa digabung.'
    },
    {
      id: 'stone_well',
      title: 'Medieval Stone Well',
      file: 'assets/models/medieval_stone_well_-_game_prop.glb',
      cat: 'props', badge: 'heavy', size: '110.6 MB', sizeMB: 110.6,
      tris: 1935315, draw: 22, author: 'Pigcraft', license: 'CC-BY-4.0', height: 1.5,
      note: 'Terlalu berat untuk prop; perlu decimate sebelum masuk gameplay.'
    },
    {
      id: 'cinderella_castle',
      title: 'Cinderella Castle',
      file: 'assets/models/cinderella_castle_-_toshueyi.glb',
      cat: 'building', badge: 'medium', size: '7.5 MB', sizeMB: 7.5,
      tris: 130539, draw: 21, author: 'Joanthan To', license: 'CC-BY-4.0', height: 30,
      note: 'Warna flat, tanpa tekstur. Skala asli sekitar 3,3 km; perlu diperkecil.'
    },
    {
      id: 'fantastic_castle',
      title: 'Fantastic Castle',
      file: 'assets/models/fantastic_castle.glb',
      cat: 'building', badge: 'medium', size: '21.2 MB', sizeMB: 21.2,
      tris: 53629, draw: 5, author: 'lepkarepka', license: 'CC-BY-4.0', height: 30,
      warn: true,
      note: 'Tekstur sekitar 80 MB; kompresi tekstur diperlukan sebelum dipakai.'
    },
    {
      id: 'castle',
      title: 'Castle',
      file: 'assets/models/castle.glb',
      cat: 'building', badge: 'heavy', size: '16.1 MB', sizeMB: 16.1,
      tris: 450078, draw: 14, author: 'SravaniPeethala', license: 'CC-BY-4.0', height: 30,
      note: 'Material abu-abu dan 5.874 node. Animasi Take 001 hanya menggerakkan kamera.'
    },
    {
      id: 'modular_wall',
      title: 'Modular Medieval Wall',
      file: 'assets/models/modular_medieval_wall_-_realistic.glb',
      cat: 'building', badge: 'heavy', size: '33.0 MB', sizeMB: 33.0,
      tris: 67745, draw: 21, author: 'Daniel Vicente', license: 'CC-BY-4.0', height: 15,
      warn: true,
      note: 'Dinding besar dengan 43 tekstur; tekstur perlu dikompresi.'
    },
    {
      id: 'castle_ai',
      title: 'Castle AI',
      file: 'assets/models/castle_ai.glb',
      cat: 'building', badge: 'heavy', size: '56.2 MB', sizeMB: 56.2,
      tris: 1895655, draw: 17, author: 'Wikiquik', license: 'CC-BY-4.0', height: 30,
      note: 'Sekitar 1,9 juta triangle; perlu decimate. Origin berada di tengah model.'
    },
    {
      id: 'boadiam_castle',
      title: 'Boadiam Castle',
      file: 'assets/models/boadiam_castle.glb',
      cat: 'building', badge: 'heavy', size: '304.5 MB', sizeMB: 304.5,
      tris: 4305375, draw: 41, author: 'wlab_studio', license: 'CC-BY-4.0', height: 35,
      note: 'Aset paling berat: 4,3 juta triangle dan 304 MB. Jangan dimuat bersamaan.'
    },
    {
      id: 'npc_knight',
      title: 'NPC Knight — Doom Rigged',
      file: 'assets/models/npc_knight_-_doom__the_dark_ages_-_rigged.glb',
      cat: 'char', badge: 'heavy', size: '73.5 MB', sizeMB: 73.5,
      tris: 127594, draw: 23, author: 'wrimpr', license: 'CC-BY-4.0', height: 2,
      warn: true,
      note: 'Punya 142 tulang tetapi 0 klip animasi; kandidat player yang perlu retarget.'
    },
    {
      id: 'crimson_knight',
      title: 'Crimson Death Knight',
      file: 'assets/models/crimson_death_knight_-_dual_falchions.glb',
      cat: 'char', badge: 'heavy', size: '112.2 MB', sizeMB: 112.2,
      tris: 1923148, draw: 23, author: 'Pigcraft', license: 'CC-BY-4.0', height: 2,
      note: 'Model statis tanpa rig; tidak bisa dianimasikan tanpa proses tambahan.'
    },
    {
      id: 'kingslayer',
      title: 'Kingslayer Assassin',
      file: 'assets/models/kingslayer_assassin_-_dark_fantasy.glb',
      cat: 'char', badge: 'heavy', size: '108.6 MB', sizeMB: 108.6,
      tris: 1927917, draw: 22, author: 'Pigcraft', license: 'CC-BY-4.0', height: 2,
      note: 'Model statis tanpa rig; tidak bisa dianimasikan tanpa proses tambahan.'
    },
    {
      id: 'forest_road',
      title: 'Forest 3 with a Road at Night',
      file: 'assets/models/a_forest_3_with_a_road_at_night_for_game.glb',
      cat: 'scene', badge: 'heavy', size: '14.1 MB', sizeMB: 14.1,
      tris: 151954, draw: 1480, author: 'dasy444', license: 'CC-BY-4.0', height: 8,
      warn: true,
      note: 'Diorama hutan dengan 1.480 draw call; geometri harus di-merge untuk game.'
    },
    {
      id: 'dirt_road',
      title: 'Dirt Road Through Forest',
      file: 'assets/models/update_dirt_road_through_forest.glb',
      cat: 'scene', badge: 'heavy', size: '85.4 MB', sizeMB: 85.4,
      tris: 341109, draw: 27, author: '99.Miles', license: 'CC-BY-4.0', height: 8,
      warn: true,
      note: 'Scene jalan hutan dengan 70 tekstur sekitar 228 MB; perlu kompresi.'
    },
    {
      id: 'modular_city',
      title: 'Medieval Modular City',
      file: 'assets/models/medieval_modular_city_realistic_-_wip.glb',
      cat: 'scene', badge: 'heavy', size: '167.8 MB', sizeMB: 167.8,
      tris: 1103072, draw: 193, author: 'Daniel Vicente', license: 'CC-BY-4.0', height: 40,
      note: 'Scene kota utuh, bukan kit modular. Tekstur sekitar 485 MB; sangat berat.'
    },
    {
      id: 'water_cube',
      title: 'Small Flat Cube of Water',
      file: 'assets/models/small_flat_cube_of_water.glb',
      cat: 'water', badge: 'medium', size: '5.7 MB', sizeMB: 5.7,
      tris: 196608, draw: 2, author: 'organ collector', license: 'CC-BY-4.0', height: 5,
      note: 'Air prosedural yang sudah ada di game lebih baik; aset ini opsional.'
    }
  ];

  var CAT_KEY = {
    char: 'gallery.cat.char',
    building: 'gallery.cat.building',
    vegetation: 'gallery.cat.vegetation',
    props: 'gallery.cat.props',
    scene: 'gallery.cat.scene',
    water: 'gallery.cat.water'
  };
  var CAT_FALLBACK = {
    char: 'Karakter', building: 'Bangunan', vegetation: 'Vegetasi',
    props: 'Props', scene: 'Scene', water: 'Air'
  };
  var BADGE_KEY = {
    light: 'gallery.badge.light',
    medium: 'gallery.badge.medium',
    heavy: 'gallery.badge.heavy'
  };
  var BADGE_FALLBACK = { light: 'Ringan', medium: 'Sedang', heavy: 'Berat' };

  var el = {};
  var renderer = null, scene = null, camera = null, clock = null;
  var stageGroup = null, ground = null, grid = null, ring = null, dirLight = null;
  var modelWrap = null, modelScene = null, currentGltf = null;
  var mixer = null, currentAction = null, animPlaying = false;
  var currentAsset = null, currentStats = null, currentBox = null, originalBox = null;
  var currentExtraNote = '';
  var selectedId = null;
  var loading = false;
  var loadToken = 0;
  var pendingAsset = null;
  var toastTimer = 0;
  var searchTerm = '';
  var category = 'all';
  var originalScale = false;
  var wireframe = false;
  var autoRotate = false;
  var dragging = false, lastX = 0, lastY = 0;
  var loadAllowed = true;
  var rendererReady = false;
  var orbit = {
    yaw: 0.72, pitch: 0.32, dist: 10,
    minDist: 0.01, maxDist: 1000,
    target: new THREE.Vector3()
  };

  function tx(key, fallback) {
    return (global.Lang && global.Lang.tx) ? global.Lang.tx(key, fallback) : fallback;
  }

  function catLabel(cat) {
    return tx(CAT_KEY[cat] || '', CAT_FALLBACK[cat] || cat);
  }

  function badgeLabel(badge) {
    return tx(BADGE_KEY[badge] || '', BADGE_FALLBACK[badge] || badge);
  }

  function formatNum(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    var locale = (global.Lang && global.Lang.get() === 'en') ? 'en-US' : 'id-ID';
    try { return Math.round(n).toLocaleString(locale); }
    catch (e) { return String(Math.round(n)); }
  }

  function formatBytes(n) {
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    var v = n / Math.pow(1024, i);
    return (i === 0 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)) + ' ' + units[i];
  }

  function formatLen(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    if (n >= 1000) return (n / 1000).toFixed(2) + ' km';
    if (n >= 100) return n.toFixed(0) + ' m';
    if (n >= 10) return n.toFixed(1) + ' m';
    if (n >= 1) return n.toFixed(2) + ' m';
    return (n * 100).toFixed(1) + ' cm';
  }

  function formatBounds(box) {
    if (!box || box.isEmpty()) return '—';
    var size = box.getSize(new THREE.Vector3());
    return formatLen(size.x) + ' × ' + formatLen(size.y) + ' × ' + formatLen(size.z);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function cacheDom() {
    el.canvas = document.getElementById('gallery-canvas');
    el.search = document.getElementById('gallery-search');
    el.category = document.getElementById('gallery-category');
    el.list = document.getElementById('gallery-list');
    el.count = document.getElementById('gallery-count');
    el.currentName = document.getElementById('gallery-current-name');
    el.currentMeta = document.getElementById('gallery-current-meta');
    el.original = document.getElementById('gallery-original');
    el.wire = document.getElementById('gallery-wire');
    el.rotate = document.getElementById('gallery-rotate');
    el.reset = document.getElementById('gallery-reset');
    el.empty = document.getElementById('gallery-empty');
    el.info = document.getElementById('gallery-info');
    el.infoToggle = document.getElementById('gallery-info-toggle');
    el.badge = document.getElementById('gallery-badge');
    el.stats = document.getElementById('gallery-stats');
    el.note = document.getElementById('gallery-note');
    el.credit = document.getElementById('gallery-credit');
    el.animBar = document.getElementById('gallery-anim-bar');
    el.animSelect = document.getElementById('gallery-anim-select');
    el.animPlay = document.getElementById('gallery-anim-play');
    el.hint = document.querySelector('.gallery-hint');
    el.fileWarning = document.getElementById('gallery-file-warning');
    el.loading = document.getElementById('gallery-loading');
    el.loadingTitle = document.getElementById('gallery-loading-title');
    el.loadingFile = document.getElementById('gallery-loading-file');
    el.loadingHint = document.getElementById('gallery-loading-hint');
    el.progressFill = document.getElementById('gallery-progress-fill');
    el.warning = document.getElementById('gallery-warning');
    el.warningText = document.getElementById('gallery-warning-text');
    el.warningCancel = document.getElementById('gallery-warning-cancel');
    el.warningLoad = document.getElementById('gallery-warning-load');
    el.toast = document.getElementById('gallery-toast');
  }

  function setupRenderer() {
    renderer = new THREE.WebGLRenderer({
      canvas: el.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setSize(global.innerWidth, global.innerHeight, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      45,
      global.innerWidth / Math.max(1, global.innerHeight),
      0.01,
      1000000
    );
    camera.position.set(0, 2, 8);

    var hemi = new THREE.HemisphereLight(0xc6e8ff, 0x251b13, 0.9);
    scene.add(hemi);

    dirLight = new THREE.DirectionalLight(0xffefd0, 1.35);
    dirLight.position.set(6, 10, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.bias = -0.0006;
    scene.add(dirLight);
    scene.add(dirLight.target);

    var fill = new THREE.DirectionalLight(0x86bfff, 0.38);
    fill.position.set(-8, 4, -7);
    scene.add(fill);

    var amb = new THREE.AmbientLight(0xffffff, 0.16);
    scene.add(amb);

    stageGroup = new THREE.Group();
    scene.add(stageGroup);

    clock = new THREE.Clock();
    rendererReady = true;
  }

  function bindUi() {
    if (el.search) {
      el.search.addEventListener('input', function () {
        searchTerm = el.search.value || '';
        renderList();
      });
    }

    if (el.category) {
      el.category.addEventListener('change', function () {
        category = el.category.value || 'all';
        renderList();
      });
    }

    if (el.original) {
      el.original.addEventListener('change', function () {
        originalScale = !!el.original.checked;
        if (currentAsset) {
          applyScaleAndFrame();
          updateHeader();
          updateInfo();
        }
      });
    }

    if (el.wire) {
      el.wire.addEventListener('click', function () {
        wireframe = !wireframe;
        el.wire.classList.toggle('active', wireframe);
        applyWireframe();
      });
    }

    if (el.rotate) {
      el.rotate.addEventListener('click', function () {
        autoRotate = !autoRotate;
        el.rotate.classList.toggle('active', autoRotate);
      });
    }

    if (el.reset) el.reset.addEventListener('click', resetCamera);

    if (el.animSelect) {
      el.animSelect.addEventListener('change', function () {
        playClip(parseInt(el.animSelect.value, 10) || 0);
      });
    }

    if (el.animPlay) el.animPlay.addEventListener('click', toggleAnimation);

    if (el.infoToggle) {
      el.infoToggle.addEventListener('click', function () {
        var collapsed = el.info.classList.toggle('collapsed');
        el.infoToggle.textContent = collapsed ? '+' : '−';
        el.infoToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        el.infoToggle.title = collapsed
          ? tx('gallery.showStats', 'Tampilkan statistik')
          : tx('gallery.hideStats', 'Sembunyikan statistik');
      });
    }

    if (el.warningCancel) el.warningCancel.addEventListener('click', closeWarning);
    if (el.warningLoad) {
      el.warningLoad.addEventListener('click', function () {
        var asset = pendingAsset;
        closeWarning();
        if (asset) loadAsset(asset);
      });
    }
    if (el.warning) {
      el.warning.addEventListener('click', function (e) {
        if (e.target === el.warning) closeWarning();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeWarning();
    });

    bindCanvasControls();
  }

  function bindCanvasControls() {
    el.canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      try { el.canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });

    el.canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      orbit.yaw -= dx * 0.005;
      orbit.pitch = clamp(orbit.pitch + dy * 0.005, -0.15, 1.45);
      updateCamera();
    });

    function endDrag(e) {
      dragging = false;
      try {
        if (e && e.pointerId !== undefined) el.canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    el.canvas.addEventListener('pointerup', endDrag);
    el.canvas.addEventListener('pointercancel', endDrag);

    el.canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      orbit.dist = clamp(
        orbit.dist * Math.exp(e.deltaY * 0.0012),
        orbit.minDist,
        orbit.maxDist
      );
      updateCamera();
    }, { passive: false });

    el.canvas.addEventListener('dblclick', resetCamera);
    el.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function renderList() {
    if (!el.list) return;
    var query = searchTerm.trim().toLowerCase();
    var filtered = ASSETS.filter(function (asset) {
      if (category !== 'all' && asset.cat !== category) return false;
      if (!query) return true;
      var haystack = [
        asset.id, asset.title, asset.file, asset.note, catLabel(asset.cat)
      ].join(' ').toLowerCase();
      return haystack.indexOf(query) !== -1;
    });

    el.list.textContent = '';

    filtered.forEach(function (asset) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'asset-item' +
        (asset.badge === 'heavy' ? ' is-heavy' : '') +
        (asset.id === selectedId ? ' active' : '');
      btn.title = asset.file;
      btn.setAttribute('aria-pressed', asset.id === selectedId ? 'true' : 'false');
      btn.addEventListener('click', function () { selectAsset(asset); });

      var top = document.createElement('div');
      top.className = 'ai-top';

      var name = document.createElement('span');
      name.className = 'ai-name';
      name.textContent = asset.title;

      var badge = document.createElement('span');
      badge.className = 'ai-badge badge-' + asset.badge;
      badge.textContent = badgeLabel(asset.badge);

      top.appendChild(name);
      top.appendChild(badge);

      var meta = document.createElement('div');
      meta.className = 'ai-meta';
      meta.textContent = catLabel(asset.cat) + ' · ' + asset.size + ' · ' +
        formatNum(asset.tris) + ' tris';

      var note = document.createElement('div');
      note.className = 'ai-note';
      note.textContent = asset.note;

      btn.appendChild(top);
      btn.appendChild(meta);
      btn.appendChild(note);
      el.list.appendChild(btn);
    });

    if (!filtered.length) {
      var empty = document.createElement('div');
      empty.className = 'gallery-no-results';
      empty.textContent = tx('gallery.noResults', 'Tidak ada aset yang cocok.');
      el.list.appendChild(empty);
    }

    if (el.count) {
      el.count.textContent = filtered.length + ' / ' + ASSETS.length + ' ' +
        tx('gallery.assets', 'aset');
    }
  }

  function selectAsset(asset) {
    if (!asset || loading) {
      if (loading) showToast(tx('gallery.busy', 'Tunggu model selesai dimuat.'));
      return;
    }
    if (!rendererReady) {
      showToast(tx('gallery.noWebgl', 'WebGL tidak tersedia di peramban ini.'));
      return;
    }
    if (!loadAllowed) {
      showToast(tx('gallery.fileModeToast',
        'Jalankan jalankan.bat lalu buka http://localhost:8317/galeri.html'));
      return;
    }
    if (asset.warn || asset.sizeMB >= 100 || asset.tris >= 1000000 || asset.draw >= 500) {
      openWarning(asset);
      return;
    }
    loadAsset(asset);
  }

  function openWarning(asset) {
    pendingAsset = asset;
    var lines = [
      tx('gallery.heavyIntro',
        'Aset ini besar. Memuatnya bisa memakan waktu dan banyak memori.'),
      asset.title + ' — ' + asset.size + ' · ' + formatNum(asset.tris) +
        ' tris · ' + formatNum(asset.draw) + ' draw call',
      asset.note
    ];
    if (asset.sizeMB >= 100) {
      lines.push(tx('gallery.heavyLfs',
        'File ini lebih dari 100 MB; gunakan Git LFS bila di-commit ke GitHub.'));
    }
    el.warningText.textContent = lines.join('\n');
    el.warning.classList.remove('hidden');
    if (el.warningLoad) el.warningLoad.focus();
  }

  function closeWarning() {
    if (el.warning) el.warning.classList.add('hidden');
    pendingAsset = null;
  }

  function loadAsset(asset) {
    if (!asset || loading) return;
    if (!THREE.GLTFLoader) {
      showToast(tx('gallery.noLoader', 'GLTFLoader tidak tersedia.'));
      return;
    }
    loading = true;
    selectedId = asset.id;
    currentExtraNote = '';
    renderList();
    disposeCurrent();
    showLoading(asset);

    var token = ++loadToken;
    var loader = new THREE.GLTFLoader();

    loader.load(asset.file, function (gltf) {
      if (token !== loadToken) {
        disposeGltf(gltf);
        return;
      }
      loading = false;
      hideLoading();
      try {
        onAssetLoaded(asset, gltf);
      } catch (err) {
        console.error('[Galeri] Gagal menyiapkan model', asset.file, err);
        disposeCurrent();
        selectedId = null;
        renderList();
        showToast(tx('gallery.error', 'Gagal memuat aset') + ': ' + asset.title);
      }
    }, function (xhr) {
      if (token !== loadToken) return;
      updateProgress(xhr, asset);
    }, function (err) {
      if (token !== loadToken) return;
      loading = false;
      hideLoading();
      selectedId = null;
      resetHeader();
      renderList();
      console.error('[Galeri] Gagal memuat', asset.file, err);
      showToast(tx('gallery.error', 'Gagal memuat aset') + ': ' + asset.title);
    });
  }

  function onAssetLoaded(asset, gltf) {
    currentAsset = asset;
    currentGltf = gltf;
    modelScene = gltf.scene;
    modelScene.updateMatrixWorld(true);

    originalBox = new THREE.Box3().setFromObject(modelScene);
    if (originalBox.isEmpty()) {
      originalBox.set(
        new THREE.Vector3(-1, -1, -1),
        new THREE.Vector3(1, 1, 1)
      );
    }

    currentStats = collectStats(modelScene, gltf);
    currentExtraNote = '';

    modelWrap = new THREE.Group();
    modelWrap.name = 'gallery-model';
    modelWrap.add(modelScene);
    scene.add(modelWrap);

    modelScene.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });

    setupAnimations(gltf);
    applyScaleAndFrame();
    applyWireframe();
    updateHeader();
    updateInfo();
    setEmpty(false);
    renderList();
  }

  function applyScaleAndFrame() {
    if (!modelWrap || !originalBox || !currentAsset) return;

    modelWrap.scale.set(1, 1, 1);
    modelWrap.position.set(0, 0, 0);
    modelWrap.rotation.set(0, 0, 0);

    if (!originalScale) {
      var size = originalBox.getSize(new THREE.Vector3());
      var footprint = Math.max(size.x, size.z);
      var baseHeight = Math.max(size.y, footprint * 0.25, 0.0001);
      var targetHeight = currentAsset.height || 2;
      var scale = targetHeight / baseHeight;
      var cx = (originalBox.min.x + originalBox.max.x) * 0.5;
      var cz = (originalBox.min.z + originalBox.max.z) * 0.5;

      modelWrap.scale.setScalar(scale);
      modelWrap.position.set(
        -cx * scale,
        -originalBox.min.y * scale,
        -cz * scale
      );
    }

    modelWrap.updateMatrixWorld(true);
    currentBox = new THREE.Box3().setFromObject(modelWrap);
    if (currentBox.isEmpty()) {
      currentBox.set(
        new THREE.Vector3(-1, 0, -1),
        new THREE.Vector3(1, 2, 1)
      );
    }

    buildStage(currentBox);
    frameCamera(currentBox);
  }

  function buildStage(box) {
    clearStage();
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z, 0.001);
    var groundY = box.min.y - maxDim * 0.002;
    var groundSize = Math.max(maxDim * 4, 0.4);

    var groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    var groundMat = new THREE.MeshStandardMaterial({
      color: 0x0b1721,
      roughness: 0.96,
      metalness: 0.02
    });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(center.x, groundY, center.z);
    stageGroup.add(ground);

    grid = new THREE.GridHelper(groundSize, 28, 0x2c5c73, 0x142a38);
    grid.position.set(center.x, groundY + maxDim * 0.004, center.z);
    if (grid.material) {
      grid.material.transparent = true;
      grid.material.opacity = 0.58;
      grid.material.depthWrite = false;
    }
    stageGroup.add(grid);

    var ringGeo = new THREE.RingGeometry(maxDim * 0.355, maxDim * 0.362, 64);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0x4c9bb6,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, groundY + maxDim * 0.007, center.z);
    stageGroup.add(ring);

    var useShadow = maxDim < 250;
    renderer.shadowMap.enabled = useShadow;
    dirLight.castShadow = useShadow;
    ground.receiveShadow = useShadow;

    if (modelScene) {
      modelScene.traverse(function (o) {
        if (!o.isMesh) return;
        o.castShadow = useShadow;
        o.receiveShadow = useShadow;
      });
    }

    if (useShadow) {
      var shadowSize = Math.max(maxDim * 1.15, 1);
      dirLight.position.set(
        center.x + shadowSize * 1.4,
        center.y + shadowSize * 2.1,
        center.z + shadowSize * 1.1
      );
      dirLight.target.position.copy(center);
      dirLight.target.updateMatrixWorld();

      var shadowCam = dirLight.shadow.camera;
      shadowCam.left = -shadowSize;
      shadowCam.right = shadowSize;
      shadowCam.top = shadowSize;
      shadowCam.bottom = -shadowSize;
      shadowCam.near = Math.max(0.1, maxDim * 0.01);
      shadowCam.far = Math.max(10, shadowSize * 5);
      shadowCam.updateProjectionMatrix();
    }
  }

  function frameCamera(box) {
    if (!box) return;
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z, 0.001);
    var fov = camera.fov * Math.PI / 180;
    var dist = (maxDim * 0.5) / Math.max(0.001, Math.tan(fov * 0.5)) * 1.45;
    dist = Math.max(dist, maxDim * 0.75);

    orbit.target.copy(center);
    orbit.dist = dist;
    orbit.minDist = Math.max(maxDim * 0.03, 0.001);
    orbit.maxDist = Math.max(maxDim * 12, 1);
    orbit.yaw = 0.72;
    orbit.pitch = 0.32;

    camera.near = Math.max(0.001, maxDim / 20000);
    camera.far = Math.max(100, maxDim * 60);
    camera.updateProjectionMatrix();
    updateCamera();
  }

  function updateCamera() {
    if (!camera) return;
    var cosPitch = Math.cos(orbit.pitch);
    camera.position.set(
      orbit.target.x + orbit.dist * cosPitch * Math.sin(orbit.yaw),
      orbit.target.y + orbit.dist * Math.sin(orbit.pitch),
      orbit.target.z + orbit.dist * cosPitch * Math.cos(orbit.yaw)
    );
    camera.lookAt(orbit.target);
  }

  function resetCamera() {
    if (currentBox) frameCamera(currentBox);
  }

  function applyWireframe() {
    if (!modelScene) return;
    modelScene.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      for (var i = 0; i < mats.length; i++) {
        var mat = mats[i];
        if (mat && mat.wireframe !== undefined) {
          mat.wireframe = wireframe;
          mat.needsUpdate = true;
        }
      }
    });
  }

  function setupAnimations(gltf) {
    if (mixer) {
      mixer.stopAllAction();
      if (modelScene) mixer.uncacheRoot(modelScene);
      mixer = null;
    }
    currentAction = null;
    animPlaying = false;
    currentExtraNote = '';

    var clips = gltf.animations || [];
    el.animSelect.textContent = '';
    el.animPlay.textContent = '▶';
    el.animPlay.disabled = false;
    el.animSelect.disabled = false;

    if (!clips.length) {
      el.animBar.classList.add('hidden');
      return;
    }

    for (var i = 0; i < clips.length; i++) {
      var option = document.createElement('option');
      option.value = String(i);
      option.textContent = clips[i].name || ('Clip ' + (i + 1));
      el.animSelect.appendChild(option);
    }
    el.animBar.classList.remove('hidden');

    var cameraOnly = clips.every(function (clip) {
      if (!clip.tracks.length) return false;
      return clip.tracks.every(function (track) {
        return /camera/i.test(track.name);
      });
    });

    if (cameraOnly) {
      el.animPlay.disabled = true;
      el.animSelect.disabled = true;
      currentExtraNote = tx('gallery.cameraAnim',
        'Animasi ini hanya menggerakkan kamera di dalam model dan tidak terlihat di pratinjau.');
    } else {
      playClip(0);
    }
  }

  function playClip(index) {
    if (!modelScene || !currentGltf) return;
    var clips = currentGltf.animations || [];
    var clip = clips[index];
    if (!clip) return;

    if (!mixer) mixer = new THREE.AnimationMixer(modelScene);
    if (currentAction) currentAction.stop();

    currentAction = mixer.clipAction(clip);
    currentAction.reset();
    currentAction.setLoop(THREE.LoopRepeat, Infinity);
    currentAction.clampWhenFinished = false;
    currentAction.paused = false;
    currentAction.play();
    animPlaying = true;
    el.animPlay.textContent = '⏸';
    el.animSelect.value = String(index);
  }

  function toggleAnimation() {
    if (!currentAction) {
      if (currentGltf && currentGltf.animations && currentGltf.animations.length) {
        playClip(parseInt(el.animSelect.value, 10) || 0);
      }
      return;
    }
    if (animPlaying) {
      currentAction.paused = true;
      animPlaying = false;
      el.animPlay.textContent = '▶';
    } else {
      currentAction.paused = false;
      animPlaying = true;
      el.animPlay.textContent = '⏸';
    }
  }

  function collectStats(root, gltf) {
    var tris = 0, verts = 0, draws = 0, meshes = 0;
    var materials = {};
    var textures = {};

    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      meshes++;
      var geo = o.geometry;
      var pos = geo.attributes && geo.attributes.position;
      var vcount = pos ? pos.count : 0;
      verts += vcount;
      tris += geo.index ? geo.index.count / 3 : vcount / 3;
      draws += (geo.groups && geo.groups.length) ? geo.groups.length : 1;

      var mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (var i = 0; i < mats.length; i++) {
        var mat = mats[i];
        if (!mat) continue;
        materials[mat.uuid] = true;
        for (var key in mat) {
          var value = mat[key];
          if (value && value.isTexture) textures[value.uuid] = true;
        }
      }
    });

    var json = (gltf.parser && gltf.parser.json) || {};
    var skinJoints = 0;
    (json.skins || []).forEach(function (skin) {
      if (skin.joints) skinJoints += skin.joints.length;
    });

    return {
      tris: tris,
      verts: verts,
      draws: draws,
      meshes: meshes,
      materials: Object.keys(materials).length || (json.materials || []).length,
      textures: Object.keys(textures).length || (json.textures || []).length,
      animations: (gltf.animations || []).length,
      skinJoints: skinJoints,
      nodes: (json.nodes || []).length
    };
  }

  function updateHeader() {
    if (!el.currentName) return;
    if (!currentAsset) {
      el.currentName.textContent = tx('gallery.pick', 'Pilih aset');
      el.currentMeta.textContent = '—';
      return;
    }
    var tris = currentStats ? currentStats.tris : currentAsset.tris;
    var draws = currentStats ? currentStats.draws : currentAsset.draw;
    el.currentName.textContent = currentAsset.title;
    el.currentMeta.textContent = catLabel(currentAsset.cat) + ' · ' +
      currentAsset.size + ' · ' + formatNum(tris) + ' tris · ' +
      formatNum(draws) + ' draw';
  }

  function updateInfo() {
    if (!el.info) return;
    if (!currentAsset || !currentStats) {
      el.info.classList.add('hidden');
      return;
    }

    el.info.classList.remove('hidden');
    el.badge.className = 'gallery-badge badge-' + currentAsset.badge;
    el.badge.textContent = badgeLabel(currentAsset.badge);

    var rows = [
      [tx('gallery.size', 'Ukuran file'), currentAsset.size],
      [tx('gallery.triangles', 'Triangle'), formatNum(currentStats.tris)],
      [tx('gallery.vertices', 'Vertex'), formatNum(currentStats.verts)],
      [tx('gallery.meshes', 'Mesh'), formatNum(currentStats.meshes)],
      [tx('gallery.drawCalls', 'Draw call'), formatNum(currentStats.draws)],
      [tx('gallery.materials', 'Material'), formatNum(currentStats.materials)],
      [tx('gallery.textures', 'Tekstur'), formatNum(currentStats.textures)],
      [tx('gallery.animations', 'Animasi'), formatNum(currentStats.animations)],
      [tx('gallery.skins', 'Tulang skin'), currentStats.skinJoints ? formatNum(currentStats.skinJoints) : '—'],
      [tx('gallery.nodes', 'Node'), formatNum(currentStats.nodes)],
      [tx('gallery.originalSize', 'Ukuran asli'), formatBounds(originalBox), true],
      [tx('gallery.shownSize', 'Ukuran tampil'), formatBounds(currentBox), true]
    ];

    el.stats.textContent = '';
    rows.forEach(function (row) {
      var item = document.createElement('div');
      item.className = 'gallery-stat' + (row[2] ? ' wide' : '');
      var label = document.createElement('span');
      label.textContent = row[0];
      var value = document.createElement('b');
      value.textContent = row[1];
      item.appendChild(label);
      item.appendChild(value);
      el.stats.appendChild(item);
    });

    el.note.textContent = currentAsset.note +
      (currentExtraNote ? ' ' + currentExtraNote : '');
    el.credit.textContent = tx('gallery.author', 'Penulis') + ': ' +
      currentAsset.author + ' · ' +
      tx('gallery.license', 'Lisensi') + ': ' + currentAsset.license;
  }

  function resetHeader() {
    currentAsset = null;
    currentStats = null;
    currentBox = null;
    originalBox = null;
    currentGltf = null;
    currentExtraNote = '';
    if (el.currentName) el.currentName.textContent = tx('gallery.pick', 'Pilih aset');
    if (el.currentMeta) el.currentMeta.textContent = '—';
    if (el.info) el.info.classList.add('hidden');
    if (el.animBar) el.animBar.classList.add('hidden');
    if (el.stats) el.stats.textContent = '';
    if (el.note) el.note.textContent = '';
    if (el.credit) el.credit.textContent = '';
    if (el.badge) {
      el.badge.className = 'gallery-badge';
      el.badge.textContent = '';
    }
    setEmpty(true);
  }

  function disposeCurrent() {
    if (mixer) {
      mixer.stopAllAction();
      if (modelScene) mixer.uncacheRoot(modelScene);
      mixer = null;
    }
    currentAction = null;
    animPlaying = false;

    if (modelWrap) {
      if (modelWrap.parent) modelWrap.parent.remove(modelWrap);
      disposeObject(modelWrap);
    }
    modelWrap = null;
    modelScene = null;

    clearStage();
    resetHeader();
    if (el.animSelect) el.animSelect.textContent = '';
    if (el.animPlay) {
      el.animPlay.textContent = '▶';
      el.animPlay.disabled = false;
    }
    if (el.animSelect) el.animSelect.disabled = false;
  }

  function disposeGltf(gltf) {
    if (gltf && gltf.scene) disposeObject(gltf.scene);
  }

  function disposeObject(root) {
    if (!root) return;
    var geometries = {};
    var materials = {};
    var textures = {};

    root.traverse(function (o) {
      if (o.geometry) geometries[o.geometry.uuid] = o.geometry;
      var mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (var i = 0; i < mats.length; i++) {
        var mat = mats[i];
        if (!mat) continue;
        materials[mat.uuid] = mat;
        for (var key in mat) {
          var value = mat[key];
          if (value && value.isTexture) textures[value.uuid] = value;
        }
      }
    });

    Object.keys(textures).forEach(function (key) {
      try { textures[key].dispose(); } catch (e) {}
    });
    Object.keys(materials).forEach(function (key) {
      try { materials[key].dispose(); } catch (e) {}
    });
    Object.keys(geometries).forEach(function (key) {
      try { geometries[key].dispose(); } catch (e) {}
    });
  }

  function clearStage() {
    if (!stageGroup) return;
    while (stageGroup.children.length) {
      var child = stageGroup.children[0];
      stageGroup.remove(child);
      disposeObject(child);
    }
    ground = null;
    grid = null;
    ring = null;
  }

  function setEmpty(show) {
    if (!el.empty) return;
    el.empty.classList.toggle('hidden', !show);
  }

  function showLoading(asset) {
    if (!el.loading) return;
    el.loadingTitle.textContent = tx('gallery.loading', 'Memuat...') + ' ' + asset.title;
    el.loadingFile.textContent = asset.file + ' · ' + asset.size;
    el.loadingHint.textContent = tx('gallery.loadingHint',
      'Model besar bisa memakan waktu.');
    el.progressFill.style.width = '0%';
    el.loading.classList.remove('hidden');
  }

  function updateProgress(xhr, asset) {
    if (!el.loadingFile || !el.progressFill) return;
    var loaded = xhr && typeof xhr.loaded === 'number' ? xhr.loaded : 0;
    var total = xhr && typeof xhr.total === 'number' ? xhr.total : 0;

    if (total > 0) {
      var percent = Math.min(99, Math.round((loaded / total) * 100));
      el.progressFill.style.width = percent + '%';
      el.loadingFile.textContent = formatBytes(loaded) + ' / ' +
        formatBytes(total) + ' · ' + asset.file;
      if (percent >= 99) {
        el.loadingTitle.textContent = tx('gallery.processing', 'Memproses model...');
      }
    } else if (loaded > 0) {
      el.loadingFile.textContent = formatBytes(loaded) + ' · ' + asset.file;
    }
  }

  function hideLoading() {
    if (el.loading) el.loading.classList.add('hidden');
  }

  function showToast(message) {
    if (!el.toast || !message) return;
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.add('hidden');
      toastTimer = 0;
    }, 3400);
  }

  function onResize() {
    if (!renderer || !camera) return;
    var width = global.innerWidth || 1;
    var height = global.innerHeight || 1;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
  }

  function animate() {
    global.requestAnimationFrame(animate);
    var dt = clock ? Math.min(clock.getDelta(), 0.1) : 0;
    if (autoRotate && currentBox) {
      orbit.yaw += dt * 0.28;
      updateCamera();
    }
    if (mixer && animPlaying) mixer.update(dt);
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function init() {
    cacheDom();
    if (global.Lang) {
      global.Lang.load();
      global.Lang.applyDom();
    }
    if (el.search) el.search.placeholder = tx('gallery.search', 'Cari aset...');
    if (el.loadingHint) {
      el.loadingHint.textContent = tx('gallery.loadingHint',
        'Model besar bisa memakan waktu.');
    }
    if (el.infoToggle) {
      el.infoToggle.title = tx('gallery.hideStats', 'Sembunyikan statistik');
    }

    loadAllowed = global.location.protocol !== 'file:';

    if (!global.THREE || !THREE.WebGLRenderer) {
      showToast(tx('gallery.noWebgl', 'WebGL tidak tersedia di peramban ini.'));
      renderList();
      return;
    }

    try {
      setupRenderer();
    } catch (err) {
      console.error('[Galeri] Renderer gagal dibuat', err);
      showToast(tx('gallery.noWebgl', 'WebGL tidak tersedia di peramban ini.'));
      renderList();
      return;
    }

    bindUi();
    renderList();

    if (!loadAllowed) {
      if (el.fileWarning) el.fileWarning.classList.remove('hidden');
      if (el.hint) el.hint.classList.add('hidden');
    }

    global.addEventListener('resize', onResize);
    animate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
