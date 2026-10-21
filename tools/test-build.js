/* Uji integrasi tanpa browser: bangun terrain/laut/langit/pemain + 120 frame simulasi. */
'use strict';
var path = require('path');
var THREE = require(path.join(__dirname, '..', 'lib', 'three.min.js'));
globalThis.THREE = THREE;

require('../js/utils.js');
require('../js/textures.js');
require('../js/assets.js');
require('../js/config.js');
require('../js/sky.js');
require('../js/world.js');
require('../js/ui.js');
require('../js/rpg.js');
require('../js/save.js');
require('../js/effects.js');
require('../js/minimap.js');
require('../js/player.js');
require('../js/grass.js');
require('../js/village.js');
require('../js/boat.js');
require('../js/enemies.js');
require('../js/i18n.js');
require('../js/audio.js');
require('../js/trailer.js');

// Stub input: tidak ada tombol ditekan
globalThis.Input = {
  isDown: function () { return false; },
  consumeMouse: function () { return { dx: 0, dy: 0, wheel: 0 }; },
  init: function () {},
  requestLock: function () {},
  exitLock: function () {},
  onPointerLockChange: function () {},
  locked: false
};

function t(label, fn) {
  var t0 = Date.now();
  var r = fn();
  console.log('[OK] ' + label + ' (' + (Date.now() - t0) + ' ms)');
  return r;
}

var scene = new THREE.Scene();
var world = t('new World', function () { return new globalThis.World(scene); });
t('buildTerrain', function () { world.buildTerrain(); });
t('buildWater', function () { world.buildWater(); });
t('buildSky', function () { world.buildSky(); });
t('buildEnvironment', function () { world.buildEnvironment(); });
console.log('  Dunia: ' + globalThis.CONFIG.WORLD.size + ' m (skala ' + world.scale.toFixed(3) + '×), pulau kecil: ' +
  (world.islands ? world.islands.length : 0) + ', pelabuhan: ' +
  (world.harborSpot ? 'x=' + world.harborSpot.x.toFixed(0) + ' z=' + world.harborSpot.z.toFixed(0) + ' (dermaga ' + world.harborSpot.dockLen + ' m)' : 'TIDAK ADA!'));

// ---- Kerajaan Besar: tembok melingkar + kastil + 30 rumah + jalan ----
t('kerajaan besar dibangun (tembok, kastil, ~30 rumah)', function () {
  var kb = world.kingdomBuilt;
  if (!kb) throw new Error('kingdomBuilt tidak ada — kerajaan tidak dibangun');
  if (kb.houses < 30) throw new Error('rumah kerajaan kurang: ' + kb.houses);
  if (kb.instances < 500) throw new Error('instance kerajaan terlalu sedikit: ' + kb.instances);
  if (!(kb.r >= 55)) throw new Error('radius tembok terlalu kecil: ' + kb.r);
  var lm = (world.landmarks || []).filter(function (l) { return l.id === 'great_kingdom'; });
  if (!lm.length) throw new Error('landmark great_kingdom tidak terdaftar');
  var box = new THREE.Box3();
  var m = new THREE.Matrix4(), v = new THREE.Vector3(), nan = 0;
  var meshes = 0;
  lm[0].group.traverse(function (o) {
    if (!o.isInstancedMesh) return;
    meshes++;
    for (var i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      v.set(m.elements[12], m.elements[13], m.elements[14]);
      if (!isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)) nan++;
      box.expandByPoint(v);
    }
  });
  if (nan) throw new Error('instance kerajaan NaN: ' + nan);
  if (meshes < 8) throw new Error('InstancedMesh kerajaan terlalu sedikit: ' + meshes);
  var spanX = box.max.x - box.min.x, spanZ = box.max.z - box.min.z;
  if (spanX < 100 || spanZ < 100) throw new Error('kerajaan terlalu kecil: ' + spanX.toFixed(0) + '×' + spanZ.toFixed(0) + ' m');
  if (box.min.y < world.groundHeight(kb.x, kb.z) - 12) throw new Error('kerajaan terbenam terlalu dalam');
  return kb;
});
t('platform rumah kerajaan menapak tanah (tidak melayang)', function () {
  var kb = world.kingdomBuilt;
  var bad = 0, count = 0;
  for (var i = 0; i < world.platforms.length; i++) {
    var p = world.platforms[i];
    if (Math.hypot(p.x - kb.x, p.z - kb.z) > kb.r) continue;
    count++;
    if (p.top < world.groundHeight(p.x, p.z) - 0.1) bad++;
    if (p.top - world.groundHeight(p.x, p.z) > 2.2) bad++;
  }
  if (count < 30) throw new Error('platform kerajaan hanya ' + count);
  if (bad) throw new Error(bad + ' platform kerajaan tidak menapak tanah');
  return count;
});
t('tembok kerajaan menahan pemain (collider melingkar penuh)', function () {
  var kb = world.kingdomBuilt;
  var segs = 0;
  for (var i = 0; i < world.walls.length; i++) {
    var w = world.walls[i];
    var mx = (w.x1 + w.x2) / 2, mz = (w.z1 + w.z2) / 2;
    var d = Math.hypot(mx - kb.x, mz - kb.z);
    if (d > kb.r - 6 && d < kb.r + 6) segs++;
  }
  if (segs < 30) throw new Error('segmen tembok luar kurang: ' + segs);
  return segs;
});
var village = t('new Village', function () { return new globalThis.Village(scene, world); });
t('build village', function () { village.build(); });
var boat = t('new Boat', function () { return new globalThis.Boat(scene, world); });
t('build harbour & boat', function () { boat.build(); });
var grass = t('new GrassField', function () { return new globalThis.GrassField(scene, world); });
t('build grass', function () { grass.build(); });
var player = t('new Player', function () { return new globalThis.Player(scene, world); });
var rpgStats = t('new RPG.Stats', function () { return new globalThis.RPG.Stats(); });
var enemies = t('new Enemies', function () { return new globalThis.Enemies(scene, world); });
t('build enemies', function () { enemies.build(); });
console.log('  Makhluk: ' + enemies.list.length + ' (babi ' + enemies.counts.babi + ', slime ' +
  enemies.counts.slime + ', bandit ' + enemies.counts.bandit + '), babi pembuka: ' +
  (enemies.introBoar ? 'ada @ x=' + enemies.introBoar.home.x.toFixed(0) + ' z=' + enemies.introBoar.home.z.toFixed(0) : 'tidak ada'));
