/* Dwibahasa antarmuka (Tahap Menu): Bahasa Indonesia (asli) & English (shell UI).
   Dialog cerita tetap Bahasa Indonesia — lihat catatan di panel Bahasa.
   Aman di Node (tanpa document). */
(function (global) {
  'use strict';

  var KEY = 'pulau.bahasa';
  var lang = 'id';

  /* ---------- Kamus kunci (elemen ber-atribut data-i18n) ---------- */
  var EN = {
    /* Menu utama */
    'menu.subtitle': 'A low-poly 3D world to explore — procedural island, village & villagers, day–night cycle, and rolling seas',
    'menu.continue': '▶ Continue Journey',
    'menu.play': '▶ Play',
    'menu.settings': '⚙ Settings',
    'menu.exit': '✕ Exit',
    'menu.how': 'How to Play',
    'menu.footnote': 'Built with Three.js — procedural world, textures & story (no internet). 3D models (CC0) load when launched via jalankan.bat; double-click mode stays procedural.',

    /* Cara bermain */
    'help.wasd': 'walk / steer the boat',
    'help.shift': 'run / swim faster',
    'help.space': 'jump',
    'help.swim': 'deep water automatically swims — the whole ocean is open to explore',
    'help.attack': 'swing sword (3-hit combo)',
    'help.e': 'talk to villagers / pick up items / board & leave the boat',
    'help.i': 'open/close the large bag (battle loot)',
    'help.h': 'eat boar meat (+30 HP)',
    'help.m': 'cycle map mode: World → Around → Local → Hidden',
    'help.map': 'open the world map & mark a destination',
    'help.save': 'quick save (load it from the pause menu)',
    'help.mouse': 'hold Right Click to orbit the camera',
    'help.wheel': 'zoom camera distance',
    'help.esc': 'close bag/dialogue, or pause/resume',
    'help.f3': 'performance panel',

    /* Berenang */
    'swim.hint': '🌊 Swimming — W/A/S/D to move, Shift to swim faster. The whole ocean is open to explore!',

    /* Pengaturan */
    'set.title': 'SETTINGS',
    'set.tab.audio': 'Audio',
    'set.tab.graphics': 'Graphics',
    'set.tab.language': 'Language',
    'set.audio.music': 'Music & ambience',
    'set.audio.sfx': 'Sound effects',
    'set.audio.note': 'All audio is synthesized inside the game — no audio files needed.',
    'set.audio.test': '🔊 Play a sample',
    'set.graphics.title': 'Graphics quality',
    'set.graphics.note': 'HD & Ultra: sharper image, soft shadows, textures, effects & 3D character models. Fast is for weaker devices.',
    'q.cepat': 'Fast',
    'q.hd': 'HD',
    'q.ultra': 'Ultra',
    'set.lang.note': 'Menus and interface are translated; story dialogue remains in Indonesian.',
    'set.back': 'Back',

    /* Keluar */
    'exit.title': 'EXIT?',
    'exit.text': 'Thanks for playing. Are you sure you want to close the game?',
    'exit.yes': 'Yes, exit',
    'exit.no': 'Cancel',
    'bye.title': 'SEE YOU SOON',
    'bye.text': 'Thanks for playing Pulau Nusantara! Close this tab to exit.',
    'bye.back': 'Back to Menu',

    /* Jeda */
    'pause.title': 'PAUSED',
    'pause.subtitle': 'Your journey is on hold for a moment.',
    'pause.resume': 'Resume',
    'pause.save': '💾 Save',
    'pause.load': '📂 Load',
    'pause.settings': '⚙ Settings',
    'pause.menu': 'Back to Menu',
    'pause.footnote': 'Save/load is available above. Hold the right mouse button to orbit the camera.',

    /* Simpan/muat (Fase 4) */
    'save.last': 'Last saved: ',
    'save.none': 'No save yet',
    'save.saved': '✓ Game saved',
    'save.notFound': 'No save found',
    'save.failed': 'Could not save — browser storage is blocked or full',
    'save.loaded': 'Save loaded',

    /* Tumbang */
    'death.title': 'YOU HAVE FALLEN',
    'death.subtitle': 'This island is harsh… but you never give up.',
    'death.respawn': 'Rise Again',
    'death.footnote': 'You will rise again on the beach where the adventure began.',

    /* Pemuatan */
    'loading.init': 'Preparing the 3D engine...',
    'loading.ready': 'Ready!',

    /* HUD */
    'hud.controls': '<b>WASD</b> move &nbsp;·&nbsp; <b>Shift</b> run &nbsp;·&nbsp; <b>Space</b> jump &nbsp;·&nbsp; <b>Left Click</b> attack &nbsp;·&nbsp; <b>E</b> talk &nbsp;·&nbsp; <b>I</b> bag &nbsp;·&nbsp; <b>H</b> eat &nbsp;·&nbsp; <b>Esc</b> pause',
    'hud.bag': 'BAG <span class="inv-key">I</span>',
    'hud.bagHint': 'Press I or Esc to close',
    'hud.north': 'N',
    'map.world': 'WORLD',
    'map.near': 'AROUND',
    'map.local': 'LOCAL',

    /* Peta besar & tujuan (Fase 5 lanjutan) */
    'map.title': 'NUSANTARA MAP',
    'map.subtitle': 'World map — click a location to mark your destination',
    'map.running': 'The world keeps running',
    'map.hint': 'Click a location to mark your destination',
    'map.locked': 'movement & attacks locked',
    'map.noTarget': 'No destination yet — click a location on the map',
    'map.targetPrefix': 'Destination',
    'map.freeTarget': 'Custom point',
    'map.poi.village': 'Nusantara Village',
    'map.poi.harbor': 'Harbour',
    'map.poi.hut': "Paman Dera's Hut",
    'map.poi.hut2': 'Island Hut',
    'map.legend.village': 'Village',
    'map.legend.harbor': 'Harbour',
    'map.legend.hut': 'Hut',
    'map.legend.you': 'You',
    'map.legend.boat': 'Boat',
    'map.legend.target': 'Destination',
    'map.clear': 'Clear Destination',
    'map.close': 'Close',
    'map.closeGo': 'Close & Go',
    'map.cleared': 'Destination cleared',
    'map.arrived': 'You have arrived',
    'map.attacked': 'You were attacked!',
    'dbg.hint': 'F3 = hide panel',

    /* Panel debug */
    'dbg.pos': 'Position: ',
    'dbg.height': 'Altitude: ',
    'dbg.speed': 'Speed: ',
    'dbg.gfx': 'Graphics: ',
    'dbg.m3d': '3D model',
    'dbg.proc': 'procedural shape',

    /* Trailer */
    'trailer.skip': 'Click / press any key to skip',
    'trailer.c1t': 'PULAU NUSANTARA',
    'trailer.c1s': 'A 3D adventure across the islands of the archipelago',
    'trailer.c2t': 'Beaches & forests',
    'trailer.c2s': 'Follow the coast, forests and harbour — sail out and explore the isles',
    'trailer.c3t': 'Meet the villagers',
    'trailer.c3s': 'Help them with their little quests',
    'trailer.c4t': 'Face the wild',
    'trailer.c4s': 'Boars, bandits and slimes — collect loot, level up',
    'trailer.c5t': 'Pulau Nusantara',
    'trailer.c5s': 'happy exploring!'
  };

  /* ---------- Kamus untai dinamis (teks Indonesia → Inggris) ---------- */
  var EN_STR = {
    'Membangun terrain pulau...': 'Building the island terrain...',
    'Mengalirkan lautan...': 'Filling the seas...',
    'Memasang langit & siklus siang-malam...': 'Raising the sky & day-night cycle...',
    'Memuat model 3D...': 'Loading 3D models...',
    'Menumbuhkan vegetasi & batu...': 'Growing vegetation & rocks...',
    'Membangun desa & penduduk...': 'Building the village & villagers...',
    'Membangun pelabuhan & perahu...': 'Building the harbour & boat...',
    'Menanam rumput & bunga...': 'Planting grass & flowers...',
    'Menciptakan pemain...': 'Spawning the hero...',
    'Membangkitkan makhluk pulau...': 'Awakening island creatures...',
    'Menyiapkan peta & efek...': 'Charting the island & effects...',
    'Menyiapkan awal perjalanan...': 'Preparing the journey...',
    'Siap!': 'Ready!'
  };

  function t(key) {
    if (lang === 'en' && EN[key] !== undefined) return EN[key];
    return null;
  }
  /* Ambil terjemahan kunci; bila tidak ada pakai cadangan (teks asli). */
  function tx(key, fallback) {
    var v = t(key);
    return v !== null ? v : fallback;
  }
  /* Terjemahkan untai utuh (untuk teks dinamis dari kode). */
  function str(s) {
    return (lang === 'en' && EN_STR[s]) ? EN_STR[s] : s;
  }

  function applyDom() {
    if (typeof document === 'undefined') return;
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.__idText === undefined) el.__idText = el.textContent;
      var v = t(el.getAttribute('data-i18n'));
      el.textContent = v !== null ? v : el.__idText;
    }
    var ehs = document.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < ehs.length; j++) {
      var eh = ehs[j];
      if (eh.__idHtml === undefined) eh.__idHtml = eh.innerHTML;
      var vh = t(eh.getAttribute('data-i18n-html'));
      eh.innerHTML = vh !== null ? vh : eh.__idHtml;
    }
    if (document.documentElement) {
      document.documentElement.lang = lang === 'en' ? 'en' : 'id';
    }
  }

  function set(code) {
    if (code !== 'id' && code !== 'en') return false;
    lang = code;
    try {
      if (global.localStorage) global.localStorage.setItem(KEY, code);
    } catch (e) {}
    applyDom();
    return true;
  }

  function load() {
    var n = null;
    try { n = global.localStorage ? global.localStorage.getItem(KEY) : null; } catch (e) { n = null; }
    if (n === 'en' || n === 'id') lang = n;
  }

  global.Lang = {
    get: function () { return lang; },
    set: set,
    load: load,
    t: t,
    tx: tx,
    str: str,
    applyDom: applyDom,
    EN: EN,
    EN_STR: EN_STR
  };
})(typeof window !== 'undefined' ? window : globalThis);
