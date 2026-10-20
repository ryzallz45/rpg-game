/* Uji terrain di Node.js (tanpa browser): statistik + peta ASCII pulau. */
'use strict';
require('../js/utils.js');
require('../js/config.js');
require('../js/world.js');

var C = globalThis.CONFIG;
var height = globalThis.World.createHeightFunction();

console.log('=== UJI GENERATOR PULAU (seed ' + C.WORLD.seed + ') ===\n');

var N = 72;
var min = Infinity, max = -Infinity;
var land = 0, total = 0, deep = 0;
var size = C.WORLD.size;

// Peta ASCII
var rows = [];
for (var iz = 0; iz < N; iz++) {
  var row = '';
  for (var ix = 0; ix < N; ix++) {
    var x = (ix / (N - 1) - 0.5) * size;
    var z = (iz / (N - 1) - 0.5) * size;
    var h = height(x, z);
    total++;
    if (h > 0) land++;
    if (h < -6) deep++;
    if (h < min) min = h;
    if (h > max) max = h;
    var ch;
    if (h < -6) ch = ' ';
    else if (h < 0) ch = '.';
    else if (h < 3) ch = ':';
    else if (h < 15) ch = '*';
    else if (h < 40) ch = '#';
    else if (h < 65) ch = '%';
    else ch = '@';
    row += ch + ' ';
  }
  rows.push(row);
}
console.log(rows.join('\n'));
console.log('\nLegenda: (spasi)=laut dalam  . =laut  : =pantai/dataran rendah  * =perbukitan  # =tinggi  % =gunung  @ =puncak\n');

var spawn = globalThis.World.findSpawnPoint(height);
console.log('Statistik:');
console.log('  Daratan            : ' + (land / total * 100).toFixed(1) + '%');
console.log('  Laut dalam (<-6)   : ' + (deep / total * 100).toFixed(1) + '%');
console.log('  Ketinggian minimum : ' + min.toFixed(1) + ' m');
console.log('  Ketinggian maksimum: ' + max.toFixed(1) + ' m');
console.log('  Titik awal pemain  : x=' + spawn.x.toFixed(0) + ', y=' + spawn.y.toFixed(1) + ', z=' + spawn.z.toFixed(0));

// Uji jalur jalan lurus dari spawn ke tengah — pastikan tidak langsung masuk laut dalam
var blocked = 0, steps = 0;
for (var r = spawn.x; r > 20; r -= 3) {
  steps++;
  if (height(r, 0) < -1.4) blocked++;
}
console.log('  Jalur spawn->tengah: ' + blocked + '/' + steps + ' titik terlalu dalam (>1.4 m)');
console.log('\nOK: generator berjalan tanpa error.');