var linkedScene = 0;
for (var li = 0; li < enemies.list.length; li++) if (enemies.list[li].group.parent === scene) linkedScene++;
console.log('  Musuh terpasang di scene: ' + linkedScene + '/' + enemies.list.length +
  ' → ' + (linkedScene === enemies.list.length ? 'OK ✓' : 'GAGAL!'));

console.log('  Desa: ' + village.sites.length + ' lokasi, NPC: ' + village.npcs.length +
  ', desa utama x=' + village.center.x.toFixed(0) + ' z=' + village.center.z.toFixed(0) +
  ', jarak dari spawn=' + Math.sqrt(Math.pow(village.center.x - player.position.x, 2) + Math.pow(village.center.z - player.position.z, 2)).toFixed(0) + ' m');
for (var si = 1; si < village.sites.length; si++) {
  console.log('    Pendukuhan ' + si + ': x=' + village.sites[si].x.toFixed(0) + ' z=' + village.sites[si].z.toFixed(0));
}
console.log('  Rumput: ' + grass.counts.tufts + ' rumpun, bunga: ' + grass.counts.flowers);
console.log('  Api unggun: ' + village.campfires.length);

var camera = new THREE.PerspectiveCamera(60, 1.6, 0.1, 3000);
camera.position.set(player.position.x, player.position.y + 5, player.position.z + 9);

console.log('  Objek di scene: ' + scene.children.length);
console.log('  Vertex terrain: ' + world.terrain.geometry.attributes.position.count.toLocaleString('id-ID'));
console.log('  Warna vertex terrain: ' + (world.terrain.geometry.attributes.color ? 'OK' : 'HILANG!'));
console.log('  Kabut: ' + (world.scene.fog && world.scene.fog.isFogExp2 ? 'FogExp2 (kabut atmosferik)' : world.scene.fog ? 'Fog biasa' : 'TIDAK ADA'));
console.log('  Spawn: x=' + player.position.x.toFixed(0) + ' y=' + player.position.y.toFixed(1) + ' z=' + player.position.z.toFixed(0));

// Simulasi 120 frame (2 detik) gameplay + kamera
var camYaw = player.yaw, camPitch = 0.3, camDist = 9;
var smoothFocus = new THREE.Vector3().copy(player.getFocus(new THREE.Vector3()));
var tmp = new THREE.Vector3();
var dt = 1 / 60;
t('120 frame simulasi', function () {
  for (var i = 0; i < 120; i++) {
    player.update(dt, camYaw, true);
    world.update(dt, camera);
    village.update(dt, player);
    enemies.update(dt, player, camera, true, rpgStats);
    player.getFocus(tmp);
    smoothFocus.lerp(tmp, 1 - Math.exp(-12 * dt));
    var cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    camera.position.set(
      smoothFocus.x - Math.sin(camYaw) * cp * camDist,
      smoothFocus.y + sp * camDist,
      smoothFocus.z - Math.cos(camYaw) * cp * camDist
    );
    var minY = world.heightAt(camera.position.x, camera.position.z) + 0.6;
    if (camera.position.y < minY) camera.position.y = minY;
    camera.lookAt(smoothFocus.x, smoothFocus.y + 0.2, smoothFocus.z);
    camera.updateMatrixWorld();
  }
});

function cek(v) { return isFinite(v) ? v.toFixed(2) : 'NaN/TakHingga!'; }
console.log('  Setelah simulasi — pemain: x=' + cek(player.position.x) + ' y=' + cek(player.position.y) + ' z=' + cek(player.position.z));
console.log('  Kamera: x=' + cek(camera.position.x) + ' y=' + cek(camera.position.y) + ' z=' + cek(camera.position.z));
console.log('  Waktu dunia: ' + (world.timeOfDay * 24).toFixed(2) + ' jam (' + world.getClockInfo().text + ' ' + world.getClockInfo().phase + ')');

var jem = world.sunLight.shadow.mapSize;
console.log('  Bayangan matahari: ' + jem.width + 'x' + jem.height + ', kekuatan=' + world.sunLight.intensity.toFixed(2));

// Uji pergantian siang->malam: majukan waktu 6 jam dunia
world.timeOfDay = 0.98; // hampir tengah malam
world.update(1 / 60, camera);
console.log('  Saat malam — matahari terlihat: ' + world.sunMesh.visible + ', bulan terlihat: ' + world.moonMesh.visible + ', bintang opacity: ' + world.stars.material.opacity.toFixed(2));
world.timeOfDay = 0.5; // tengah hari
world.update(1 / 60, camera);
console.log('  Saat siang — matahari terlihat: ' + world.sunMesh.visible + ', bulan terlihat: ' + world.moonMesh.visible + ', langit terang: ' + (world.fogColor.r > 0.2));

// Uji arah: dengan kamera yaw=0, tombol D harus menggerakkan pemain ke -X (kanan layar)
globalThis.Input.isDown = function (code) { return code === 'KeyD'; };
var x0 = player.position.x, z0 = player.position.z;
for (var f = 0; f < 30; f++) player.update(1 / 60, 0, true);
var dxTot = player.position.x - x0, dzTot = player.position.z - z0;
console.log('  Uji arah tombol D (yaw=0): Δx=' + dxTot.toFixed(2) + ' Δz=' + dzTot.toFixed(2) + ' → ' + (dxTot < -0.5 ? 'BENAR (ke kanan layar) ✓' : 'SALAH!'));
globalThis.Input.isDown = function () { return false; };

// Uji tabrakan: pemain di pusat rintangan harus terdorong keluar
var c0 = world.colliders[0];
player.position.set(c0.x + 0.01, world.heightAt(c0.x + 0.01, c0.z), c0.z + 0.01);
player._collide();
var distR = Math.sqrt((player.position.x - c0.x) * (player.position.x - c0.x) + (player.position.z - c0.z) * (player.position.z - c0.z));
var minR = c0.r + 0.34;
console.log('  Uji tabrakan: jarak=' + distR.toFixed(2) + ' (minimum ' + minR.toFixed(2) + ') → ' + (distR >= minR - 0.01 ? 'TERDORONG KELUAR ✓' : 'GAGAL!'));
console.log('  Rintangan: ' + world.colliders.length + ' lingkaran + ' + world.walls.length + ' segmen dinding (pohon ' + world.envCounts.trees + ', batu ' + world.envCounts.rocks + ', kanopi ' + world.envCounts.canopyParts + ' bagian, cemara ' + world.envCounts.pines + ' kerucut)');
console.log('  Rumah: ' + world.platforms.length + ' platform lantai (bisa dimasuki)');

