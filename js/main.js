/* Alur utama: renderer, pemuatan bertahap, kamera orang ketiga, HUD, menu. */
(function () {
  'use strict';
  var U = window.Utils;
  var C = window.CONFIG;

  var renderer, scene, camera, world, player, grass, village, enemies, rpgStats;
  var assets = null; // pustaka model 3D (Tahap G5; null bila mode file://)
  var state = 'loading'; // loading | menu | playing | paused | dead
  var hashParams = {};
  window.location.hash.replace('#', '').split('&').forEach(function (kv) {
    var p = kv.split('=');
    if (p[0]) hashParams[p[0]] = p[1];
  });
  var camYaw = 0, camPitch = 0.30, camDist = 0, camDistSmooth = 0;
  var smoothFocus = new THREE.Vector3();
  var tmpFocus = new THREE.Vector3();
  var tagV = new THREE.Vector3();
  var clock = new THREE.Clock();
  var fpsFrames = 0, fpsTime = 0, fpsValue = 0, hudTime = 1;
  var greeted = false;
  var combatGreeted = false;
  var swimGreeted = false;

  /* Fase 4: peta mini, efek, simpan/muat, dan getaran kamera. */
  var minimap = null;
  var boat = null; // Fase 5: pelabuhan & perahu
  var mapLabel = null;
  var playSeconds = 0;
  var autoSaveT = 0;
  var shakeT = 0, shakeDur = 0.25, shakeMag = 0;
  var footstepT = 0;
  var lastNight = -1;

  /* Fase 5 lanjutan: peta besar, tujuan, dan mercusuar 3D. */
  var worldMapOpen = false;
  var waypoint = null; // { x, z, poi } — poi null untuk titik bebas
  var wmAcc = 0;
  var beacon = null, beaconBeam = null, beaconGem = null, beaconRing = null, beaconT = 0;
  var MAP_POI = { village: 1, harbor: 1, hut: 1, hut2: 1, castle: 1, chapel: 1, stones: 1, kingdom: 1, empire: 1 };

  /* Dwibahasa (i18n): pintasan terjemahan antarmuka. */
  function L(key, fb) { return window.Lang ? window.Lang.tx(key, fb) : fb; }
  function Lstr(s) { return window.Lang ? window.Lang.str(s) : s; }

  /* ---------- Kualitas grafis (Cepat / HD / Ultra) ---------- */
  var QUALITY_KEY = 'pulau.kualitas';
  var quality = 'hd';

  function qualityPreset(name) {
    var P = (C.RENDER && C.RENDER.presets) || {};
    return P[name] || P.hd;
  }
  function loadQuality() {
    var n = null;
    // Param hash #q=cepat|hd|ultra menang atas simpanan (memudahkan uji & berbagi)
    if (hashParams.q && C.RENDER.presets && C.RENDER.presets[hashParams.q]) return hashParams.q;
    try { n = window.localStorage ? window.localStorage.getItem(QUALITY_KEY) : null; } catch (e) { n = null; }
    return (n && C.RENDER.presets && C.RENDER.presets[n]) ? n : ((C.RENDER && C.RENDER.quality) || 'hd');
  }
  function saveQuality(n) {
    try { if (window.localStorage) window.localStorage.setItem(QUALITY_KEY, n); } catch (e) {}
  }
  function applyQualityToConfig(n) {
    var p = qualityPreset(n) || {};
    C.RENDER.quality = n;
    C.RENDER.pixelRatio = p.pixelRatio || 1;
    C.RENDER.shadowMap = p.shadowMap || 1024;
    C.RENDER.postFx = !!p.postFx;
    C.RENDER.env = !!p.env;
    C.RENDER.models = !!p.models;
    C.RENDER.lampLights = p.lampLights !== false;
  }
  function refreshQualityButtons() {
    var btns = document.querySelectorAll('.q-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-q') === quality);
    }
  }
  /* ---------- Post-processing (Tahap G4): bloom halus + FXAA ---------- */
  var composer = null, bloomPass = null, fxaaPass = null;

  function postFxAvailable() {
    return !!(THREE.EffectComposer && THREE.RenderPass && THREE.ShaderPass &&
              THREE.UnrealBloomPass && THREE.FXAAShader);
  }
  function updateFxaaResolution() {
    if (!fxaaPass || !renderer) return;
    var pr = renderer.getPixelRatio();
    fxaaPass.material.uniforms.resolution.value.set(
      1 / (window.innerWidth * pr),
      1 / (window.innerHeight * pr)
    );
  }
  /* Bloom cukup digambar setengah resolusi — nyaris tak terlihat bedanya,
     tetapi menghemat fill-rate terutama di iGPU. Dipanggil setelah composer.setSize. */
  function updateBloomSize() {
    if (!bloomPass || !renderer) return;
    var pr = renderer.getPixelRatio();
    bloomPass.setSize(
      Math.max(64, Math.round(window.innerWidth * pr * 0.5)),
      Math.max(64, Math.round(window.innerHeight * pr * 0.5))
    );
  }
  function buildComposer() {
    if (composer || !renderer || !postFxAvailable()) return;
    try {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      // Bloom lembut — hanya bagian sangat terang (matahari, api, kilau air)
      bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 0.20, 0.55, 0.90
      );
      composer.addPass(bloomPass);
      fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
      fxaaPass.renderToScreen = true;
      composer.addPass(fxaaPass);
      // Render target sRGB: warna scene persis seperti render langsung (r128)
      if (THREE.sRGBEncoding) {
        composer.renderTarget1.texture.encoding = THREE.sRGBEncoding;
        composer.renderTarget2.texture.encoding = THREE.sRGBEncoding;
      }
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(window.innerWidth, window.innerHeight);
      updateFxaaResolution();
      updateBloomSize();
      console.log('[Aetheria] Post-processing aktif (bloom + FXAA)');
    } catch (e) {
      composer = null;
      bloomPass = null;
      fxaaPass = null;
      if (window.console) console.warn('[Aetheria] Post-processing gagal:', e && e.message);
    }
  }
  function updatePostFx() {
    if (!renderer) return;
    if (C.RENDER.postFx) {
      buildComposer();
      if (composer) {
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(window.innerWidth, window.innerHeight);
        updateFxaaResolution();
        updateBloomSize();
      }
    }
  }

  function applySkyEnv() {
    if (world && world.sky && world.sky.setEnvEnabled) world.sky.setEnvEnabled(!!C.RENDER.env);
  }

  /* Pasang model 3D ke pemain/penduduk/makhluk bila preset kualitas mengizinkan.
     Aman dipanggil berkali-kali (idempoten) dan saat ganti preset di tengah main. */
  function attachAssets() {
    if (!assets || !assets.ready || !C.RENDER.models) return;
    if (village) village.attachModels(assets);
    if (player) player.attachModel(assets);
    if (enemies) enemies.attachModels(assets);
  }

  function selectQuality(n) {
    if (!C.RENDER.presets || !C.RENDER.presets[n]) return;
    quality = n;
    applyQualityToConfig(n);
    saveQuality(n);
    if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, C.RENDER.pixelRatio));
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    if (world && world.sunLight) {
      var sh = world.sunLight.shadow;
      sh.mapSize.width = C.RENDER.shadowMap;
      sh.mapSize.height = C.RENDER.shadowMap;
      if (sh.map) { sh.map.dispose(); sh.map = null; } // paksa pembuatan ulang
    }
    applySkyEnv();
    updatePostFx();
    attachAssets(); // bila beralih ke HD/Ultra, model 3D langsung dipasang
    refreshQualityButtons();
  }

  var dom = {};
  function $(id) { return document.getElementById(id); }
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function boot() {
    dom.canvas = $('scene');
    dom.menu = $('menu');
    dom.pause = $('pause');
    dom.loading = $('loading');
    dom.hud = $('hud');
    dom.hotbar = $('hotbar');
    dom.playerTag = $('player-tag');
    dom.bagBtn = $('bag-btn');
    dom.bagBtn2 = $('btn-hud-bag');
    dom.invClose = $('inv-close');
    dom.minimap = $('minimap');
    dom.minimapCanvas = $('minimap-canvas');
    dom.mmMode = $('mm-mode');
    dom.mapBtn = $('btn-hud-map');
    dom.worldmap = $('worldmap');
    dom.worldmapCanvas = $('worldmap-canvas');
    dom.wmTarget = $('wm-target');
    dom.wmClear = $('wm-clear');
    dom.wmGo = $('wm-go');
    dom.wmClose = $('wm-close');
    dom.wmVitals = $('wm-vitals');
    dom.waypoint = $('waypoint');
    dom.wpArrow = $('wp-arrow');
    dom.wpLabel = $('wp-label');
    dom.wpDist = $('wp-dist');
    dom.wpClear = $('wp-clear');
    dom.pauseBtn = $('btn-hud-pause');
    dom.questBtn = $('btn-hud-quest');
    dom.hotSlots = $('hotbar-slots');
    dom.lowhp = $('lowhp');
    dom.btnContinue = $('btn-continue');
    dom.btnSave = $('btn-save');
    dom.btnLoad = $('btn-load');
    dom.menuSaveInfo = $('menu-save-info');
    dom.pauseSaveInfo = $('pause-save-info');
    dom.loadingText = $('loading-text');
    dom.loadingFill = $('loading-fill');
    dom.clock = $('hud-clock');
    dom.debug = $('debug');
    dom.dbgFps = $('dbg-fps');
    dom.dbgPos = $('dbg-pos');
    dom.dbgInfo = $('dbg-info');
    dom.settings = $('settings');
    dom.exitdlg = $('exitdlg');
    dom.exitAsk = $('exit-ask');
    dom.exitBye = $('exit-bye');

    try {
      renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true });
    } catch (e) {
      dom.loadingText.textContent = 'Browser Anda tidak mendukung WebGL. :(';
      return;
    }
    quality = loadQuality();
    applyQualityToConfig(quality);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, C.RENDER.pixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xB8C3BE, 1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    if (window.TexLib) window.TexLib.setAnisotropy(renderer.capabilities.getMaxAnisotropy());

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      C.CAMERA.fov, window.innerWidth / window.innerHeight,
      C.CAMERA.near, C.CAMERA.far
    );

    window.Input.init(dom.canvas);
    window.UI.init();
    if (window.Lang) { window.Lang.load(); window.Lang.applyDom(); }
    rpgStats = new window.RPG.Stats();
    window.addEventListener('resize', onResize);
    wireUi();

    world = new window.World(scene, { renderer: renderer });
    if (hashParams.time) world.timeOfDay = parseFloat(hashParams.time); // waktu uji
    runLoadingSequence();
  }

  /* ---------- Pemuatan bertahap (async didukung; setiap tahap terlihat di layar) ---------- */
  var stages = [
    ['Membangun terrain pulau...', function () { world.buildTerrain(); }],
    ['Mengalirkan lautan...', function () { world.buildWater(); }],
    ['Memasang langit & siklus siang-malam...', function () { world.buildSky(); applySkyEnv(); }],
    ['Memuat model 3D...', function () {
      if (!window.AssetLibrary) return null;
      assets = new window.AssetLibrary();
      return assets.load(function (done, total) {
        dom.loadingText.textContent = Lstr('Memuat model 3D...') + ' (' + done + '/' + total + ')';
      });
    }],
    ['Menumbuhkan hutan pinus & batu...', function () { world.buildEnvironment(assets); }],
    ['Membangun Aldenmere & penduduk...', function () {
      village = new window.Village(scene, world);
      village.build();
      attachAssets();
    }],
    ['Membangun pelabuhan & perahu...', function () {
      if (!window.Boat) return;
      boat = new window.Boat(scene, world);
      boat.build();
    }],
    ['Menanam rumput & bunga...', function () { grass = new window.GrassField(scene, world); grass.build(); }],
    ['Menciptakan pemain...', function () {
      player = new window.Player(scene, world);
      attachAssets();
    }],
    ['Membangkitkan penghuni rimba...', function () { buildEnemies(); }],
    ['Menyiapkan peta & efek...', function () {
      if (window.Effects) window.Effects.init(scene);
      if (window.Minimap && dom.minimapCanvas && world) {
        minimap = new window.Minimap();
        if (!minimap.init(dom.minimapCanvas, world)) minimap = null;
        if (minimap && dom.worldmapCanvas) minimap.initBig(dom.worldmapCanvas);
        syncMapLabel();
        if (dom.minimap) dom.minimap.classList.toggle('hidden', !minimap || !minimap.visible);
      }
    }],
    ['Menyiapkan awal perjalanan...', function () { setupStartCamera(); }]
  ];

  /* Fase 3: makhluk, pertarungan, jarahan */
  function buildEnemies() {
    enemies = new window.Enemies(scene, world);
    enemies.build();
    attachAssets();
    player.onSwingHit = function () {
      if (state !== 'playing') return;
      window.AudioMan.sfx('hit');
      enemies.playerHit(player.position.x, player.position.z, player.yaw, rpgStats.getDamage(), rpgStats);
    };
    enemies.hooks = {
      onPlayerHurt: onPlayerHurt,
      onAggro: function (enemy) {
        if (combatGreeted) return;
        combatGreeted = true;
        window.UI.toast('⚔️ ' + enemy.def.label + ' menyerang! Klik kiri untuk melawan');
      },
      onHitEnemy: function (enemy, died) {
        if (window.Effects && enemy && enemy.group) {
          var ep = enemy.group.position;
          window.Effects.hit(ep.x, ep.y, ep.z, died);
        }
        addShake(died ? 0.14 : 0.07, died ? 0.07 : 0.035);
      },
      onKill: function () {},
      onLevelUp: function (stats) {
        window.AudioMan.sfx('levelup');
        if (window.Effects && player) {
          window.Effects.levelUp(player.position.x, player.position.y, player.position.z);
        }
        addShake(0.2, 0.08);
        window.UI.toast('⬆️ Naik ke level ' + stats.level + '! HP & serangan bertambah');
      },
      onLoot: function (id, n) {
        window.AudioMan.sfx('pickup');
        var it = window.RPG.ITEMS[id];
        window.UI.toast('+' + n + ' ' + (it ? it.icon + ' ' + it.name : id));
        if (window.Effects && player) {
          window.Effects.burst(player.position.x, player.position.y + 1.0, player.position.z, {
            color: 0xffd166, count: 5, speed: 1.6, up: 2.2, gravity: 4, life: 0.5
          });
        }
        if (window.UI.isInventoryOpen()) window.UI.refreshInventory(rpgStats);
      }
    };
  }

  function onPlayerHurt(dmg, sx, sz) {
    if (state !== 'playing') return;
    // Peta besar menutup HUD; serangan musuh saat membaca peta langsung
    // menutupnya agar pemain bisa bereaksi (dunia memang tetap berjalan).
    var fromMap = worldMapOpen;
    if (fromMap) closeWorldMap(true);
    window.AudioMan.sfx('hurt');
    var died = rpgStats.damage(dmg);
    window.UI.damageFlash();
    if (fromMap) window.UI.toast('⚠️ ' + L('map.attacked', 'Kamu diserang!'));
    if (window.Effects) {
      window.Effects.burst(player.position.x, player.position.y + 1.0, player.position.z, {
        color: 0xff6b5a, count: 10, speed: 2.6, up: 2.2, gravity: 9, life: 0.55
      });
    }
    addShake(0.26, 0.16);
    player.knockback(player.position.x - sx, player.position.z - sz, 5.5);
    if (died) startDeath();
  }

  function addShake(dur, mag) {
    if (!(dur > 0) || !(mag > 0)) return;
    if (shakeT <= 0) {
      shakeT = dur;
      shakeDur = dur;
      shakeMag = mag;
      return;
    }
    shakeT = Math.max(shakeT, dur);
    shakeDur = Math.max(shakeDur, dur);
    shakeMag = Math.max(shakeMag, mag);
  }

  function startDeath() {
    if (state !== 'playing') return;
    state = 'dead';
    closeWorldMap(true);
    window.UI.closeDialog();
    window.UI.closeInventory();
    window.UI.showPrompt(null);
    window.UI.setVitals(rpgStats.hp, rpgStats.maxHp, rpgStats.level, rpgStats.xp, rpgStats.xpNeed());
    window.UI.showDeath();
    addShake(0.5, 0.22);
  }

  function respawn() {
    if (state !== 'dead') return;
    var spawn = world.findSpawnPoint();
    player.position.set(spawn.x, world.groundHeight(spawn.x, spawn.z), spawn.z);
    player.velocity.set(0, 0, 0);
    player.swimming = false;
    player.grounded = true;
    player.yaw = Math.atan2(-spawn.x, -spawn.z);
    player.group.rotation.y = player.yaw;
    camYaw = player.yaw;
    smoothFocus.copy(player.getFocus(tmpFocus));
    rpgStats.hp = rpgStats.maxHp;
    window.UI.hideDeath();
    state = 'playing';
    shakeT = 0; shakeMag = 0;
    if (boat) boat.forceExit();
    window.UI.toast('💪 Kau bangkit kembali di pantai');
  }

  /* ---------- Fase 4: simpan / muat ---------- */
  function clampInt(v, a, b) {
    v = Math.floor(Number(v));
    if (!isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function clockText(t) {
    var mins = Math.round((((Number(t) || 0) % 1) + 1) % 1 * 1440) % 1440;
    return pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60);
  }

  function saveMetaText(rec) {
    if (!rec || !rec.data) return '';
    var p = rec.data.player || {};
    var w = rec.data.world || {};
    var date = new Date(rec.savedAt || Date.now());
    var en = !!(window.Lang && window.Lang.get() === 'en');
    var locale = en ? 'en-GB' : 'id-ID';
    var dateStr = '', timeStr = '';
    try {
      dateStr = date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      timeStr = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      dateStr = date.getDate() + '/' + (date.getMonth() + 1);
      timeStr = pad2(date.getHours()) + ':' + pad2(date.getMinutes());
    }
    return 'Lv ' + (p.level || 1) + ' · ' + clockText(w.timeOfDay) + ' · ' + dateStr + ' ' + timeStr;
  }

  function refreshSaveUi() {
    var rec = window.SaveGame ? window.SaveGame.read() : null;
    var meta = rec ? saveMetaText(rec) : '';
    if (dom.btnContinue) {
      dom.btnContinue.classList.toggle('hidden', !rec);
      dom.btnContinue.title = rec ? meta : '';
    }
    if (dom.menuSaveInfo) {
      dom.menuSaveInfo.classList.toggle('hidden', !rec);
      dom.menuSaveInfo.textContent = rec ? (L('save.last', 'Terakhir disimpan: ') + meta) : '';
    }
    if (dom.btnLoad) dom.btnLoad.disabled = !rec;
    if (dom.pauseSaveInfo) {
      dom.pauseSaveInfo.textContent = rec
        ? (L('save.last', 'Terakhir disimpan: ') + meta)
        : L('save.none', 'Belum ada simpanan');
      dom.pauseSaveInfo.style.color = '';
    }
    return rec;
  }

  function buildSnapshot() {
    var inv = Object.create(null);
    var id;
    for (id in rpgStats.inventory) {
      if (Object.prototype.hasOwnProperty.call(rpgStats.inventory, id)) {
        inv[id] = rpgStats.inventory[id];
      }
    }
    var palms = [];
    var i;
    for (i = 0; i < world.palms.length; i++) palms.push(!!world.palms[i].taken);
    var npcLines = [];
    for (i = 0; i < village.npcs.length; i++) npcLines.push(village.npcs[i].lineIdx || 0);
    var qk = village.quests.kelapa;
    var qb = village.quests.keranjang;
    return {
      playTime: playSeconds,
      player: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        yaw: player.yaw,
        level: rpgStats.level,
        xp: rpgStats.xp,
        hp: rpgStats.hp,
        maxHp: rpgStats.maxHp,
        baseDamage: rpgStats.baseDamage,
        inventory: inv
      },
      world: {
        timeOfDay: world.timeOfDay,
        elapsed: world.elapsed
      },
      palms: palms,
      boat: boat ? {
        x: boat.position.x,
        z: boat.position.z,
        yaw: boat.yaw,
        boarded: !!boat.boarded
      } : null,
      // Fase 5 lanjutan: tujuan peta ikut tersimpan (null = tidak ada).
      waypoint: waypoint ? {
        x: waypoint.x, z: waypoint.z, poi: waypoint.poi || null
      } : null,
      quests: {
        kelapa: { state: qk.state, count: qk.count, need: qk.need },
        keranjang: { state: qb.state }
      },
      npcLines: npcLines
    };
  }

  function applySnapshot(d) {
    if (!d || !d.player || !rpgStats || !player || !world) return false;
    var ps = d.player;

    // Statistik: level menentukan batas HP yang wajar; isi tas disaring.
    var level = clampInt(ps.level, 1, 99);
    var expectedMax = 100 + (level - 1) * 10;
    rpgStats.level = level;
    rpgStats.maxHp = Math.max(100, Math.min(clampInt(ps.maxHp, 100, 9999), expectedMax));
    rpgStats.hp = Math.max(1, Math.min(expectedMax, Math.floor(Number(ps.hp) || rpgStats.maxHp)));
    if (rpgStats.hp > rpgStats.maxHp) rpgStats.hp = rpgStats.maxHp;
    rpgStats.xp = clampInt(ps.xp, 0, Math.max(0, rpgStats.xpNeed() - 1));
    rpgStats.baseDamage = clampInt(ps.baseDamage, 1, 999);
    var inv = Object.create(null);
    var items = window.RPG ? window.RPG.ITEMS : {};
    if (ps.inventory && typeof ps.inventory === 'object') {
      for (var id in ps.inventory) {
        if (!Object.prototype.hasOwnProperty.call(ps.inventory, id)) continue;
        if (!Object.prototype.hasOwnProperty.call(items, id)) continue;
        var n = Math.floor(Number(ps.inventory[id]));
        if (n > 0) inv[id] = Math.min(n, 9999);
      }
    }
    rpgStats.inventory = inv;

    // Posisi & kamera. Batas hanya pengaman simpanan; dunia (termasuk lautan)
    // tidak punya dinding tak terlihat.
    var lim = C.WORLD.exploreLimit || 100000;
    var x = Math.max(-lim, Math.min(lim, Number(ps.x) || 0));
    var z = Math.max(-lim, Math.min(lim, Number(ps.z) || 0));
    var y = Number(ps.y);
    var ground = world.groundHeight(x, z);
    if (!isFinite(y)) y = ground;
    if (y < ground - 0.4) y = ground;
    if (y > 400 * (C.WORLD.scale || 1)) y = Math.max(ground, 0);
    var support = world.supportHeight ? world.supportHeight(x, z, y) : ground;
    if (y < support - 0.2) y = support;
    player.position.set(x, y, z);
    player.velocity.set(0, 0, 0);
    player.currentSpeed = 0;
    var waterY = world.waterLevelAt
      ? world.waterLevelAt(x, z, world.elapsed || 0)
      : (world.waveHeight
        ? world.waveHeight(x, z, world.elapsed || 0)
        : ((C.WATER && C.WATER.level) || 0));
    player.swimming = support <= ground + 0.05 && ground < waterY - C.PLAYER.swimDepth;
    player.grounded = !player.swimming;
    player.groundedTimer = player.swimming ? 0 : 0.12;
    player.attackTimer = 0;
    player.attackCooldown = 0;
    player._hitDone = false;
    var yaw = Number(ps.yaw);
    player.yaw = isFinite(yaw) ? yaw : Math.atan2(-x, -z);
    player.group.rotation.y = player.yaw;
    camYaw = player.yaw;
    camPitch = 0.30;
    camDist = C.CAMERA.distance;
    camDistSmooth = camDist;
    smoothFocus.copy(player.getFocus(tmpFocus));
    shakeT = 0; shakeMag = 0;

    // Waktu dunia.
    var t = d.world && Number(d.world.timeOfDay);
    if (isFinite(t)) world.timeOfDay = ((t % 1) + 1) % 1;
    var el = d.world && Number(d.world.elapsed);
    if (isFinite(el) && el >= 0) world.elapsed = el;

    // Kelapa yang sudah dipetik.
    if (Array.isArray(d.palms) && world.palms) {
      for (var pi = 0; pi < world.palms.length; pi++) {
        world.palms[pi].taken = !!d.palms[pi];
      }
    }

    // Tugas desa + keranjang.
    var qs = village.quests.kelapa;
    var qk = d.quests && d.quests.kelapa;
    var validKelapa = { belum: 1, cari: 1, kembali: 1, selesai: 1 };
    if (qk && validKelapa[qk.state]) {
      qs.state = qk.state;
      qs.count = clampInt(qk.count, 0, qs.need);
      if (qs.state === 'belum') qs.count = 0;
      if (qs.state === 'cari' && qs.count >= qs.need) qs.state = 'kembali';
      if (qs.state === 'kembali' && qs.count < qs.need) qs.count = qs.need;
    }
    var qb = d.quests && d.quests.keranjang;
    var validBasket = { belum: 1, cari: 1, kembali: 1, selesai: 1 };
    if (qb && validBasket[qb.state]) village.quests.keranjang.state = qb.state;
    if (village.basket) village.basket.visible = village.quests.keranjang.state === 'cari';

    // Variasi dialog warga.
    if (Array.isArray(d.npcLines) && village.npcs) {
      for (var ni = 0; ni < village.npcs.length; ni++) {
        var line = Math.floor(Number(d.npcLines[ni]));
        if (isFinite(line) && line >= 0) village.npcs[ni].lineIdx = line;
      }
    }

    // Perahu (Fase 5): posisi, arah, dan status menaiki.
    if (boat) {
      if (d.boat) {
        boat.setPose(Number(d.boat.x) || 0, Number(d.boat.z) || 0, Number(d.boat.yaw) || 0, !!d.boat.boarded);
        if (boat.boarded) boat._placeRider(player);
      } else {
        boat.forceExit();
      }
    }

    // Tujuan peta (Fase 5 lanjutan) — simpanan lama tanpa field ini tetap sah.
    waypoint = null;
    if (d.waypoint && typeof d.waypoint === 'object') {
      var wx = Number(d.waypoint.x), wz = Number(d.waypoint.z);
      if (isFinite(wx) && isFinite(wz) &&
          Math.abs(wx) <= lim && Math.abs(wz) <= lim) {
        waypoint = {
          x: wx, z: wz,
          poi: (typeof d.waypoint.poi === 'string' && MAP_POI[d.waypoint.poi])
            ? d.waypoint.poi : null
        };
      }
    }
    updateWaypointHud();
    updateBeacon();

    playSeconds = Math.max(0, Number(d.playTime) || 0);
    village.updateTracker();
    window.UI.closeDialog();
    window.UI.closeInventory();
    window.UI.showPrompt(null);
    window.UI.hideDeath();
    window.UI.setVitals(rpgStats.hp, rpgStats.maxHp, rpgStats.level, rpgStats.xp, rpgStats.xpNeed());
    window.UI.refreshHotbar(rpgStats, {
      kelapa: village.quests.kelapa.count,
      force: true
    });
    if (dom.lowhp) {
      dom.lowhp.style.opacity = '0';
      dom.lowhp.classList.remove('active');
    }
    shakeT = 0; shakeMag = 0; footstepT = 0;
    if (window.Effects) window.Effects.clear();
    return true;
  }

  function saveGame(quiet) {
    if (!window.SaveGame || !world || !player || !rpgStats) return false;
    if (state !== 'playing' && state !== 'paused') return false;
    var ok = window.SaveGame.write(buildSnapshot());
    if (ok) {
      autoSaveT = 0;
      if (!quiet) window.AudioMan.sfx('save');
      var rec = refreshSaveUi();
      if (state === 'paused' && dom.pauseSaveInfo) {
        dom.pauseSaveInfo.textContent = L('save.saved', '✓ Permainan disimpan') +
          (rec ? ' · ' + saveMetaText(rec) : '');
        dom.pauseSaveInfo.style.color = '#bff0cf';
      } else if (!quiet) {
        window.UI.toast('💾 ' + L('save.saved', 'Permainan disimpan') + ' · Lv ' + rpgStats.level);
      }
    } else if (state === 'paused' && dom.pauseSaveInfo) {
      dom.pauseSaveInfo.textContent = L('save.failed', 'Gagal menyimpan — penyimpanan peramban penuh/diblokir');
      dom.pauseSaveInfo.style.color = '#ff9c9c';
    } else if (!quiet) {
      window.UI.toast('⚠️ ' + L('save.failed', 'Gagal menyimpan — penyimpanan peramban penuh/diblokir'));
    }
    return ok;
  }

  function loadGame() {
    if (!window.SaveGame || !world || !player) return false;
    var rec = window.SaveGame.read();
    if (!rec) {
      refreshSaveUi();
      window.UI.toast('📂 ' + L('save.notFound', 'Simpanan tidak ditemukan'));
      return false;
    }
    if (!applySnapshot(rec.data)) return false;

    hide(dom.menu);
    hide(dom.pause);
    hide(dom.settings);
    if (dom.exitdlg) hide(dom.exitdlg);
    window.UI.hideDeath();
    show(dom.hud);
    if (player) player.group.visible = true;
    if (dom.minimap && minimap) dom.minimap.classList.toggle('hidden', !minimap.visible);
    state = 'playing';
    if (worldMapOpen) closeWorldMap(true);
    greeted = true;
    combatGreeted = false;
    autoSaveT = 0;
    window.AudioMan.unlock();
    window.AudioMan.startAmbience();
    window.AudioMan.sfx('load');
    syncMapLabel();
    updateWaypointHud();
    updateBeacon();
    refreshSaveUi();
    window.UI.toast('📂 ' + L('save.loaded', 'Simpanan dimuat') + ' · Lv ' + rpgStats.level);
    return true;
  }

  /* Peta (Fase 5): M mengganti mode peta mini; klik peta mini / tombol peta
     membuka peta besar untuk memilih tujuan (Fase 5 lanjutan). */
  function syncMapLabel() {
    if (!dom.mmMode) return;
    var t = minimap ? minimap.label() : '';
    if (t === 'DUNIA') t = L('map.world', 'DUNIA');
    else if (t === 'SEKITAR') t = L('map.near', 'SEKITAR');
    else if (t === 'LOKAL') t = L('map.local', 'LOKAL');
    dom.mmMode.textContent = t;
    dom.mmMode.classList.toggle('hidden', !t);
  }

  function cycleMapMode() {
    if (!minimap || worldMapOpen) return;
    minimap.cycle();
    if (dom.minimap) dom.minimap.classList.toggle('hidden', !minimap.visible);
    syncMapLabel();
    window.AudioMan.sfx('click');
  }

  // Nama lama tetap ada agar hook/tautan lama tidak rusak.
  function toggleMinimap() { cycleMapMode(); }

  /* ---------- Fase 5 lanjutan: peta besar, tujuan, kompas, mercusuar ---------- */
  function mapPois() {
    var list = [];
    if (world && world.villageSpots && world.villageSpots[0]) {
      list.push({
        id: 'village', x: world.villageSpots[0].x, z: world.villageSpots[0].z,
        label: L('map.poi.village', 'Desa Aldenmere')
      });
    }
    if (world && world.harborSpot) {
      list.push({
        id: 'harbor', x: world.harborSpot.x, z: world.harborSpot.z,
        label: L('map.poi.harbor', 'Pelabuhan')
      });
    }
    if (world && world.islandSites) {
      for (var i = 0; i < world.islandSites.length && i < 2; i++) {
        list.push({
          id: i === 0 ? 'hut' : 'hut2',
          x: world.islandSites[i].x, z: world.islandSites[i].z,
          label: i === 0 ? L('map.poi.hut', 'Pondok Dera')
            : L('map.poi.hut2', 'Pondok Pulau')
        });
      }
    }
    if (world && world.kingdomSite) {
      list.push({
        id: 'kingdom', x: world.kingdomSite.x, z: world.kingdomSite.z,
        label: L('map.poi.kingdom', 'Kerajaan Pusat Aetheria')
      });
    }
    if (world && world.empireSite) {
      list.push({
        id: 'empire', x: world.empireSite.x, z: world.empireSite.z,
        label: L('map.poi.empire', 'Kekaisaran Aetheria')
      });
    }
    if (world && world.landmarks) {
      var lmLabels = {
        castle: ['map.poi.castle', 'Reruntuhan Kastil'],
        chapel: ['map.poi.chapel', 'Kapel Tua'],
        stones: ['map.poi.stones', 'Lingkaran Batu']
      };
      for (var li = 0; li < world.landmarks.length; li++) {
        var lm = world.landmarks[li];
        var lab = lmLabels[lm.id];
        if (!lab) continue;
        list.push({ id: lm.id, x: lm.x, z: lm.z, label: L(lab[0], lab[1]) });
      }
    }
    return list;
  }

  function waypointLabel() {
    if (!waypoint) return '';
    if (waypoint.poi === 'village') return L('map.poi.village', 'Desa Aldenmere');
    if (waypoint.poi === 'harbor') return L('map.poi.harbor', 'Pelabuhan');
    if (waypoint.poi === 'hut') return L('map.poi.hut', 'Pondok Dera');
    if (waypoint.poi === 'hut2') return L('map.poi.hut2', 'Pondok Pulau');
    if (waypoint.poi === 'castle') return L('map.poi.castle', 'Reruntuhan Kastil');
    if (waypoint.poi === 'kingdom') return L('map.poi.kingdom', 'Kerajaan Pusat Aetheria');
    if (waypoint.poi === 'empire') return L('map.poi.empire', 'Kekaisaran Aetheria');
    if (waypoint.poi === 'chapel') return L('map.poi.chapel', 'Kapel Tua');
    if (waypoint.poi === 'stones') return L('map.poi.stones', 'Lingkaran Batu');
    return L('map.freeTarget', 'Tujuan');
  }

  function fmtDistance(d) {
    if (!isFinite(d) || d < 0) d = 0;
    if (d >= 1000) {
      var km = (d / 1000).toFixed(1);
      if (window.Lang && window.Lang.get() === 'id') km = km.replace('.', ',');
      return km + ' km';
    }
    return Math.round(d) + ' m';
  }

  function waypointDistance() {
    if (!waypoint || !player) return 0;
    var dx = waypoint.x - player.position.x;
    var dz = waypoint.z - player.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function targetText() {
    if (!waypoint) return L('map.noTarget', 'Belum ada tujuan — klik lokasi di peta');
    var dist = fmtDistance(waypointDistance());
    if (waypoint.poi) {
      return L('map.targetPrefix', 'Tujuan') + ': ' + waypointLabel() + ' · ±' + dist;
    }
    return L('map.targetPrefix', 'Tujuan') + ' · ±' + dist;
  }

  function updateWaypointHud() {
    if (!dom.waypoint) return;
    var showChip = !!waypoint && state === 'playing' && !worldMapOpen && !!player;
    dom.waypoint.classList.toggle('hidden', !showChip);
    if (!showChip) return;

    var dx = waypoint.x - player.position.x;
    var dz = waypoint.z - player.position.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var distText = fmtDistance(dist);
    var label = waypointLabel();
    var rel = window.Minimap ? window.Minimap.bearingTo(camYaw, dx, dz) : 0;
    var arrow = 'rotate(' + (rel * 180 / Math.PI).toFixed(1) + 'deg)';
    if (dom.wpArrow && dom.wpArrow.style.transform !== arrow) {
      dom.wpArrow.style.transform = arrow;
    }
    if (dom.wpDist && dom.wpDist.textContent !== distText) {
      dom.wpDist.textContent = distText;
    }
    if (dom.wpLabel && dom.wpLabel.textContent !== label) {
      dom.wpLabel.textContent = label;
    }
    var title = label + ' · ' + distText;
    if (dom.waypoint.title !== title) dom.waypoint.title = title;

    // Sampai di tujuan → bersihkan otomatis.
    if (dist <= 3.2) {
      waypoint = null;
      dom.waypoint.classList.add('hidden');
      updateBeacon();
      window.UI.toast('📍 ' + L('map.arrived', 'Tiba di tujuan'));
    }
  }

  function setWaypoint(x, z, poi) {
    if (!world || !player) return false;
    x = Number(x); z = Number(z);
    if (!isFinite(x) || !isFinite(z)) return false;
    var lim = C.WORLD.exploreLimit || 100000;
    waypoint = {
      x: U.clamp(x, -lim, lim),
      z: U.clamp(z, -lim, lim),
      poi: (typeof poi === 'string' && MAP_POI[poi]) ? poi : null
    };
    updateWaypointHud();
    updateBeacon();
    if (worldMapOpen) {
      drawBigMap();
      updateWorldMapHud();
    }
    return true;
  }

  function clearWaypoint(notify) {
    var had = !!waypoint;
    waypoint = null;
    updateWaypointHud();
    updateBeacon();
    if (worldMapOpen) {
      drawBigMap();
      updateWorldMapHud();
    }
    if (notify && had && !worldMapOpen) {
      window.UI.toast('📍 ' + L('map.cleared', 'Tujuan dihapus'));
    }
  }

  function ensureBeacon() {
    if (beacon || !scene) return;
    beacon = new THREE.Group();
    var beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd166, transparent: true, opacity: 0.2,
      depthWrite: false, side: THREE.DoubleSide, fog: false,
      blending: THREE.AdditiveBlending
    });
    beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.45, 64, 8, 1, true), beamMat);
    beaconBeam.position.y = 32;
    beaconBeam.renderOrder = 2;
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd166, transparent: true, opacity: 0.45,
      depthWrite: false, side: THREE.DoubleSide, fog: false,
      blending: THREE.AdditiveBlending
    });
    beaconRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.6, 24), ringMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.y = 0.12;
    beaconRing.renderOrder = 2;
    beaconGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff0b8, fog: false })
    );
    beaconGem.position.y = 6;
    beaconGem.renderOrder = 2;
    beacon.add(beaconBeam);
    beacon.add(beaconRing);
    beacon.add(beaconGem);
    beacon.visible = false;
    scene.add(beacon);
  }

  function updateBeacon(dt) {
    if (!waypoint || state !== 'playing') {
      if (beacon) beacon.visible = false;
      return;
    }
    if (!beacon) ensureBeacon();
    if (!beacon) return;
    var g = world.groundHeight(waypoint.x, waypoint.z);
    beacon.position.set(waypoint.x, Math.max(g, 0.12), waypoint.z);
    beacon.visible = true;
    beaconT += Math.min(dt || 0, 0.05);
    if (beaconGem) {
      beaconGem.rotation.y = beaconT * 1.7;
      beaconGem.position.y = 6 + Math.sin(beaconT * 2.1) * 0.45;
    }
    if (beaconRing) {
      var s = 1 + Math.sin(beaconT * 2.6) * 0.18;
      beaconRing.scale.set(s, s, s);
      beaconRing.material.opacity = 0.32 + 0.18 * (0.5 + 0.5 * Math.sin(beaconT * 2.6));
    }
    if (beaconBeam) {
      beaconBeam.material.opacity = 0.16 + 0.08 * (0.5 + 0.5 * Math.sin(beaconT * 1.7));
    }
  }

  function drawBigMap() {
    if (!minimap || !minimap.hasBig || !minimap.hasBig() || !player) return;
    minimap.drawBig({
      world: world, player: player, boat: boat, camYaw: camYaw,
      waypoint: waypoint, pois: mapPois(), north: L('hud.north', 'U'),
      playerLabel: L('map.legend.you', 'Kamu'),
      boatLabel: L('map.legend.boat', 'Perahu'),
      targetLabel: L('map.legend.target', 'Tujuan')
    });
  }

  function updateWorldMapHud() {
    if (!dom.wmTarget || !world || !rpgStats) return;
    dom.wmTarget.textContent = targetText();
    if (dom.wmClear) dom.wmClear.disabled = !waypoint;
    if (dom.wmGo) {
      dom.wmGo.textContent = waypoint
        ? L('map.closeGo', 'Tutup & Jalan')
        : L('map.close', 'Tutup');
    }
    if (dom.wmVitals) {
      var info = world.getClockInfo();
      dom.wmVitals.textContent = '❤️ ' + Math.round(rpgStats.hp) + '/' + rpgStats.maxHp +
        ' · ✦ ' + rpgStats.xp + '/' + rpgStats.xpNeed() + ' · ' + info.text;
    }
  }

  function updateWorldMap(dt) {
    if (!worldMapOpen) return;
    if (state !== 'playing') { closeWorldMap(true); return; }
    wmAcc += dt || 0;
    if (wmAcc < 0.2) return;
    wmAcc = 0;
    drawBigMap();
    updateWorldMapHud();
  }

  function openWorldMap() {
    if (worldMapOpen || state !== 'playing' || !world || !player) return;
    if (!dom.worldmap || !minimap || !minimap.hasBig || !minimap.hasBig()) return;
    if (window.UI.isDialogOpen()) window.UI.closeDialog();
    if (window.UI.isInventoryOpen()) setBagOpen(false);
    window.UI.showPrompt(null);
    worldMapOpen = true;
    wmAcc = 0;
    hide(dom.hud);
    show(dom.worldmap);
    drawBigMap();
    updateWorldMapHud();
    window.AudioMan.sfx('click');
  }

  function closeWorldMap(silent) {
    if (!worldMapOpen) return;
    worldMapOpen = false;
    if (dom.worldmap) hide(dom.worldmap);
    if (state === 'playing') show(dom.hud);
    updateWaypointHud();
    updateBeacon();
    if (!silent) {
      if (waypoint) window.UI.toast('📍 ' + targetText());
      window.AudioMan.sfx('click');
    }
  }

  /* Debu kecil mengikuti langkah saat pemain berjalan/berlari. */
  function updateFootsteps(dt, enabled) {
    if (!enabled || !player || !window.Effects) { footstepT = 0; return; }
    if (footstepT > 0) footstepT -= dt;
    if (footstepT > 0) return;
    if (!player.grounded || player.currentSpeed < 2.8 || player.position.y < 0.1) return;
    footstepT = player.currentSpeed > 8 ? 0.22 : 0.34;
    var a = player.yaw + (Math.random() - 0.5) * 0.9;
    window.Effects.dust(
      player.position.x - Math.sin(a) * 0.18,
      player.position.y + 0.06,
      player.position.z - Math.cos(a) * 0.18,
      player.currentSpeed > 8 ? 3 : 2
    );
  }

  function updateLowHp() {
    if (!dom.lowhp || !rpgStats) return;
    var frac = rpgStats.maxHp > 0 ? rpgStats.hp / rpgStats.maxHp : 1;
    var show = state === 'playing' && !window.UI.isInventoryOpen() && !worldMapOpen;
    var op = show && frac < 0.36 ? (0.36 - frac) / 0.36 : 0;
    dom.lowhp.style.opacity = (op * 0.85).toFixed(2);
    dom.lowhp.classList.toggle('active', op > 0);
  }

  function updateNightAudio() {
    if (!world || !window.AudioMan || !window.AudioMan.setNight) return;
    var sunY = Math.sin((world.timeOfDay - 0.25) * Math.PI * 2);
    var night = 1 - U.smoothstep(-0.06, 0.28, sunY);
    if (Math.abs(night - lastNight) > 0.04) {
      lastNight = night;
      window.AudioMan.setNight(night);
    }
  }

  /* Buka/tutup tas besar di tengah layar; lepas kunci mouse agar tombol bisa diklik. */
  function setBagOpen(open) {
    if (!rpgStats || state !== 'playing' || worldMapOpen) return;
    if (open && window.UI.isDialogOpen()) return;
    var isOpen = window.UI.isInventoryOpen();
    if (open === isOpen) return;
    window.UI.toggleInventory(rpgStats);
    if (open) window.UI.showPrompt(null);
  }

  /* Klik kotak hotbar: senjata menebas, daging dimakan, jarahan → keterangan. */
  function onHotbarClick(id) {
    if (!id || state !== 'playing' || worldMapOpen) return;
    if (id === 'weapon') {
      if (player.attack()) window.AudioMan.sfx('swing');
    } else if (id === 'daging') {
      eatFood();
    } else {
      var ITEMS = window.RPG ? window.RPG.ITEMS : {};
      var it = ITEMS[id];
      window.UI.toast((it ? it.icon + ' ' + it.name : '❔ ' + id) + ' — jarahan dari penghuni rimba');
    }
  }

  function eatFood() {
    if (rpgStats.count('daging') <= 0) {
      window.UI.toast('🥩 Tidak ada daging — buru celeng hutan dulu!');
      return;
    }
    if (rpgStats.hp >= rpgStats.maxHp) {
      window.UI.toast('❤️ HP sudah penuh');
      return;
    }
    if (rpgStats.useConsumable('daging')) {
      window.UI.toast('🥩 Makan daging — +30 HP');
      window.UI.setVitals(rpgStats.hp, rpgStats.maxHp, rpgStats.level, rpgStats.xp, rpgStats.xpNeed());
      window.UI.refreshHotbar(rpgStats);
      if (window.UI.isInventoryOpen()) window.UI.refreshInventory(rpgStats);
    }
  }

  function runLoadingSequence() {
    var i = 0;
    function step() {
      if (i >= stages.length) { finishLoading(); return; }
      var label = stages[i][0];
      var fn = stages[i][1];
      dom.loadingText.textContent = Lstr(label);
      dom.loadingFill.style.width = Math.round((i / stages.length) * 100) + '%';
      requestAnimationFrame(function () {
        setTimeout(function () {
          var t0 = performance.now();
          function done() {
            console.log('[Aetheria] ' + label + ' (' + (performance.now() - t0).toFixed(0) + ' ms)');
            i++;
            step();
          }
          try {
            var r = fn();
            if (r && typeof r.then === 'function') r.then(done, done);
            else done();
          } catch (e) {
            console.error('[Aetheria] Gagal saat: ' + label, e);
            done();
          }
        }, 30);
      });
    }
    step();
  }

  function setupStartCamera() {
    // Hook uji: &pos=x,z memindahkan titik awal pemain (memudahkan inspeksi area)
    if (hashParams.pos) {
      var pp = hashParams.pos.split(',').map(parseFloat);
      if (pp.length === 2 && isFinite(pp[0]) && isFinite(pp[1])) {
        player.position.set(pp[0], world.groundHeight(pp[0], pp[1]), pp[1]);
        player.yaw = Math.atan2(-pp[0], -pp[1]);
        player.group.rotation.y = player.yaw;
      }
    }
    camYaw = player.yaw;
    if (hashParams.yaw) camYaw += parseFloat(hashParams.yaw); // offset uji
    camPitch = 0.30;
    camDist = C.CAMERA.distance;
    camDistSmooth = camDist;
    smoothFocus.copy(player.getFocus(tmpFocus));
  }

  function finishLoading() {
    dom.loadingFill.style.width = '100%';
    dom.loadingText.textContent = L('loading.ready', 'Siap!');
    updatePostFx(); // siapkan bloom/FXAA sesuai preset kualitas
    setTimeout(function () {
      hide(dom.loading);
      show(dom.menu);
      state = 'menu';
      refreshSaveUi();
      console.log('[Aetheria] Dunia siap — silakan mulai menjelajah.');
      clock.start();
      animate();
      // Hook pengujian/otomasi
      window.__game = {
        world: world, player: player, camera: camera, renderer: renderer,
        grass: grass, village: village, enemies: enemies, stats: rpgStats, UI: window.UI,
        assets: assets,
        setQuality: selectQuality,
        getQuality: function () { return quality; },
        startTrailer: startTrailer,
        skipTrailer: function () { if (trailer) trailer.skip(); },
        getTrailer: function () { return trailer; },
        getState: function () { return state; },
        getLang: function () { return window.Lang.get(); },
        setLang: function (c) { window.Lang.set(c); },
        minimap: minimap,
        effects: window.Effects,
        save: function () { return saveGame(false); },
        load: function () { return loadGame(); },
        refreshSaveUi: refreshSaveUi,
        toggleMinimap: cycleMapMode,
        cycleMap: cycleMapMode,
        getMapMode: function () { return minimap ? minimap.mode : 'sembunyi'; },
        openMap: openWorldMap,
        closeMap: function () { closeWorldMap(); },
        isMapOpen: function () { return worldMapOpen; },
        getWaypoint: function () {
          return waypoint ? { x: waypoint.x, z: waypoint.z, poi: waypoint.poi } : null;
        },
        getWaypointLabel: waypointLabel,
        setWaypoint: function (x, z, poi) { return setWaypoint(x, z, poi); },
        clearWaypoint: function () { clearWaypoint(true); },
        getBeacon: function () { return beacon; },
        getCamYaw: function () { return camYaw; },
        boat: boat,
        getBoat: function () { return boat; },
        isBoarded: function () { return !!(boat && boat.boarded); },
        getPlayTime: function () { return playSeconds; },
        audio: window.AudioMan
      };
      window.__gameReady = true;
      // Hook pengujian: buka dengan index.html#autostart untuk langsung bermain
      if ('autostart' in hashParams) startGame();
    }, 350);
  }

  /* ---------- UI: menu, pengaturan, jeda, keluar ---------- */
  function openSettings() {
    if (dom.exitdlg) hide(dom.exitdlg);
    show(dom.settings);
  }

  function closeSettings() {
    hide(dom.settings);
  }

  function wireUi() {
    $('btn-start').addEventListener('click', startTrailer);
    if (dom.btnContinue) dom.btnContinue.addEventListener('click', function () { loadGame(); });
    $('btn-resume').addEventListener('click', startGame);
    if (dom.btnSave) dom.btnSave.addEventListener('click', function () { saveGame(false); });
    if (dom.btnLoad) dom.btnLoad.addEventListener('click', function () { loadGame(); });
    $('btn-menu').addEventListener('click', toMenu);
    $('btn-respawn').addEventListener('click', respawn);
    $('btn-how').addEventListener('click', function (e) {
      if (e) e.preventDefault();
      $('how-to').classList.toggle('hidden');
    });

    // Pengaturan: bisa dibuka dari menu utama maupun menu jeda
    $('btn-settings').addEventListener('click', openSettings);
    $('btn-pause-settings').addEventListener('click', openSettings);
    $('btn-settings-back').addEventListener('click', closeSettings);

    // Tab pengaturan: Audio / Grafik / Bahasa
    var tabs = document.querySelectorAll('.set-tab');
    for (var ti = 0; ti < tabs.length; ti++) {
      (function (tab) {
        tab.addEventListener('click', function () {
          for (var k = 0; k < tabs.length; k++) tabs[k].classList.toggle('active', tabs[k] === tab);
          var ids = ['pane-audio', 'pane-graphics', 'pane-language'];
          for (var p = 0; p < ids.length; p++) {
            var el = $(ids[p]);
            if (el) el.classList.toggle('hidden', ids[p] !== 'pane-' + tab.getAttribute('data-tab'));
          }
        });
      })(tabs[ti]);
    }

    // Audio: slider volume + contoh efek
    var vm = $('vol-music'), vs = $('vol-sfx');
    function syncVolLabels() {
      $('vol-music-val').textContent = Math.round(window.AudioMan.volMusic * 100) + '%';
      $('vol-sfx-val').textContent = Math.round(window.AudioMan.volSfx * 100) + '%';
    }
    if (vm) {
      vm.value = Math.round(window.AudioMan.volMusic * 100);
      vm.addEventListener('input', function () { window.AudioMan.setMusic(vm.value / 100); syncVolLabels(); });
    }
    if (vs) {
      vs.value = Math.round(window.AudioMan.volSfx * 100);
      vs.addEventListener('input', function () { window.AudioMan.setSfx(vs.value / 100); syncVolLabels(); });
    }
    syncVolLabels();
    $('btn-sfx-test').addEventListener('click', function () {
      window.AudioMan.unlock();
      window.AudioMan.startAmbience();
      window.AudioMan.sfx('levelup');
    });

    // Bahasa: Indonesia / English (antarmuka)
    var langBtns = document.querySelectorAll('.lang-btn');
    function refreshLangBtns() {
      for (var i = 0; i < langBtns.length; i++) {
        langBtns[i].classList.toggle('active', langBtns[i].getAttribute('data-lang') === window.Lang.get());
      }
    }
    for (var li = 0; li < langBtns.length; li++) {
      (function (b) {
        b.addEventListener('click', function () {
          window.Lang.set(b.getAttribute('data-lang'));
          refreshLangBtns();
          refreshSaveUi();
          syncMapLabel();
        });
      })(langBtns[li]);
    }
    refreshLangBtns();

    // Keluar: konfirmasi → coba tutup tab; bila ditolak peramban, tampilkan layar pamit
    $('btn-exit').addEventListener('click', function () {
      show(dom.exitdlg);
      show(dom.exitAsk);
      hide(dom.exitBye);
    });
    $('btn-exit-no').addEventListener('click', function () { hide(dom.exitdlg); });
    $('btn-exit-yes').addEventListener('click', function () {
      hide(dom.exitAsk);
      show(dom.exitBye);
      try { window.close(); } catch (e) {}
    });
    $('btn-bye-back').addEventListener('click', function () { hide(dom.exitdlg); });

    var qBtns = document.querySelectorAll('.q-btn');
    for (var qi = 0; qi < qBtns.length; qi++) {
      (function (b) {
        b.addEventListener('click', function () { selectQuality(b.getAttribute('data-q')); });
      })(qBtns[qi]);
    }
    refreshQualityButtons();

    // Suara: klik tombol + buka kunci audio pada gestur pertama
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('.btn, .set-tab, .lang-btn')) window.AudioMan.sfx('click');
      window.AudioMan.unlock();
      window.AudioMan.startAmbience();
    }, true);

    // Klik kiri hanya di atas kanvas dunia (bukan UI) — kamera diputar dengan
    // menahan tombol kanan (Fase 5: tanpa pointer lock).
    dom.canvas.addEventListener('click', function () {
      if (state !== 'playing' || worldMapOpen) return;
      if (window.UI.isInventoryOpen()) { setBagOpen(false); return; }
      if (window.UI.isDialogOpen()) { window.UI.advanceDialog(); return; }
    });
    if (dom.bagBtn) dom.bagBtn.addEventListener('click', function () {
      setBagOpen(!window.UI.isInventoryOpen());
    });
    if (dom.bagBtn2) dom.bagBtn2.addEventListener('click', function () {
      setBagOpen(!window.UI.isInventoryOpen());
    });
    if (dom.invClose) dom.invClose.addEventListener('click', function () {
      setBagOpen(false);
    });

    // Tombol HUD (Fase 5) — selalu bisa diklik: peta, jeda, tugas.
    if (dom.mapBtn) dom.mapBtn.addEventListener('click', function () { openWorldMap(); });
    if (dom.pauseBtn) dom.pauseBtn.addEventListener('click', function () { pauseGame(); });
    if (dom.questBtn) dom.questBtn.addEventListener('click', function () {
      var shown = window.UI.toggleQuest();
      window.UI.toast(shown ? '📜 Daftar tugas ditampilkan' : '📜 Daftar tugas disembunyikan');
    });
    // Klik peta mini = buka peta besar (mode peta tetap lewat M).
    if (dom.minimap) dom.minimap.addEventListener('click', function () { openWorldMap(); });

    // Peta besar: klik lokasi/POI, tutup, dan hapus tujuan.
    if (dom.worldmapCanvas) {
      dom.worldmapCanvas.addEventListener('click', function (e) {
        if (!worldMapOpen || !minimap) return;
        var hit = minimap.bigClick(e.clientX, e.clientY);
        if (!hit) return;
        setWaypoint(hit.x, hit.z, hit.poi);
        window.AudioMan.sfx('click');
      });
    }
    if (dom.worldmap) {
      dom.worldmap.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    if (dom.wmClose) dom.wmClose.addEventListener('click', function () { closeWorldMap(); });
    if (dom.wmGo) dom.wmGo.addEventListener('click', function () { closeWorldMap(); });
    if (dom.wmClear) dom.wmClear.addEventListener('click', function () { clearWaypoint(true); });
    if (dom.wpClear) dom.wpClear.addEventListener('click', function (e) {
      if (e) e.stopPropagation();
      clearWaypoint(true);
    });

    // Kotak hotbar bisa diklik: senjata menebas, daging dimakan, jarahan → info.
    if (dom.hotSlots) dom.hotSlots.addEventListener('click', function (e) {
      var slot = e.target && e.target.closest ? e.target.closest('.slot') : null;
      if (slot) onHotbarClick(slot.getAttribute('data-slot'));
    });
    window.addEventListener('keydown', function (e) {
      if (e.code === 'F3') {
        e.preventDefault();
        dom.debug.classList.toggle('hidden');
      }
      // Simpan cepat (Ctrl/Cmd + S) — hanya saat bermain atau jeda.
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS' && !e.repeat &&
          (state === 'playing' || state === 'paused')) {
        e.preventDefault();
        saveGame(false);
      }
      // Peta: M saat bermain (peta besar ditutup dulu dengan Esc).
      if (e.code === 'KeyM' && !e.repeat && state === 'playing' && !worldMapOpen &&
          !e.ctrlKey && !e.metaKey && !e.altKey) {
        cycleMapMode();
      }
      if (e.code === 'Escape') {
        if (worldMapOpen) { e.preventDefault(); closeWorldMap(); return; }
        if (window.UI.isInventoryOpen()) { setBagOpen(false); return; }
        if (dom.exitdlg && !dom.exitdlg.classList.contains('hidden')) { hide(dom.exitdlg); return; }
        if (dom.settings && !dom.settings.classList.contains('hidden')) { closeSettings(); return; }
        if (state === 'playing') {
          if (window.UI.isDialogOpen()) window.UI.closeDialog();
          else pauseGame();
        } else if (state === 'paused') {
          startGame(); // Esc menutup jeda (sama seperti tombol Lanjutkan)
        }
      }
    });
  }

  var trailer = null;

  /* Mulai → putar trailer sinematik dahulu, baru masuk permainan. */
  function startTrailer() {
    if (!window.Trailer || !world) { startGame(); return; }
    if (!trailer) trailer = new window.Trailer(camera, world);
    hide(dom.menu);
    hide(dom.settings);
    window.AudioMan.unlock();
    window.AudioMan.startAmbience();
    if (player) player.group.visible = false; // jangan tampak berdiri di trailer
    state = 'trailer';
    trailer.start(startGame);
  }

  function startGame() {
    if (worldMapOpen) closeWorldMap(true);
    hide(dom.menu);
    hide(dom.pause);
    hide(dom.settings);
    window.UI.hideDeath();
    show(dom.hud);
    if (player) player.group.visible = true;
    state = 'playing';
    autoSaveT = 0;
    shakeT = 0; shakeMag = 0;
    window.UI.setVitals(rpgStats.hp, rpgStats.maxHp, rpgStats.level, rpgStats.xp, rpgStats.xpNeed());
    syncMapLabel();
    updateWaypointHud();
    updateBeacon();
    if (!greeted) {
      greeted = true;
      window.UI.toast('💡 E bicara / naiki perahu · Klik Kiri menebas — tahan Klik Kanan untuk memutar kamera');
    }
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    closeWorldMap(true);
    window.UI.closeDialog();
    window.UI.closeInventory();
    window.UI.showPrompt(null);
    show(dom.pause);
    hide(dom.hud);
    if (dom.lowhp) {
      dom.lowhp.style.opacity = '0';
      dom.lowhp.classList.remove('active');
    }
    refreshSaveUi();
  }

  function toMenu() {
    state = 'menu';
    closeWorldMap(true);
    hide(dom.pause);
    hide(dom.hud);
    hide(dom.settings);
    hide(dom.exitdlg);
    window.UI.closeInventory();
    if (dom.lowhp) {
      dom.lowhp.style.opacity = '0';
      dom.lowhp.classList.remove('active');
    }
    show(dom.menu);
    refreshSaveUi();
  }

  /* ---------- Loop utama ---------- */
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);

    // Trailer sinematik: kamera dikendalikan trailer, dunia tetap hidup
    if (state === 'trailer' && trailer) {
      trailer.update(dt);
      player.update(dt, camYaw, false);
      world.update(dt, camera);
      if (grass && grass.update) grass.update(dt, { position: camera.position });
      village.update(dt, player);
      if (enemies) enemies.update(dt, player, camera, false, rpgStats);
      renderer.setClearColor(world.fogColor, 1);
      if (composer && C.RENDER.postFx) composer.render();
      else renderer.render(scene, camera);
      return;
    }

    var playing = state === 'playing';
    if (playing) {
      playSeconds += dt;
      autoSaveT += dt;
      if (autoSaveT >= 120) { // simpan otomatis tiap 2 menit
        autoSaveT = 0;
        saveGame(true);
      }
    }
    var m = window.Input.consumeMouse();
    if (playing && !worldMapOpen) {
      camYaw -= m.dx * C.CAMERA.mouseSens; // mouse kanan = kamera menoleh kanan
      camPitch = U.clamp(camPitch + m.dy * C.CAMERA.mouseSens, C.CAMERA.minPitch, C.CAMERA.maxPitch);
      if (m.wheel) {
        camDist = U.clamp(camDist + m.wheel * 0.01, C.CAMERA.minDistance, C.CAMERA.maxDistance);
      }
    }

    // Interaksi (E), serangan, tas, makan
    var dialogOpen = window.UI.isDialogOpen();
    var bagOpen = window.UI.isInventoryOpen();
    if (playing && !worldMapOpen) {
      var pressed = window.Input.wasPressed('KeyE');
      var wantAttack = window.Input.wasPressed('Mouse0') || window.Input.wasPressed('KeyF');
      if (dialogOpen) {
        window.UI.showPrompt(null);
        if (pressed) window.UI.advanceDialog();
      } else if (!bagOpen) {
        var target = boat ? boat.findInteraction(player) : null;
        if (!target) target = village.findInteraction(player);
        window.UI.showPrompt(target ? target.prompt : null);
        if (pressed && target) {
          if (target.kind === 'boat' && boat) boat.interact(player);
          else village.interact(target);
        }
        if (wantAttack) {
          if (player.attack()) window.AudioMan.sfx('swing');
        }
        if (window.Input.wasPressed('KeyH')) eatFood();
      } else {
        window.UI.showPrompt(null);
      }
      if (window.Input.wasPressed('KeyI')) setBagOpen(!bagOpen);
    } else {
      window.UI.showPrompt(null);
      window.Input.wasPressed('Mouse0');
      window.Input.wasPressed('KeyF');
      window.Input.wasPressed('KeyH');
      window.Input.wasPressed('KeyI');
      window.Input.wasPressed('KeyE');
    }
    dialogOpen = window.UI.isDialogOpen();
    var invOpen = window.UI.isInventoryOpen();

    var controlsEnabled = playing && !dialogOpen && !invOpen && !worldMapOpen;
    var boarded = !!(boat && boat.boarded);
    if (dom.hotbar) dom.hotbar.classList.toggle('hidden', dialogOpen || invOpen || worldMapOpen);
    if (boarded) player.updateRiding(dt);
    else player.update(dt, camYaw, controlsEnabled);
    if (player.swimming && !swimGreeted && playing && !worldMapOpen) {
      swimGreeted = true;
      window.UI.toast(L('swim.hint', '🌊 Berenang — W/A/S/D bergerak, Shift lebih cepat. Lautan bebas dijelajahi!'));
    }
    updateFootsteps(dt, controlsEnabled && !boarded);
    var worldDt = playing ? dt : dt * 0.4; // waktu dunia melambat di menu
    world.update(worldDt, camera);
    if (grass && grass.update) grass.update(dt, player);
    village.update(worldDt, player);
    if (enemies) enemies.update(worldDt, player, camera, playing && !dialogOpen && !invOpen, rpgStats);
    if (boat) {
      boat.update(dt, player, playing && controlsEnabled && boarded, window.Input);
      // Kamera menoleh mengikuti arah perahu saat melaju.
      if (boarded && playing && Math.abs(boat.speed) > 0.6) {
        camYaw = U.lerpAngle(camYaw, boat.yaw, 1 - Math.exp(-2.2 * dt));
      }
    }
    updateCamera(dt);
    updatePlayerTag();
    updateWaypointHud();
    updateBeacon(dt);
    if (worldMapOpen) updateWorldMap(dt);
    if (window.Effects) window.Effects.update(playing ? dt : dt * 0.4);
    if (minimap && playing && !worldMapOpen) {
      minimap.update(dt, {
        world: world, player: player, camera: camera, camYaw: camYaw,
        village: village, enemies: enemies, stats: rpgStats, boat: boat,
        waypoint: waypoint
      });
    }
    renderer.setClearColor(world.fogColor, 1);
    if (composer && C.RENDER.postFx) composer.render();
    else renderer.render(scene, camera);
    updateCounters(dt);
  }

  function updateCamera(dt) {
    player.getFocus(tmpFocus);
    smoothFocus.lerp(tmpFocus, 1 - Math.exp(-C.CAMERA.smooth * dt));

    // Di dalam rumah: kamera didekatkan (dan dibatasi langit-langit) agar pemain tetap terlihat
    var plat = world.insidePlatform ? world.insidePlatform(smoothFocus.x, smoothFocus.z) : null;
    var targetDist = camDist;
    if (plat) {
      // Di dalam rumah: kamera tetap bisa diputar, tetapi dibatasi dinding —
      // jarak maksimum dihitung pada koordinat LOKAL rumah (rumah diputar),
      // dari posisi fokus pemain ke tepi ruang. Rumus putar sama dengan
      // world.inPlantRect agar konsisten.
      var iw = Math.max(0.6, plat.hw - 0.4);
      var id = Math.max(0.6, plat.hd - 0.4);
      var cp0 = Math.max(0.2, Math.cos(camPitch));
      var dirX = -Math.sin(camYaw) * cp0;          // arah fokus → kamera (dunia)
      var dirZ = -Math.cos(camYaw) * cp0;
      var ldx = dirX * plat.cos - dirZ * plat.sin; // arah dalam lokal rumah
      var ldz = dirX * plat.sin + dirZ * plat.cos;
      var fdx = smoothFocus.x - plat.x, fdz = smoothFocus.z - plat.z;
      var lfx = fdx * plat.cos - fdz * plat.sin;   // fokus dalam lokal rumah
      var lfz = fdx * plat.sin + fdz * plat.cos;
      var tX = ldx > 0.001 ? (iw - lfx) / ldx : (ldx < -0.001 ? (-iw - lfx) / ldx : 99);
      var tZ = ldz > 0.001 ? (id - lfz) / ldz : (ldz < -0.001 ? (-id - lfz) / ldz : 99);
      var wallDist = Math.min(tX, tZ);
      targetDist = U.clamp(Math.min(camDist, wallDist), 0.7, C.CAMERA.maxDistance);
    }
    if (camDistSmooth <= 0) camDistSmooth = camDist;
    camDistSmooth += (targetDist - camDistSmooth) * (1 - Math.exp(-6 * dt));

    var cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    var camY = smoothFocus.y + sp * camDistSmooth;
    if (plat) {
      var maxY = plat.ceil - 0.32;
      if (camY > maxY) camY = maxY;
      // Kamera tidak boleh turun menembus lantai rumah
      var minRoomY = plat.top + 0.45;
      if (camY < minRoomY) camY = minRoomY;
    }
    camera.position.set(
      smoothFocus.x - Math.sin(camYaw) * cp * camDistSmooth,
      camY,
      smoothFocus.z - Math.cos(camYaw) * cp * camDistSmooth
    );
    // Jangan menembus terrain (dan jangan terbenam di air saat menaiki perahu
    // atau mengarungi pantai dengan berjalan).
    var minY = world.groundHeight(camera.position.x, camera.position.z) + 0.6;
    if (boat && boat.boarded) minY = Math.max(minY, 0.75);
    else if (!plat) minY = Math.max(minY, 0.75); // kamera tetap di atas permukaan laut
    if (camera.position.y < minY) camera.position.y = minY;

    // Di lereng curam (mis. jalan menuju reruntuhan kastil), naikkan kamera
    // agar garis pandang ke pemain tidak tertutup punggung bukit.
    var camYFix = camera.position.y;
    for (var cs = 1; cs <= 3; cs++) {
      var ct = cs / 4;
      var sx = smoothFocus.x + (camera.position.x - smoothFocus.x) * ct;
      var sz = smoothFocus.z + (camera.position.z - smoothFocus.z) * ct;
      var gy = world.groundHeight(sx, sz) + 0.3;
      var ly = smoothFocus.y + (camYFix - smoothFocus.y) * ct;
      if (gy > ly) camYFix += (gy - ly) / ct;
    }
    camera.position.y = camYFix;

    camera.lookAt(smoothFocus.x, smoothFocus.y + 0.2, smoothFocus.z);

    // Getar kamera singkat saat terluka / menebas.
    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - dt);
      var f = shakeT / (shakeDur || 1);
      var amp = shakeMag * f * f;
      camera.position.x += (Math.random() * 2 - 1) * amp;
      camera.position.y += (Math.random() * 2 - 1) * amp * 0.6;
      camera.position.z += (Math.random() * 2 - 1) * amp;
      camera.lookAt(smoothFocus.x, smoothFocus.y + 0.2, smoothFocus.z);
      if (shakeT <= 0) { shakeT = 0; shakeDur = 0; shakeMag = 0; }
    }
  }

  /* Label level melayang tepat di atas kepala pemain (proyeksi dunia → layar). */
  function updatePlayerTag() {
    if (!dom.playerTag || !player || !camera) return;
    var visible = state === 'playing' && !window.UI.isDialogOpen() &&
      !window.UI.isInventoryOpen() && !worldMapOpen;
    if (visible && world.isInsideHouse && world.isInsideHouse(player.position.x, player.position.z)) visible = false;
    if (!visible) { dom.playerTag.classList.add('hidden'); return; }

    tagV.set(player.position.x, player.position.y + 2.4, player.position.z).project(camera);
    if (tagV.z > 1) { dom.playerTag.classList.add('hidden'); return; }
    var sx = (tagV.x * 0.5 + 0.5) * window.innerWidth;
    var sy = (-tagV.y * 0.5 + 0.5) * window.innerHeight;
    dom.playerTag.style.transform =
      'translate(-50%, -100%) translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
    dom.playerTag.classList.remove('hidden');
  }

  function updateCounters(dt) {
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
      fpsValue = Math.round(fpsFrames / fpsTime);
      fpsFrames = 0;
      fpsTime = 0;
    }
    hudTime += dt;
    if (hudTime < 0.25) return;
    hudTime = 0;

    var info = world.getClockInfo();
    dom.clock.innerHTML = info.text + ' <span class="phase">' + info.phase + '</span>';

    window.UI.setVitals(rpgStats.hp, rpgStats.maxHp, rpgStats.level, rpgStats.xp, rpgStats.xpNeed());
    window.UI.refreshHotbar(rpgStats, {
      kelapa: (village && village.quests && village.quests.kelapa) ? village.quests.kelapa.count : 0
    });
    if (window.UI.isInventoryOpen()) window.UI.refreshInventory(rpgStats);
    updateLowHp();
    updateNightAudio();

    var p = player.position;
    var spd = (boat && boat.boarded) ? Math.abs(boat.speed) : player.currentSpeed;
    dom.dbgFps.textContent = 'FPS: ' + fpsValue;
    dom.dbgPos.innerHTML =
      L('dbg.pos', 'Posisi: ') + p.x.toFixed(0) + ', ' + p.z.toFixed(0) +
      '<br>' + L('dbg.height', 'Ketinggian: ') + p.y.toFixed(1) + ' m' +
      '<br>' + L('dbg.speed', 'Kecepatan: ') + (spd * 3.6).toFixed(0) + ' km/j';
    dom.dbgInfo.textContent = L('dbg.gfx', 'Grafik: ') + String(quality || 'hd').toUpperCase() +
      ' · ' + (player.mixer ? L('dbg.m3d', 'model 3D') : L('dbg.proc', 'bentuk prosedural')) +
      (minimap ? ' · ' + minimap.label() : '');
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(window.innerWidth, window.innerHeight);
      updateFxaaResolution();
      updateBloomSize();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
