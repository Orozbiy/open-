/* Оюндун негизги цикли: абалдар (меню → жүктөө → санак → оюн → жыйынтык), режимдер, камера, физика чакыруу */
(function () {
  const clamp = TK.util.clamp, lerp = TK.util.lerp;
  const S = () => TK.save.data;
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 3000);
  const env = new TK.Environment(scene);
  scene.add(camera);
  const showroom = TK.Showroom(renderer);
  const fx = TK.FX(scene), weather = TK.Weather(scene, env);

  // ---- жөндөөлөр ----
  const DEF_SET = { quality: 1, sound: true, daytime: 'auto', weather: 'clear', brightness: 0.55, fpsCap: 60, showFps: false, units: 'kmh', mapRotate: true, traffic: 1, camMode: 'chase', fov: 62, camDist: 1, volume: 0.8, blur: 1 };
  const ST = () => { const s = S().settings; for (const k in DEF_SET) if (s[k] === undefined) s[k] = DEF_SET[k]; return s; };
  function applySettings() {
    const st = ST();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, st.quality || 1)); renderer.setSize(innerWidth, innerHeight);
    canvas.style.filter = 'brightness(' + (0.55 + st.brightness * 0.8).toFixed(2) + ') saturate(1.16) contrast(1.06)';   // Forza сыяктуу ачык түстөр
    TK.audio.setVolume && TK.audio.setVolume(st.volume);
    TK.audio.setMuted(st.sound === false);
  }
  // ---- оюнчунун деңгээли (XP) ----
  const needXP = l => 800 + 400 * l;
  function addXP(v) {
    const d = S(); d.xp = (d.xp || 0) + Math.round(v); d.lvl = d.lvl || 1;
    while (d.xp >= needXP(d.lvl)) { d.xp -= needXP(d.lvl); d.lvl++; d.spins = (d.spins || 0) + 1; const bonus = 500 * d.lvl; d.cash += bonus; cash = d.cash; TK.HUD.toast('ДЕҢГЭЭЛ ' + d.lvl + '!', '+' + TK.HUD.fmt(bonus) + ' CR · 🎰 +1 WHEELSPIN (менюдан)', 3.2); TK.audio.gate(); }
    TK.save.commit(); TK.HUD.level(d.lvl, d.xp / needXP(d.lvl));
  }
  TK.progress = { needXP };

  function applyQuality() { applySettings(); }
  applySettings();

  // ---- дөңгөлөк издери ----
  const SKID_N = 420;
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const skidGeo = new THREE.PlaneGeometry(0.3, 0.55), skids = [];
  for (let k = 0; k < SKID_N; k++) { const m = new THREE.Mesh(skidGeo, skidMat); m.visible = false; scene.add(m); skids.push(m); }
  let skidIdx = 0, skidDist = 0;
  function dropSkid(x, z, h) { const m = skids[skidIdx]; skidIdx = (skidIdx + 1) % SKID_N; m.visible = true; m.position.set(x, gyAt(x, z) + 0.2, z); m.rotation.set(-Math.PI / 2, 0, h); }
  function clearSkids() { skids.forEach(m => m.visible = false); }

  // ---- абал ----
  let state = 'menu';            // menu | loading | countdown | play | pause | result
  let level = null, map = null, player = null, car = null, stats = null, mode = null, rivals = [];
  let input = { gas: 0, brake: 0, hb: 0, steer: 0 };
  let cdTimer = 0, cdLast = 0, shake = 0, t0 = 0, last = performance.now();
  let cash = 0, best = 0, lastRender = 0, smokeAcc = 0, dustAcc = 0, slopeFs = 0, slopeLs = 0, camYs = 0;
  const camPos = new THREE.Vector3(0, 5, -20), lookAt = new THREE.Vector3();
  // ---- автоматтык кутуча (чыныгы машинадагыдай) ----
  const RATIOS = [3.40, 2.15, 1.55, 1.20, 0.98, 0.82];      // берүүлөрдүн катышы (1…6)
  const IDLE = 900, UPSHIFT = 7100, LIMIT = 7600;          // бош жүрүш, которуу, чектегич (айн/мүн)
  const gb = { g: 1, shiftT: 0, rpm: IDLE, lim: 0 };
  const camDir = new THREE.Vector2(0, 1);
  const _ce = new THREE.Vector3(), _ct = new THREE.Vector3(), _cu = new THREE.Vector3(), _cq = new THREE.Quaternion();
  let cockpit = null, blurZ = 0, blurS = 0;
  const postfx = TK.PostFX(renderer);
  let showroomCarId = null, startOpts = {}, carY = 0, prevState = 'play';
  // жер бети; тайыз сууда (тереңдиги 4.5 м чейин) машина суунун бетинде жүрөт (дөңгөлөктөр сууда)
  const gyAt = (x, z) => { if (!map || !map.groundY) return 0; const g = map.groundY(x, z); if (map.SEA !== undefined && g < map.SEA - 0.25 && g > map.SEA - 4.5) return map.SEA - 0.42; return g; };
  function grad(x, z) { if (!map || !map.groundY) return [0, 0]; const e = 2.5; return [(gyAt(x + e, z) - gyAt(x - e, z)) / (2 * e), (gyAt(x, z + e) - gyAt(x, z - e)) / (2 * e)]; }

  // ================= маршрут (GPS сызыгы) =================
  const route = { target: null, pts: null, timer: 0, mesh: null, waypoint: false };
  const chevTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(56,182,255,0.55)'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#e6f6ff'; g.beginPath(); g.moveTo(8, 44); g.lineTo(32, 14); g.lineTo(56, 44); g.lineTo(45, 44); g.lineTo(32, 28); g.lineTo(19, 44); g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const routeMat = new THREE.MeshBasicMaterial({ map: chevTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, fog: false });
  const wpMarker = (() => {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 80, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x38b6ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 40; g.add(beam); g.visible = false; scene.add(g); return g;
  })();
  function setRoute(t, isWaypoint) {
    route.target = t; route.timer = 0; route.waypoint = !!isWaypoint;
    wpMarker.visible = !!(t && isWaypoint);
    if (t && isWaypoint) wpMarker.position.set(t.x, gyAt(t.x, t.z), t.z);
    if (!t) { route.pts = null; if (route.mesh) route.mesh.visible = false; }
  }
  function buildRouteMesh() {
    const pts = route.pts, P = [], U = [], I = [];
    let dist = 0, n = 0; const W = 0.8, MAXD = 320;
    // полилинияны 2.5 м сайын бөлүү
    const seq = [];
    for (let i = 0; i < pts.length - 1 && dist < MAXD; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.01) continue;
      const steps = Math.max(1, Math.ceil(L / 2.5));
      for (let k = 0; k < steps && dist < MAXD; k++) { const t = k / steps; seq.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, dist]); dist += L / steps; }
    }
    const lp = pts[pts.length - 1]; if (dist < MAXD) seq.push([lp[0], lp[1], dist]);
    for (let i = 0; i < seq.length; i++) {
      const a = seq[Math.max(0, i - 1)], b = seq[Math.min(seq.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
      const nx = -tz, nz = tx, [x, z, d] = seq[i], y = gyAt(x, z) + 0.28;
      P.push(x + nx * W, y, z + nz * W, x - nx * W, y, z - nz * W); U.push(0, d / 2.4, 1, d / 2.4);
      if (i < seq.length - 1) { const o = i * 2; I.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    }
    if (route.mesh) { route.mesh.geometry.dispose(); } else { route.mesh = new THREE.Mesh(new THREE.BufferGeometry(), routeMat); route.mesh.frustumCulled = false; scene.add(route.mesh); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
    route.mesh.geometry = g; route.mesh.visible = true;
  }
  function updateRoute(dt) {
    chevTex.offset.y -= dt * 1.6;
    if (!route.target || !map || !map.route) { if (route.mesh) route.mesh.visible = false; return; }
    if (route.waypoint && Math.hypot(car.x - route.target.x, car.z - route.target.z) < 16) { TK.audio.gate(); setRoute(null); return; }
    route.timer -= dt;
    if (route.timer <= 0) { route.pts = map.route(car.x, car.z, route.target.x, route.target.z); route.timer = 0.6; buildRouteMesh(); }
    wpMarker.children[0].material.opacity = 0.28 + Math.sin(performance.now() / 300) * 0.08;
  }
  function drawRouteOverlay(mg, px) {
    if (!route.pts) return;
    mg.strokeStyle = '#38b6ff'; mg.lineWidth = 5 / px; mg.lineJoin = 'round'; mg.lineCap = 'round';
    mg.beginPath(); route.pts.forEach((p, i) => i ? mg.lineTo(p[0], p[1]) : mg.moveTo(p[0], p[1])); mg.stroke();
    if (route.waypoint) { const t = route.target; mg.fillStyle = '#38b6ff'; mg.beginPath(); mg.arc(t.x, t.z, 8 / px, 0, 6.3); mg.fill(); }
  }

  // ================= чоң карта =================
  function resolveMarker(m) { if (m === 'driftZone') return map.driftZone ? { x: map.driftZone.x, z: map.driftZone.z } : null; return Array.isArray(m) ? { x: m[0], z: m[1] } : null; }
  function toggleMap() {
    if (TK.BigMap.isOpen) { TK.BigMap.close(); return; }
    if (!(state === 'play' || state === 'countdown')) return;
    prevState = state; state = 'map'; TK.input.clear(); TK.audio.engineOn(false);
    const free = level.type === 'free';
    const events = map.id === 'world' ? TK.LEVELS.map((l, i) => { const p = l.marker ? resolveMarker(l.marker) : null; return p ? { x: p.x, z: p.z, id: l.id, name: l.name, sub: l.sub, stars: S().stars[l.id] || 0, locked: !TK.Menu.unlocked(i), touge: l.map === 'touge' } : null; }).filter(Boolean) : [];
    const d = S(), spec = TK.Cars.byId[d.car];
    TK.BigMap.open(map, car, {
      teleport: free && !!map.snapToRoad,
      pick: route.waypoint ? route.target : null,
      hasRoute: () => !!route.waypoint,
      events, pois: map.pois || [],
      player: { lvl: d.lvl || 1, xp: (d.xp || 0) / needXP(d.lvl || 1), car: spec.name, power: Math.round(spec.stats.engine * 28) + ' а.к.', money: TK.HUD.fmt(d.cash) },
      extra: (g, k) => { drawRouteOverlay(g, k); drawPois(g, k); if (mode.overlay) mode.overlay(g, k); },
      onEvent: id => { TK.BigMap.close(); start(id); },
      onRoute: p => { if (map.route) setRoute(p, true); },
      onGo: p => {
        if (plane.active) exitPlane();
        const sp = map.snapToRoad(p.x, p.z);
        Object.assign(car, { x: sp.x, z: sp.z, h: sp.h, vx: 0, vz: 0, yaw: 0, vf: 0, vl: 0 });
        groundCar(); chainFail(true); clearSkids(); snapCamera(); setRoute(null);
      },
      onClear: () => setRoute(null),
      onClose: () => { if (state === 'map') { state = prevState; last = performance.now(); TK.audio.engineOn(true); } }
    });
  }
  function drawPois(g, px) {
    if (map && map.stunts && level && level.type === 'free') horizon.drawIcons(g, px, car);
    (map.pois || []).forEach(p => {
      if (p.type === 'town') { if (px < 0.4) TK.mapLabel(g, p.x, p.z, p.name); return; }
      if (p.type === 'airport' || p.type === 'fuel' || p.type === 'garage' || p.type === 'drift') {} else return;
      TK.mapIcon(g, p.x, p.z, p.type === 'fuel' ? 'F' : (p.type === 'garage' ? 'G' : (p.type === 'airport' ? '✈' : 'D')), p.type === 'fuel' ? '#1d7fd6' : (p.type === 'garage' ? '#e08a1c' : (p.type === 'airport' ? '#6b4fd6' : '#1d9e4b')), px > 0.4 ? 10 : 12);
    });
  }

  function timeFor(l) {
    if (startOpts.time) return startOpts.time;
    const t = (l.time === 'auto' || l.time === 'pick') ? S().settings.daytime : l.time;
    if (t && t !== 'auto') return t;
    const h = new Date().getHours();
    return h >= 7 && h < 17 ? 'day' : (h >= 17 && h < 20 ? 'sunset' : 'night');
  }

  // ================= режимдер =================
  const Modes = {
    free() { return { countdown: false, init() { TK.HUD.mission(false); }, update() {}, overlay() {}, onCombo() {} }; },

    checkpoints() {
      let targets, idx = 0, timeLeft, elapsed = 0, markers = [];
      return {
        countdown: true,
        init() {
          targets = level.cps.map(c => map.point ? map.point(c) : map.intersection(c[0], c[1]));
          timeLeft = level.limit;
          for (let k = 0; k < 2; k++) {
            const g = new THREE.Group();
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
            beam.position.y = 30; g.add(beam);
            const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.22, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd08a })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
            scene.add(g); markers.push(g);
          }
          this.place();
        },
        place() {
          const a = targets[idx], b = targets[idx + 1];
          markers[0].position.set(a.x, gyAt(a.x, a.z), a.z); markers[0].visible = true; markers[0].scale.set(1, 1, 1);
          setRoute(a, false);
          if (b) { markers[1].position.set(b.x, gyAt(b.x, b.z), b.z); markers[1].visible = true; markers[1].scale.set(.6, 1, .6); } else markers[1].visible = false;
        },
        update(dt) {
          if (state === 'play') {
            elapsed += dt; timeLeft -= dt;
            const t = targets[idx];
            if (Math.hypot(car.x - t.x, car.z - t.z) < 14) {
              idx++; timeLeft += level.bonus; TK.audio.gate();
              if (idx >= targets.length) { this.finish(true); return; }
              this.place();
            }
            if (timeLeft <= 0) { this.finish(false); return; }
          }
          markers[0].children[1].rotation.z += dt * 2;
          const t = targets[Math.min(idx, targets.length - 1)];
          TK.HUD.mission(true, level.name.toUpperCase(), TK.HUD.time(timeLeft), 'ЧЕКИТ ' + Math.min(idx + 1, targets.length) + ' / ' + targets.length, timeLeft < 10);
          const rel = Math.atan2(t.x - car.x, t.z - car.z) - car.h;
          TK.HUD.arrow(-rel);
        },
        overlay(mg, px) {
          const r0 = Math.max(9, 7 / (px || 1));
          targets.forEach((t, i) => { if (i <= idx) return; mg.fillStyle = 'rgba(255,181,71,.45)'; mg.beginPath(); mg.arc(t.x, t.z, r0 * 0.7, 0, 6.3); mg.fill(); });
          const t = targets[Math.min(idx, targets.length - 1)];
          mg.fillStyle = '#ffb547'; mg.beginPath(); mg.arc(t.x, t.z, r0, 0, 6.3); mg.fill();
          mg.strokeStyle = 'rgba(255,181,71,.5)'; mg.lineWidth = 3 / (px || 1); mg.beginPath(); mg.arc(t.x, t.z, r0 * (1.8 + (performance.now() / 600) % 1.2), 0, 6.3); mg.stroke();
        },
        onCombo() {},
        finish(win) {
          const L = level.stars; let st = 0;
          if (win) st = elapsed <= L[0] ? 3 : (elapsed <= L[1] ? 2 : 1);
          endLevel({ win, stars: st, sub: level.name, title: win ? 'ФИНИШ!' : 'УБАКЫТ БҮТТҮ', value: win ? elapsed : null, valueLabel: win ? TK.HUD.time(elapsed) : null, lower: true,
            lines: win ? ['Убакыт: <b>' + TK.HUD.time(elapsed) + '</b>', '3★ үчүн: ' + TK.HUD.time(L[0])] : ['Чекит: <b>' + idx + ' / ' + targets.length + '</b>'] });
        },
        dispose() { markers.forEach(m => { scene.remove(m); TK.util.disposeTree(m); }); markers = []; TK.HUD.arrow(null); setRoute(null); }
      };
    },

    drift() {
      let score = 0, timeLeft;
      return {
        countdown: true,
        init() { timeLeft = level.limit; },
        update(dt) {
          if (state === 'play') { timeLeft -= dt; if (timeLeft <= 0) { chainBank(); this.finish(); return; } }
          const live = chain.pts * chainMult(), nextT = level.stars.find(s => s > score + live) || level.stars[2];
          TK.HUD.mission(true, level.name.toUpperCase(), TK.HUD.time(timeLeft), 'УПАЙ ' + TK.HUD.fmt(score + live) + ' / ' + TK.HUD.fmt(nextT), timeLeft < 10);
        },
        overlay(mg, px) {
          mg.strokeStyle = 'rgba(255,181,71,.85)'; mg.lineWidth = 3 / (px || 1);
          if (level.spawn === 'driftZone' && map.driftZone) { const z = map.driftZone; mg.strokeRect(z.x - z.w / 2, z.z - z.d / 2, z.w, z.d); }
          else (map.lots || []).forEach(l => mg.strokeRect(l.cx - 26, l.cz - 26, 52, 52));
        },
        onCombo(total) { score += total; },
        finish() {
          const L = level.stars, st = score >= L[2] ? 3 : (score >= L[1] ? 2 : (score >= L[0] ? 1 : 0));
          endLevel({ win: st > 0, stars: st, sub: level.name, title: st > 0 ? 'ЖАКШЫ ДРИФТ!' : 'ЖЕТИШПЕДИ', value: score, valueLabel: TK.HUD.fmt(score), lower: false,
            lines: ['Упай: <b>' + TK.HUD.fmt(score) + '</b>', '1★ — ' + TK.HUD.fmt(L[0]) + ' · 2★ — ' + TK.HUD.fmt(L[1]) + ' · 3★ — ' + TK.HUD.fmt(L[2])] });
        },
        dispose() {}
      };
    },

    race() {
      let tr, n, playerS = 0, lastIdx = 0, elapsed = 0, done = false;
      return {
        countdown: true,
        init() {
          tr = map.track; n = tr.n;
          const R = level.rivals, ids = TK.Cars.list.filter(c => !c.glb).map(c => c.id);
          const cols = ['#e8edf5', '#1f5fd1', '#ffb547', '#2fa37a', '#8c5cd6', '#17191f'];
          const slot = k => ({ off: 4 + 5 * k, lane: (k % 2 ? 2.4 : -2.4) });
          for (let k = 0; k < R; k++) {
            const o = TK.Cars.make(ids[(k + 1) % ids.length], cols[k % cols.length]);
            if (o.spot) o.group.remove(o.spot); if (o.tailGlow) o.group.remove(o.tailGlow);
            scene.add(o.group);
            const sl = slot(k);
            rivals.push({ o, s: -sl.off, lane: sl.lane, v: 0, vTop: level.rivalSpeed * (0.94 + Math.random() * 0.08), grip: level.rivalGrip * (0.95 + Math.random() * 0.1), ph: Math.random() * 6, done: false });
          }
          const ps = slot(R), i0 = ((n - ps.off) % n + n) % n;
          car.x = tr.X[i0] + tr.NX[i0] * ps.lane; car.z = tr.Z[i0] + tr.NZ[i0] * ps.lane; car.h = Math.atan2(tr.TX[i0], tr.TZ[i0]);
          car.trackIdx = i0; lastIdx = i0; playerS = -ps.off;
          this.place(0);
        },
        place(dt) {
          const X = tr.X, Z = tr.Z;
          rivals.forEach(r => {
            const f = ((r.s % n) + n) % n, i = Math.floor(f), t = f - i, j = (i + 1) % n;
            const lane = r.lane + Math.sin(performance.now() / 2000 + r.ph) * 0.8;
            const x = lerp(X[i], X[j], t) + tr.NX[i] * lane, z = lerp(Z[i], Z[j], t) + tr.NZ[i] * lane;
            r.o.group.position.set(x, 0, z); r.o.group.rotation.y = Math.atan2(tr.TX[i], tr.TZ[i]);
            r.x = x; r.z = z;
            r.o.wheels.forEach(w => w.spin.rotation.x += r.v * dt / 0.34);
          });
        },
        update(dt) {
          const lim = level.laps * n;
          if (state === 'play' || state === 'countdown') {
            if (state === 'play') {
              elapsed += dt;
              rivals.forEach(r => {
                if (r.done) { r.v *= 0.97; return; }
                const i0 = Math.floor(((r.s % n) + n) % n); let kmax = 0;
                for (let k = 0; k < 36; k += 3) kmax = Math.max(kmax, tr.K[(i0 + k) % n]);
                let target = Math.min(r.vTop, Math.max(14, Math.sqrt(r.grip / (kmax + 1e-4))));
                const gap = (r.s - playerS) * tr.seg;
                if (gap > 220) target *= 0.9; else if (gap < -110) target *= 1.08;
                r.v += (target - r.v) * Math.min(1, dt * (target > r.v ? 1.1 : 2.4));
                r.s += r.v * dt / tr.seg;
                if (r.s >= lim) { r.s = lim; r.done = true; }
                if (Math.abs(car.x - r.x) < 8 && Math.abs(car.z - r.z) < 8 && TK.Physics.hitCar(car, r.x, r.z, r.o.group.rotation.y, 2.2, 0.6)) r.v = Math.max(r.v * 0.985, 9);   // рақиб токтоп калбайт
              });
              let d = car.trackIdx - lastIdx; if (d > n / 2) d -= n; else if (d < -n / 2) d += n;
              playerS += d; lastIdx = car.trackIdx;
              if (playerS >= lim && !done) { done = true; this.finish(); return; }
            }
            this.place(dt);
          }
          const ahead = rivals.filter(r => r.s > playerS).length, rank = 1 + ahead, lap = clamp(Math.floor(Math.max(0, playerS) / n) + 1, 1, level.laps);
          TK.HUD.mission(true, level.name.toUpperCase(), 'ОРУН ' + rank + ' / ' + (rivals.length + 1), 'АЙЛАМПА ' + lap + ' / ' + level.laps + ' · ' + TK.HUD.time(elapsed));
        },
        overlay(mg, px) { const r0 = Math.max(6, 5 / (px || 1)); mg.fillStyle = '#ff5a4e'; rivals.forEach(r => { mg.beginPath(); mg.arc(r.x || 0, r.z || 0, r0, 0, 6.3); mg.fill(); }); },
        onCombo() {},
        finish() {
          const rank = 1 + rivals.filter(r => r.s > playerS || r.done).length, st = rank === 1 ? 3 : (rank === 2 ? 2 : (rank === 3 ? 1 : 0));
          endLevel({ win: st > 0, stars: st, sub: level.name, title: rank === 1 ? 'ЖЕҢИШ!' : rank + '-ОРУН', value: elapsed, valueLabel: TK.HUD.time(elapsed), lower: true,
            lines: ['Орун: <b>' + rank + ' / ' + (rivals.length + 1) + '</b>', 'Убакыт: <b>' + TK.HUD.time(elapsed) + '</b>', st === 0 ? 'Жылдыз алуу үчүн эң аз 3-орунга чыгыңыз' : ''].filter(Boolean) });
        },
        dispose() { rivals.forEach(r => { scene.remove(r.o.group); TK.util.disposeTree(r.o.group); }); rivals = []; }
      };
    }
  };

  // ================= деңгээлди баштоо / бүтүрүү =================
  function cleanup() {
    if (plane.active) plane.exit();
    if (mode && mode.dispose) mode.dispose();
    mode = null;
    setRoute(null);
    if (map) { map.dispose(); map = null; }
    if (player) { scene.remove(player.group); TK.util.disposeTree(player.group); player = null; }
    clearSkids(); fx.clear(); TK.HUD.prompt(null);
    if (car && car.useFuel) { S().fuel = car.fuel; TK.save.commit(); }
  }

  function start(id, o) {
    if (TK.BigMap.isOpen) TK.BigMap.close();
    if (o || !level || level.id !== id) startOpts = o || {};
    level = TK.levelById(id);
    state = 'loading'; showroom.active = false;
    TK.Menu.show('loading'); TK.HUD.show(false); TK.audio.engineOn(false); TK.audio.init();
    // жүктөө экраны: деңгээлдин аты жана кокус кеңеш (тилке CSS анимациясы — курулуп жатканда да жылат)
    const tips = ['F — фото режим, G — дрон менен дүйнөнү учуп көрүңүз.', 'Аэропортто E басып самолётко отуруңуз: W — газ, Space — өйдө.', 'Гаражда тюнинг: кыймылдаткыч, турбо, дөңгөлөк, амортизатор, нитро.',
      'Чокулардагы түз жолдо ылдамдык алып, тик ылдыйдан учуп өтүңүз!', 'Ар 6 мүнөттө мезгил алмашат: жаз, жай, күз, кыш.', 'Тайыз сууда машина сууда жүрө алат, терең сууга кирбеңиз.',
      'M — чоң карта: каалаган жерди басып «БАРУУ».', 'Дарак, тосмо, конус — баары сынат, бирок машинаны бир аз жайлатат.', 'Space — кол тормоз: дрифт үчүн бурулуштан мурун басыңыз.'];
    const $l = id => document.getElementById(id);
    $l('ldName').textContent = level.name; $l('ldSub').textContent = level.sub || '';
    $l('ldTip').textContent = tips[(Math.random() * tips.length) | 0]; $l('ldStep').textContent = level.map === 'world' ? 'Арал, жолдор жана токойлор курулууда…' : 'Трасса курулууда…';
    const bar = document.querySelector('#scr-loading .ld-bar em'); if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    setTimeout(build, 120);
  }

  function build() {
    cleanup();
    const st = ST();
    map = TK.maps[level.map]({ scene, renderer, opts: { traffic: level.traffic } });
    env.setTime(timeFor(level), true);
    env.setWeather(level.type === 'free' ? (startOpts.weather || st.weather) : (level.weather || 'clear'), true);
    const spec = TK.Cars.byId[S().car];
    player = TK.Cars.make(S().car, S().paint[S().car] || TK.Cars.PAINTS[1][0]); player.baseHex = S().paint[S().car] || TK.Cars.PAINTS[1][0];
    scene.add(player.group);
    addCarExtras(player, spec);
    cockpit = TK.buildCockpit(spec); player.body.add(cockpit.group);
    stats = TK.Cars.tunedStats(S().car);
    let sp = level.spawn || map.spawn;
    if (sp === 'driftZone') sp = { x: map.driftZone.x, z: map.driftZone.z - map.driftZone.d / 2 + 14, h: 0 };
    if (sp && sp.road && map.roads && map.roads[sp.road]) { const r = map.roads[sp.road], i = clamp(Math.round(sp.t * (r.N - 1)), 0, r.N - 1); sp = { x: r.X[i], z: r.Z[i], h: Math.atan2(r.TX[i], r.TZ[i]) }; }
    car = TK.Physics.newCar(sp.x, sp.z, sp.h); car.hl = (spec.len || 4.4) / 2; car.hw = 0.95;
    car.n2o = 1; car.fuel = level.type === 'free' ? (S().fuel === undefined ? 40 : S().fuel) : 40; car.useFuel = level.type === 'free';
    cash = S().cash; best = S().bestDrift || 0;
    chainReset(); shake = 0; waterT = 0; gb.g = 1; gb.shiftT = 0; gb.rpm = IDLE; fuelWarned = false; nearMap.clear();
    mode = Modes[level.type](); mode.init();
    if (map.track && car.trackIdx === undefined) car.trackIdx = map.track.nearest(car.x, car.z);
    groundCar(); susp.y = 0; susp.v = 0; horizon.clearRec(); horizon.dirt = 0;
    map.onBreak = it => {
      shake = Math.max(shake, it.kind === 'tree' ? 0.4 : 0.12); TK.audio.beep(it.kind === 'tree' ? 90 : 300, 0.25, 'sawtooth', 0.25);
      if (it.kind === 'tree') { for (let k = 0; k < 22; k++) fx.spawn(it.autumn && k % 2 ? 'leafA' : 'leaf', it.x + (Math.random() - .5) * 3, it.y + 3 + Math.random() * 5, it.z + (Math.random() - .5) * 3, (Math.random() - .5) * 6, Math.random() * 3, (Math.random() - .5) * 6); earn(80, 'ДАРАК СЫНДЫ'); }
      else if (it.kind === 'board') { horizon.boardHit(it); earn(150, 'XP ТАКТА'); for (let k = 0; k < 14; k++) fx.spawn('spark', it.x, it.y + 2, it.z, (Math.random() - .5) * 8, 2 + Math.random() * 4, (Math.random() - .5) * 8); }
      else if (it.kind === 'fence') { earn(40, 'ТОСМО'); for (let k = 0; k < 8; k++) fx.spawn('dust', it.x, it.y + 0.5, it.z, (Math.random() - .5) * 4, 1 + Math.random() * 2, (Math.random() - .5) * 4); }
      else earn(30, 'КОНУС');
    };
    snapCamera();
    env.update(0.001, camera.position);
    TK.Menu.hideAll(); TK.HUD.show(true); TK.HUD.cash(cash, best); TK.HUD.scoreHide(); TK.HUD.prompt(null); TK.HUD.mode(tcOn);
    TK.HUD.level(S().lvl || 1, (S().xp || 0) / needXP(S().lvl || 1));
    if (!mode.dispose) mode.dispose = () => {};
    TK.input.clear(); fx.clear();
    if (mode.countdown) { state = 'countdown'; cdTimer = 3.2; cdLast = 4; } else state = 'play';
    TK.audio.engineOn(true); last = performance.now();
    if (level.type === 'free') TK.HUD.toast(level.name.toUpperCase(), 'M — карта · E — аракет · Shift — нитро · T — TC · C — камера', 3.5);
  }

  // машинага кошумча: көлөкө, выхлоп жалыны
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  function addCarExtras(p, spec) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.7, (spec.len || 4.4) + 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -3 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.06; p.group.add(sh); p.shadow = sh;
    const ex = spec.exhaust || [0.4, 0.3, -(spec.len || 4.4) / 2 - 0.1];
    p.flames = [1, -1].map(sx => {
      const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x66c8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s2.position.set(ex[0] * sx, ex[1], ex[2] - 0.25); s2.scale.set(0.6, 0.6, 1); s2.visible = false; p.body.add(s2); return s2;
    });
  }

  function endLevel(r) {
    if (state === 'result') return;
    state = 'result'; TK.audio.engineOn(false); TK.HUD.arrow(null);
    const rec = S(); const prev = rec.stars[level.id] || 0; let reward = 0;
    if (r.stars > prev) { reward = level.reward[r.stars - 1] - (prev > 0 ? level.reward[prev - 1] : 0); rec.stars[level.id] = r.stars; }
    else if (r.stars > 0) reward = Math.floor(level.reward[r.stars - 1] * 0.2);
    rec.cash += reward;
    addXP(250 + reward / 3);
    if (r.value !== null && r.value !== undefined) {
      rec.bestN = rec.bestN || {};
      const old = rec.bestN[level.id];
      if (old === undefined || (r.lower ? r.value < old : r.value > old)) { rec.bestN[level.id] = r.value; rec.best[level.id] = r.valueLabel; }
    }
    TK.save.commit();
    const i = TK.LEVELS.findIndex(l => l.id === level.id);
    TK.Menu.showResult({ win: r.win, title: r.title, sub: r.sub, stars: r.stars, lines: r.lines, reward, canNext: r.stars > 0 && i + 1 < TK.LEVELS.length && TK.Menu.unlocked(i + 1) });
  }

  function toMenu() {
    cleanup(); state = 'menu'; TK.HUD.show(false); TK.audio.engineOn(false); TK.input.clear();
    syncShowroom(); showroom.active = true; TK.Menu.show('main');
  }
  function pause() {
    if (state === 'play' || state === 'countdown') { state = 'pause'; TK.input.clear(); TK.Menu.show('pause'); TK.audio.engineOn(false); }
    else if (state === 'pause') resume();
  }
  function resume() { if (state !== 'pause') return; TK.Menu.hideAll(); state = 'play'; last = performance.now(); TK.audio.engineOn(true); }

  // ================= упай чынжыры (дрифт · ылдамдык · жакын өтүү) =================
  const chain = { pts: 0, time: 0, idle: 0, label: '', on: false, earnedNow: false };
  let tcOn = false, waterT = 0, fuelWarned = false, fuelSave = 0, popT = 0;
  const nearMap = new Map();
  const chainMult = () => 1 + Math.min(8, Math.floor(chain.time / 2)) * 0.5;
  function chainReset() { chain.pts = 0; chain.time = 0; chain.idle = 0; chain.on = false; }
  function earn(p, label) { chain.pts += p; chain.idle = 0; chain.on = true; chain.label = label; chain.earnedNow = true; }
  function chainBank() {
    if (!chain.on || chain.pts < 1) { chainReset(); return; }
    const total = Math.floor(chain.pts * chainMult()), cr = Math.max(1, Math.round(total / 10));
    S().cash += cr; cash = S().cash; if (total > best) { best = total; S().bestDrift = best; }
    TK.HUD.score(total, chainMult(), '+' + TK.HUD.fmt(cr) + ' CR', 1, 'bank'); TK.HUD.cash(cash, best, cr);
    if (mode && mode.onCombo) mode.onCombo(total);
    addXP(total / 4); chainReset();
  }
  function chainFail(silent) {
    if (chain.on && !silent) TK.HUD.score('КАГЫЛЫШ', chainMult(), 'упай күйдү', 0, 'fail');
    chainReset();
  }

  function snapCamera() {
    const s = Math.sin(car.h), c = Math.cos(car.h), y = gyAt(car.x, car.z);
    camPos.set(car.x - s * 6.4, y + 2.7, car.z - c * 6.4); camera.position.copy(camPos); camDir.set(s, c);
    lookAt.set(car.x + s * 3, y + 1.1, car.z + c * 3); camera.lookAt(lookAt);
  }

  // ================= башкы цикл =================
  const tmpV = new THREE.Vector3();
  /* ТИК ФИЗИКА: машина жерди гравитациядан тез "кача" албайт. Дөңдүн чокусунан ылдамдыкта өтсө же
     тик ылдыйга кирсе — абага учат, кайра гравитация менен конот (конгондо амортизатор кысылат). */
  // ===== суу эффекттери: дөңгөлөктөн чачыранды, кирерде чоң чачыранды, айланасына тараган толкун шакектери =====
  const ripples = [], ripMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const ripGeo = new THREE.RingGeometry(0.85, 1, 40); ripGeo.rotateX(-Math.PI / 2);
  let wasWater = false, ripT = 0, splAcc = 0;
  function waterFx(dt, inW, speed, s, c) {
    const sea = map && map.SEA !== undefined ? map.SEA : 0;
    if (inW && !wasWater && (speed > 5 || car.vy < -3)) {
      for (let k = 0; k < 50; k++) fx.spawn('splash', car.x + (Math.random() - .5) * 3, sea + 0.2, car.z + (Math.random() - .5) * 3, car.vx * 0.3 + (Math.random() - .5) * 8, 3 + Math.random() * 6 + speed * 0.12, car.vz * 0.3 + (Math.random() - .5) * 8);
      TK.audio.beep(120, 0.35, 'triangle', 0.25); shake = Math.max(shake, 0.25);
    }
    wasWater = inW;
    if (inW && speed > 1.5) {
      splAcc += dt * (8 + speed * 2.2);
      while (splAcc > 1) { splAcc--; const off = Math.random() < 0.5 ? 0.9 : -0.9, back = Math.random() < 0.6 ? -1.3 : 1.6;
        fx.spawn('splash', car.x - c * off + s * back, sea + 0.15, car.z + s * off + c * back, -c * off * 2.5 + car.vx * 0.25 + (Math.random() - .5) * 2, 1.5 + Math.random() * 2 + speed * 0.08, s * off * 2.5 + car.vz * 0.25 + (Math.random() - .5) * 2); }
      ripT -= dt;
      if (ripT <= 0) { ripT = Math.max(0.08, 0.3 - speed * 0.01);
        let r = ripples.find(q => !q.m.visible); if (!r && ripples.length < 40) { r = { m: new THREE.Mesh(ripGeo, ripMat.clone()) }; scene.add(r.m); ripples.push(r); }
        if (r) { r.t = 0; r.m.visible = true; r.m.position.set(car.x, sea + 0.05, car.z); r.grow = 3 + speed * 0.35; }
      }
    }
    for (const r of ripples) { if (!r.m.visible) continue; r.t += dt; const k = r.t / 1.8; if (k >= 1) { r.m.visible = false; continue; } r.m.scale.setScalar(1.2 + r.grow * k * 2.2); r.m.material.opacity = 0.55 * (1 - k); }
  }
  function land(gv) {            // конуу: дөңгөлөктөр кайра жерге тийди
    const hit = gv - car.vy; car.vy = gv;
    if (hit > 2.5) { susp.v -= Math.min(hit, 14) * 0.22; TK.audio.beep(70 + Math.random() * 30, 0.18, 'sine', Math.min(0.35, hit * 0.03)); }
    if (hit > 7) shake = Math.max(shake, Math.min(0.8, hit / 18));
    if (hit > 13) chainFail();
    if (hit > 8) { const k = 1 - Math.min(0.3, (hit - 8) * 0.025); car.vx *= k; car.vz *= k; }   // катуу конуу — ылдамдык азаят
    if (car.airT > 0.6 && level && level.type !== 'race') earn(Math.round(car.airT * 120), 'СЕКИРИК <em>' + car.airT.toFixed(1) + ' с</em>');
    car.lastHit = hit; car.airT = 0;
  }
  function vertical(h) {
    const gyN = gyAt(car.x, car.z), gr = grad(car.x, car.z);
    const gv = gr[0] * car.vx + gr[1] * car.vz;                  // жердин бетинин тик ылдамдыгы (машинанын астында)
    const above = car.y - gyN;
    if (above > 0.12) {                                           // абада
      car.vy -= 9.8 * h; car.y += car.vy * h; car.airT = (car.airT || 0) + h;
      if (car.y <= gyN) { car.y = gyN; land(gv); }
    } else if (car.airT > 0) { car.y = gyN; land(gv); }
    else {
      // жерде: машина бетти ээрчийт, бирок ылдыйга гравитациядан ылдам ылдамдана албайт
      const vyNew = Math.max(gv, car.vy - 9.8 * h);
      if (vyNew > gv + 0.01 && Math.hypot(car.vx, car.vz) > 9) { car.vy = vyNew; car.y = Math.max(gyN, car.y + car.vy * h); }
      else { car.vy = Math.min(gv, 0.7 * Math.hypot(car.vx, car.vz) + 2); car.y = gyN; }
    }
  }
  const susp = { y: 0, v: 0 };
  const orbit = { yaw: 0, pitch: 0, drag: false, rel: 0, lx: 0, ly: 0, id: null };
  canvas.addEventListener('pointerdown', e => { if (!(state === 'play' || state === 'countdown') || (e.pointerType === 'mouse' && e.button !== 0)) return; orbit.drag = true; orbit.id = e.pointerId; orbit.lx = e.clientX; orbit.ly = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} });
  canvas.addEventListener('pointermove', e => { if (!orbit.drag || e.pointerId !== orbit.id) return; orbit.yaw -= (e.clientX - orbit.lx) * 0.009; orbit.pitch = clamp(orbit.pitch + (e.clientY - orbit.ly) * 0.006, -0.25, 1.25); orbit.lx = e.clientX; orbit.ly = e.clientY; if (orbit.yaw > Math.PI) orbit.yaw -= 2 * Math.PI; if (orbit.yaw < -Math.PI) orbit.yaw += 2 * Math.PI; });
  const orbitEnd = e => { if (e.pointerId !== orbit.id) return; orbit.drag = false; orbit.rel = performance.now(); };
  canvas.addEventListener('pointerup', orbitEnd); canvas.addEventListener('pointercancel', orbitEnd);
  function groundCar() { car.y = gyAt(car.x, car.z); car.vy = 0; car.airT = 0; carY = car.y; }
  function playFrame(dt) {
    const running = state === 'play', st = ST();
    input = running && waterT <= 0 ? TK.input.read() : { gas: 0, brake: 0, hb: 0, steer: 0, n2o: 0 };
    // бензин
    if (car.useFuel && car.fuel <= 0) input.gas = 0;
    const n2oOn = running && input.n2o && car.n2o > 0.01 && input.gas;
    const S2 = n2oOn ? Object.assign({}, stats, { engine: stats.engine * 1.9, maxSpeed: stats.maxSpeed * 1.18 }) : stats;
    let lastSf = { grip: 1, drag: 0 };
    if (state === 'play' || state === 'countdown') {
      const sub = 4, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        const sf = map.surface(car);
        const gr0 = grad(car.x, car.z), sh0 = Math.sin(car.h), ch0 = Math.cos(car.h);
        const airborne = car.y - gyAt(car.x, car.z) > 0.12;
        if (airborne) sf.air = true;
        else if (map.groundY) { sf.slope = gr0[0] * sh0 + gr0[1] * ch0; sf.slopeL = gr0[0] * ch0 - gr0[1] * sh0; }
        if (tcOn) sf.tc = true;
        if (sf.dirt && stats.dirt) { sf.grip = Math.min(1, sf.grip + 0.18 * stats.dirt); sf.drag *= 1 - 0.6 * stats.dirt; }   // ралли/4x4 топуракта жакшы
        if (weather.wet) sf.grip *= 0.88;
        if (TK.SEASON.uSnow.value > 0.2 && !sf.water) sf.grip *= 1 - 0.15 * TK.SEASON.uSnow.value;   // кыш: кар, тайгак
        lastSf = sf;
        TK.Physics.step(car, gb.shiftT > 0 && input.gas ? Object.assign({}, input, { gas: 0 }) : input, h, S2, sf, map.collide.bind(map));
        vertical(h);
      }
    }
    if (state === 'countdown') {
      cdTimer -= dt; const n = Math.ceil(cdTimer);
      if (n !== cdLast && n <= 3) { cdLast = n; if (n > 0) { TK.HUD.count(String(n)); TK.audio.beep(520, 0.12, 'square', 0.2); } }
      if (cdTimer <= 0) { state = 'play'; TK.HUD.count('GO!'); TK.audio.beep(1040, 0.3, 'square', 0.25); }
    }
    if (state === 'play' || state === 'countdown') { map.update(dt, env.p); if (map.follow) map.follow(car.x, car.z); }

    const speed = Math.hypot(car.vx, car.vz), kmh = speed * 3.6;
    const driftAng = speed > 6 ? Math.atan2(Math.abs(car.vl), Math.abs(car.vf)) * 180 / Math.PI : 0;
    const drifting = running && driftAng > 12 && kmh > 25 && car.vf > 0;
    const s = Math.sin(car.h), c = Math.cos(car.h);

    // нитро
    if (n2oOn) car.n2o = Math.max(0, car.n2o - dt * 0.22 / (stats.n2oK || 1));
    else car.n2o = Math.min(1, car.n2o + dt * (drifting ? 0.06 : 0.012));
    // бензин
    if (car.useFuel && running) {
      car.fuel = Math.max(0, car.fuel - dt * (0.004 + 0.035 * input.gas * (0.3 + speed / stats.maxSpeed)) * (n2oOn ? 1.5 : 1));
      fuelSave -= dt; if (fuelSave <= 0) { S().fuel = car.fuel; TK.save.commit(); fuelSave = 5; }
      if (car.fuel < 6 && !fuelWarned && map.pois) {
        fuelWarned = true; TK.HUD.toast('БЕНЗИН АЗ', 'Жакынкы заправкага маршрут коюлду', 3);
        let best2 = null, bd = 1e12; map.pois.forEach(p => { if (p.type !== 'fuel') return; const d2 = Math.hypot(p.x - car.x, p.z - car.z); if (d2 < bd) { bd = d2; best2 = p; } });
        if (best2 && !route.waypoint) setRoute({ x: best2.x, z: best2.z }, true);
      }
    }
    // POI: заправка жана гараж
    const poi = map.poiAt && level.type === 'free' ? map.poiAt(car.x, car.z) : null;
    if (poi && poi.type === 'fuel') {
      if (speed < 4 && car.fuel < 39.9) { const add = Math.min(40 - car.fuel, 6 * dt); car.fuel += add; S().cash = Math.max(0, S().cash - add * 2); cash = S().cash; TK.HUD.cash(cash); TK.HUD.prompt('ЗАПРАВКА · бензин куюлууда · 2 CR/л'); if (car.fuel >= 39.9) { fuelWarned = false; S().fuel = 40; TK.save.commit(); } }
      else TK.HUD.prompt(car.fuel >= 39.9 ? 'ЗАПРАВКА · бак толук' : 'ЗАПРАВКА · токтосоңуз бензин куюлат');
    } else if (poi && poi.type === 'garage') TK.HUD.prompt('ГАРАЖ', 'КИРҮҮ (E)', enterGarage);
    else if (poi && poi.type === 'airport') TK.HUD.prompt('АЭРОПОРТ', '✈ САМОЛЁТКО ОТУРУУ (E)', enterPlane);
    else TK.HUD.prompt(null);

    // ылдамдык өлчөгүч дарбазалар (чокулардагы түз жолдун аягында)
    // Forza системасы: PR трюктар, XP такталар, барн файнд, кир, артка тартуу үчүн жазуу
    curSf = lastSf;
    if (running) horizon.update(dt, car, speed, !!lastSf.water, weather.wet, level.type === 'free');
    // экран эффекттери: ылдамдык сызыктары
    const sfx = document.getElementById('speedfx'); if (sfx) { const o = clamp((kmh - 150) / 120, 0, 0.75) + (n2oOn ? 0.25 : 0); if (Math.abs(o - (sfx._o || 0)) > 0.02) { sfx.style.opacity = o.toFixed(2); sfx._o = o; } }
    // суу
    if (waterT > 0) { waterT -= dt; car.vx *= 0.9; car.vz *= 0.9; if (waterT <= 0) { map.respawn(car); car.spin = 0; groundCar(); snapCamera(); } }
    else if (running && map.inWater && map.inWater(car)) {
      waterT = 1.3; chainFail(); TK.HUD.toast('СУУГА ТҮШТҮҢҮЗ', 'жакынкы жолго кайтарылат', 1.6); TK.audio.beep(160, 0.4, 'sawtooth', 0.3);
      for (let k = 0; k < 40; k++) fx.spawn('splash', car.x, (map.SEA || 0) + 0.2, car.z, (Math.random() - .5) * 8, 4 + Math.random() * 6, (Math.random() - .5) * 8);
    }

    // упай чынжыры
    if (car.impact > 5) { shake = Math.min(1, car.impact / 18); chainFail(); if (car.impact > 9) TK.audio.beep(110, 0.18, 'sawtooth', 0.3); }
    car.impact = 0;
    chain.earnedNow = false;
    if (drifting) earn(driftAng * speed * dt * 0.6, 'ДРИФТ <em>' + Math.round(driftAng) + '°</em>');
    else if (running && kmh > 140) earn((kmh - 140) * dt * 0.8, 'ЫЛДАМДЫК <em>' + Math.round(kmh) + '</em>');
    // жакын өтүү (трафик)
    if (running && kmh > 70 && map.trafficList) {
      for (const p of map.trafficList()) {
        const d = Math.hypot(p.x - car.x, p.z - car.z);
        if (d < 7) { const m = nearMap.get(p); nearMap.set(p, m === undefined ? d : Math.min(m, d)); }
        else if (nearMap.has(p)) { const m = nearMap.get(p); nearMap.delete(p); if (m > 3.35 && m < 5.2) { earn(250, 'ЖАКЫН ӨТҮҮ'); car.n2o = Math.min(1, car.n2o + 0.1); } }
      }
    }
    if (chain.on) {
      if (chain.earnedNow) chain.time += dt; else chain.idle += dt;
      TK.HUD.score(chain.pts, chainMult(), chain.label, 1 - chain.idle / 2.5, 'live');
      if (chain.idle > 2.5) chainBank();
    }
    TK.HUD.tick(dt);

    // издер, түтүн, чаң
    const slip = Math.abs(car.vl) > 3.2 || (input.hb && speed > 4) || (input.brake && car.vf > 12);
    if (running && slip && !lastSf.dirt && !lastSf.water) {
      skidDist += speed * dt;
      if (skidDist > 0.45) { skidDist = 0; [0.82, -0.82].forEach(off => dropSkid(car.x - c * off - s * 1.35, car.z + s * off - c * 1.35, car.h)); }
    }
    if (running && (drifting || (slip && speed > 8)) && !lastSf.dirt && !lastSf.water) {
      smokeAcc += dt * 34;
      while (smokeAcc > 1) { smokeAcc--; const off = Math.random() < 0.5 ? 0.85 : -0.85; fx.spawn('smoke', car.x - c * off - s * 1.4, carY + 0.35, car.z + s * off - c * 1.4, car.vx * 0.15 + (Math.random() - .5), 0.6 + Math.random() * 0.8, car.vz * 0.15 + (Math.random() - .5)); }
    }
    if (running && lastSf.dirt && speed > 5) {
      dustAcc += dt * (10 + speed * 1.2) * lastSf.dirt;
      while (dustAcc > 1) { dustAcc--; const off = Math.random() < 0.5 ? 0.85 : -0.85; fx.spawn('dust', car.x - c * off - s * 1.5, carY + 0.3, car.z + s * off - c * 1.5, -car.vx * 0.1 + (Math.random() - .5) * 2, 0.8 + Math.random(), -car.vz * 0.1 + (Math.random() - .5) * 2); }
    }

    // чөп басылат (дөңгөлөктөрдүн астында жатып калат, акырындап турат)
    if (map.press && (lastSf.dirt || lastSf.grip < 1) && !lastSf.water && car.y - gyAt(car.x, car.z) < 0.3 && (speed > 0.4 || running)) { map.press(car.x + s * 1.3, car.z + c * 1.3, 1.5); map.press(car.x - s * 1.3, car.z - c * 1.3, 1.5); }
    // суу: чачыранды, толкундар
    waterFx(dt, lastSf.water && car.y - gyAt(car.x, car.z) < 0.3, speed, s, c);

    // машинанын визуалы
    const gr = grad(car.x, car.z), inAir = car.y - gyAt(car.x, car.z) > 0.12;
    carY += (car.y - carY) * Math.min(1, dt * (inAir ? 60 : 20)); if (Math.abs(car.y - carY) > 3) carY = car.y;
    // эңкейиш: жерде — жердин бети боюнча; абада — учуу траекториясы боюнча
    const k8 = Math.min(1, dt * (inAir ? 2.5 : 7));
    const tF = inAir ? clamp(car.vy / Math.max(6, speed), -0.6, 0.5) : gr[0] * s + gr[1] * c, tL = inAir ? slopeLs * 0.9 : gr[0] * c - gr[1] * s;
    slopeFs += (tF - slopeFs) * k8; slopeLs += (tL - slopeLs) * k8;
    // амортизатор (серпилгич)
    susp.v += (-140 * susp.y - 11 * susp.v) * dt; susp.y += susp.v * dt; susp.y = clamp(susp.y, -0.28, 0.2);
    player.body.position.y = susp.y - (player.lowY || 0);
    const slopeF = slopeFs, slopeL = slopeLs;
    player.group.position.set(car.x, carY, car.z);
    player.group.rotation.set(-Math.atan(slopeF), car.h, Math.atan(slopeL), 'YXZ');
    player.body.rotation.z += (clamp(car.yaw * speed * 0.0045, -0.09, 0.09) - player.body.rotation.z) * Math.min(1, dt * 6);
    const pitch = (input.brake && car.vf > 2 ? 0.035 : (input.gas ? -0.02 - (n2oOn ? 0.02 : 0) : 0)) * (stats.pitch || 1);
    player.body.rotation.x += (pitch - susp.v * 0.02 - player.body.rotation.x) * Math.min(1, dt * 5);
    player.wheels.forEach(w => { w.spin.rotation.x = car.wheelRot; if (w.front) w.pivot.rotation.y = -car.steer * 0.5; });
    const braking = input.brake || input.hb;
    if (player.tailMat && player.tailMat.color) player.tailMat.color.setHex(braking ? 0xff2a1a : 0x8a0d0d);
    if (player.tailGlow) player.tailGlow.intensity = braking ? 1.6 : 0.4 * env.p.head;
    if (player.spot) player.spot.intensity = 3.4 * Math.max(env.p.head, env.wx.gray * 0.6);
    if (player.shadow) player.shadow.material.opacity = 0.55 * (1 - env.p.windows * 0.5) * (1 - env.wx.gray * 0.4);
    // выхлоп жалыны (нитро же газды коё бергенде "атуу")
    popT -= dt; if (running && !input.gas && speed > 18 && Math.random() < dt * 2.5) popT = 0.09;
    if (player.flames) player.flames.forEach(f => { const on = n2oOn || popT > 0; f.visible = on; if (on) { const k = 0.5 + Math.random() * 0.5; f.scale.set((n2oOn ? 1.1 : 0.7) * k, (n2oOn ? 1.1 : 0.7) * k, 1); f.material.color.setHex(n2oOn ? 0x66c8ff : 0xff9a3a); } });

    // камера
    // 360° камера: чычкандын сол баскычы (же манжа) менен сүйрөө. Коё бергенден 1.5 с кийин артка кайтат.
    if (!orbit.drag && performance.now() - orbit.rel > 1500) { const kd2 = Math.exp(-3 * dt); orbit.yaw *= kd2; orbit.pitch *= kd2; }
    const orbiting = Math.abs(orbit.yaw) > 0.01 || Math.abs(orbit.pitch) > 0.01 || orbit.drag;
    const cm = orbiting && st.camMode === 'hood' ? 'chase' : st.camMode;
    if (cockpit) cockpit.group.visible = cm === 'cockpit';
    const wantNear = cm === 'cockpit' ? 0.08 : 0.3; if (camera.near !== wantNear) { camera.near = wantNear; camera.updateProjectionMatrix(); }
    if (cm === 'cockpit' && cockpit) {
      // КАБИНАДАН: көз айдоочунун ордунда, машина менен бирге эңкейет; чычкан менен тартса башын бурат
      player.group.updateMatrixWorld(true);
      const e = cockpit.eye, b = player.body, ya = orbit.yaw * 1.4, pa = -orbit.pitch * 0.5;
      _ce.set(e.x, e.y + susp.y * 0.3, e.z); b.localToWorld(_ce); camera.position.copy(_ce);
      _ct.set(e.x + Math.sin(ya) * 10, e.y - 0.35 + pa * 10, e.z + Math.cos(ya) * 10); b.localToWorld(_ct);
      _cu.set(0, 1, 0).applyQuaternion(b.getWorldQuaternion(_cq)); camera.up.copy(_cu); camera.lookAt(_ct);
    } else if (cm === 'hood') {
      camera.up.set(0, 1, 0);
      camPos.set(car.x + s * 0.3, carY + 1.32, car.z + c * 0.3); camera.position.copy(camPos);
      lookAt.set(car.x + s * 20, carY + 1.0 + slopeF * 20, car.z + c * 20); camera.lookAt(lookAt);
    } else {
      camera.up.set(0, 1, 0);
      // камера машинага катуу байланган: ылдамдыкта бир аз гана алыстайт (макс. ~1 м)
      let dirX = s, dirZ = c;
      if (speed > 4) { const vx = car.vx / speed, vz = car.vz / speed; dirX = s * 0.7 + vx * 0.3; dirZ = c * 0.7 + vz * 0.3; }
      const L0 = Math.hypot(dirX, dirZ) || 1; dirX /= L0; dirZ /= L0;
      const kd = 1 - Math.exp(-7 * dt); camDir.x += (dirX - camDir.x) * kd; camDir.y += (dirZ - camDir.y) * kd; camDir.normalize();
      // учуп баратканда камера бир аз артка/өйдө чыгып, машинаны кадрда кармайт (учуу көрүнөт)
      camYs += ((car.airT > 0.25 ? 1 : 0) - camYs) * Math.min(1, dt * (car.airT > 0.25 ? 1.6 : 2.5));
      const far = cm === 'far' ? 1.45 : 1, back = (6.4 + Math.min(1, speed * 0.018)) * far * st.camDist * (1 + 0.45 * camYs);
      const oc = Math.cos(orbit.yaw), os = Math.sin(orbit.yaw), odx = camDir.x * oc - camDir.y * os, odz = camDir.x * os + camDir.y * oc;
      const ob = back * Math.cos(orbit.pitch * 0.9);
      camPos.x = car.x - odx * ob; camPos.z = car.z - odz * ob;
      const cy = carY + (2.7 + Math.min(0.4, speed * 0.006)) * far * (0.6 + 0.4 * st.camDist) + Math.sin(orbit.pitch) * back + 1.5 * camYs;
      camPos.y += (cy - camPos.y) * (1 - Math.exp(-(8 - 5.5 * camYs) * dt));
      const cgy = gyAt(camPos.x, camPos.z) + 1.4; if (camPos.y < cgy) camPos.y += (cgy - camPos.y) * Math.min(1, dt * 10);
      camera.position.copy(camPos);
      if (orbiting) lookAt.set(car.x, carY + 1.0, car.z); else lookAt.set(car.x + s * 3 * (1 - camYs), carY + 1.1 + slopeF * 3 * (1 - camYs), car.z + c * 3 * (1 - camYs));
      if (orbit.drag) camPos.y = Math.max(camPos.y, cy - 0.5), camera.position.y = Math.max(camera.position.y, gyAt(camera.position.x, camera.position.z) + 0.6);
      camera.lookAt(lookAt);
    }
    if (shake > 0) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake = Math.max(0, shake - dt * 2.5); }
    const fov = st.fov + clamp(speed / stats.maxSpeed, 0, 1) * 7 + (n2oOn ? 4 : 0) + (st.camMode === 'cockpit' ? 8 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }

    // HUD
    // кутуча: оборот = дөңгөлөктүн ылдамдыгы × берүүнүн катышы; 7100 айн/мүн жеткенде жогору, 2600дөн төмөн түшкөндө ылдый которот
    const K = UPSHIFT / (stats.maxSpeed * RATIOS[5]), v = Math.max(0, car.vf);
    let gearTxt, rpmT;
    if (gb.shiftT > 0) gb.shiftT -= dt;
    if (car.vf < -0.5) { gearTxt = 'R'; gb.g = 1; rpmT = Math.max(IDLE, (-car.vf) * K * 3.2) + input.brake * 400; }
    else {
      if (gb.shiftT <= 0) {
        const rNow = v * K * RATIOS[gb.g - 1];
        if (gb.g < 6 && rNow > (input.gas ? UPSHIFT : 5000)) { gb.g++; gb.shiftT = 0.24; TK.audio.beep && popT <= 0 && (popT = 0.06); }
        else if (gb.g > 1 && rNow < (input.gas ? 3400 : 2300) && v * K * RATIOS[gb.g - 2] < 6400) { gb.g--; gb.shiftT = 0.15; }
      }
      rpmT = Math.max(IDLE, v * K * RATIOS[gb.g - 1]);
      if (gb.g === 1 && input.gas) rpmT = Math.max(rpmT, IDLE + 2600 * Math.max(0, 1 - v / 6));   // илинишүү (сцепление)
      if (input.gas && (Math.abs(car.vl) > 4 || input.hb)) rpmT += 1400;                                                   // дөңгөлөк тайгаланат
      if (!input.gas && v < 1) rpmT = IDLE;
      gearTxt = v < 0.5 && !input.gas ? 'N' : String(gb.g);
    }
    if (rpmT > LIMIT) { gb.lim += dt; rpmT = LIMIT - (Math.sin(gb.lim * 60) > 0 ? 350 : 0); }     // чектегич
    if (car.useFuel && car.fuel <= 0) rpmT = IDLE * 0.5;
    gb.rpm += (rpmT - gb.rpm) * Math.min(1, dt * (gb.shiftT > 0 ? 9 : 16));
    const rpm = clamp((gb.rpm - IDLE) / (LIMIT - IDLE), 0, 1), g = gb.g;
    car.boost = (car.boost || 0) + ((input.gas ? 0.25 + rpm * 0.75 : 0.1) - (car.boost || 0)) * Math.min(1, dt * 4);
    if (running) { S().odo = (S().odo || 0) + speed * dt / 1000; }
    const mph = st.units === 'mph';
    if (cockpit && cockpit.group.visible) cockpit.update(dt, car.steer, kmh, gb.rpm / 10000, gearTxt);
    // кыймыл бүдөмүгү: ылдамдыкта четтери созулат, бурулганда капталга
    { const bk = [0, 0.6, 1.2][st.blur === undefined ? 1 : st.blur] || 0; blurZ = clamp((kmh - 70) / 230, 0, 1) * 0.05 * bk + (n2oOn ? 0.012 * bk : 0); blurS = clamp(-(car.yaw + car.spin) * speed * 0.00035, -0.012, 0.012) * bk; }
    TK.HUD.tacho({ rpm: gb.rpm / 10000, gear: gearTxt, odo: S().odo || 0, shifting: gb.shiftT > 0, speed: mph ? kmh * 0.621 : kmh, unit: mph ? 'mph' : 'km/h', n2o: car.n2o, n2oOn, boost: car.boost, tc: tcOn });
    TK.HUD.fuel(car.useFuel ? car.fuel / 40 : 1, car.useFuel ? car.fuel : null);
    TK.HUD.fps(st.showFps, dt);
    mode.update(dt);
    updateRoute(dt);
    TK.HUD.drawMap(map, car, (g2, px) => { drawRouteOverlay(g2, px); drawPois(g2, px); if (mode.overlay) mode.overlay(g2, px); }, clamp(300 + speed * 5, 300, 640), st.mapRotate);

    if (running || state === 'countdown') TK.audio.engine(rpm, g, input.gas, clamp((Math.abs(car.vl) - 2.5) / 8, 0, 1) * (speed > 5 && !lastSf.dirt ? 1 : 0), (stats.maxSpeed > 70 ? 1.15 : 1) * (n2oOn ? 1.08 : 1));
    seasonUpdate(dt, running);
    env.update(dt, camera.position);
    weather.update(dt, camera.position);
    fx.update(dt, 0.3 + 0.7 * (1 - env.p.windows * 0.8));
  }

  function enterGarage() { if (state !== 'play') return; S().fuel = car.fuel; TK.save.commit(); toMenu(); TK.Menu.show('garage'); }

  function frame(now) {
    requestAnimationFrame(frame);
    const cap = ST().fpsCap;
    if (cap && now - lastRender < 1000 / cap - 2) return;
    lastRender = now;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; t0 += dt;
    const rwHeld = state === 'play' && !plane.active && TK.input.read().rewind && horizon.recLen > 2;
    if (!rwHeld) rewindEnd();
    if (rwHeld) { rewindFrame(dt); renderer.render(scene, camera); }
    else if (state === 'play' && plane.active) { planeFrame(dt); const bk = [0, 0.6, 1.2][ST().blur === undefined ? 1 : ST().blur] || 0; postfx.render(scene, camera, clamp((plane.P.v * 3.6 - 150) / 300, 0, 1) * 0.04 * bk, 0); }
    else if (state === 'play' || state === 'countdown') { playFrame(dt); postfx.render(scene, camera, blurZ, blurS); }
    else if (state === 'photo') { env.update(dt, camera.position); weather.update(dt, camera.position); photo.update(dt); renderer.render(scene, camera); }
    else if (state === 'pause' || state === 'result' || state === 'map') { env.update(dt, camera.position); weather.update(dt, camera.position); renderer.render(scene, camera); }
    else if (state === 'menu') { showroom.update(dt); showroom.render(); }
  }

  // ================= шоу-рум менен байланыш =================
  function syncShowroom() {
    const id = S().car, paint = S().paint[id] || TK.Cars.PAINTS[1][0];
    if (showroomCarId !== id) { showroom.setCar(TK.Cars.make(id, paint)); showroomCarId = id; }
    else showroom.car.setPaint && showroom.car.setPaint(paint);
  }
  const H = TK.Menu.hooks;
  H.showroom = v => showroom.setView(v);
  H.preview = (id, paint) => {
    if (showroomCarId !== id) { showroom.setCar(TK.Cars.make(id, paint)); showroomCarId = id; }
    else showroom.car.setPaint && showroom.car.setPaint(paint);
  };
  H.isFree = () => !!level && level.type === 'free';
  H.curTime = () => env.preset;
  H.setTime = t => { env.setTime(t); S().settings.daytime = t; TK.save.commit(); };
  H.curWeather = () => env.weather;
  H.setWeather = w => { env.setWeather(w); ST().weather = w; TK.save.commit(); };
  H.settings = () => applySettings();
  H.plate = () => { showroomCarId = null; syncShowroom(); };
  H.rebuild = id => { const paint = S().paint[id] || TK.Cars.PAINTS[1][0]; showroom.setCar(TK.Cars.make(id, paint)); showroomCarId = id; };
  H.start = start; H.resume = resume; H.restart = () => start(level.id); H.toMenu = toMenu; H.quality = () => { applyQuality(); };
  H.next = () => { const i = TK.LEVELS.findIndex(l => l.id === level.id); start(TK.LEVELS[i + 1].id); };

  // ================= FORZA: PR трюктар, барн файнд, XP такталар, кир, артка тартуу =================
  let curSf = { grip: 1, drag: 0 }, rewindOn = false;
  const MUD = new THREE.Color(0x6b5236), _dc = new THREE.Color();
  const horizon = TK.Horizon({ map: () => map, earn: (p, l) => earn(p, l), addXP: v => addXP(v), surface: () => curSf,
    addCash: v => { S().cash += v; cash = S().cash; TK.HUD.cash(cash, best, v); },
    applyDirt: k => { if (!player || !player.mats || !player.mats.paint) return; if (Math.abs(k - (player._dirt || 0)) < 0.01) return; player._dirt = k;
      _dc.set(player.baseHex || '#d23a2e').lerp(MUD, k * 0.65); player.mats.paint.color.copy(_dc); if (player.mats.paintFlat) player.mats.paintFlat.color.copy(_dc); player.mats.paint.roughness = 0.34 + k * 0.5; } });
  function rewindFrame(dt) {
    if (!rewindOn) { rewindOn = true; document.body.classList.add('rewind'); chainFail(true); TK.audio.engineOn(false); }
    if (horizon.rewind(dt, car)) {
      carY = car.y; player.group.position.set(car.x, car.y, car.z); player.group.rotation.set(0, car.h, 0, 'YXZ');
      player.wheels.forEach(w => { if (w.front) w.pivot.rotation.y = -car.steer * 0.5; });
      snapCamera();
    }
    TK.HUD.drawMap(map, car, (g2, px) => { drawPois(g2, px); }, 400, ST().mapRotate);
    env.update(dt, camera.position); weather.update(dt, camera.position); fx.update(dt, 0.3 + 0.7 * (1 - env.p.windows * 0.8));
  }
  function rewindEnd() { if (!rewindOn) return; rewindOn = false; document.body.classList.remove('rewind'); TK.audio.engineOn(true); last = performance.now(); }

  // ================= МЕЗГИЛДЕР: ар 6 мүнөттө жаз → жай → күз → кыш =================
  // вектор: [кар, күз, жаз]
  const SEASONS = [['spring', 'ЖАЗ', '🌸', [0, 0, 1], 'гүлдөр ачылды, чөп жашылданды'], ['summer', 'ЖАЙ', '☀', [0, 0, 0], 'жылуу, ачык күндөр'], ['autumn', 'КҮЗ', '🍂', [0, 1, 0], 'жалбырактар саргайып түшүүдө'], ['winter', 'КЫШ', '❄', [1, 0.3, 0], 'кар жаап, жол тайгак']];
  const SEASON_LEN = 360, seasonCur = [0, 0, 0];
  let seasonIdx = -1, seasonSave = 0, leafAcc = 0;
  function seasonUpdate(dt, advance) {
    const st = ST(), world = map && map.id === 'world' && level && level.type === 'free';
    let idx, vec;
    if (!world) { idx = 1; vec = [0, 0, 0]; }
    else if (st.season && st.season !== 'auto') { idx = Math.max(0, SEASONS.findIndex(q => q[0] === st.season)); vec = SEASONS[idx][3]; }
    else {
      if (S().seasonT === undefined) S().seasonT = 30;
      if (advance) S().seasonT += dt;
      const YR = SEASON_LEN * 4, p = ((((S().seasonT || 0) % YR) + YR) % YR) / SEASON_LEN; idx = Math.min(3, Math.floor(p));
      const fr = (p - idx) * SEASON_LEN, w = clamp(fr / 25, 0, 1), ww = w * w * (3 - 2 * w), a = SEASONS[(idx + 3) % 4][3], b = SEASONS[idx][3];
      vec = a.map((v, i) => v + (b[i] - v) * ww);
    }
    const k = Math.min(1, dt * 0.6);
    for (let i = 0; i < 3; i++) seasonCur[i] += (vec[i] - seasonCur[i]) * (seasonIdx < 0 ? 1 : k);
    TK.SEASON.uSnow.value = seasonCur[0]; TK.SEASON.uAutumn.value = seasonCur[1]; TK.SEASON.uSpring.value = seasonCur[2];
    weather.setSnow(seasonCur[0] > 0.5 ? seasonCur[0] : 0);
    if (map && map.seasonal) map.seasonal(seasonCur);
    if (idx !== seasonIdx) {
      if (seasonIdx >= 0 && world) TK.HUD.toast(SEASONS[idx][2] + ' ' + SEASONS[idx][1] + ' КЕЛДИ', SEASONS[idx][4], 2.6);
      seasonIdx = idx; const ch = document.getElementById('seasonChip'); if (ch) { ch.hidden = !world; ch.textContent = SEASONS[idx][2] + ' ' + SEASONS[idx][1]; }
    }
    // күзүндө жалбырактар айланада учуп түшөт
    if (seasonCur[1] > 0.35 && advance) {
      leafAcc += dt * 16 * seasonCur[1];
      while (leafAcc > 1) { leafAcc--; const a = Math.random() * 6.283, d = 4 + Math.random() * 26, p = camera.position;
        fx.spawn(Math.random() < 0.5 ? 'leafF' : 'leafA', p.x + Math.cos(a) * d, p.y + 3 + Math.random() * 8, p.z + Math.sin(a) * d, 1.2 + Math.random() * 1.5, -0.4, (Math.random() - .5) * 1.5); }
    }
    seasonSave += dt; if (seasonSave > 10) { seasonSave = 0; TK.save.commit(); }
  }
  H.curSeason = () => ST().season || 'auto';
  H.setSeason = v => { ST().season = v; TK.save.commit(); };

  // ================= САМОЛЁТ =================
  const plane = TK.PlaneMode({ scene, camera, fx,
    airport: () => map && map.airport, groundY: (x, z) => (map ? map.groundY(x, z) : 0), inWater: (x, z) => map.groundY(x, z) < (map.SEA || 0) - 0.4,
    get sea() { return map ? map.SEA || 0 : 0; }, runway: (x, z) => !map.runway || map.runway(x, z), buildingAt: (x, z) => (map.buildingAt ? map.buildingAt(x, z) : 0),
    get bound() { return map ? (map.EXT || 2000) - 220 : 2000; }, shake: v => { shake = Math.max(shake, v); } });
  function enterPlane() {
    if (state !== 'play' || !map || !map.airport || plane.active) return;
    TK.HUD.prompt(null); setRoute(null); chainFail(true); plane.enter(); TK.audio.engineOn(true);
  }
  function exitPlane() {
    const P = plane.P; plane.exit();
    const sx = P.x - Math.cos(P.yaw) * 9, sz = P.z + Math.sin(P.yaw) * 9;
    Object.assign(car, { x: sx, z: sz, h: P.yaw, vx: 0, vz: 0, yaw: 0, spin: 0, vf: 0, vl: 0 }); groundCar(); snapCamera();
  }
  function planeFrame(dt) {
    const st = ST(), inp = TK.input.read();
    plane.update(dt, inp);
    const P = plane.P;
    if (Math.abs(camera.fov - st.fov - 4) > 0.05) { camera.fov += (st.fov + 4 - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    map.update(dt, env.p); if (map.follow) map.follow(P.x, P.z);
    TK.HUD.fps(st.showFps, dt);
    TK.HUD.drawMap(map, plane.proxy, (g2, px) => drawPois(g2, px), clamp(700 + P.v * 8, 700, 1800), st.mapRotate);
    TK.audio.engine(0.25 + P.thr * 0.6, 3, P.thr > 0.1, 0, 0.8);
    if (shake > 0) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake = Math.max(0, shake - dt * 2.5); }
    seasonUpdate(dt, true);
    env.update(dt, camera.position); weather.update(dt, camera.position); fx.update(dt, 0.3 + 0.7 * (1 - env.p.windows * 0.8));
  }
  H.plane = () => { if (state === 'pause') resume(); enterPlane(); };

  // ================= фото / дрон режими =================
  let photoFrom = 'play';
  const photo = TK.PhotoMode({ camera, renderer, canvas, scene, getCar: () => (plane.active ? plane.proxy : car), carY: () => (plane.active ? plane.P.y - 1.2 : carY),
    groundY: (x, z) => (map ? gyAt(x, z) : 0), bound: 1950,
    curTime: () => env.preset, curWeather: () => env.weather,
    setTime: t => H.setTime(t), setWeather: w => H.setWeather(w),
    onExit: () => { TK.HUD.show(true); last = performance.now(); snapCamera(); if (photoFrom === 'pause') { state = 'pause'; TK.Menu.show('pause'); } else { state = 'play'; TK.audio.engineOn(true); } } });
  function enterPhoto(m) {
    if (!(state === 'play' || state === 'pause') || !map) return;
    if (TK.BigMap.isOpen) TK.BigMap.close();
    photoFrom = state; state = 'photo'; TK.Menu.hideAll(); TK.HUD.show(false); TK.audio.engineOn(false); TK.input.clear(); photo.enter(m);
  }
  H.photo = m => enterPhoto(m);

  // ================= іске косуу =================
  if (S().spins === undefined) { S().spins = 1; TK.save.commit(); }   // биринчи wheelspin белек
  TK.HUD.init(); TK.input.bindTouch(); TK.Menu.init(); TK.BigMap.init();
  const I = TK.input.hooks;
  I.map = toggleMap;
  I.tc = () => { if (state !== 'play') return; tcOn = !tcOn; TK.HUD.mode(tcOn); TK.HUD.toast(tcOn ? 'TC КҮЙҮК' : 'TC ӨЧҮК', tcOn ? 'тайгалануу азаят' : 'SPORT режими · дрифт оңой', 1.2); };
  I.cam = () => { if (state !== 'play' && state !== 'countdown') return; const m = ['chase', 'far', 'hood', 'cockpit'], st = ST(); st.camMode = m[(m.indexOf(st.camMode) + 1) % m.length]; TK.save.commit(); TK.HUD.toast('КАМЕРА', { chase: 'артта', far: 'алыс', hood: 'капоттон', cockpit: 'кабинанын ичинен' }[st.camMode], 1); };
  I.photo = () => { if (state === 'play' || state === 'pause') enterPhoto('photo'); };
  I.drone = () => { if (state === 'play' || state === 'pause') enterPhoto('drone'); };
  I.action = () => {
    if (state !== 'play' || !map) return;
    if (plane.active) { if (!plane.P.air && plane.P.v < 8) exitPlane(); else TK.HUD.toast('САМОЛЁТ', 'түшүү үчүн жерге конуп токтоңуз', 1.4); return; }
    if (map.poiAt && level.type === 'free') { const p = map.poiAt(car.x, car.z); if (p && p.type === 'garage') enterGarage(); else if (p && p.type === 'airport') enterPlane(); }
  };
  I.pause = code => { if (TK.BigMap.isOpen) { TK.BigMap.close(); return; } pause(); };
  I.reset = () => { if (state === 'play' && plane.active) { plane.spawn(); return; } if (state === 'play' && map) { map.respawn(car); car.spin = 0; groundCar(); chainFail(true); snapCamera(); } };
  document.getElementById('mapBtn').addEventListener('click', toggleMap);
  document.getElementById('map').addEventListener('click', toggleMap);
  document.getElementById('camBtn').addEventListener('click', () => I.cam());
  document.getElementById('photoBtn').addEventListener('click', () => enterPhoto('photo'));
  document.getElementById('pauseBtn').addEventListener('click', pause);
  document.getElementById('reset').addEventListener('click', () => I.reset());
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); showroom.resize(innerWidth, innerHeight); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { TK.audio.suspend(); if (state === 'play') pause(); } else TK.audio.resume(); });
  syncShowroom(); showroom.active = true; showroom.resize(innerWidth, innerHeight);
  TK.Menu.show('main');
  requestAnimationFrame(frame);
  TK.game = {
    start, toMenu, get state() { return state; }, get car() { return car; }, get map() { return map; }, get mode() { return mode; }, get level() { return level; },
    setWaypoint(x, z) { setRoute({ x, z }, true); }, toggleMap,
    place(x, z, h, v) { Object.assign(car, { x, z, h, vx: Math.sin(h) * (v || 0), vz: Math.cos(h) * (v || 0), yaw: 0, spin: 0, steer: 0 }); groundCar(); snapCamera(); },
    env, weather, fx, showroom, photo, enterPhoto, plane, enterPlane, exitPlane, scene, camera, renderer, applySettings,
    get player() { return player; }, get gearbox() { return gb; }, get carY() { return carY; },
    _pf: dt => planeFrame(dt),
    debugStep(n, dt, inp) { for (let k = 0; k < n; k++) { if (inp) TK.input._force = inp(); playFrame(dt); } TK.input._force = null; }
  };
})();