// Platform rumah milik desa Aldenmere. Kerajaan Besar punya platform sendiri
// (dibangun lebih dulu di buildEnvironment), jadi uji pintu/dinding desa harus
// memilih platform yang benar-benar berada di desa.
var villagePlatforms = world.platforms.filter(function (p) {
  var v = world.villageSpots[0];
  return p && !p.open && Math.hypot(p.x - v.x, p.z - v.z) < 90;
});
if (villagePlatforms.length < 2) throw new Error('platform rumah desa tidak ditemukan');
console.log('  Platform desa: ' + villagePlatforms.length + ' unit (kerajaan: ' + (world.platforms.length - villagePlatforms.length) + ')');

// Uji rumah bisa dimasuki: platform lantai menangkap pemain, dinding tetap menabrak
t('rumah bisa dimasuki (platform)', function () {
  var p0 = villagePlatforms[0];
  if (!p0) throw new Error('tidak ada platform rumah');
  if (!world.isInsideHouse(p0.x, p0.z)) throw new Error('isInsideHouse gagal di tengah rumah');
  var sup = world.supportHeight(p0.x, p0.z, p0.top - 0.2);
  if (Math.abs(sup - p0.top) > 0.001) throw new Error('supportHeight=' + sup + ' ≠ lantai ' + p0.top);
  var supJauh = world.supportHeight(p0.x, p0.z, p0.top - 3.0);
  if (supJauh >= p0.top - 0.001) throw new Error('platform menangkap dari terlalu jauh');
});
console.log('  Platform rumah pertama: top=' + villagePlatforms[0].top.toFixed(2) + ' (terrain ' + world.groundHeight(villagePlatforms[0].x, villagePlatforms[0].z).toFixed(2) + ') → ' + (villagePlatforms[0].top - world.groundHeight(villagePlatforms[0].x, villagePlatforms[0].z) < 0.95 ? 'bisa dinaiki ✓' : 'TERLALU TINGGI!'));

// Fase 5: rumah seukuran manusia normal, ruang dalam lapang (tidak sesak)
t('rumah lapang: pintu ≥2,1 m & langit-langit ≥2,7 m', function () {
  var p0 = villagePlatforms[0];
  var p1 = villagePlatforms[1];
  if (!(p0.doorW >= 1.3 && p0.doorH >= 2.1)) throw new Error('pintu balai terlalu kecil: ' + p0.doorW + '×' + p0.doorH);
  if (!(p1.doorW >= 1.3 && p1.doorH >= 2.1)) throw new Error('pintu rumah terlalu kecil: ' + p1.doorW + '×' + p1.doorH);
  if (p0.ceil - p0.top < 2.7) throw new Error('langit-langit balai terlalu rendah: ' + (p0.ceil - p0.top).toFixed(2));
  if (p1.ceil - p1.top < 2.7) throw new Error('langit-langit rumah terlalu rendah: ' + (p1.ceil - p1.top).toFixed(2));
  if (p0.hw * 2 > 9 || p0.hd * 2 > 9) throw new Error('rumah terlalu besar untuk ukuran manusia');
});
console.log('  Rumah: pintu ' + villagePlatforms[1].doorW + '×' + villagePlatforms[1].doorH.toFixed(2) +
  ' m, langit-langit ' + (villagePlatforms[1].ceil - villagePlatforms[1].top).toFixed(2) + ' m ✓');

// Uji dinding: pemain tidak boleh menembus dinding rumah (termasuk saat fps rendah)
function ujiDinding(dt) {
  var p0 = villagePlatforms[0];
  var rot = Math.atan2(p0.sin, p0.cos);
  var doorX = Math.sin(rot), doorZ = Math.cos(rot);
  var hdRaw = p0.hd - 0.17;
  var sx = p0.x - doorX * (hdRaw + 2.2), sz = p0.z - doorZ * (hdRaw + 2.2);
  var pl = new globalThis.Player(scene, world);
  pl.position.set(sx, world.groundHeight(sx, sz), sz);
  var oldIsDown = globalThis.Input.isDown;
  globalThis.Input.isDown = function (c) { return c === 'KeyW'; };
  var camYaw = Math.atan2(doorX, doorZ);
  for (var k = 0; k < Math.round(4 / dt); k++) pl.update(dt, camYaw, true);
  globalThis.Input.isDown = oldIsDown;
  return world.isInsideHouse(pl.position.x, pl.position.z);
}
t('dinding rumah menahan pemain (60 fps)', function () {
  if (ujiDinding(1 / 60)) throw new Error('menembus dinding pada 60 fps!');
});
t('dinding rumah menahan pemain (20 fps)', function () {
  if (ujiDinding(0.05)) throw new Error('menembus dinding pada 20 fps!');
});
t('pintu rumah tetap bisa dimasuki', function () {
  var p0 = villagePlatforms[0];
  var rot = Math.atan2(p0.sin, p0.cos);
  var doorX = Math.sin(rot), doorZ = Math.cos(rot);
  var hdRaw = p0.hd - 0.17;
  var sx = p0.x + doorX * (hdRaw + 2.2), sz = p0.z + doorZ * (hdRaw + 2.2);
  var pl = new globalThis.Player(scene, world);
  pl.position.set(sx, world.groundHeight(sx, sz), sz);
  var oldIsDown = globalThis.Input.isDown;
  globalThis.Input.isDown = function (c) { return c === 'KeyW'; };
  var camYaw = Math.atan2(-doorX, -doorZ);
  for (var k = 0; k < 150; k++) pl.update(1 / 60, camYaw, true);
  globalThis.Input.isDown = oldIsDown;
  if (!world.isInsideHouse(pl.position.x, pl.position.z)) throw new Error('tidak bisa masuk lewat pintu!');
  if (Math.abs(pl.position.y - p0.top) > 0.05) throw new Error('tidak berpijak di lantai: y=' + pl.position.y + ' vs ' + p0.top);
});

// ---- Fase 2: dialog, tugas, dan NPC ----
var UI = globalThis.UI;
function advDialog() { var steps = 0; while (UI.isDialogOpen() && steps++ < 30) UI.advanceDialog(); }

var chief = null, mira = null, i2;
for (i2 = 0; i2 < village.npcs.length; i2++) {
  if (village.npcs[i2].role === 'kepala') chief = village.npcs[i2];
  if (village.npcs[i2].role === 'mira') mira = village.npcs[i2];
}

