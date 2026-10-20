/* Bench performa via Chrome DevTools Protocol.
   Menjalankan satu ekspresi async dari berkas (menunggu promise selesai),
   lalu mencetak hasilnya + jepretan.
   Pemakaian: node tools/perf.js "<url>" "<keluaran.png>" <tunggu_ms> <berkas.js> */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var PORT = 9336;
var url = process.argv[2];
var out = process.argv[3] || path.join(process.env.TEMP || '.', 'perf.png');
var waitMs = parseInt(process.argv[4] || '3000', 10);
var exprFile = process.argv[5];
var expr = exprFile ? fs.readFileSync(exprFile, 'utf8') : '1';

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
  var profile = path.join(process.env.TEMP || '.', 'pn-chrome-perf');
  var chrome = spawn(CHROME, [
    '--headless=new', '--use-angle=d3d11', '--window-size=1280,800',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    'about:blank'
  ], { stdio: 'ignore' });

  var ws;
  try {
    var ok = false;
    for (var i = 0; i < 60; i++) {
      try { await getJson('/json/version'); ok = true; break; } catch (e) { await sleep(250); }
    }
    if (!ok) throw new Error('Chrome DevTools tidak merespons');

    var targets = await getJson('/json/list');
    var page = null;
    for (var t = 0; t < targets.length; t++) { if (targets[t].type === 'page') { page = targets[t]; break; } }

    ws = new WebSocket(page.webSocketDebuggerUrl);
    var id = 0, pending = new Map();
    var logs = [];
    ws.addEventListener('message', function (ev) {
      var msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
      if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
        logs.push('[' + msg.params.type + '] ' + msg.params.args.map(function (a) { return a.value !== undefined ? String(a.value) : (a.description || a.type); }).join(' ').slice(0, 400));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        var ex = msg.params.exceptionDetails;
        logs.push('[exception] ' + (ex.exception && (ex.exception.description || ex.exception.value) || ex.text).toString().slice(0, 500));
      }
    });
    await new Promise(function (res, rej) { ws.addEventListener('open', res); ws.addEventListener('error', rej); });

    function send(method, params) {
      return new Promise(function (resolve) {
        var mid = ++id;
        pending.set(mid, resolve);
        ws.send(JSON.stringify({ id: mid, method: method, params: params || {} }));
      });
    }
    function evalIn(exprText, awaitPromise) {
      return send('Runtime.evaluate', {
        expression: exprText, returnByValue: true, awaitPromise: !!awaitPromise, timeout: 180000
      }).then(function (r) {
        if (!r || !r.result) return undefined;
        if (r.result.exceptionDetails) return '<exception: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400) + '>';
        return r.result.result ? r.result.result.value : undefined;
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: url });

    var ready = false;
    for (var k = 0; k < 240; k++) {
      if (await evalIn('!!window.__gameReady')) { ready = true; break; }
      await sleep(500);
    }
    console.log('Siap: ' + ready);
    await sleep(waitMs);

    var t0 = Date.now();
    var result = await evalIn(expr, true);
    console.log('Hasil (' + ((Date.now() - t0) / 1000).toFixed(1) + ' detik):');
    console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));

    var shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('Jepretan: ' + out + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');

    if (logs.length) {
      console.log('--- Log konsol (error/peringatan) ---');
      logs.slice(0, 15).forEach(function (l) { console.log('  ' + l); });
    } else {
      console.log('--- Tidak ada error konsol ---');
    }
  } catch (e) {
    console.error('GAGAL: ' + e.message);
    process.exitCode = 1;
  } finally {
    if (ws) try { ws.close(); } catch (e) {}
    chrome.kill();
  }
})();
