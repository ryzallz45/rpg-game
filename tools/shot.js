/* Jepretan layar via Chrome DevTools Protocol (andal untuk game 3D).
   Pemakaian:  node tools/shot.js "<url>" "<keluaran.png>" [tunggu_ms] [lebar] [tinggi] */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var PORT = 9333;
var url = process.argv[2] || 'http://localhost:8317/index.html#autostart';
var out = process.argv[3] || path.join(process.env.TEMP || '.', 'shot.png');
var waitMs = parseInt(process.argv[4] || '2500', 10);
var W = parseInt(process.argv[5] || '1280', 10);
var H = parseInt(process.argv[6] || '800', 10);

function getJson(p) {
  return new Promise(function (resolve, reject) {
    http.get({ host: '127.0.0.1', port: PORT, path: p }, function (res) {
      var d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var profile = path.join(process.env.TEMP || '.', 'pn-chrome-shot');
  var chrome = spawn(CHROME, [
    '--headless=new', '--use-angle=d3d11',
    '--window-size=' + W + ',' + H,
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    var ok = false;
    for (var i = 0; i < 60; i++) {
      try { await getJson('/json/version'); ok = true; break; } catch (e) { await sleep(250); }
    }
    if (!ok) throw new Error('Chrome DevTools tidak merespons');

    var targets = await getJson('/json/list');
    var page = null;
    for (var t = 0; t < targets.length; t++) { if (targets[t].type === 'page') { page = targets[t]; break; } }
    if (!page) throw new Error('Tab tidak ditemukan');

    var ws = new WebSocket(page.webSocketDebuggerUrl);
    var id = 0, pending = new Map();
    ws.addEventListener('message', function (ev) {
      var msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    });
    await new Promise(function (res, rej) {
      ws.addEventListener('open', res);
      ws.addEventListener('error', rej);
    });
    function send(method, params) {
      return new Promise(function (resolve) {
        var mid = ++id;
        pending.set(mid, resolve);
        ws.send(JSON.stringify({ id: mid, method: method, params: params || {} }));
      });
    }

    await send('Page.enable');
    await send('Page.navigate', { url: url });

    var ready = false;
    for (var k = 0; k < 240; k++) {
      var r = await send('Runtime.evaluate', { expression: '!!window.__gameReady', returnByValue: true });
      if (r && r.result && r.result.result && r.result.result.value) { ready = true; break; }
      await sleep(500);
    }
    if (!ready) console.log('PERINGATAN: __gameReady tidak terdeteksi — jepretan diambil apa adanya.');
    await sleep(waitMs);

    var shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('Jepretan: ' + out + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB, siap=' + ready + ')');
    ws.close();
  } catch (e) {
    console.error('GAGAL: ' + e.message);
    process.exitCode = 1;
  } finally {
    chrome.kill();
  }
})();