t('dialog Pak Raka → mulai tugas', function () {
  village.interact({ kind: 'npc', npc: chief });
  advDialog();
});
console.log('  Tugas kelapa: ' + village.quests.kelapa.state + ' → ' + (village.quests.kelapa.state === 'cari' ? 'OK ✓' : 'GAGAL!'));

t('petik 5 kelapa', function () {
  for (var i3 = 0; i3 < 5 && i3 < world.palms.length; i3++) {
    village.interact({ kind: 'palm', palm: world.palms[i3] });
  }
});
console.log('  Kelapa: ' + village.quests.kelapa.count + '/' + village.quests.kelapa.need + ', status ' + village.quests.kelapa.state + ' → ' + (village.quests.kelapa.state === 'kembali' ? 'OK ✓' : 'GAGAL!'));

t('lapor ke Pak Raka', function () {
  village.interact({ kind: 'npc', npc: chief });
  advDialog();
});
console.log('  Tugas kelapa: ' + village.quests.kelapa.state + ' → ' + (village.quests.kelapa.state === 'selesai' ? 'OK ✓' : 'GAGAL!'));

t('tugas keranjang: Mira', function () {
  village.interact({ kind: 'npc', npc: mira });
  advDialog();
});
console.log('  Keranjang: ' + village.quests.keranjang.state + ', terlihat=' + (village.basket && village.basket.visible) + ' → ' + (village.quests.keranjang.state === 'cari' && village.basket.visible ? 'OK ✓' : 'GAGAL!'));

t('ambil keranjang', function () { village.interact({ kind: 'basket' }); });
console.log('  Keranjang: ' + village.quests.keranjang.state + ' → ' + (village.quests.keranjang.state === 'kembali' ? 'OK ✓' : 'GAGAL!'));

t('antar keranjang ke Mira', function () {
  village.interact({ kind: 'npc', npc: mira });
  advDialog();
});
console.log('  Tugas keranjang: ' + village.quests.keranjang.state + ' → ' + (village.quests.keranjang.state === 'selesai' ? 'OK ✓' : 'GAGAL!'));

// ---- Fase 3: statistik, makhluk, pertarungan, jarahan ----
console.log('\n--- Fase 3 ---');

// Pindahkan pemain ke desa (datar & aman) untuk uji tempur
player.position.set(village.center.x, world.groundHeight(village.center.x, village.center.z), village.center.z);
player.yaw = 0;

var boar = null, slime = null, i4;
for (i4 = 0; i4 < enemies.list.length; i4++) {
  if (!boar && enemies.list[i4].typeId === 'babi') boar = enemies.list[i4];
  if (!slime && enemies.list[i4].typeId === 'slime') slime = enemies.list[i4];
}

t('tebasan pemain: kalahkan babi', function () {
  boar.group.position.set(player.position.x, player.position.y, player.position.z + 1.5);
  boar.hp = 12; // hampir kalah — sekali tebas
  enemies.playerHit(player.position.x, player.position.z, player.yaw, rpgStats.getDamage(), rpgStats);
});
console.log('  Babi: hp=' + boar.hp + ' (mati=' + (boar.deadT >= 0) + '), jarahan di dunia: ' + enemies.loot.length +
  ' → ' + (boar.deadT >= 0 && enemies.loot.length > 0 ? 'OK ✓' : 'GAGAL!'));
console.log('  XP pemain: ' + rpgStats.xp + ' → ' + (rpgStats.xp > 0 ? 'OK ✓' : 'GAGAL!'));

t('ambil jarahan (magnet + kantong)', function () {
  for (var f3 = 0; f3 < 90; f3++) enemies.update(1 / 60, player, camera, true, rpgStats);
});
var totalItems = 0;
for (var key in rpgStats.inventory) totalItems += rpgStats.inventory[key];
console.log('  Isi tas: ' + JSON.stringify(rpgStats.inventory) + ' → ' + (totalItems > 0 ? 'OK ✓' : 'GAGAL!'));

t('naik level', function () {
  rpgStats.gainXp(3000);
});
console.log('  Level ' + rpgStats.level + ', HP maks ' + rpgStats.maxHp + ', serangan ' + rpgStats.getDamage() +
  ' → ' + (rpgStats.level > 1 && rpgStats.maxHp > 100 ? 'OK ✓' : 'GAGAL!'));

t('AI: slime mengejar pemain', function () {
  slime.home.x = player.position.x + 6;
  slime.home.z = player.position.z;
  slime.group.position.set(player.position.x + 6, world.groundHeight(player.position.x + 6, player.position.z), player.position.z);
  slime.aggro = false; slime.state = 'idle'; slime.timer = 5; slime.deadT = -1; slime.hp = slime.maxHp;
  for (var f4 = 0; f4 < 60; f4++) enemies.update(1 / 60, player, camera, true, rpgStats);
});
console.log('  Slime: status=' + slime.state + ', aggro=' + slime.aggro + ' → ' + (slime.aggro ? 'OK ✓' : 'GAGAL!'));

var hurtAmt = 0;
enemies.hooks = { onPlayerHurt: function (d) { hurtAmt += d; } };
t('musuh melukai pemain (hook)', function () {
  slime.home.x = player.position.x + 1.4;
  slime.home.z = player.position.z;
  slime.group.position.set(player.position.x + 1.4, player.position.y, player.position.z);
  slime.aggro = true; slime.state = 'attack'; slime.windup = 0.3; slime._struck = false; slime.cd = 0;
  for (var f5 = 0; f5 < 40; f5++) enemies.update(1 / 60, player, camera, true, rpgStats);
});
console.log('  Total luka dari slime: ' + hurtAmt + ' → ' + (hurtAmt > 0 ? 'OK ✓' : 'GAGAL!'));
enemies.hooks = null;

t('makan daging memulihkan HP', function () {
  rpgStats.hp = 50;
  rpgStats.addItem('daging', 1);
  rpgStats.useConsumable('daging');
});
console.log('  HP setelah makan: ' + rpgStats.hp + ' → ' + (rpgStats.hp === 80 ? 'OK ✓' : 'GAGAL!'));

console.log('  Bilah HP musuh: ' + (enemies._barGroup ? 'ADA ✓' : 'HILANG!'));
console.log('  Kotak jarahan: geometri ' + (enemies._lootGeo ? 'siap ✓' : 'HILANG!') + ', material tersimpan: ' +
  (enemies._lootMats ? Object.keys(enemies._lootMats).length : 0));

