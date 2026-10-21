/* Konversi Quaternius Medieval MegaKit dari .gltf + .bin + PNG menjadi satu
   file .glb mandiri (tekstur dibuang — material diganti TexLib prosedural).

   Pemakaian:
     node tools/gltf-to-glb.js            -> konversi semua model yang dipakai js/assets.js
     node tools/gltf-to-glb.js --all      -> konversi semua .gltf di folder buildings
*/
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DIR = path.join(ROOT, 'assets', 'models', 'buildings');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// Buang semua rujukan tekstur supaya .glb tidak butuh berkas PNG terpisah.
function stripTextures(json) {
  delete json.images;
  delete json.textures;
  delete json.samplers;
  (json.materials || []).forEach(function (m) {
    delete m.normalTexture;
    delete m.occlusionTexture;
    delete m.emissiveTexture;
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture;
      delete m.pbrMetallicRoughness.metallicRoughnessTexture;
    }
  });
  ['extensionsUsed', 'extensionsRequired'].forEach(function (k) {
    if (!Array.isArray(json[k])) return;
    json[k] = json[k].filter(function (e) {
      return !/texture|KHR_materials_(?:clearcoat|sheen|transmission|volume)/i.test(e);
    });
    if (!json[k].length) delete json[k];
  });
}

function pad4(buf, fill) {
  var rem = buf.length % 4;
  if (!rem) return buf;
  return Buffer.concat([buf, Buffer.alloc(4 - rem, fill)]);
}

function toGLB(json, bin) {
  json.buffers = bin ? [{ byteLength: bin.length }] : [];
  var jsonBuf = pad4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  var binBuf = bin ? pad4(bin, 0x00) : null;

  var total = 12 + 8 + jsonBuf.length + (binBuf ? 8 + binBuf.length : 0);
  var out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0); // 'glTF'
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBuf.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
  jsonBuf.copy(out, 20);
  if (binBuf) {
    var o = 20 + jsonBuf.length;
    out.writeUInt32LE(binBuf.length, o);
    out.writeUInt32LE(0x004e4942, o + 4); // 'BIN\0'
    binBuf.copy(out, o + 8);
  }
  return out;
}

function convert(gltfPath) {
  var json = readJSON(gltfPath);
  var bin = null;
  var buffers = json.buffers || [];
  for (var i = 0; i < buffers.length; i++) {
    var uri = buffers[i] && buffers[i].uri;
    if (!uri) continue;
    if (/^data:/i.test(uri)) continue;
    var file = path.join(path.dirname(gltfPath), decodeURIComponent(uri));
    if (!fs.existsSync(file)) throw new Error('buffer tidak ada: ' + uri);
    var data = fs.readFileSync(file);
    if (!bin) bin = data;
    else if (buffers.length === 1) bin = data;
  }
  stripTextures(json);
  var out = toGLB(json, bin);
  var dest = gltfPath.replace(/\.gltf$/i, '.glb');
  fs.writeFileSync(dest, out);
  return { dest: dest, size: out.length };
}

function usedModels() {
  var src = fs.readFileSync(path.join(ROOT, 'js', 'assets.js'), 'utf8');
  var re = /assets\/models\/buildings\/([^'"]+\.gltf)/g;
  var names = [], m;
  while ((m = re.exec(src))) names.push(m[1]);
  return names;
}

function main() {
  var all = process.argv.indexOf('--all') !== -1;
  var list;
  if (all) {
    list = fs.readdirSync(DIR).filter(function (f) { return /\.gltf$/i.test(f); });
  } else {
    list = usedModels();
  }
  var ok = 0, fail = 0;
  list.forEach(function (name) {
    var p = path.join(DIR, name);
    if (!fs.existsSync(p)) {
      console.log('[LEWAT] ' + name + ' (tidak ada)');
      return;
    }
    try {
      var r = convert(p);
      ok++;
      console.log('[OK] ' + name + ' -> ' + path.basename(r.dest) + ' (' + (r.size / 1024).toFixed(0) + ' KB)');
    } catch (e) {
      fail++;
      console.log('[GAGAL] ' + name + ': ' + e.message);
    }
  });
  console.log('\nSelesai: ' + ok + ' berhasil, ' + fail + ' gagal.');
}

main();
