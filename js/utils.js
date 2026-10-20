/* Utilitas: PRNG ber-seed, noise 2D (value noise), fBm/ridged, matematika. */
(function (global) {
  'use strict';

  // PRNG mulberry32 — angka acak deterministik dari sebuah seed.
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Noise 2D nilai (value noise) dengan interpolasi halus. Hasil: -1..1
  function createNoise2D(seed) {
    var rand = mulberry32(seed);
    var p = new Uint8Array(256);
    var i, j, t;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) {
      j = (rand() * (i + 1)) | 0;
      t = p[i]; p[i] = p[j]; p[j] = t;
    }
    var perm = new Uint8Array(512);
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];

    function fade(x) { return x * x * (3 - 2 * x); }
    function val(xi, yi) { return perm[(perm[xi & 255] + (yi & 255)) & 255] / 127.5 - 1; }

    return function noise2D(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var xf = x - xi, yf = y - yi;
      var u = fade(xf), v = fade(yf);
      var a = val(xi, yi), b = val(xi + 1, yi);
      var c = val(xi, yi + 1), d = val(xi + 1, yi + 1);
      return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
    };
  }

  // fBm: noise berlapis (oktaf) — bentuk besar + detail. Hasil: -1..1
  function makeFbm(noise, octaves) {
    var oct = octaves || 4;
    return function (x, y) {
      var sum = 0, amp = 1, freq = 1, norm = 0, i;
      for (i = 0; i < oct; i++) {
        sum += noise(x * freq, y * freq) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2.0;
      }
      return sum / norm;
    };
  }

  // Ridged noise: cocok untuk punggungan gunung. Hasil: -1..1
  function makeRidged(noise, octaves) {
    var oct = octaves || 4;
    return function (x, y) {
      var sum = 0, amp = 1, freq = 1, norm = 0, i;
      for (i = 0; i < oct; i++) {
        var n = 1 - Math.abs(noise(x * freq, y * freq));
        sum += n * n * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2.0;
      }
      return (sum / norm) * 2 - 1;
    };
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function lerpAngle(a, b, t) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  function approach(cur, target, maxDelta) {
    return cur < target ? Math.min(cur + maxDelta, target) : Math.max(cur - maxDelta, target);
  }

  global.Utils = {
    mulberry32: mulberry32,
    createNoise2D: createNoise2D,
    makeFbm: makeFbm,
    makeRidged: makeRidged,
    clamp: clamp,
    lerp: lerp,
    smoothstep: smoothstep,
    lerpAngle: lerpAngle,
    approach: approach
  };
})(typeof window !== 'undefined' ? window : globalThis);