console.log('\n--- Grafis (Tahap G1–G5) ---');

var texNode = t('TexLib aman tanpa canvas (Node)', function () {
  return globalThis.TexLib.get('bark');
});
console.log('  TexLib.get("bark") di Node: ' + (texNode === null ? 'null — fallback aman ✓' : 'ADA (tak terduga!)'));

console.log('  AssetLibrary: ' + (typeof globalThis.AssetLibrary === 'function' ? 'siap ✓' : 'HILANG!'));
console.log('  Metode model 3D: pemain=' + (typeof globalThis.Player.prototype.attachModel === 'function' ? 'ada ✓' : 'HILANG!') +
  ', desa=' + (typeof globalThis.Village.prototype.attachModels === 'function' ? 'ada ✓' : 'HILANG!') +
  ', musuh=' + (typeof globalThis.Enemies.prototype.attachModels === 'function' ? 'ada ✓' : 'HILANG!'));

var qp = globalThis.CONFIG.RENDER.presets || {};
console.log('  Preset kualitas: ' + Object.keys(qp).join('/') + ' → ' +
  (qp.cepat && qp.hd && qp.ultra && qp.cepat.models === false && qp.hd.models === true && qp.ultra.pixelRatio > qp.hd.pixelRatio ?
    'lengkap ✓' : 'PERIKSA!'));

console.log('\n--- Menu: pengaturan, bahasa, audio & trailer (Tahap Menu) ---');

var Lang = globalThis.Lang;
console.log('  Dwibahasa: ' + (Lang && typeof Lang.set === 'function' ? 'siap ✓' : 'HILANG!') +
  ' (kamus EN: ' + (Lang ? Object.keys(Lang.EN).length : 0) + ' kunci, untai dinamis: ' +
  (Lang ? Object.keys(Lang.EN_STR).length : 0) + ')');
if (Lang) {
  var before = Lang.tx('menu.play', 'Mulai Menjelajah');
  Lang.set('en');
  var after = Lang.tx('menu.play', 'Mulai Menjelajah');
  var loadLabel = Lang.str('Membangun terrain pulau...');
  Lang.set('id');
  var back = Lang.tx('menu.play', 'Mulai Menjelajah');
  console.log('  Terjemahan: id="' + before + '" → en="' + after + '" → id="' + back + '", label memuat (en): "' + loadLabel + '" → ' +
    (before === 'Mulai Menjelajah' && after === 'Begin Adventure' && back === 'Mulai Menjelajah' && langLabelOk(loadLabel) ? 'OK ✓' : 'PERIKSA!'));
} else {
  console.log('  Terjemahan: GAGAL!');
}
function langLabelOk(s) { return s === 'Building the island terrain...'; }

var AM = globalThis.AudioMan;
console.log('  Audio prosedural: ' + (AM && typeof AM.sfx === 'function' ? 'siap ✓' : 'HILANG!') +
  ' (musik ' + (AM ? Math.round(AM.volMusic * 100) : '?') + '%, efek ' + (AM ? Math.round(AM.volSfx * 100) : '?') + '%)');
if (AM) {
  var sfxSafe = 'OK ✓';
  try { AM.sfx('click'); } catch (e) { sfxSafe = 'GAGAL: ' + e.message; }
  console.log('  sfx() tanpa AudioContext: ' + sfxSafe);
}

console.log('  Trailer: ' + (typeof globalThis.Trailer === 'function' ? 'siap ✓' : 'HILANG!') +
  ' (' + (globalThis.Trailer ? globalThis.Trailer.CARDS.length : 0) + ' kartu judul)');
if (globalThis.Trailer) {
  var tr = new globalThis.Trailer(camera, world);
  t('trailer: bangun jalur kamera', function () { tr._buildCurves(); });
  var tp0 = tr._posCurve.getPointAt(0), tp1 = tr._posCurve.getPointAt(0.5), tp2 = tr._posCurve.getPointAt(1);
  var trailOk = isFinite(tp0.x) && isFinite(tp1.x) && isFinite(tp2.x);
  console.log('  Jalur kamera 3 titik: (' + tp0.x.toFixed(0) + ',' + tp0.z.toFixed(0) + ') → (' +
    tp1.x.toFixed(0) + ',' + tp1.z.toFixed(0) + ') → (' + tp2.x.toFixed(0) + ',' + tp2.z.toFixed(0) + ') → ' +
    (trailOk ? 'OK ✓' : 'NaN/GAGAL!'));
}

console.log('\n--- Fase 4: simpan/muat, peta mini, efek, suasana malam ---');

// localStorage palsu untuk uji Node
var oldStorage = globalThis.localStorage;
var fakeStore = Object.create(null);
globalThis.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(fakeStore, k) ? fakeStore[k] : null; },
  setItem: function (k, v) { fakeStore[k] = String(v); },
  removeItem: function (k) { delete fakeStore[k]; }
};

var SG = globalThis.SaveGame;
t('simpan → baca → info', function () {
  var snap = {
    playTime: 123,
    player: { x: 10, y: 2, z: 20, yaw: 0.5, level: 4, xp: 17, hp: 88, maxHp: 130, baseDamage: 13,
      inventory: { daging: 2, koin: 9 } },
    world: { timeOfDay: 0.42, elapsed: 44 },
    palms: [true, false, true],
    quests: { kelapa: { state: 'cari', count: 2, need: 5 }, keranjang: { state: 'belum' } }
  };
  if (!SG.write(snap)) throw new Error('write gagal');
  var rec = SG.read();
  if (!rec || rec.data.player.level !== 4 || rec.data.player.inventory.koin !== 9) throw new Error('isi tidak sama');
  var inf = SG.info();
  if (!inf || inf.level !== 4 || inf.playTime !== 123) throw new Error('info salah');
});
console.log('  Slot simpanan: ' + SG.KEY + ' → ' + (SG.has() ? 'terbaca ✓' : 'GAGAL!'));
console.log('  Versi simpanan: v' + SG.VERSION + ' → ' + (SG.VERSION === 2 && SG.KEY === 'pulau.simpanan.v2' ? 'Fase 5 OK ✓' : 'PERIKSA!'));

