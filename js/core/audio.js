/* Үн: кыймылдаткыч, дөңгөлөк чийиген үнү, UI үндөрү (баары кодтон синтезделет) */
(function () {
  let A = null, muted = false, vol = 0.8;
  const lvl = () => (muted ? 0 : 0.42 * vol);
  function init() {
    if (A) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain(); master.gain.value = lvl(); master.connect(ctx.destination);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(master);
      const eg = ctx.createGain(); eg.gain.value = 0; eg.connect(lp);
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.connect(eg); o1.start();
      const o2 = ctx.createOscillator(); o2.type = 'square'; const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(eg); o2.start();
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 6;
      const sg = ctx.createGain(); sg.gain.value = 0; noise.connect(bp); bp.connect(sg); sg.connect(master); noise.start();
      A = { ctx, master, lp, eg, o1, o2, sg };
    } catch (_) { A = null; }
  }
  TK.audio = {
    init,
    get muted() { return muted; },
    setMuted(m) { muted = m; if (A) A.master.gain.setTargetAtTime(lvl(), A.ctx.currentTime, 0.05); },
    setVolume(v) { vol = v; if (A) A.master.gain.setTargetAtTime(lvl(), A.ctx.currentTime, 0.05); },
    engineOn(on) { if (A) A.eg.gain.setTargetAtTime(on ? 0.25 : 0, A.ctx.currentTime, 0.1); if (A && !on) A.sg.gain.setTargetAtTime(0, A.ctx.currentTime, 0.05); },
    engine(rpm, gear, gas, screech, pitch) {
      if (!A) return;
      const t = A.ctx.currentTime, p = pitch || 1;
      const f = (38 + rpm * 120 + (gear - 1) * 6 + (gas ? 10 : 0)) * p;
      A.o1.frequency.setTargetAtTime(f, t, 0.05);
      A.o2.frequency.setTargetAtTime(f / 2, t, 0.05);
      A.lp.frequency.setTargetAtTime(500 + rpm * 1600 + (gas ? 400 : 0), t, 0.08);
      A.sg.gain.setTargetAtTime(screech * 0.22, t, 0.05);
    },
    beep(freq, dur, type, vol) {
      if (!A || muted) return;
      const t = A.ctx.currentTime, o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq || 660;
      g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
      o.connect(g); g.connect(A.master); o.start(t); o.stop(t + (dur || 0.12) + 0.02);
    },
    click() { this.beep(520, 0.07, 'triangle', 0.18); },
    gate() { this.beep(880, 0.14, 'sine', 0.25); setTimeout(() => this.beep(1320, 0.18, 'sine', 0.2), 90); },
    suspend() { if (A) A.ctx.suspend(); },
    resume() { if (A) A.ctx.resume(); }
  };
})();
