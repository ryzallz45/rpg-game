/* Audio prosedural (Tahap Menu): semua suara disintesis dengan Web Audio —
   tanpa berkas audio, sesuai prinsip proyek. Menyediakan musik suasana
   (ombak & pad lembut) + efek suara singkat untuk pertarungan & UI.
   Volume disimpan di localStorage 'pulau.audio'. Aman di Node. */
(function (global) {
  'use strict';

  var KEY = 'pulau.audio';
  var AC = global.AudioContext || global.webkitAudioContext;

  function AudioMan() {
    this.volMusic = 0.6;  // 0..1
    this.volSfx = 0.8;    // 0..1
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this._ambience = null;
    this._noiseBuf = null;
    this._night = 0;       // 0 = siang, 1 = malam (diumpankan dari world)
    this._nightGain = null;
    this.load();
  }

  AudioMan.prototype.load = function () {
    try {
      if (!global.localStorage) return;
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (typeof o.music === 'number') this.volMusic = Math.max(0, Math.min(1, o.music));
      if (typeof o.sfx === 'number') this.volSfx = Math.max(0, Math.min(1, o.sfx));
    } catch (e) {}
  };
  AudioMan.prototype.save = function () {
    try {
      if (global.localStorage) global.localStorage.setItem(KEY, JSON.stringify({ music: this.volMusic, sfx: this.volSfx }));
    } catch (e) {}
  };

  /* Buka kunci audio — panggil dari gestur pengguna (klik). Idempoten. */
  AudioMan.prototype.unlock = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
      return true;
    }
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.volMusic * 0.5;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.volSfx;
      this.sfxGain.connect(this.master);
      if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
    } catch (e) {
      this.ctx = null;
    }
    return !!this.ctx;
  };
  AudioMan.prototype.ready = function () { return !!(this.ctx && this.sfxGain); };

  AudioMan.prototype.setMusic = function (v) {
    this.volMusic = Math.max(0, Math.min(1, v));
    this.save();
    if (this.musicGain) {
      try { this.musicGain.gain.setTargetAtTime(this.volMusic * 0.5, this.ctx.currentTime, 0.08); } catch (e) {}
    }
  };
  AudioMan.prototype.setSfx = function (v) {
    this.volSfx = Math.max(0, Math.min(1, v));
    this.save();
    if (this.sfxGain) {
      try { this.sfxGain.gain.setTargetAtTime(this.volSfx, this.ctx.currentTime, 0.05); } catch (e) {}
    }
  };

  /* Suasana malam (serangga/angin hangat) — dipanggil dari game loop. */
  AudioMan.prototype.setNight = function (v) {
    this._night = Math.max(0, Math.min(1, v));
    if (this._nightGain && this.ctx) {
      try {
        this._nightGain.gain.setTargetAtTime(this._night * 0.045, this.ctx.currentTime, 1.4);
      } catch (e) {}
    }
  };

  /* ---------- Pembantu sintesis ---------- */
  AudioMan.prototype._noise = function () {
    if (this._noiseBuf) return this._noiseBuf;
    var len = Math.floor(this.ctx.sampleRate * 1.2);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      // noise "coklat" — lebih lembut dari white noise
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    this._noiseBuf = buf;
    return buf;
  };
  AudioMan.prototype._blip = function (freq, dur, type, vol, slideTo, delay) {
    var t0 = this.ctx.currentTime + (delay || 0);
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  };
  AudioMan.prototype._noiseBurst = function (dur, vol, f0, f1, q, delay) {
    var t0 = this.ctx.currentTime + (delay || 0);
    var src = this.ctx.createBufferSource();
    src.buffer = this._noise();
    var f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t0 + dur);
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  };

  /* ---------- Efek suara ---------- */
  AudioMan.prototype.sfx = function (name) {
    if (!this.ready() || this.volSfx <= 0.001) return;
    try {
      switch (name) {
        case 'click':
          this._blip(680, 0.07, 'square', 0.10, 940);
          break;
        case 'swing':
          this._noiseBurst(0.22, 0.22, 1400, 320, 1.1);
          break;
        case 'hit':
          this._blip(170, 0.13, 'sine', 0.5, 62);
          this._noiseBurst(0.09, 0.28, 900, 260, 0.9);
          break;
        case 'hurt':
          this._blip(220, 0.22, 'sawtooth', 0.22, 110);
          this._blip(160, 0.18, 'square', 0.10, 96, 0.02);
          break;
        case 'pickup':
          this._blip(660, 0.09, 'triangle', 0.16);
          this._blip(990, 0.12, 'triangle', 0.16, 0, 0.08);
          break;
        case 'levelup':
          this._blip(523, 0.10, 'triangle', 0.17);
          this._blip(659, 0.10, 'triangle', 0.17, 0, 0.09);
          this._blip(784, 0.10, 'triangle', 0.17, 0, 0.18);
          this._blip(1047, 0.22, 'triangle', 0.18, 0, 0.27);
          break;
        case 'jump':
          this._blip(300, 0.12, 'triangle', 0.12, 520);
          break;
        case 'save':
          this._blip(784, 0.08, 'triangle', 0.13);
          this._blip(1047, 0.15, 'triangle', 0.15, 0, 0.08);
          break;
        case 'load':
          this._blip(523, 0.09, 'triangle', 0.13);
          this._blip(659, 0.09, 'triangle', 0.13, 0, 0.08);
          this._blip(880, 0.16, 'triangle', 0.14, 0, 0.16);
          break;
      }
    } catch (e) {}
  };

  /* ---------- Musik suasana: ombak + pad lembut ---------- */
  AudioMan.prototype.startAmbience = function () {
    if (!this.ctx || !this.musicGain || this._ambience) return;
    try {
      var t0 = this.ctx.currentTime;
      var amb = { nodes: [] };

      // Ombak: noise coklat lewat lowpass, bergelombang pelan
      var src = this.ctx.createBufferSource();
      src.buffer = this._noise();
      src.loop = true;
      var lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      var g = this.ctx.createGain();
      g.gain.value = 0.35;
      var lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.09;
      var lfoG = this.ctx.createGain();
      lfoG.gain.value = 0.18;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      src.connect(lp); lp.connect(g); g.connect(this.musicGain);
      src.start(t0); lfo.start(t0);
      amb.nodes.push(src, lfo, lp, g, lfoG);

      // Pad: dua gelombang segitiga berdenyut pelan (kuint bersih)
      var freqs = [130.81, 196.0];
      for (var i = 0; i < freqs.length; i++) {
        var o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freqs[i];
        var og = this.ctx.createGain();
        og.gain.value = 0.045;
        var olfo = this.ctx.createOscillator();
        olfo.frequency.value = 0.05 + i * 0.017;
        var olfoG = this.ctx.createGain();
        olfoG.gain.value = 0.02;
        olfo.connect(olfoG);
        olfoG.connect(og.gain);
        o.connect(og); og.connect(this.musicGain);
        o.start(t0); olfo.start(t0);
        amb.nodes.push(o, og, olfo, olfoG);
      }

      // Malam: desis halus berfilter (angin hangat/serangga jauh), gain 0 saat siang.
      var nsrc = this.ctx.createBufferSource();
      nsrc.buffer = this._noise();
      nsrc.loop = true;
      var nbp = this.ctx.createBiquadFilter();
      nbp.type = 'bandpass';
      nbp.frequency.value = 2400;
      nbp.Q.value = 1.3;
      var ng = this.ctx.createGain();
      ng.gain.value = this._night * 0.045;
      var nlfo = this.ctx.createOscillator();
      nlfo.frequency.value = 0.17;
      var nlfoG = this.ctx.createGain();
      nlfoG.gain.value = 700;
      nlfo.connect(nlfoG);
      nlfoG.connect(nbp.frequency);
      nsrc.connect(nbp); nbp.connect(ng); ng.connect(this.musicGain);
      nsrc.start(t0); nlfo.start(t0);
      amb.nodes.push(nsrc, nbp, ng, nlfo, nlfoG);
      this._nightGain = ng;

      this._ambience = amb;
    } catch (e) { this._ambience = null; }
  };

  global.AudioMan = new AudioMan();
})(typeof window !== 'undefined' ? window : globalThis);