t('simpanan v1 dibersihkan & data perahu/tujuan tersimpan', function () {
  globalThis.localStorage.setItem('pulau.simpanan.v1', '{"v":1}');
  SG.write({
    playTime: 1,
    player: { x: 1, y: 1, z: 1, yaw: 0, level: 1, xp: 0, hp: 10, maxHp: 10, baseDamage: 5, inventory: {} },
    world: { timeOfDay: 0.3, elapsed: 1 },
    palms: [],
    boat: { x: 5, z: 6, yaw: 0.5, boarded: true },
    waypoint: { x: 944, z: 740, poi: 'hut' },
    quests: { kelapa: { state: 'belum', count: 0, need: 5 }, keranjang: { state: 'belum' } },
    npcLines: []
  });
  if (globalThis.localStorage.getItem('pulau.simpanan.v1') !== null) throw new Error('kunci v1 tidak dihapus');
  var rec2 = SG.read();
  if (!rec2 || !rec2.data.boat || rec2.data.boat.boarded !== true) throw new Error('data perahu tidak tersimpan');
  if (!rec2.data.waypoint || rec2.data.waypoint.poi !== 'hut' || rec2.data.waypoint.x !== 944) {
    throw new Error('data tujuan tidak tersimpan');
  }
});

t('simpanan rusak diabaikan', function () {
  globalThis.localStorage.setItem(SG.KEY, '{"v":1,"data":');
  if (SG.read() !== null) throw new Error('JSON rusak tidak diabaikan');
  globalThis.localStorage.setItem(SG.KEY, JSON.stringify({ v: 99, data: { player: {} } }));
  if (SG.read() !== null) throw new Error('versi salah tidak diabaikan');
});

t('hapus simpanan', function () {
  if (!SG.clear()) throw new Error('clear gagal');
  if (SG.has()) throw new Error('masih ada setelah clear');
});

// Peta mini: kelas aman di Node; state toggle disimpan.
var MM = globalThis.Minimap;
var mm = new MM();
t('peta mini: toggle + persistensi', function () {
  if (mm.init(null, world) !== false) throw new Error('init tanpa kanvas harus false');
  var first = mm.visible;
  mm.setVisible(false);
  var mm2 = new MM();
  if (mm2.visible !== false) throw new Error('status tersembunyi tidak tersimpan');
  mm.setVisible(first);
});
console.log('  Minimap: ' + (MM ? 'kelas siap ✓' : 'HILANG!') + ', kanvas aman tanpa DOM ✓');

t('peta: 4 mode berurutan (Dunia → Sekitar → Lokal → Sembunyi)', function () {
  mm.setMode('dunia');
  if (mm.label() !== 'DUNIA' || !mm.visible) throw new Error('mode dunia gagal');
  mm.cycle(); if (mm.mode !== 'sekitar' || mm.label() !== 'SEKITAR') throw new Error('mode sekitar gagal');
  mm.cycle(); if (mm.mode !== 'lokal' || mm.label() !== 'LOKAL') throw new Error('mode lokal gagal');
  mm.cycle(); if (mm.mode !== 'sembunyi' || mm.visible || mm.label() !== '') throw new Error('mode sembunyi gagal');
  mm.cycle(); if (mm.mode !== 'dunia') throw new Error('tidak kembali ke mode dunia');
});

t('peta besar: konversi klik 1024² & arah kompas', function () {
  if (typeof MM.worldToMap !== 'function' || typeof MM.mapToWorld !== 'function' ||
      typeof MM.bearingTo !== 'function') throw new Error('helper peta besar hilang');
  var ws = globalThis.CONFIG.WORLD.size;
  var p = MM.worldToMap(944, 740, 1024, ws);
  var w = MM.mapToWorld(p.x, p.y, 1024, ws);
  if (Math.abs(w.x - 944) > 0.001 || Math.abs(w.z - 740) > 0.001) throw new Error('bolak-balik koordinat salah');
  var front = MM.bearingTo(0, 0, 10);
  var left = MM.bearingTo(0, 10, 0);
  var right = MM.bearingTo(0, -10, 0);
  var back = MM.bearingTo(0, 0, -10);
  var east = MM.bearingTo(Math.PI / 2, 10, 0);
  if (Math.abs(front) > 1e-6) throw new Error('arah depan salah');
  if (Math.abs(left + Math.PI / 2) > 1e-6) throw new Error('arah kiri salah');
  if (Math.abs(right - Math.PI / 2) > 1e-6) throw new Error('arah kanan salah');
  if (Math.abs(Math.abs(back) - Math.PI) > 1e-6) throw new Error('arah belakang salah');
  if (Math.abs(east) > 1e-6) throw new Error('arah kamera timur salah');
  if (mm.initBig(null) !== false) throw new Error('initBig tanpa kanvas harus false');
});
console.log('  Peta besar: konversi 1024² + kompas relatif kamera ✓');

// Efek: pool partikel + cincin.
var FX = new globalThis.EffectSystem();
t('efek: init, burst, update, clear', function () {
  if (!FX.init(scene)) throw new Error('init efek gagal');
  FX.hit(0, 2, 0, false);
  FX.levelUp(0, 2, 0);
  for (var f = 0; f < 30; f++) FX.update(1 / 60);
  if (FX.countActive() <= 0) throw new Error('tidak ada partikel aktif');
  if (FX.rings.length !== 3) throw new Error('cincin tidak lengkap');
  FX.clear();
  if (FX.countActive() !== 0) throw new Error('clear gagal');
});
console.log('  Efek: ' + (FX.countActive() === 0 ? 'pool partikel + 3 cincin siap ✓' : 'PERIKSA!'));

t('audio malam aman tanpa AudioContext', function () {
  if (AM && typeof AM.setNight === 'function') AM.setNight(1);
  if (AM && typeof AM.sfx === 'function') { AM.sfx('save'); AM.sfx('load'); }
});

console.log('\n--- Fase 5: dunia 10×, pelabuhan & perahu, peta mode ---');

t('dunia 10× & pulau-pulau kecil', function () {
  var cfg = globalThis.CONFIG.WORLD;
  if (Math.abs(cfg.size / cfg.baseSize - world.scale) > 0.01) throw new Error('skala dunia tidak cocok');
  if (!world.islands || world.islands.length < 8 || world.islands.length > 12) {
    throw new Error('jumlah pulau kecil: ' + (world.islands ? world.islands.length : 0));
  }
  if (!world.harborSpot) throw new Error('pelabuhan tidak ada');
  var peak = 0;
  for (var sxp = -1200; sxp <= 1200; sxp += 60) {
    for (var szp = -1200; szp <= 1200; szp += 60) {
      var hh = world.groundHeight(sxp, szp);
      if (hh > peak) peak = hh;
    }
  }
  if (peak < 120) throw new Error('pegunungan tidak ikut membesar (puncak ' + peak.toFixed(0) + ' m)');
  console.log('  Skala ' + world.scale.toFixed(3) + '×, puncak tertinggi (sampel): ' + peak.toFixed(0) + ' m ✓');
});

