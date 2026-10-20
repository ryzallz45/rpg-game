/* Input: keyboard, mouse, roda mouse.
   Fase 5: kursor selalu tampil (tanpa pointer lock). Kamera diputar dengan
   menahan Klik Kanan lalu mengarahkan mouse. Klik kiri hanya dihitung sebagai
   serangan bila terjadi di atas kanvas (dunia), bukan di atas elemen HUD. */
(function (global) {
  'use strict';

  var keys = Object.create(null);
  var buttons = Object.create(null); // tombol mouse (Mouse0, Mouse1, ...)
  var pressed = Object.create(null); // tombol yang baru ditekan (sekali pakai)
  var mouse = { dx: 0, dy: 0, wheel: 0, x: 0, y: 0 };
  var dragging = false;              // seret kamera dengan klik kanan
  var canvasEl = null;

  var PREVENT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  function init(canvas) {
    canvasEl = canvas;

    window.addEventListener('keydown', function (e) {
      if (!keys[e.code]) pressed[e.code] = true;
      keys[e.code] = true;
      if (PREVENT.indexOf(e.code) !== -1) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) {
      keys[e.code] = false;
    });
    window.addEventListener('blur', function () {
      for (var k in keys) keys[k] = false;
      for (var b in buttons) buttons[b] = false;
      for (var p in pressed) pressed[p] = false;
      dragging = false;
    });

    // Klik di atas kanvas (dunia). Klik pada elemen HUD tidak sampai ke sini,
    // jadi tombol HUD tetap bisa diklik tanpa memicu serangan.
    canvas.addEventListener('mousedown', function (e) {
      var code = 'Mouse' + e.button;
      if (!buttons[code]) pressed[code] = true;
      buttons[code] = true;
      if (e.button === 2) dragging = true;
      e.preventDefault();
    });
    window.addEventListener('mouseup', function (e) {
      buttons['Mouse' + e.button] = false;
      if (e.button === 2) dragging = false;
    });

    window.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (dragging) {
        mouse.dx += e.movementX || 0;
        mouse.dy += e.movementY || 0;
      }
    });

    canvas.addEventListener('wheel', function (e) {
      mouse.wheel += e.deltaY;
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function consumeMouse() {
    var d = { dx: mouse.dx, dy: mouse.dy, wheel: mouse.wheel };
    mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0;
    return d;
  }

  function isDown(code) { return !!keys[code]; }

  /* True sekali saja setelah tombol ditekan (hingga dilepas lagi). */
  function wasPressed(code) {
    if (pressed[code]) { pressed[code] = false; return true; }
    return false;
  }

  global.Input = {
    init: init,
    isDown: isDown,
    wasPressed: wasPressed,
    consumeMouse: consumeMouse,
    isDragging: function () { return dragging; },
    cursor: function () { return { x: mouse.x, y: mouse.y }; },
    /* Kompatibilitas API Fase 1–4 — pointer lock tidak dipakai lagi. */
    requestLock: function () {},
    exitLock: function () {},
    onPointerLockChange: function () {},
    locked: true
  };
})(typeof window !== 'undefined' ? window : globalThis);
