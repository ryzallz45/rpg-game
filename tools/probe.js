/* Probe diagnostik via Chrome DevTools Protocol:
   cetak error konsol, evaluasi kondisi game, lalu simpan jepretan.
   Pemakaian: node tools/probe.js "<url>" "<keluaran.png>" [tunggu_ms] */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var PORT = 9334;
var url = process.argv[2] || 'http://localhost:8317/index.html#autostart';
var out = process.argv[3] || path.join(process.env.TEMP || '.', 'probe.png');
var waitMs = parseInt(process.argv[4] || '3000', 10);

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
  var chrome = spawn(CHROME, [
    '--headless=new', '--use-angle=d3d11', '--window-size=1280,800',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'pn-chrome-probe'),
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
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        logs.push('[log] ' + msg.params.entry.text.slice(0, 300));
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
    function evalIn(expr) {
      return send('Runtime.evaluate', { expression: expr, returnByValue: true }).then(function (r) {
        if (r && r.result && r.result.exceptionDetails) return '<exception: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300) + '>';
        return r && r.result && r.result.result ? r.result.result.value : undefined;
      });
    }

    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: url });

    var ready = false;
    for (var k = 0; k < 240; k++) {
      if (await evalIn('!!window.__gameReady')) { ready = true; break; }
      await sleep(500);
    }
    console.log('Siap: ' + ready);
    await sleep(waitMs);

    var e1 = await evalIn('__game.world.elapsed');
    await sleep(1000);
    var e2 = await evalIn('__game.world.elapsed');
    console.log('Loop hidup: ' + (typeof e1 === 'number' && e2 > e1) + ' (elapsed ' + e1 + ' → ' + e2 + ')');

    var state = await evalIn([
      'JSON.stringify({',
      ' env: !!__game.world.scene.environment,',
      ' sun: +__game.world.sunLight.intensity.toFixed(2),',
      ' sunVis: __game.world.sunLight.visible,',
      ' sunPos: [__game.world.sunLight.position.x, __game.world.sunLight.position.y, __game.world.sunLight.position.z].map(function(v){return +v.toFixed(1)}),',
      ' hemi: +__game.world.hemi.intensity.toFixed(2),',
      ' fogD: __game.world.scene.fog.density,',
      ' fogColor: __game.world.fogColor.getHexString(),',
      ' skyTop: __game.world.sky.skyMat ? __game.world.sky.skyMat.uniforms.topColor.value.getHexString() : "-",',
      ' calls: __game.renderer.info.render.calls,',
      ' tris: __game.renderer.info.render.triangles,',
      ' progs: __game.renderer.info.programs.length,',
      ' envCounts: JSON.stringify(__game.world.envCounts),',
      ' npc: __game.village ? __game.village.npcs.length : 0,',
      ' desa: __game.world.villageSpots ? __game.world.villageSpots.map(function(s){return s.x+","+s.z;}).join(" | ") : "-",',
      ' tugas: __game.village ? JSON.stringify(__game.village.quests) : "-",',
      ' rumput: __game.grass ? (__game.grass.counts.tufts + " rumpun / " + __game.grass.counts.flowers + " bunga") : "-",',
      ' musuh: __game.enemies ? (__game.enemies.list.length + " (" + JSON.stringify(__game.enemies.counts) + "), jarahan: " + __game.enemies.loot.length) : "-",',
      ' rpg: __game.stats ? ("Lv " + __game.stats.level + " · HP " + __game.stats.hp + "/" + __game.stats.maxHp + " · XP " + __game.stats.xp + "/" + __game.stats.xpNeed() + " · dmg " + __game.stats.getDamage() + " · tas " + JSON.stringify(__game.stats.inventory)) : "-",',
      ' fps: (function(){var d=document.getElementById(\"dbg-fps\"); return d?d.textContent:\"?\";})(),',
      ' camPos: [__game.camera.position.x, __game.camera.position.y, __game.camera.position.z].map(function(v){return +v.toFixed(1)}),',
      ' playerPos: [__game.player.position.x, __game.player.position.y, __game.player.position.z].map(function(v){return +v.toFixed(1)})',
      '})'
    ].join('\n'));
    console.log('Keadaan: ' + state);

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