t('pondok + api unggun di pulau kecil & NPC penghuni', function () {
  var isl = world.islandSites || [];
  if (isl.length < 2) throw new Error('pulau kecil berpondok kurang dari 2: ' + isl.length);
  if (village.sites.length < world.villageSpots.length + isl.length) throw new Error('situs pondok pulau tidak terdaftar');
  var pelaut = 0;
  for (var ni = 0; ni < village.npcs.length; ni++) if (village.npcs[ni].role === 'pelaut') pelaut++;
  if (pelaut < 1) throw new Error('NPC penghuni pulau tidak ada');
  console.log('  Pondok pulau: ' + isl.length + ', NPC penghuni: ' + pelaut + ', total situs desa: ' + village.sites.length + ' ✓');
});

t('dermaga: dek bisa dipijak, bukan ruang rumah', function () {
  var dp = boat.dockPlatform;
  if (!dp || !dp.open) throw new Error('platform dermaga tidak ada / tidak open');
  if (world.insidePlatform(dp.x, dp.z) !== null) throw new Error('dermaga dianggap ruang rumah');
  if (Math.abs(dp.top - globalThis.Boat.DECK_Y) > 0.001) throw new Error('tinggi dek salah');
  var sup = world.supportHeight(dp.x, dp.z, dp.top - 0.1);
  if (Math.abs(sup - dp.top) > 0.001) throw new Error('supportHeight dek=' + sup);
});

t('perahu: bisa dinaiki & dikemudikan (W)', function () {
  player.position.set(boat.position.x + 1.4, boat.position.y + 0.2, boat.position.z);
  var target = boat.findInteraction(player);
  if (!target || target.kind !== 'boat') throw new Error('interaksi perahu tidak terdeteksi');
  boat.interact(player);
  if (!boat.boarded) throw new Error('gagal menaiki perahu');
  var x0 = boat.position.x, z0 = boat.position.z;
  var oldDown = globalThis.Input.isDown;
  globalThis.Input.isDown = function (c) { return c === 'KeyW'; };
  for (var fb = 0; fb < 180; fb++) boat.update(1 / 60, player, true, globalThis.Input);
  globalThis.Input.isDown = oldDown;
  var moved = Math.sqrt(Math.pow(boat.position.x - x0, 2) + Math.pow(boat.position.z - z0, 2));
  if (moved < 8) throw new Error('perahu tidak bergerak (hanya ' + moved.toFixed(1) + ' m)');
  if (Math.abs(player.position.x - boat.position.x) > 4 || Math.abs(player.position.z - boat.position.z) > 4) {
    throw new Error('pemain tidak mengikuti perahu');
  }
  console.log('  Perahu bergerak ' + moved.toFixed(1) + ' m, kecepatan ' + (boat.speed * 3.6).toFixed(0) + ' km/j ✓');
});

t('bisa turun di air dalam & berenang', function () {
  if (world.groundHeight(boat.position.x, boat.position.z) > globalThis.CONFIG.BOAT.minDepth) {
    throw new Error('perahu tidak berada di air dalam');
  }
  if (!boat.exit(player)) throw new Error('turun di air dalam seharusnya bisa');
  if (boat.boarded) throw new Error('masih menaiki perahu setelah turun di laut');
  if (!player.swimming) throw new Error('pemain tidak masuk mode berenang');
  var wy = world.waveHeight(player.position.x, player.position.z, world.elapsed || 0);
  var targetY = wy + globalThis.CONFIG.PLAYER.swimOffset;
  if (Math.abs(player.position.y - targetY) > 0.1) {
    throw new Error('tinggi berenang salah: y=' + player.position.y.toFixed(2));
  }
  for (var sw = 0; sw < 20; sw++) player.update(1 / 60, 0, false);
  if (!player.swimming) throw new Error('mode berenang hilang setelah update');
  console.log('  Turun di laut dalam, berenang (y=' + player.position.y.toFixed(2) + ') ✓');
});

t('turun dengan aman di dermaga', function () {
  boat.setPose(boat.moor.x, boat.moor.z, boat.moor.yaw, true);
  if (!boat.exit(player)) throw new Error('turun di dermaga gagal');
  if (boat.boarded) throw new Error('masih menaiki perahu');
  if (Math.abs(player.position.y - globalThis.Boat.DECK_Y) > 0.01) {
    throw new Error('pemain tidak berpijak di dek dermaga: y=' + player.position.y.toFixed(2));
  }
  console.log('  Turun di dek dermaga (y=' + player.position.y.toFixed(2) + ') ✓');
});

t('turun di pantai pulau kecil (air dangkal)', function () {
  var minD = globalThis.CONFIG.BOAT.minDepth;
  var isl = null;
  for (var ii = 0; ii < world.islands.length; ii++) {
    if (world.islands[ii].r > 80) { isl = world.islands[ii]; break; }
  }
  if (!isl) throw new Error('tidak ada pulau kecil yang cukup besar');
  var ang = isl.ang || 0;
  var dx = Math.cos(ang), dz = Math.sin(ang);
  // Cari garis pantai pulau (kedalaman tepat di ambang perahu) dari luar ke dalam.
  var shore = null;
  for (var rr = isl.r * 1.4; rr > isl.r * 0.4; rr -= 0.25) {
    var gx = isl.x + dx * rr, gz = isl.z + dz * rr;
    if (world.groundHeight(gx, gz) > minD - 0.05) { shore = { r: rr }; break; }
  }
  if (!shore) throw new Error('garis pantai pulau tidak ditemukan');
  // Perahu 2 m di luar garis pantai, haluan menghadap pulau.
  var bx = isl.x + dx * (shore.r + 2.0), bz = isl.z + dz * (shore.r + 2.0);
  boat.setPose(bx, bz, Math.atan2(-dx, -dz), true);
  if (world.groundHeight(boat.position.x, boat.position.z) > minD) {
    throw new Error('perahu uji berada di darat');
  }
  if (!boat.exit(player)) throw new Error('turun di pantai pulau gagal');
  if (boat.boarded) throw new Error('masih menaiki perahu setelah turun di pulau');
  // Titik turun harus di air dangkal (di atas ambang kandas perahu), bukan air dalam.
  if (player.position.y < minD - 0.1) {
    throw new Error('pemain turun di air terlalu dalam: y=' + player.position.y.toFixed(2));
  }
  var pg = world.groundHeight(player.position.x, player.position.z);
  if (Math.abs(player.position.y - pg) > 0.05) throw new Error('pemain tidak berpijak di tanah pulau');
  console.log('  Turun di pantai pulau kecil (y=' + player.position.y.toFixed(2) + ') ✓');
});

