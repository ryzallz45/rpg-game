/* Fase 4: simpan/muat — satu slot simpanan di localStorage.
   Tanpa DOM/THREE — aman diuji di Node (localStorage disuntik saat uji). */
(function (global) {
  'use strict';

  var KEY = 'pulau.simpanan.v2';
  var VERSION = 2;
  var LEGACY_KEYS = ['pulau.simpanan.v1'];

  function storage() {
    try { return global.localStorage || null; } catch (e) { return null; }
  }

  /* Tulis cuplikan (snapshot) ke slot. Kembalikan true bila berhasil. */
  function write(data) {
    var st = storage();
    if (!st || !data) return false;
    try {
      st.setItem(KEY, JSON.stringify({
        v: VERSION,
        savedAt: Date.now(),
        data: data
      }));
      for (var i = 0; i < LEGACY_KEYS.length; i++) {
        try { st.removeItem(LEGACY_KEYS[i]); } catch (e2) {}
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Baca slot. Kembalikan { savedAt, data } atau null bila kosong/rusak. */
  function read() {
    var st = storage();
    if (!st) return null;
    try {
      var raw = st.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || o.v !== VERSION || !o.data || typeof o.data !== 'object') return null;
      if (!o.data.player || typeof o.data.player !== 'object') return null;
      return { savedAt: Number(o.savedAt) || 0, data: o.data };
    } catch (e) {
      return null;
    }
  }

  function has() { return !!read(); }

  function clear() {
    var st = storage();
    if (!st) return false;
    try { st.removeItem(KEY); return true; } catch (e) { return false; }
  }

  /* Ringkasan kecil untuk tombol "Lanjutkan" tanpa memuat seluruh snapshot. */
  function info() {
    var rec = read();
    if (!rec) return null;
    var d = rec.data || {};
    var p = d.player || {};
    var w = d.world || {};
    return {
      savedAt: rec.savedAt,
      level: Number(p.level) || 1,
      timeOfDay: typeof w.timeOfDay === 'number' ? w.timeOfDay : 0,
      playTime: Number(d.playTime) || 0
    };
  }

  global.SaveGame = {
    KEY: KEY,
    VERSION: VERSION,
    LEGACY_KEYS: LEGACY_KEYS,
    write: write,
    read: read,
    has: has,
    info: info,
    clear: clear
  };
})(typeof window !== 'undefined' ? window : globalThis);
