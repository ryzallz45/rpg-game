/* Server statis mini untuk "Aetheria: Legacy of the Dawn" — tanpa dependensi (Node saja). */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var ROOT = __dirname;
var PORT = 8317;

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.hdr': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

http.createServer(function (req, res) {
  var pathname = decodeURIComponent(url.parse(req.url).pathname);
  if (pathname === '/') pathname = '/index.html';
  var file = path.normalize(path.join(ROOT, pathname));
  if (file.indexOf(ROOT) !== 0) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Terlarang');
    return;
  }
  fs.stat(file, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Tidak ditemukan: ' + pathname);
      return;
    }
    var ext = path.extname(file).toLowerCase();
    var headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    };
    // Prevent browser download prompt for GLTF binary buffers
    if (ext === '.bin' || ext === '.gltf') {
      headers['Content-Disposition'] = 'inline';
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    var stream = fs.createReadStream(file);
    stream.on('error', function () {
      // Header sudah terkirim; putuskan koneksi agar pemuat GLTF tahu ini gagal.
      res.destroy();
    });
    stream.pipe(res);
  });
}).listen(PORT, function () {
  console.log('================================================');
  console.log('  AETHERIA - Legacy of the Dawn');
  console.log('  Buka   : http://localhost:' + PORT + '/');
  console.log('  Tutup jendela ini untuk mematikan server.');
  console.log('================================================');
});

process.on('SIGINT', function () { process.exit(0); });