t('jembatan dermaga tersambung dari darat', function () {
  var lp = boat.dockLanding;
  if (!lp || !isFinite(lp.x) || !lp.top) throw new Error('platform jembatan dermaga tidak ada');
  if (Math.abs(world.supportHeight(lp.x, lp.z, lp.top - 0.1) - lp.top) > 0.001) {
    throw new Error('jembatan dermaga tidak bisa dipijak');
  }
  // Ada titik darat di ujung jembatan yang bisa melangkah ke platformnya.
  var ry = boat.dockYaw;
  var walkable = false;
  for (var lx = -2.2; lx <= 2.2; lx += 0.25) {
    for (var lz = -9.2; lz <= -1.8; lz += 0.25) {
      var x = boat.spot.x + Math.cos(ry) * lx + Math.sin(ry) * lz;
      var z = boat.spot.z - Math.sin(ry) * lx + Math.cos(ry) * lz;
      var g = world.groundHeight(x, z);
      if (g > 0.05 && g < lp.top - 0.05 &&
          Math.abs(world.supportHeight(x, z, g) - lp.top) < 0.001) {
        walkable = true;
        break;
      }
    }
    if (walkable) break;
  }
  if (!walkable) throw new Error('tidak ada jalan darat → jembatan dermaga');
  console.log('  Jembatan pantai: darat → dek dermaga (top=' + lp.top.toFixed(2) + ') ✓');
});

t('berenang bisa naik ke dek dermaga', function () {
  var s = boat.spot, ry = boat.dockYaw;
  var x = s.x + Math.sin(ry) * 12, z = s.z + Math.cos(ry) * 12;
  player.position.set(x, -0.9, z);
  player.velocity.set(0, 0, 0);
  player.swimming = true;
  player.grounded = false;
  player.groundedTimer = 0;
  player.update(1 / 60, 0, false);
  if (!player.grounded || player.swimming) {
    throw new Error('pemain tidak naik ke dek dari air');
  }
  if (Math.abs(player.position.y - boat.dockPlatform.top) > 0.05) {
    throw new Error('tinggi dek setelah naik dari air salah: ' + player.position.y.toFixed(2));
  }
  console.log('  Berenang di sisi dek → naik ke dek (y=' + player.position.y.toFixed(2) + ') ✓');
});

t('tabrakan dermaga memakai arah dermaga, bukan yaw perahu', function () {
  var s = boat.spot, ry = boat.dockYaw;
  var dx = s.x + Math.sin(ry) * 12, dz = s.z + Math.cos(ry) * 12;
  var oldYaw = boat.yaw;
  boat.yaw = 1.57;
  if (boat._canMoveTo(dx, dz)) throw new Error('perahu bisa menembus dek saat berbelok');
  boat.yaw = oldYaw;
  console.log('  Dinding dermaga tetap pada arahnya saat perahu berputar ✓');
});

t('laut terbuka: pemain & perahu melewati batas peta lama', function () {
  if (world.groundHeight(2000, 0) > -globalThis.CONFIG.PLAYER.swimDepth) {
    throw new Error('titik uji di luar peta bukan laut dalam');
  }
  if (!boat._canMoveTo(2000, 0)) throw new Error('perahu masih diblokir di luar batas peta lama');
  player.position.set(2000, 0.2, 0);
  player.velocity.set(0, 0, 0);
  player.swimming = false;
  player.grounded = false;
  for (var ow = 0; ow < 30; ow++) player.update(1 / 60, 0, false);
  if (Math.abs(player.position.x - 2000) > 0.01) throw new Error('pemain dijepit batas dunia: x=' + player.position.x);
  if (!player.swimming) throw new Error('pemain tenggelam / tidak berenang di samudra luar');
  console.log('  Berenang di x=2000 (batas lama 1612), perahu juga bebas ✓');
});

t('posisi perahu darat dikoreksi ke tambatan', function () {
  boat.setPose(0, 0, 1.2, false); // (0,0) = puncak pulau → darat
  var dx = boat.position.x - boat.moor.x, dz = boat.position.z - boat.moor.z;
  if (dx * dx + dz * dz > 1) throw new Error('perahu tidak kembali ke tambatan');
  boat.setPose(boat.moor.x, boat.moor.z, boat.moor.yaw, false);
});

t('pemain di atas perahu: updateRiding aman', function () {
  player.attackCooldown = 0; player.attackTimer = 0;
  player.updateRiding(1 / 60);
  if (!isFinite(player.position.x) || !isFinite(player.position.y)) throw new Error('posisi NaN setelah updateRiding');
});

t('rumput: potongan sekitar pemain terbangun bertahap', function () {
  var vc = village.center || { x: 0, z: 0 };
  var gx = vc.x + 30;
  player.position.set(gx, world.groundHeight(gx, vc.z), vc.z);
  grass.update(1 / 60, player);
  grass.update(1 / 60, player);
  var ready = 0, total = 0;
  for (var kk in grass.chunks) { total++; if (grass.chunks[kk].ready) ready++; }
  if (ready < 2) throw new Error('tidak ada potongan rumput siap');
  console.log('  Potongan rumput: ' + ready + '/' + total + ' siap setelah 2 frame ✓');
});

t('makhluk pulau ditambah untuk dunia 10×', function () {
  if (enemies.list.length < 55) throw new Error('jumlah makhluk terlalu sedikit: ' + enemies.list.length);
  console.log('  Makhluk: ' + enemies.list.length + ' (babi ' + enemies.counts.babi + ', slime ' + enemies.counts.slime +
    ', bandit ' + enemies.counts.bandit + ') ✓');
});

globalThis.localStorage = oldStorage;

console.log('\nSEMUA TAHAP FASE 1 + 2 + 3 + 4 + 5 BERJALAN TANPA ERROR.');
