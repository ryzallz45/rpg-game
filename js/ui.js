/* UI Fase 2: dialog NPC, petunjuk interaksi (E), daftar tugas, dan pesan singkat (toast).
   Aman dijalankan tanpa DOM (uji Node) — semua elemen opsional. */
(function (global) {
  'use strict';

  var doc = typeof document !== 'undefined' ? document : null;
  var els = {
    dialog: null, name: null, text: null, prompt: null, toast: null, quest: null, questLines: null,
    vLevel: null, vHpFill: null, vHpText: null, vXpFill: null, vXpText: null,
    inv: null, invGrid: null, invStats: null, hotSlots: null, dmg: null, death: null
  };
  var dialog = null; // { name, lines, index, onEnd }
  var toastTimer = null;
  var invOpen = false;
  var hotSig = '';
  var questHidden = false;   // Fase 5: daftar tugas bisa disembunyikan lewat tombol HUD
  var lastQuestLines = null;
  var HOT_ORDER = ['daging', 'kulit', 'taring', 'koin', 'besi', 'lendir'];

  function $(id) { return doc ? doc.getElementById(id) : null; }

  function init() {
    if (!doc) return;
    els.dialog = $('dialog');
    els.name = $('dlg-name');
    els.text = $('dlg-text');
    els.prompt = $('prompt');
    els.toast = $('toast');
    els.quest = $('quest');
    els.questLines = $('quest-lines');
    els.vLevel = $('v-level');
    els.vHpFill = $('v-hp-fill');
    els.vHpText = $('v-hp-text');
    els.vXpFill = $('v-xp-fill');
    els.vXpText = $('v-xp-text');
    els.inv = $('inventory');
    els.invGrid = $('inv-grid');
    els.invStats = $('inv-stats');
    els.hotSlots = $('hotbar-slots');
    els.dmg = $('dmg-flash');
    els.death = $('death');
  }

  function isDialogOpen() { return !!dialog; }

  function showDialog(name, lines, onEnd) {
    if (!lines || !lines.length) { if (onEnd) onEnd(); return; }
    dialog = { lines: lines, index: 0, onEnd: onEnd || null };
    if (els.dialog) {
      els.name.textContent = name;
      els.text.textContent = lines[0];
      els.dialog.classList.remove('hidden');
    }
  }

  /* Majukan satu baris dialog; panggil onEnd saat baris habis. */
  function advanceDialog() {
    if (!dialog) return;
    dialog.index++;
    if (dialog.index >= dialog.lines.length) {
      var cb = dialog.onEnd;
      dialog = null;
      if (els.dialog) els.dialog.classList.add('hidden');
      if (cb) cb();
    } else if (els.text) {
      els.text.textContent = dialog.lines[dialog.index];
    }
  }

  /* Tutup paksa tanpa onEnd (mis. saat jeda). */
  function closeDialog() {
    dialog = null;
    if (els.dialog) els.dialog.classList.add('hidden');
  }

  /* Petunjuk interaksi; null untuk menyembunyikan. */
  function showPrompt(html) {
    if (!els.prompt) return;
    if (!html) { els.prompt.classList.add('hidden'); return; }
    els.prompt.innerHTML = html;
    els.prompt.classList.remove('hidden');
  }

  function toast(text) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.classList.remove('hidden');
    els.toast.classList.remove('show');
    void els.toast.offsetWidth; // paksa animasi ulang
    els.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (els.toast) els.toast.classList.remove('show');
    }, 2600);
  }

  /* Daftar tugas aktif di sudut kiri atas; array string (HTML ringan). */
  function setQuest(lines) {
    lastQuestLines = lines || null;
    if (!els.quest) return;
    if (!lines || !lines.length || questHidden) { els.quest.classList.add('hidden'); return; }
    var html = '';
    for (var i = 0; i < lines.length; i++) html += '<div class="q-line">' + lines[i] + '</div>';
    els.questLines.innerHTML = html;
    els.quest.classList.remove('hidden');
  }

  /* Tampilkan/sembunyikan daftar tugas (tombol HUD). Kembalikan status tampil. */
  function toggleQuest() {
    questHidden = !questHidden;
    if (questHidden) {
      if (els.quest) els.quest.classList.add('hidden');
    } else {
      setQuest(lastQuestLines);
    }
    return !questHidden;
  }

  /* ---------- Fase 3: vital, tas, efek tempur ---------- */

  function setVitals(hp, maxHp, level, xp, xpNeed) {
    if (!els.vHpFill) return;
    els.vHpFill.style.width = Math.max(0, Math.min(100, (hp / maxHp) * 100)) + '%';
    if (els.vHpText) els.vHpText.textContent = Math.ceil(hp) + '/' + maxHp;
    if (els.vXpFill) els.vXpFill.style.width = Math.max(0, Math.min(100, (xp / xpNeed) * 100)) + '%';
    if (els.vXpText) els.vXpText.textContent = xp + '/' + xpNeed + ' XP';
    if (els.vLevel) els.vLevel.textContent = 'Lv ' + level;
  }

  /* Satu kotak hotbar: ikon, nama (tooltip), jumlah, dan kunci pintasan. */
  function slotCard(icon, name, n, key, id) {
    var has = n > 0;
    return '<div class="slot' + (has ? '' : ' empty') + '"' + (id ? ' data-slot="' + id + '"' : '') +
      ' title="' + name + (has ? ' ×' + n : '') + '">' +
      '<span class="slot-ic">' + icon + '</span>' +
      (has ? '<span class="slot-ct">' + n + '</span>' : '') +
      (key ? '<span class="slot-key">' + key + '</span>' : '') +
      '</div>';
  }

  /* Hotbar bawah: pedang, makanan, kelapa tugas, lalu barang jarahan.
     Hanya menyentuh DOM bila isi tas berubah. */
  function refreshHotbar(stats, extra) {
    if (!els.hotSlots || !stats) return;
    var kelapa = (extra && extra.kelapa != null) ? extra.kelapa : 0;
    var force = !!(extra && extra.force);
    var sig = stats.level + ':' + kelapa;
    for (var s = 0; s < HOT_ORDER.length; s++) sig += ':' + stats.count(HOT_ORDER[s]);
    if (sig === hotSig && !force) return;
    hotSig = sig;

    var ITEMS = global.RPG ? global.RPG.ITEMS : {};
    var html = '<div class="slot weapon" data-slot="weapon" title="Pedang — serangan ' + stats.getDamage() + '">' +
      '<span class="slot-ic">⚔️</span><span class="slot-key">1</span></div>';
    html += slotCard('🥩', 'Daging Babi', stats.count('daging'), 'H', 'daging');
    html += slotCard('🥥', 'Kelapa (tugas)', kelapa, '', 'kelapa');
    for (var i = 0; i < HOT_ORDER.length; i++) {
      var id = HOT_ORDER[i];
      if (id === 'daging') continue;
      var it = ITEMS[id] || { name: id, icon: '❔' };
      html += slotCard(it.icon, it.name, stats.count(id), '', id);
    }
    els.hotSlots.innerHTML = html;
  }

  /* Kedip merah di tepi layar saat pemain terluka. */
  function damageFlash() {
    if (!els.dmg) return;
    els.dmg.classList.remove('hit');
    void els.dmg.offsetWidth;
    els.dmg.classList.add('hit');
  }

  function showDeath() { if (els.death) els.death.classList.remove('hidden'); }
  function hideDeath() { if (els.death) els.death.classList.add('hidden'); }

  function refreshInventory(stats) {
    if (!invOpen || !els.invGrid || !stats) return;
    var ITEMS = global.RPG ? global.RPG.ITEMS : {};
    var html = '<div class="inv-card weapon"><div class="inv-ic">⚔️</div><div class="inv-info">' +
      '<div class="inv-name"><span>Pedang Perunggu</span><span class="inv-count">senjata</span></div>' +
      '<div class="inv-desc">Senjata utama — serangan ' + stats.getDamage() + '.</div></div></div>';
    var found = 0;
    for (var i = 0; i < HOT_ORDER.length; i++) {
      var id = HOT_ORDER[i];
      var n = stats.count(id);
      if (!n) continue;
      found++;
      var it = ITEMS[id] || { name: id, icon: '❔', desc: '' };
      html += '<div class="inv-card"><div class="inv-ic">' + it.icon + '</div><div class="inv-info">' +
        '<div class="inv-name"><span>' + it.name + '</span><span class="inv-count">×' + n + '</span></div>' +
        (it.desc ? '<div class="inv-desc">' + it.desc + '</div>' : '') +
        '</div></div>';
    }
    if (!found) {
      html += '<div class="inv-empty">Tas kosong — kalahkan makhluk di pulau untuk mendapat barang.</div>';
    }
    els.invGrid.innerHTML = html;
    if (els.invStats) {
      els.invStats.innerHTML =
        '<span>❤️ HP ' + stats.hp + '/' + stats.maxHp + '</span>' +
        '<span>⚔️ Serangan ' + stats.getDamage() + '</span>' +
        '<span>⭐ Level ' + stats.level + ' (' + stats.xp + '/' + stats.xpNeed() + ' XP)</span>';
    }
  }

  function toggleInventory(stats) {
    invOpen = !invOpen;
    if (!els.inv) return invOpen;
    if (invOpen) {
      refreshInventory(stats);
      els.inv.classList.remove('hidden');
    } else {
      els.inv.classList.add('hidden');
    }
    return invOpen;
  }

  function closeInventory() {
    invOpen = false;
    if (els.inv) els.inv.classList.add('hidden');
  }

  function isInventoryOpen() { return invOpen; }

  global.UI = {
    init: init,
    isDialogOpen: isDialogOpen,
    showDialog: showDialog,
    advanceDialog: advanceDialog,
    closeDialog: closeDialog,
    showPrompt: showPrompt,
    toast: toast,
    setQuest: setQuest,
    toggleQuest: toggleQuest,
    setVitals: setVitals,
    refreshHotbar: refreshHotbar,
    damageFlash: damageFlash,
    showDeath: showDeath,
    hideDeath: hideDeath,
    toggleInventory: toggleInventory,
    refreshInventory: refreshInventory,
    closeInventory: closeInventory,
    isInventoryOpen: isInventoryOpen
  };
})(typeof window !== 'undefined' ? window : globalThis);
