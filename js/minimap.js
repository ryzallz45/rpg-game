/* Fase 4–5: peta (minimap) — kanvas 2D, peta dasar dirender sekali dari fungsi
   tinggi dunia, lalu penanda pemain/desa/tugas/musuh/perahu digambar tiap
   ~0,1 detik. Fase 5: mode Dunia (seluruh peta) → Sekitar → Lokal → Sembunyi
   lewat tombol M; klik peta mini membuka PETA BESAR (Fase 5 lanjutan), tempat
   pemain memilih tujuan. Peta besar memakai gambar dasar yang sama, menambah
   ikon/label POI, dan mengubah klik layar menjadi koordinat dunia.
   Aman di Node (tanpa DOM). */
(function (global) {
  'use strict';

  var KEY = 'pulau.minimap';
  var MODES = ['dunia', 'sekitar', 'lokal', 'sembunyi'];
  var VIEW_BY_MODE = { sekitar: 230, lokal: 90 }; // meter dari pemain ke tepi peta
  var BASE_RES = 512;
  var doc = typeof document !== 'undefined' ? document : null;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function mix(a, b, t) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ];
  }

  function dot(c, x, y, r, fill, stroke) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.lineWidth = 1.2;
      c.strokeStyle = stroke;
      c.stroke();
    }
  }

  function Minimap() {
    this.canvas = null;
    this.ctx = null;
    this.base = null;
    this.baseRes = BASE_RES;
    this.worldSize = 1024;
    this.half = 512;
    this.mode = 'dunia';       // Fase 5: peta dunia tampil sejak awal
    this.visible = true;
    this._lastMode = 'dunia';
    this._t = 0;
    this._acc = 1;
    this._world = null;
    this.bigCanvas = null;   // peta besar (Fase 5 lanjutan)
    this.bigCtx = null;
    this.bigSize = 0;
    this._bigHotspots = [];  // ikon/label POI yang bisa diklik

    try {
      var s = global.localStorage ? global.localStorage.getItem(KEY) : null;
      if (s === '0') this.mode = 'sembunyi';            // simpanan Fase 4
      else if (s === '1') this.mode = 'dunia';
      else if (s && MODES.indexOf(s) !== -1) this.mode = s;
    } catch (e) {}
    this.visible = this.mode !== 'sembunyi';
    if (this.visible) this._lastMode = this.mode;
  }

  Minimap.prototype.init = function (canvas, world) {
    if (!canvas || !canvas.getContext || !world || !doc) return false;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return false;
    this._world = world;
    this.worldSize = (global.CONFIG && global.CONFIG.WORLD && global.CONFIG.WORLD.size) || 1024;
    this.half = this.worldSize / 2;
    this._buildBase(world);
    this._acc = 1;
    return !!this.base;
  };

  /* Fase 5 lanjutan: siapkan kanvas peta besar (1024²). Peta dasar 512²
     dipakai ulang; penanda & label digambar vektor di atasnya. */
  Minimap.prototype.initBig = function (canvas) {
    if (!canvas || !canvas.getContext || !doc) return false;
    this.bigCanvas = canvas;
    this.bigCtx = canvas.getContext('2d');
    if (!this.bigCtx) return false;
    this.bigSize = Math.min(canvas.width || 1024, canvas.height || 1024);
    this._bigHotspots = [];
    return true;
  };

  Minimap.prototype.hasBig = function () {
    return !!(this.bigCanvas && this.bigCtx && this.base);
  };

  /* Peta dasar: warna laut/pasir/rumput/bukit/batu dari tinggi terrain. */
  Minimap.prototype._buildBase = function (world) {
    if (!doc || !world || typeof world.height !== 'function') return;
    var res = BASE_RES;
    var cv = doc.createElement('canvas');
    cv.width = res;
    cv.height = res;
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    var img = ctx.createImageData(res, res);
    var data = img.data;
    var size = this.worldSize;
    var S = world.scale || (global.CONFIG && global.CONFIG.WORLD && global.CONFIG.WORLD.scale) || 1;
    var deep = [8, 34, 52];
    var shallow = [54, 111, 111];
    var sand = [190, 176, 137];
    var grass = [74, 101, 60];
    var grassDark = [88, 108, 66];
    var hill = [107, 108, 82];
    var rock = [118, 116, 104];
    var peak = [144, 144, 136];

    for (var j = 0; j < res; j++) {
      var z = (j / (res - 1) - 0.5) * size;
      for (var i = 0; i < res; i++) {
        var x = (i / (res - 1) - 0.5) * size;
        var h = world.height(x, z);
        var col;
        if (h < -0.05 * S) {
          var d = clamp(-h / (16 * S), 0, 1);
          col = mix(shallow, deep, d);
        } else if (h < 1.0 * S) {
          col = mix(sand, grass, clamp((h - 0.55 * S) / (0.45 * S), 0, 1) * 0.25);
        } else {
          var t = clamp((h - 1.0 * S) / (21 * S), 0, 1);
          if (t < 0.35) col = mix(grass, grassDark, t / 0.35);
          else if (t < 0.7) col = mix(grassDark, hill, (t - 0.35) / 0.35);
          else if (t < 0.94) col = mix(hill, rock, (t - 0.7) / 0.24);
          else col = mix(rock, peak, (t - 0.94) / 0.06);
          // Variasi halus agar peta tidak terlihat seperti bidang datar.
          var grain = Math.sin(x * (0.11 / S) + z * (0.073 / S)) * 0.5 +
                      Math.cos(x * (0.043 / S) - z * (0.097 / S)) * 0.5;
          var shade = 1 + grain * 0.055;
          col = [col[0] * shade, col[1] * shade, col[2] * shade];
        }
        var o = (j * res + i) * 4;
        data[o] = col[0];
        data[o + 1] = col[1];
        data[o + 2] = col[2];
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.base = cv;
    this.baseRes = res;
  };

  /* --- Peta besar (Fase 5 lanjutan) -------------------------------------
     Menggambar seluruh dunia + ikon/label POI, pemain, perahu, dan tujuan.
     Hotspot ikon/label disimpan supaya klik bisa "menempel" ke POI terdekat;
     klik di laut/daratan lain menjadi titik bebas. */
  Minimap.prototype.drawBig = function (state) {
    if (!this.bigCtx || !this.base || !state || !state.player) return;
    var c = this.bigCtx;
    var W = this.bigCanvas.width || this.bigSize || 1024;
    var H = this.bigCanvas.height || this.bigSize || 1024;
    var size = Math.min(W, H);
    var k = size / 1024;
    var ws = this.worldSize || 3240;
    var half = ws / 2;
    var world = this._world || state.world;
    var player = state.player;
    var px = player.position.x, pz = player.position.z;
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var pulse = 0.5 + 0.5 * Math.sin(now * 0.0043);
    this._bigHotspots = [];
    var occupied = []; // kotak label yang sudah terpakai, agar label POI tidak bertumpuk

    function rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function mx(wx) { return (wx / ws + 0.5) * size; }
    function my(wz) { return (wz / ws + 0.5) * size; }

    function iconHouse(x, y, s, color) {
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.fillStyle = 'rgba(52, 38, 23, 0.96)';
      c.fillRect(-6, 0, 12, 8);
      c.beginPath();
      c.moveTo(-10, 0);
      c.lineTo(0, -9);
      c.lineTo(10, 0);
      c.closePath();
      c.fillStyle = color || '#ffd166';
      c.fill();
      c.lineWidth = 1.6;
      c.strokeStyle = 'rgba(5, 14, 21, 0.95)';
      c.stroke();
      c.strokeStyle = 'rgba(5, 14, 21, 0.85)';
      c.strokeRect(-6, 0, 12, 8);
      c.restore();
    }

    function iconCastle(x, y, s) {
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.fillStyle = 'rgba(62, 60, 54, 0.97)';
      c.fillRect(-7, -2, 14, 10);
      c.fillRect(-9, -7, 4, 15);
      c.fillRect(5, -7, 4, 15);
      c.fillStyle = '#c9c2ae';
      c.beginPath();
      c.moveTo(-11, -7); c.lineTo(-9, -11); c.lineTo(-7, -7); c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(7, -7); c.lineTo(9, -11); c.lineTo(11, -7); c.closePath(); c.fill();
      c.fillRect(-2, 2, 4, 6);
      c.lineWidth = 1.4;
      c.strokeStyle = 'rgba(5, 14, 21, 0.95)';
      c.strokeRect(-7, -2, 14, 10);
      c.strokeStyle = '#ffd166';
      c.beginPath();
      c.moveTo(0, -14); c.lineTo(3, -9); c.lineTo(0, -4); c.lineTo(-3, -9); c.closePath();
      c.stroke();
      c.restore();
    }

    function iconChapel(x, y, s) {
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.fillStyle = 'rgba(84, 85, 80, 0.98)';
      c.fillRect(-5, -2, 10, 10);
      c.beginPath();
      c.moveTo(-8, -2); c.lineTo(0, -10); c.lineTo(8, -2); c.closePath();
      c.fillStyle = '#b9c7cf';
      c.fill();
      c.lineWidth = 1.4;
      c.strokeStyle = 'rgba(5, 14, 21, 0.95)';
      c.stroke();
      c.strokeStyle = 'rgba(5, 14, 21, 0.9)';
      c.strokeRect(-5, -2, 10, 10);
      c.fillStyle = '#e6eef2';
      c.fillRect(-1, -16, 2, 6);
      c.fillRect(-4, -13, 8, 2);
      c.fillStyle = '#222a2e';
      c.fillRect(-1.5, 3, 3, 5);
      c.restore();
    }

    function iconStones(x, y, s) {
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.fillStyle = '#9b9f99';
      c.strokeStyle = 'rgba(5, 14, 21, 0.95)';
      c.lineWidth = 1.4;
      c.fillRect(-8, -5, 3.4, 13);
      c.fillRect(4.6, -5, 3.4, 13);
      c.fillRect(-8, -9, 16, 3.2);
      c.strokeRect(-8, -5, 3.4, 13);
      c.strokeRect(4.6, -5, 3.4, 13);
      c.strokeRect(-8, -9, 16, 3.2);
      c.fillStyle = '#c8cbbf';
      c.beginPath();
      c.arc(0, 2.5, 2.2, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    function iconAnchor(x, y, s) {
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.lineWidth = 1.8;
      c.strokeStyle = '#8fe6f4';
      c.beginPath();
      c.arc(0, -6.5, 2.3, 0, Math.PI * 2);
      c.moveTo(0, -4.2);
      c.lineTo(0, 6.2);
      c.moveTo(-5, 2);
      c.lineTo(5, 2);
      c.moveTo(-5.4, 2.4);
      c.quadraticCurveTo(-4.6, 7.6, 0, 7.6);
      c.quadraticCurveTo(4.6, 7.6, 5.4, 2.4);
      c.stroke();
      c.restore();
    }

    function iconHut(x, y, s) {
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.fillStyle = 'rgba(58, 41, 27, 0.96)';
      c.fillRect(-5, 0, 10, 6);
      c.beginPath();
      c.moveTo(-8, 0);
      c.lineTo(0, -7);
      c.lineTo(8, 0);
      c.closePath();
      c.fillStyle = '#c99a5f';
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(5, 14, 21, 0.95)';
      c.stroke();
      c.strokeStyle = 'rgba(5, 14, 21, 0.85)';
      c.strokeRect(-5, 0, 10, 6);
      c.beginPath();
      c.arc(9, 4.5, 2.2, 0, Math.PI * 2);
      c.fillStyle = '#ff9d3c';
      c.fill();
      c.restore();
    }

    function drawLabel(text, x, y, side, dy, color) {
      var fs = Math.max(13, Math.round(27 * k));
      c.font = 'bold ' + fs + 'px "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      var tw = c.measureText(text).width;
      var gap = 30 * k;
      var row = fs * 1.6;
      var d0 = dy || 0;
      var other = side === 'left' ? 'right' : 'left';
      // Coba beberapa posisi di sekitar ikon; pilih yang tidak menimpa label lain.
      var tries = [
        [side, d0], [side, d0 + row], [side, d0 - row],
        [other, d0], [other, d0 + row], [other, d0 - row],
        [side, d0 + row * 2], [other, d0 + row * 2]
      ];
      var best = null;
      for (var ti = 0; ti < tries.length; ti++) {
        var sd = tries[ti][0], off = tries[ti][1];
        var lx = sd === 'left' ? x - gap - tw : x + gap;
        if (lx < 8 * k) lx = x + gap;
        if (lx + tw > size - 8 * k) lx = x - gap - tw;
        var ly = Math.max(fs + 10 * k, Math.min(size - fs - 10 * k, y + off));
        var rect = { x: lx - 4 * k, y: ly - fs * 0.72, w: tw + 8 * k, h: fs * 1.44 };
        var hit = false;
        for (var oi = 0; oi < occupied.length; oi++) {
          if (rectsOverlap(rect, occupied[oi])) { hit = true; break; }
        }
        if (!hit) { best = { x: lx, y: ly, rect: rect }; break; }
      }
      if (!best) {
        var bx = side === 'left' ? x - gap - tw : x + gap;
        if (bx < 8 * k) bx = x + gap;
        if (bx + tw > size - 8 * k) bx = x - gap - tw;
        var by = Math.max(fs + 10 * k, Math.min(size - fs - 10 * k, y + d0));
        best = { x: bx, y: by, rect: { x: bx - 4 * k, y: by - fs * 0.72, w: tw + 8 * k, h: fs * 1.44 } };
      }
      c.lineWidth = Math.max(3, 5 * k);
      c.strokeStyle = 'rgba(3, 11, 17, 0.95)';
      c.strokeText(text, best.x, best.y);
      c.fillStyle = color || '#f2fbff';
      c.fillText(text, best.x, best.y);
      occupied.push(best.rect);
      return best.rect;
    }

    // Label kecil untuk pemain/perahu/tujuan (selain label POI).
    function drawTag(text, x, y, color) {
      var fs = Math.max(11, Math.round(24 * k));
      c.font = 'bold ' + fs + 'px "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      var tw = c.measureText(text).width;
      var padX = 7 * k, padY = 4 * k;
      var bw = tw + padX * 2, bh = fs + padY * 2;
      var bx = x - bw / 2, by = y - bh / 2;
      bx = Math.max(4 * k, Math.min(size - bw - 4 * k, bx));
      by = Math.max(4 * k, Math.min(size - bh - 4 * k, by));
      c.fillStyle = 'rgba(4, 13, 20, 0.82)';
      c.fillRect(bx, by, bw, bh);
      c.lineWidth = Math.max(1, 1.2 * k);
      c.strokeStyle = 'rgba(255, 209, 102, 0.38)';
      c.strokeRect(bx, by, bw, bh);
      c.fillStyle = color || '#f2fbff';
      c.fillText(text, bx + padX, by + bh / 2);
    }

    c.clearRect(0, 0, W, H);
    c.fillStyle = '#082433';
    c.fillRect(0, 0, W, H);

    c.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in c) c.imageSmoothingQuality = 'high';
    c.drawImage(this.base, 0, 0, this.baseRes, this.baseRes, 0, 0, size, size);

    // Garis bantu tiap 500 m (samar).
    c.save();
    c.strokeStyle = 'rgba(230, 246, 255, 0.055)';
    c.lineWidth = Math.max(1, k);
    var gStart = -Math.floor(half / 500) * 500;
    for (var gd = gStart; gd <= half; gd += 500) {
      var gx = mx(gd), gz = my(gd);
      c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, size); c.stroke();
      c.beginPath(); c.moveTo(0, gz); c.lineTo(size, gz); c.stroke();
    }
    c.restore();

    // Pendukuhan kecil (desa utama & pondok punya ikon sendiri).
    var spots = world && world.villageSpots ? world.villageSpots : [];
    for (var i = 1; i < spots.length; i++) {
      dot(c, mx(spots[i].x), my(spots[i].z), Math.max(2.5, 3.2 * k),
        'rgba(255, 209, 102, 0.85)', 'rgba(5, 14, 21, 0.85)');
    }

    // POI: desa, pelabuhan, dan dua pondok pulau.
    var pois = state.pois || [];
    for (i = 0; i < pois.length; i++) {
      var p = pois[i];
      if (!p || !isFinite(p.x) || !isFinite(p.z)) continue;
      var sx = mx(p.x), sy = my(p.z);
      var major = p.id === 'village' || p.id === 'harbor' || p.id === 'castle' || p.id === 'kingdom' || p.id === 'empire';
      c.beginPath();
      c.arc(sx, sy, (major ? 24 : 17) * k, 0, Math.PI * 2);
      c.fillStyle = 'rgba(4, 13, 20, 0.58)';
      c.fill();
      if (p.id === 'harbor') iconAnchor(sx, sy, 1.95 * k);
      else if (p.id === 'hut' || p.id === 'hut2') iconHut(sx, sy, 1.95 * k);
      else if (p.id === 'castle') iconCastle(sx, sy, 1.95 * k);
      else if (p.id === 'kingdom') iconCastle(sx, sy, 2.5 * k);
      else if (p.id === 'empire') iconCastle(sx, sy, 3.0 * k);
      else if (p.id === 'chapel') iconChapel(sx, sy, 1.95 * k);
      else if (p.id === 'stones') iconStones(sx, sy, 1.95 * k);
      else iconHouse(sx, sy, 1.95 * k, '#ffd166');

      var side = (p.id === 'village' || p.id === 'castle' || p.id === 'chapel' || p.id === 'kingdom' || p.id === 'empire') ? 'left' : 'right';
      var dy = p.id === 'village' ? 29 * k :
        (p.id === 'harbor' ? -26 * k :
          (p.id === 'chapel' ? -22 * k : (p.id === 'kingdom' || p.id === 'empire' ? 34 * k : (p.id === 'stones' ? 38 * k : 24 * k))));
      var color = p.id === 'harbor' ? '#c8f6ff' :
        (p.id === 'village' ? '#ffe9b0' :
          (p.id === 'castle' ? '#e8d7b0' :
            (p.id === 'kingdom' ? '#ffd98a' : (p.id === 'empire' ? '#ffb27a' : (p.id === 'chapel' ? '#d7e3e9' : '#f3e2c0')))));
      var lb = drawLabel(p.label || p.id, sx, sy, side, dy, color);
      this._bigHotspots.push({
        poi: p.id, x: p.x, z: p.z,
        bx: sx, by: sy, br: 30 * k, lb: lb
      });
    }

    // Perahu (segitiga kayu), lalu pemain (panah putih + kerucut pandang).
    var boat = state.boat;
    if (boat && boat.group) {
      var bmx = mx(boat.position.x), bmy = my(boat.position.z);
      var bfx = Math.sin(boat.yaw || 0), bfz = Math.cos(boat.yaw || 0);
      var brx = -bfz, brz = bfx;
      var bl = 14 * k, bw = 6.5 * k;
      c.beginPath();
      c.moveTo(bmx + bfx * bl, bmy + bfz * bl);
      c.lineTo(bmx - bfx * bl * 0.55 + brx * bw, bmy - bfz * bl * 0.55 + brz * bw);
      c.lineTo(bmx - bfx * bl * 0.55 - brx * bw, bmy - bfz * bl * 0.55 - brz * bw);
      c.closePath();
      c.fillStyle = '#c99a5f';
      c.fill();
      c.lineWidth = 1.5 * k;
      c.strokeStyle = 'rgba(5, 14, 21, 0.9)';
      c.stroke();
      var bdx = boat.position.x - px, bdz = boat.position.z - pz;
      if (bdx * bdx + bdz * bdz > 80 * 80) {
        drawTag(state.boatLabel || 'Perahu', bmx, bmy + 30 * k, '#ffd9a8');
      }
    }

    var pcx = mx(px), pcy = my(pz);
    var cu = state.camYaw != null ? state.camYaw : player.yaw;
    var cAng = Math.atan2(Math.cos(cu), Math.sin(cu));
    c.beginPath();
    c.moveTo(pcx, pcy);
    c.arc(pcx, pcy, 36 * k, cAng - 0.48, cAng + 0.48);
    c.closePath();
    c.fillStyle = 'rgba(255, 209, 102, 0.17)';
    c.fill();

    var pu = isFinite(player.yaw) ? player.yaw : cu;
    var pax = Math.sin(pu), pay = Math.cos(pu);
    var prx = -pay, pry = pax;
    var pl = 22 * k, pw = 8.2 * k;
    c.beginPath();
    c.moveTo(pcx + pax * pl, pcy + pay * pl);
    c.lineTo(pcx - pax * pl * 0.6 + prx * pw, pcy - pay * pl * 0.6 + pry * pw);
    c.lineTo(pcx - pax * pl * 0.6 - prx * pw, pcy - pay * pl * 0.6 - pry * pw);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    c.lineWidth = 1.8 * k;
    c.strokeStyle = 'rgba(5, 14, 21, 0.95)';
    c.stroke();
    // Label "Kamu" hanya digambar bila tidak bertabrakan dengan label POI.
    var tagY = pcy + 34 * k, tagBlocked = false;
    for (var oi = 0; oi < occupied.length; oi++) {
      var rr = occupied[oi];
      if (pcx > rr.x - 46 * k && pcx < rr.x + rr.w + 46 * k &&
          tagY > rr.y - 12 * k && tagY < rr.y + rr.h + 12 * k) {
        tagBlocked = true; break;
      }
    }
    if (!tagBlocked) drawTag(state.playerLabel || 'Kamu', pcx, tagY, '#ffffff');

    // Tujuan: garis putus-putus + pin emas berdenyut.
    var wp = state.waypoint;
    if (wp) {
      var wmx = mx(wp.x), wmy = my(wp.z);
      c.save();
      c.setLineDash([8 * k, 7 * k]);
      c.lineWidth = 2.2 * k;
      c.strokeStyle = 'rgba(255, 209, 102, 0.82)';
      c.beginPath();
      c.moveTo(pcx, pcy);
      c.lineTo(wmx, wmy);
      c.stroke();
      c.setLineDash([]);
      c.restore();

      c.beginPath();
      c.arc(wmx, wmy, (17 + pulse * 8) * k, 0, Math.PI * 2);
      c.lineWidth = 2.5 * k;
      c.strokeStyle = 'rgba(255, 209, 102, ' + (0.55 - pulse * 0.3) + ')';
      c.stroke();

      c.save();
      c.translate(wmx, wmy);
      c.beginPath();
      c.arc(0, -14.5 * k, 12.5 * k, Math.PI, 0);
      c.lineTo(0, 10 * k);
      c.closePath();
      c.fillStyle = '#ffd166';
      c.fill();
      c.lineWidth = 3 * k;
      c.strokeStyle = 'rgba(5, 14, 21, 0.96)';
      c.stroke();
      c.beginPath();
      c.arc(0, -14.5 * k, 4.8 * k, 0, Math.PI * 2);
      c.fillStyle = '#15232c';
      c.fill();
      c.restore();
      drawTag(state.targetLabel || 'Tujuan', wmx, wmy - 48 * k, '#ffe9b0');
    }

    // Kompas U/N di atas + skala 500 m di kiri bawah.
    var nr = 24 * k, nx = size / 2, ny = 30 * k;
    c.beginPath();
    c.arc(nx, ny, nr, 0, Math.PI * 2);
    c.fillStyle = 'rgba(5, 16, 24, 0.8)';
    c.fill();
    c.lineWidth = 1.5 * k;
    c.strokeStyle = 'rgba(255, 209, 102, 0.45)';
    c.stroke();
    c.font = 'bold ' + Math.round(19 * k) + 'px "Segoe UI", system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffd166';
    c.fillText(state.north || 'U', nx, ny + 1 * k);

    var barLen = 500 / ws * size;
    var bx0 = 26 * k, by0 = size - 34 * k;
    c.strokeStyle = 'rgba(240, 250, 255, 0.72)';
    c.lineWidth = 2 * k;
    c.beginPath();
    c.moveTo(bx0, by0);
    c.lineTo(bx0 + barLen, by0);
    c.moveTo(bx0, by0 - 4 * k);
    c.lineTo(bx0, by0 + 4 * k);
    c.moveTo(bx0 + barLen, by0 - 4 * k);
    c.lineTo(bx0 + barLen, by0 + 4 * k);
    c.stroke();
    c.font = 'bold ' + Math.round(15 * k) + 'px "Segoe UI", system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'bottom';
    c.fillStyle = 'rgba(240, 250, 255, 0.85)';
    c.fillText('500 m', bx0, by0 - 8 * k);

    // Bingkai.
    c.lineWidth = Math.max(2, 2 * k);
    c.strokeStyle = 'rgba(123, 213, 230, 0.32)';
    c.strokeRect(1, 1, size - 2, size - 2);
  };

  /* Klik peta besar → koordinat dunia, atau POI terdekat bila mengenai
     ikon/label. Kembalikan { x, z, poi } atau null. */
  Minimap.prototype.bigClick = function (clientX, clientY) {
    if (!this.bigCanvas) return null;
    var rect = this.bigCanvas.getBoundingClientRect ? this.bigCanvas.getBoundingClientRect() : null;
    if (!rect || !rect.width || !rect.height) return null;
    var size = Math.min(this.bigCanvas.width || 1024, this.bigCanvas.height || 1024);
    var px = (clientX - rect.left) / rect.width * size;
    var py = (clientY - rect.top) / rect.height * size;
    if (px < 0 || px > size || py < 0 || py > size) return null;

    var best = null, bestD = Infinity;
    for (var i = 0; i < this._bigHotspots.length; i++) {
      var h = this._bigHotspots[i];
      var d = Math.sqrt((px - h.bx) * (px - h.bx) + (py - h.by) * (py - h.by));
      var hit = d <= h.br;
      if (!hit && h.lb) {
        hit = px >= h.lb.x && px <= h.lb.x + h.lb.w &&
              py >= h.lb.y && py <= h.lb.y + h.lb.h;
        if (hit) d = Math.max(0, d - 40);
      }
      if (hit && d < bestD) { bestD = d; best = h; }
    }
    if (best) return { x: best.x, z: best.z, poi: best.poi };

    var w = Minimap.mapToWorld(px, py, size, this.worldSize);
    var lim = this.half - 10;
    w.x = clamp(w.x, -lim, lim);
    w.z = clamp(w.z, -lim, lim);
    w.poi = null;
    return w;
  };

  /* --- Mode peta (Fase 5): dunia → sekitar → lokal → sembunyi --- */
  Minimap.prototype.setMode = function (m) {
    if (MODES.indexOf(m) === -1) return this.mode;
    this.mode = m;
    this.visible = m !== 'sembunyi';
    if (this.visible) this._lastMode = m;
    this._acc = 1;
    try {
      if (global.localStorage) global.localStorage.setItem(KEY, m);
    } catch (e) {}
    return this.mode;
  };

  Minimap.prototype.cycle = function () {
    var i = MODES.indexOf(this.mode);
    return this.setMode(MODES[(i + 1) % MODES.length]);
  };

  Minimap.prototype.setVisible = function (v) {
    if (v) return this.setMode(this._lastMode || 'dunia') !== 'sembunyi';
    return this.setMode('sembunyi') !== 'sembunyi';
  };

  Minimap.prototype.toggle = function () {
    return this.cycle();
  };

  Minimap.prototype.label = function () {
    if (this.mode === 'dunia') return 'DUNIA';
    if (this.mode === 'sekitar') return 'SEKITAR';
    if (this.mode === 'lokal') return 'LOKAL';
    return '';
  };

  Minimap.prototype.update = function (dt, state) {
    if (!this.canvas || !this.ctx || !this.base || !this.visible) return;
    this._t += dt || 0;
    this._acc += dt || 0;
    if (this._acc < 0.09) return;
    this._acc = 0;
    this.draw(state);
  };

  Minimap.prototype.forceDraw = function (state) {
    this._acc = 0;
    if (this.visible) this.draw(state);
  };

  Minimap.prototype.draw = function (state) {
    if (!this.ctx || !this.base || !state || !state.player) return;
    var worldMode = this.mode === 'dunia';
    var c = this.ctx;
    var W = this.canvas.width;
    var H = this.canvas.height;
    var cx = W / 2, cy = H / 2;
    var radius = Math.min(W, H) / 2 - 4;
    var player = state.player;
    var px = player.position.x, pz = player.position.z;
    var mapScale, viewRadius;
    if (worldMode) {
      // Seluruh peta masuk lingkaran: diagonal bujur sangkar = diameter.
      mapScale = (radius - 3) / (this.half * Math.SQRT2);
      viewRadius = this.half * 1.45;
    } else {
      viewRadius = VIEW_BY_MODE[this.mode] || VIEW_BY_MODE.sekitar;
      mapScale = radius / viewRadius;
    }
    var world = this._world || state.world;

    c.clearRect(0, 0, W, H);
    c.save();
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.clip();

    // Samudra di luar batas pulau / peta.
    c.fillStyle = '#0b2b40';
    c.fillRect(0, 0, W, H);

    if (worldMode) {
      var dw = this.worldSize * mapScale;
      c.imageSmoothingEnabled = true;
      c.drawImage(this.base, 0, 0, this.baseRes, this.baseRes, cx - dw / 2, cy - dw / 2, dw, dw);
    } else {
      var viewW = (radius * 2) / mapScale;   // meter yang tampak (lebar kanvas)
      var baseScale = this.baseRes / this.worldSize;
      var srcW = viewW * baseScale;
      var srcX = (px - viewW / 2 + this.half) * baseScale;
      var srcY = (pz - viewW / 2 + this.half) * baseScale;
      var sx0 = Math.max(0, srcX);
      var sy0 = Math.max(0, srcY);
      var sx1 = Math.min(this.baseRes, srcX + srcW);
      var sy1 = Math.min(this.baseRes, srcY + srcW);
      if (sx1 > sx0 && sy1 > sy0) {
        var dx0 = (sx0 - srcX) / srcW * W;
        var dy0 = (sy0 - srcY) / srcW * H;
        var ddw = (sx1 - sx0) / srcW * W;
        var ddh = (sy1 - sy0) / srcW * H;
        c.imageSmoothingEnabled = true;
        c.drawImage(this.base, sx0, sy0, sx1 - sx0, sy1 - sy0, dx0, dy0, ddw, ddh);
      }
      // Cincin jarak untuk orientasi.
      var ringR = this.mode === 'lokal' ? 30 : 80;
      c.strokeStyle = 'rgba(240, 250, 255, 0.07)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(cx, cy, ringR * mapScale, 0, Math.PI * 2);
      c.stroke();
    }

    function mx(wx) { return worldMode ? cx + wx * mapScale : cx + (wx - px) * mapScale; }
    function my(wz) { return worldMode ? cy + wz * mapScale : cy + (wz - pz) * mapScale; }
    function inView(x, z, margin) {
      var lim = viewRadius - (margin || 0);
      if (worldMode) return Math.abs(x) < lim && Math.abs(z) < lim;
      var ddx = x - px, ddz = z - pz;
      return ddx * ddx + ddz * ddz < lim * lim;
    }

    var village = state.village;
    var spots = world && world.villageSpots ? world.villageSpots : [];
    var i, x, y;

    // Pulau-pulau kecil (mode Dunia) — titik pasir halus di atas peta.
    if (worldMode && world && world.islands) {
      for (i = 0; i < world.islands.length; i++) {
        var is = world.islands[i];
        dot(c, mx(is.x), my(is.z), 2.1, 'rgba(215, 182, 120, 0.75)', 'rgba(8, 20, 30, 0.6)');
      }
    }

    // Titik desa/pendukuhan + pondok pulau kecil.
    var allSpots = spots.slice();
    if (world && world.islandSites) {
      for (i = 0; i < world.islandSites.length; i++) allSpots.push(world.islandSites[i]);
    }
    for (i = 0; i < allSpots.length; i++) {
      var s = allSpots[i];
      if (!inView(s.x, s.z, 4)) continue;
      x = mx(s.x); y = my(s.z);
      if (i === 0 && !s.island) {
        c.fillStyle = '#3a2a17';
        c.fillRect(x - 3, y - 1, 6, 4);
        c.beginPath();
        c.moveTo(x - 5, y - 1);
        c.lineTo(x, y - 5);
        c.lineTo(x + 5, y - 1);
        c.closePath();
        c.fillStyle = '#ffd166';
        c.fill();
        c.lineWidth = 1;
        c.strokeStyle = 'rgba(8, 20, 30, 0.8)';
        c.stroke();
      } else {
        dot(c, x, y, 2.2, '#d7b678', 'rgba(8, 20, 30, 0.75)');
      }
    }

    // Pelabuhan (ikon jangkar).
    var harbor = world && world.harborSpot;
    if (harbor && inView(harbor.x, harbor.z, 5)) {
      var hx = mx(harbor.x), hy = my(harbor.z);
      c.save();
      c.translate(hx, hy);
      c.lineWidth = 1.5;
      c.strokeStyle = '#7bd5e6';
      c.beginPath();
      c.arc(0, -4.2, 1.8, 0, Math.PI * 2);
      c.moveTo(0, -2.4); c.lineTo(0, 3.8);
      c.moveTo(-3.2, 1.2); c.lineTo(3.2, 1.2);
      c.moveTo(-3.4, 1.6);
      c.quadraticCurveTo(-2.8, 4.4, 0, 4.4);
      c.quadraticCurveTo(2.8, 4.4, 3.4, 1.6);
      c.stroke();
      c.restore();
    }

    // Perahu (segitiga kayu) — terlihat juga saat pemain berjalan kaki.
    var boat = state.boat;
    if (boat && boat.group && inView(boat.position.x, boat.position.z, 4)) {
      var bx = mx(boat.position.x), by = my(boat.position.z);
      var bfx = Math.sin(boat.yaw), bfz = Math.cos(boat.yaw);
      var brx = -bfz, brz = bfx;
      c.beginPath();
      c.moveTo(bx + bfx * 5.4, by + bfz * 5.4);
      c.lineTo(bx - bfx * 3 + brx * 2.6, by - bfz * 3 + brz * 2.6);
      c.lineTo(bx - bfx * 3 - brx * 2.6, by - bfz * 3 - brz * 2.6);
      c.closePath();
      c.fillStyle = '#c99a5f';
      c.fill();
      c.lineWidth = 1.1;
      c.strokeStyle = 'rgba(6, 16, 24, 0.85)';
      c.stroke();
    }

    // Penduduk (biru muda).
    if (village && village.npcs) {
      for (i = 0; i < village.npcs.length; i++) {
        var npc = village.npcs[i];
        if (!npc || !npc.group) continue;
        var nx = npc.group.position.x, nz = npc.group.position.z;
        if (!inView(nx, nz, 4)) continue;
        dot(c, mx(nx), my(nz), 1.8, '#8fe1ef', 'rgba(8, 20, 30, 0.7)');
      }
    }

    // Jarahan berkilau (emas kecil) — hanya di sekitar pemain.
    var loot = state.enemies && state.enemies.loot ? state.enemies.loot : [];
    var lootDrawn = 0;
    for (i = 0; i < loot.length && lootDrawn < 50; i++) {
      var lm = loot[i].mesh;
      if (!lm) continue;
      var lx = lm.position.x, lz = lm.position.z;
      var ldx = lx - px, ldz = lz - pz;
      if (ldx * ldx + ldz * ldz > 60 * 60) continue;
      dot(c, mx(lx), my(lz), 1.25, '#ffd166', null);
      lootDrawn++;
    }

    // Musuh hidup (warna per jenis).
    var enemies = state.enemies && state.enemies.list ? state.enemies.list : [];
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.deadT >= 0 || !e.group) continue;
      var ex = e.group.position.x, ez = e.group.position.z;
      if (!inView(ex, ez, 5)) continue;
      var ec = e.typeId === 'slime' ? '#9be37a' :
               (e.typeId === 'bandit' ? '#ffb15c' : '#ff6b5a');
      dot(c, mx(ex), my(ez), 2.2, ec, 'rgba(8, 20, 30, 0.8)');
    }

    // Sasaran tugas aktif: berlian emas berdenyut (atau panah di tepi peta).
    var targets = [];
    if (village && village.quests) {
      var qk = village.quests.kelapa || {};
      var qb = village.quests.keranjang || {};
      function npcAt(role) {
        if (!village.npcs) return null;
        for (var n = 0; n < village.npcs.length; n++) {
          if (village.npcs[n].role === role) return village.npcs[n].group.position;
        }
        return null;
      }
      if (qk.state === 'belum' || qk.state === 'kembali') {
        var chief = npcAt('kepala');
        if (chief) targets.push({ x: chief.x, z: chief.z });
      } else if (qk.state === 'cari') {
        var palms = world.palms || [];
        var best = null, bestD = Infinity;
        for (var pi = 0; pi < palms.length; pi++) {
          var pl = palms[pi];
          if (pl.taken) continue;
          var pdx = pl.x - px, pdz = pl.z - pz;
          var pd = pdx * pdx + pdz * pdz;
          if (pd < bestD) { bestD = pd; best = pl; }
        }
        if (best) targets.push({ x: best.x, z: best.z });
      }
      if (qb.state === 'cari' && village.basketSpot) {
        targets.push({ x: village.basketSpot.x, z: village.basketSpot.z });
      } else if (qb.state === 'kembali') {
        var mira = npcAt('mira');
        if (mira) targets.push({ x: mira.x, z: mira.z });
      }
    }

    var pulse = 0.85 + 0.15 * Math.sin(this._t * 5);
    for (i = 0; i < targets.length; i++) {
      var tg = targets[i];
      var tx = mx(tg.x), ty = my(tg.z);
      var vdx = tx - cx, vdy = ty - cy;
      var vlen = Math.sqrt(vdx * vdx + vdy * vdy);
      if (vlen > radius - 13) {
        // Di luar jangkauan: panah kecil di tepi lingkaran.
        var ex2 = cx + (vdx / (vlen || 1)) * (radius - 13);
        var ey2 = cy + (vdy / (vlen || 1)) * (radius - 13);
        var ang = Math.atan2(vdy, vdx);
        c.save();
        c.translate(ex2, ey2);
        c.rotate(ang);
        c.beginPath();
        c.moveTo(7, 0);
        c.lineTo(-4, -4.5);
        c.lineTo(-4, 4.5);
        c.closePath();
        c.fillStyle = '#ffd166';
        c.fill();
        c.lineWidth = 1.2;
        c.strokeStyle = 'rgba(8, 20, 30, 0.85)';
        c.stroke();
        c.restore();
      } else if (inView(tg.x, tg.z, 3)) {
        c.save();
        c.translate(tx, ty);
        c.rotate(Math.PI / 4);
        c.scale(pulse, pulse);
        c.fillStyle = 'rgba(255, 209, 102, 0.95)';
        c.fillRect(-4.5, -4.5, 9, 9);
        c.lineWidth = 1.3;
        c.strokeStyle = 'rgba(8, 20, 30, 0.85)';
        c.strokeRect(-4.5, -4.5, 9, 9);
        c.restore();
        c.fillStyle = '#101c26';
        c.font = 'bold 9px "Segoe UI", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('!', tx, ty + 0.5);
      }
    }

    // Tujuan pilihan pemain (peta besar): garis putus-putus + pin emas.
    var wp = state.waypoint;
    if (wp) {
      var wppx = mx(px), wppy = my(pz);
      var wpx = mx(wp.x), wpy = my(wp.z);
      var wvx = wpx - wppx, wvy = wpy - wppy;
      var wlen = Math.sqrt(wvx * wvx + wvy * wvy);
      c.save();
      c.beginPath();
      c.arc(cx, cy, radius, 0, Math.PI * 2);
      c.clip();
      c.setLineDash([4, 4]);
      c.lineWidth = 1.4;
      c.strokeStyle = 'rgba(255, 209, 102, 0.8)';
      c.beginPath();
      c.moveTo(wppx, wppy);
      c.lineTo(wpx, wpy);
      c.stroke();
      c.setLineDash([]);
      c.restore();

      if (wlen > radius - 12) {
        var wex = cx + (wvx / (wlen || 1)) * (radius - 12);
        var wey = cy + (wvy / (wlen || 1)) * (radius - 12);
        c.save();
        c.translate(wex, wey);
        c.rotate(Math.atan2(wvy, wvx));
        c.beginPath();
        c.moveTo(7, 0);
        c.lineTo(-4, -4.5);
        c.lineTo(-4, 4.5);
        c.closePath();
        c.fillStyle = '#ffd166';
        c.fill();
        c.lineWidth = 1.2;
        c.strokeStyle = 'rgba(8, 20, 30, 0.85)';
        c.stroke();
        c.restore();
      } else if (inView(wp.x, wp.z, 4)) {
        c.save();
        c.translate(wpx, wpy);
        c.beginPath();
        c.arc(0, -5, 4.6, Math.PI, 0);
        c.lineTo(0, 4.4);
        c.closePath();
        c.fillStyle = '#ffd166';
        c.fill();
        c.lineWidth = 1.2;
        c.strokeStyle = 'rgba(8, 20, 30, 0.9)';
        c.stroke();
        c.beginPath();
        c.arc(0, -5, 1.8, 0, Math.PI * 2);
        c.fillStyle = '#15232c';
        c.fill();
        c.restore();
      }
    }

    // Kerucut pandang kamera + panah arah pemain.
    var pcx = mx(px), pcy = my(pz);
    var cu = state.camYaw != null ? state.camYaw : player.yaw;
    var fx = Math.sin(cu), fy = Math.cos(cu);
    var viewAng = Math.atan2(fy, fx);
    var coneR = worldMode ? 30 : 38;
    c.beginPath();
    c.moveTo(pcx, pcy);
    c.arc(pcx, pcy, coneR, viewAng - 0.52, viewAng + 0.52);
    c.closePath();
    c.fillStyle = 'rgba(255, 209, 102, 0.14)';
    c.fill();

    var pu = isFinite(player.yaw) ? player.yaw : cu;
    var ax = Math.sin(pu), ay = Math.cos(pu);
    var rx = -ay, ry = ax;
    c.beginPath();
    c.moveTo(pcx + ax * 9, pcy + ay * 9);
    c.lineTo(pcx - ax * 5 + rx * 5.2, pcy - ay * 5 + ry * 5.2);
    c.lineTo(pcx - ax * 5 - rx * 5.2, pcy - ay * 5 - ry * 5.2);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    c.lineWidth = 1.4;
    c.strokeStyle = 'rgba(6, 16, 24, 0.9)';
    c.stroke();

    // Vignette lembut di tepi peta.
    var grad = c.createRadialGradient(cx, cy, radius * 0.62, cx, cy, radius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    c.restore();

    // Bingkai lingkaran.
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.lineWidth = 2.5;
    c.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(255, 209, 102, 0.25)';
    c.stroke();
  };

  /* --- Fase 5 lanjutan: konversi peta & arah kompas (murni, bisa diuji) --- */
  Minimap.worldToMap = function (x, z, size, worldSize) {
    var s = size || 1, ws = worldSize || 1;
    return { x: (x / ws + 0.5) * s, y: (z / ws + 0.5) * s };
  };

  Minimap.mapToWorld = function (px, py, size, worldSize) {
    var s = size || 1, ws = worldSize || 1;
    return { x: (px / s - 0.5) * ws, z: (py / s - 0.5) * ws };
  };

  /* Sudut tujuan relatif terhadap arah kamera. 0 = lurus ke depan,
     positif = di kanan layar (searah jarum jam). */
  Minimap.bearingTo = function (camYaw, dx, dz) {
    var y = camYaw || 0;
    var sy = Math.sin(y), cy = Math.cos(y);
    return Math.atan2(sy * dz - cy * dx, sy * dx + cy * dz);
  };

  global.Minimap = Minimap;
})(typeof window !== 'undefined' ? window : globalThis);
