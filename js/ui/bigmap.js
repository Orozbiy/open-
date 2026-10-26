/* Чоң карта (M): бүт дүйнө, оюнчунун картасы, легенда, жарыш белгилери (басып баштоо), заправка/гараж иконалары,
   каалаган жерди басып белги коюу → «МАРШРУТ» (GPS) же «БАРУУ» (эң жакын жолго өтүү, эркин айдоодо). */
(function () {
  const $ = id => document.getElementById(id);
  let open = false, map = null, car = null, cv, g, k = 0.25, cx = 0, cz = 0, pick = null, opts = {}, sel = null;
  const W = () => cv.width, Hh = () => cv.height, dpr = () => cv.width / innerWidth;
  const toWorld = (X, Y) => ({ x: cx - (X - W() / 2) / k, z: cz - (Y - Hh() / 2) / k });
  const toScreen = (x, z) => ({ x: W() / 2 - (x - cx) * k, y: Hh() / 2 - (z - cz) * k });
  function size() { const r = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * r; cv.height = innerHeight * r; }

  function draw() {
    if (!open) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2a6896'; g.fillRect(0, 0, W(), Hh());
    g.setTransform(-k, 0, 0, -k, W() / 2 + cx * k, Hh() / 2 + cz * k);
    map.drawMinimap(g, { x: cx, z: cz, h: 0, full: true }, null);
    if (opts.extra) opts.extra(g, k);
    const u = dpr();
    (opts.events || []).forEach(e => { TK.mapIcon(g, e.x, e.z, e.locked ? '🔒' : '★', e.locked ? '#555b66' : (sel === e ? '#ffb547' : '#d23a2e'), 15 * u); });
    if (pick) { g.strokeStyle = '#38b6ff'; g.lineWidth = 3 / k; g.beginPath(); g.arc(pick.x, pick.z, 14 * u / k, 0, 6.3); g.stroke(); TK.mapIcon(g, pick.x, pick.z, '', '#38b6ff', 6 * u); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const p = toScreen(car.x, car.z);
    g.save(); g.translate(p.x, p.y); g.rotate(-car.h); g.scale(u, u);
    g.fillStyle = '#f5d90a'; g.strokeStyle = '#1a1205'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -18); g.lineTo(12, 13); g.lineTo(0, 7); g.lineTo(-12, 13); g.closePath(); g.fill(); g.stroke();
    g.restore();
    requestAnimationFrame(draw);
  }
  function setPick(p) {
    pick = p; sel = null; $('bmEvent').hidden = true;
    $('bmGo').disabled = !p || !opts.teleport; $('bmRoute').disabled = !p; $('bmClear').hidden = !p && !(opts.hasRoute && opts.hasRoute());
    $('bmInfo').textContent = p ? (opts.teleport ? 'Белги коюлду: МАРШРУТ же БАРУУ' : 'Белги коюлду: МАРШРУТ (деңгээлде «Баруу» өчүк)') : 'Каалаган жерди басыңыз · ★ — жарыштар · сүйрөп жылдырыңыз';
  }
  function selectEvent(e) {
    sel = e; pick = null; $('bmGo').disabled = true; $('bmRoute').disabled = false;
    const box = $('bmEvent'); box.hidden = false;
    box.innerHTML = `<div class="sub">${e.touge ? 'Тоо жолу трассасы' : 'Ачык дүйнө'}</div><h3>${e.name}</h3><div class="sub">${e.sub}</div>
      <div class="stars">${'★'.repeat(e.stars)}${'☆'.repeat(3 - e.stars)}</div>
      ${e.locked ? '<div class="sub" style="color:var(--hot)">Жабык — мурунку деңгээлди өтүңүз</div>' : '<button class="act" id="bmStart">БАШТОО</button>'}`;
    if (!e.locked) $('bmStart').onclick = () => opts.onEvent && opts.onEvent(e.id);
    $('bmInfo').textContent = 'Жарыш тандалды: БАШТОО же МАРШРУТ';
  }
  function legend() {
    const L = $('bmLegend');
    L.innerHTML = [['F', '#1d7fd6', 'Заправка'], ['G', '#e08a1c', 'Гараж'], ['D', '#1d9e4b', 'Дрифт зона'], ['★', '#d23a2e', 'Жарыш / миссия'], ['', '#38b6ff', 'Сиздин белги'], ['▲', '#f5d90a', 'Сиз']]
      .map(([c, b, t]) => `<div><i style="background:${b};color:${b === '#f5d90a' ? '#111' : '#fff'}">${c}</i>${t}</div>`).join('') + '<div style="color:var(--dim)">— жол · ─ ─ туннель · көк — суу</div>';
  }
  function init() {
    cv = $('bigcv'); g = cv.getContext('2d');
    let down = null, moved = false;
    cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, cx, cz }; moved = false; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!down) return; const dx = (e.clientX - down.x) * dpr(), dy = (e.clientY - down.y) * dpr();
      if (Math.hypot(dx, dy) > 8) moved = true;
      if (moved) { cx = down.cx + dx / k; cz = down.cz + dy / k; }
    });
    cv.addEventListener('pointerup', e => {
      if (down && !moved) {
        const X = e.clientX * dpr(), Y = e.clientY * dpr();
        const ev = (opts.events || []).find(v => { const p = toScreen(v.x, v.z); return Math.hypot(p.x - X, p.y - Y) < 22 * dpr(); });
        if (ev) selectEvent(ev); else setPick(toWorld(X, Y));
        TK.audio.click();
      }
      down = null;
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
    $('bmIn').onclick = () => zoom(1.4); $('bmOut').onclick = () => zoom(1 / 1.4);
    $('bmMe').onclick = () => { cx = car.x; cz = car.z; };
    $('bmClose').onclick = () => TK.BigMap.close();
    $('bmLeg').onclick = () => { $('bmLegend').hidden = !$('bmLegend').hidden; };
    $('bmRoute').onclick = () => { const t = pick || sel; if (t && opts.onRoute) opts.onRoute({ x: t.x, z: t.z }); TK.BigMap.close(); };
    $('bmGo').onclick = () => { if (pick && opts.onGo) opts.onGo(pick); TK.BigMap.close(); };
    $('bmClear').onclick = () => { pick = null; if (opts.onClear) opts.onClear(); setPick(null); };
    addEventListener('keydown', e => {
      if (!open) return;
      if (e.code === 'KeyX') $('bmRoute').click();
      if (e.code === 'KeyL') $('bmLeg').click();
      if (e.code === 'Equal' || e.code === 'NumpadAdd') zoom(1.4);
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoom(1 / 1.4);
    });
    addEventListener('resize', () => { if (open) size(); });
    legend();
  }
  function zoom(f) { k = Math.max(0.05, Math.min(4, k * f)); }
  TK.BigMap = {
    init,
    get isOpen() { return open; },
    open(m, c, o) {
      map = m; car = c; opts = o || {}; open = true;
      $('bigmap').hidden = false; size();
      const vr = map.viewR || 800; k = Math.min(cv.width, cv.height) / (vr * (map.id === 'world' ? 2.0 : 1.15));
      cx = car.x * 0.5; cz = car.z * 0.5; if (map.id === 'touge') { cx = 0; cz = 200; }
      const P = opts.player;
      $('bmPlayer').innerHTML = P ? `<div class="lv">${P.lvl}</div><div><b>ОЮНЧУ</b><small>XP</small><div class="xp"><i style="width:${Math.round(P.xp * 100)}%"></i></div></div><div><b>${P.car}</b><small>${P.power}</small></div><div><b style="color:#6ee66a">${P.money} CR</b><small>акча</small></div>` : '';
      setPick(opts.pick || null);
      requestAnimationFrame(draw);
    },
    close() { if (!open) return; open = false; $('bigmap').hidden = true; $('bmEvent').hidden = true; if (opts.onClose) opts.onClose(); }
  };
})();
