/* Fase 3: data RPG — barang (item) & statistik pemain (HP, XP, level, tas).
   Tanpa DOM/THREE — aman diuji di Node. */
(function (global) {
  'use strict';

  /* Daftar barang. color dipakai untuk kotak jarahan di dunia. */
  var ITEMS = {
    daging: { name: 'Daging Babi', icon: '🥩', color: 0xC46A5A, consumable: true, heal: 30,
      desc: 'Panggang & makan dengan H — memulihkan 30 HP.' },
    kulit: { name: 'Kulit Babi', icon: '🟫', color: 0x8A6742,
      desc: 'Kulit tebal — bahan kerajinan.' },
    taring: { name: 'Taring Babi', icon: '🦷', color: 0xEDE6D0,
      desc: 'Taring tajam — bahan langka.' },
    koin: { name: 'Koin Perak', icon: '🪙', color: 0xD8D8E2,
      desc: 'Mata uang pulau.' },
    besi: { name: 'Besi Tua', icon: '⚙️', color: 0x9AA2AC,
      desc: 'Potongan logam dari bandit.' },
    lendir: { name: 'Lendir Slime', icon: '🫧', color: 0x7FCF6A,
      desc: 'Gumpalan kenyal — bahan ramuan.' }
  };

  function Stats() {
    this.level = 1;
    this.xp = 0;
    this.maxHp = 100;
    this.hp = 100;
    this.baseDamage = 13;
    this.inventory = Object.create(null);
  }

  /* XP yang dibutuhkan untuk naik level berikutnya. */
  Stats.prototype.xpNeed = function () { return 40 + (this.level - 1) * 30; };

  Stats.prototype.getDamage = function () { return this.baseDamage + (this.level - 1) * 2; };

  Stats.prototype.count = function (id) { return this.inventory[id] || 0; };

  Stats.prototype.addItem = function (id, n) {
    n = n === undefined ? 1 : n;
    var c = this.count(id) + n;
    if (c <= 0) delete this.inventory[id];
    else this.inventory[id] = c;
    return c;
  };

  /* Tambah XP; kembalikan jumlah kenaikan level (0 bila tidak naik). */
  Stats.prototype.gainXp = function (n) {
    this.xp += n;
    var ups = 0;
    while (this.xp >= this.xpNeed()) {
      this.xp -= this.xpNeed();
      this.level++;
      this.maxHp += 10;
      this.hp = this.maxHp; // naik level = pulih penuh
      ups++;
    }
    return ups;
  };

  Stats.prototype.damage = function (n) {
    this.hp = Math.max(0, this.hp - n);
    return this.hp <= 0;
  };

  Stats.prototype.heal = function (n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  };

  /* Pakai barang konsumsi (mis. daging). false bila tak bisa dipakai. */
  Stats.prototype.useConsumable = function (id) {
    var it = ITEMS[id];
    if (!it || !it.consumable) return false;
    if (this.count(id) <= 0) return false;
    if (this.hp >= this.maxHp) return false;
    this.addItem(id, -1);
    this.heal(it.heal);
    return true;
  };

  global.RPG = { ITEMS: ITEMS, Stats: Stats };
})(typeof window !== 'undefined' ? window : globalThis);
