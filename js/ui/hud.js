/* HUD: тахометр (аналогдук), нитро/турбо/TC, мини-карта + бензин, упай тегереги, акча, деңгээл, миссия, жебе, билдирүүлөр */
(function () {
  const $ = id => document.getElementById(id);
  let el = {}, mg, mapCv, tc, tg, toastT = 0, deltaT = 0, scoreHide = 0, fpsN = 0, fpsT = 0;
  const fmt = v => Math.floor(v).toLocaleString('ru-RU');
  const A0 = Math.PI * 0.75, A1 = Math.PI * 2.25;   // тахометрдун жаасы (0 → 10)

  function drawTacho(o) {
    const g = tg, W = 440, Hh = 320, cx = 300, cy = 168, R = 128;
    g.clearRect(0, 0, W, Hh);
    // фон
    g.fillStyle = 'rgba(8,10,16,.42)'; g.beginPath(); g.arc(cx, cy, R + 14, 0, 6.283); g.fill();
    // кызыл зона
    const ang = v => A0 + (A1 - A0) * v / 10;
    g.lineWidth = 9; g.strokeStyle = '#e8262a'; g.beginPath(); g.arc(cx, cy, R - 6, ang(7.6), ang(10)); g.stroke();
    // бөлүктөр
    g.strokeStyle = '#f2f4f8'; g.fillStyle = '#f2f4f8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let v = 0; v <= 10; v += 0.5) {
      const a = ang(v), big = v % 1 === 0, r0 = R - (big ? 20 : 12);
      g.lineWidth = big ? 4 : 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
      if (big) { g.font = '800 22px Unbounded, Arial Black, sans-serif'; g.fillText(String(v), cx + Math.cos(a) * (R - 38), cy + Math.sin(a) * (R - 38)); }
    }
    g.font = '700 10px JetBrains Mono, monospace'; g.fillStyle = '#c9ced8'; g.fillText('RPM', cx, cy - 62); g.fillText('x1000', cx, cy - 50);
    g.font = '800 italic 15px Unbounded, Arial Black'; g.fillStyle = '#fff'; g.fillText('STREET', cx, cy - 30);
    // нитро жаасы
    g.lineWidth = 7; g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(cx, cy, R + 8, -0.55, 0.75); g.stroke();
    g.strokeStyle = o.n2oOn ? '#9ff' : '#3cf0b0'; g.beginPath(); g.arc(cx, cy, R + 8, 0.75 - 1.3 * o.n2o, 0.75); g.stroke();
    // жебе
    const a = ang(o.rpm * 10);
    g.strokeStyle = '#ff2b2b'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - Math.cos(a) * 14, cy - Math.sin(a) * 14); g.lineTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)); g.stroke();
    g.fillStyle = '#c2181c'; g.beginPath(); g.arc(cx, cy, 15, 0, 6.283); g.fill();
    // санарип панель: берүү (өзүнчө кутуча) + ылдамдык + одометр
    g.fillStyle = o.shifting ? '#ffb547' : '#f5d90a'; g.fillRect(cx - 62, cy + 50, 34, 42);
    g.fillStyle = '#111'; g.font = '800 28px Unbounded, Arial Black'; g.textAlign = 'center'; g.fillText(o.gear, cx - 45, cy + 72);
    g.fillStyle = 'rgba(160,220,200,.9)'; g.fillRect(cx - 24, cy + 50, 86, 42);
    g.fillStyle = '#0d2a22'; g.font = '800 28px Unbounded, Arial Black'; g.textAlign = 'right'; g.fillText(String(Math.round(o.speed)), cx + 57, cy + 72);
    g.fillStyle = 'rgba(8,10,16,.75)'; g.fillRect(cx - 50, cy + 20, 100, 20);
    g.fillStyle = '#e8eaee'; g.font = '700 14px JetBrains Mono'; g.textAlign = 'center'; g.fillText((o.odo || 0).toFixed(1).padStart(7, '0') + ' км', cx, cy + 31);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '700 12px JetBrains Mono'; g.fillText(o.unit, cx, cy + 104);
    g.fillStyle = o.tc ? '#5ee0ff' : '#8f97ab'; g.font = '700 12px JetBrains Mono'; g.fillText(o.tc ? 'TC ON' : 'TC OFF', cx - 72, cy + 104);
    g.fillStyle = o.n2oOn ? '#9ff' : '#3cf0b0'; g.fillText('N2O', cx + 76, cy + 104);
    // турбо кичине прибор
    const bx = 92, by = 196, br = 52, b0 = Math.PI * 0.8, b1 = Math.PI * 2.2;
    g.fillStyle = 'rgba(8,10,16,.42)'; g.beginPath(); g.arc(bx, by, br + 8, 0, 6.283); g.fill();
    g.strokeStyle = '#f2f4f8'; g.lineWidth = 2;
    for (let k = 0; k <= 7; k++) { const aa = b0 + (b1 - b0) * k / 7; g.beginPath(); g.moveTo(bx + Math.cos(aa) * (br - 8), by + Math.sin(aa) * (br - 8)); g.lineTo(bx + Math.cos(aa) * br, by + Math.sin(aa) * br); g.stroke(); }
    const ba = b0 + (b1 - b0) * o.boost; g.strokeStyle = '#ff2b2b'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(ba) * (br - 6), by + Math.sin(ba) * (br - 6)); g.stroke();
    g.fillStyle = '#c2181c'; g.beginPath(); g.arc(bx, by, 6, 0, 6.283); g.fill();
    g.fillStyle = '#fff'; g.font = '800 12px Unbounded, Arial Black'; g.fillText('BOOST', bx, by + 40);
  }

  TK.HUD = {
    init() {
      ['hud', 'cash', 'cashDelta', 'best', 'mission', 'mTitle', 'mMain', 'mSub', 'map', 'arrow', 'score', 'scorePts', 'scoreMult', 'scoreLbl', 'scoreArc', 'count', 'pauseBtn', 'reset', 'tacho', 'fps', 'fuelTxt', 'modeChip', 'toast', 'toastT', 'toastS', 'prompt', 'promptT', 'promptBtn', 'lvlNum', 'lvlBar'].forEach(i => el[i] = $(i));
      mapCv = el.map; mg = mapCv.getContext('2d'); tc = el.tacho; tg = tc.getContext('2d');
    },
    show(b) { el.hud.hidden = !b; },
    cash(c, b, delta) {
      el.cash.textContent = fmt(c); if (b !== undefined) el.best.textContent = fmt(b);
      if (delta) { el.cashDelta.textContent = '+ ' + fmt(delta) + ' CR'; el.cashDelta.classList.add('on'); deltaT = 2; }
    },
    level(lvl, frac) { el.lvlNum.textContent = lvl; el.lvlBar.style.width = Math.round(frac * 100) + '%'; },
    mission(on, title, main, sub, warn) {
      el.mission.hidden = !on; if (!on) return;
      el.mTitle.textContent = title || ''; el.mMain.textContent = main || ''; el.mSub.textContent = sub || '';
      el.mMain.classList.toggle('warn', !!warn);
    },
    arrow(a) { if (a === null || a === undefined) { el.arrow.hidden = true; return; } el.arrow.hidden = false; el.arrow.style.transform = 'rotate(' + a + 'rad)'; },
    // упай тегереги: st = 'live' | 'bank' | 'fail'
    score(pts, mult, label, prog, st) {
      el.score.classList.add('show'); el.score.classList.toggle('bank', st === 'bank'); el.score.classList.toggle('fail', st === 'fail');
      el.scorePts.textContent = typeof pts === 'string' ? pts : fmt(pts);
      el.scoreMult.textContent = 'X' + (Math.round(mult * 10) / 10);
      el.scoreLbl.innerHTML = label || '';
      el.scoreArc.style.strokeDashoffset = String(264 * (1 - TK.util.clamp(prog, 0, 1)));
      scoreHide = st === 'live' ? 0 : 1.8;
    },
    scoreHide() { el.score.classList.remove('show'); },
    tacho(o) { drawTacho(o); },
    fuel(f, liters) { el.fuelTxt.textContent = liters === null ? '' : 'БЕНЗИН ' + Math.ceil(liters) + 'L'; el.fuelTxt.classList.toggle('low', f < 0.15 && liters !== null); this._fuel = f; },
    mode(tc) { el.modeChip.textContent = tc ? 'TC' : 'SPORT'; el.modeChip.classList.toggle('tc', tc); },
    fps(show, dt) { el.fps.hidden = !show; if (!show) return; fpsN++; fpsT += dt; if (fpsT > 0.5) { el.fps.textContent = Math.round(fpsN / fpsT) + ' fps'; fpsN = 0; fpsT = 0; } },
    toast(t, s, sec) { el.toastT.textContent = t; el.toastS.textContent = s || ''; el.toast.classList.add('on'); toastT = sec || 2.2; },
    prompt(text, btn, onClick) {
      if (!text) { el.prompt.hidden = true; return; }
      el.prompt.hidden = false; el.promptT.textContent = text;
      el.promptBtn.hidden = !btn; if (btn) { el.promptBtn.textContent = btn; el.promptBtn.onclick = onClick; }
    },
    tick(dt) {
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) el.toast.classList.remove('on'); }
      if (deltaT > 0) { deltaT -= dt; if (deltaT <= 0) el.cashDelta.classList.remove('on'); }
      if (scoreHide > 0) { scoreHide -= dt; if (scoreHide <= 0) el.score.classList.remove('show'); }
    },
    count(text) { el.count.textContent = text; el.count.classList.remove('pop'); void el.count.offsetWidth; el.count.classList.add('pop'); },
    /* Мини-карта: машинанын алды дайыма ӨЙДӨ (rotate=true), же түндүк өйдө (rotate=false).
       Дүйнө → экран: X = S·(оң жакка аралык), Y = −S·(алдыга аралык). */
    drawMap(map, car, overlay, rangeM, rotate) {
      const W = mapCv.width, S = W / (rangeM || 340), h = rotate === false ? 0 : car.h, c = Math.cos(h), s = Math.sin(h);
      mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, W, W); mg.save();
      mg.beginPath(); mg.arc(W / 2, W / 2, W / 2 - 14, 0, Math.PI * 2); mg.clip();
      mg.fillStyle = '#10131c'; mg.fillRect(0, 0, W, W);
      const a = -S * c, b = -S * s, cc = S * s, d = -S * c;
      mg.setTransform(a, b, cc, d, W / 2 - (a * car.x + cc * car.z), W / 2 - (b * car.x + d * car.z));
      map.drawMinimap(mg, car, overlay ? (g => overlay(g, S)) : null);
      mg.restore();
      // бензин жаасы (сол жакта, сары)
      const f = this._fuel === undefined ? 1 : this._fuel;
      mg.lineWidth = 7; mg.lineCap = 'round';
      mg.strokeStyle = 'rgba(255,255,255,.15)'; mg.beginPath(); mg.arc(W / 2, W / 2, W / 2 - 6, Math.PI * 0.6, Math.PI * 1.4); mg.stroke();
      mg.strokeStyle = f < 0.15 ? '#ff5a4e' : '#f5c84a'; mg.beginPath(); mg.arc(W / 2, W / 2, W / 2 - 6, Math.PI * 1.4 - Math.PI * 0.8 * f, Math.PI * 1.4); mg.stroke();
      mg.strokeStyle = 'rgba(255,255,255,.35)'; mg.lineWidth = 2; mg.beginPath(); mg.arc(W / 2, W / 2, W / 2 - 14, 0, 6.283); mg.stroke();
      // машина
      mg.save(); mg.translate(W / 2, W / 2); if (rotate === false) mg.rotate(-car.h);
      mg.fillStyle = '#f5d90a'; mg.strokeStyle = '#1a1205'; mg.lineWidth = 2; mg.beginPath();
      mg.moveTo(0, -15); mg.lineTo(10, 11); mg.lineTo(0, 6); mg.lineTo(-10, 11); mg.closePath(); mg.fill(); mg.stroke(); mg.restore();
      // N тамгасы (түндүк)
      const Rn = W / 2 - 26;
      mg.fillStyle = '#fff'; mg.font = '800 16px Unbounded, Arial'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('N', W / 2 + Math.sin(h) * Rn, W / 2 - Math.cos(h) * Rn);
    },
    fmt,
    time(s) { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); }
  };
  TK.mapLabel = function (g, x, z, text) {
    const p = g.getTransform().transformPoint({ x, y: z });
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.font = '800 15px Unbounded, Arial Black'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(text.toUpperCase(), p.x, p.y); g.fillStyle = '#fff'; g.fillText(text.toUpperCase(), p.x, p.y); g.restore();
  };
  // карта иконкалары: дүйнө координатасында, бирок экранда түз (айланбайт)
  TK.mapIcon = function (g, x, z, ch, bg, size) {
    const m = g.getTransform(), p = m.transformPoint({ x, y: z });
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const r = size || 11; g.fillStyle = bg; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#fff'; g.font = `800 ${Math.round(r * 1.1)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, p.x, p.y + 1);
    g.restore();
  };
})();
