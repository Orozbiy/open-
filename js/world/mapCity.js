/* Карта 1: Түнкү/күндүзгү шаар (ачык дүйнө). Көчөлөр тор түрүндө, дрифт аянттары, транспорт, тоолор шакеги. */
(function () {
  TK.maps = TK.maps || {};
  const rnd = TK.util.rnd, clamp = TK.util.clamp;
  const P = 70, R = 18, N = 5, HALF = N * P, EDGE = HALF + R / 2 + 1.5;

  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,190,100,0.55)'); gr.addColorStop(0.45, 'rgba(255,160,70,0.18)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  TK.glowTexture = glowTexture;

  TK.maps.city = function (ctx) {
    const scene = ctx.scene, renderer = ctx.renderer, opts = ctx.opts || {};
    const group = new THREE.Group(); scene.add(group);
    const dummy = new THREE.Object3D();
    const boxes = [], mapBlocks = [], buildGeoms = [[], [], [], [], []], roofGeoms = [], awnGeoms = [], roofLights = [], lots = [], sidewalkPos = [];
    const rand = TK.util.seeded(20261025);   // шаар ар дайым бирдей
    const rr = (a, b) => a + rand() * (b - a);

    // жер
    const W = !!opts.world;   // чоң дүйнөнүн ичинде болсо — сырткы жер/тоолорду mapWorld курат
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(W ? HALF * 2 + 24 : HALF * 2 + 260, W ? HALF * 2 + 24 : HALF * 2 + 260), new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.82, metalness: 0.05 }));
    asphalt.rotation.x = -Math.PI / 2; group.add(asphalt);
    if (!W) {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x3f5a35 }));
    grass.rotation.x = -Math.PI / 2; grass.position.y = -0.25; group.add(grass);
    const mount = TK.Terrain.ring(560, 1350, 230, 11); group.add(mount);
    }

    function windowTexture(seedLit, wall, glass) {
      // 2 текстура: түс (дубал + терезе) жана жарык (күйүк терезелер)
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const e = document.createElement('canvas'); e.width = e.height = 256;
      const g = c.getContext('2d'), h = e.getContext('2d');
      g.fillStyle = wall || '#a3a9b8'; g.fillRect(0, 0, 256, 256); h.fillStyle = '#000'; h.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 8; y++) { g.fillStyle = glass ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.10)'; g.fillRect(0, y * 32 + 28, 256, glass ? 2 : 4); }
      if (glass) for (let x = 0; x < 8; x++) { g.fillStyle = 'rgba(20,30,50,.35)'; g.fillRect(x * 32, 0, 2, 256); }
      const lit = ['#ffd58a', '#ffe7b8', '#ffc36b', '#bfe3ff', '#ffe0a0'];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const on = rand() < seedLit, col = lit[(rand() * lit.length) | 0];
        g.fillStyle = on ? '#e9d8b0' : (glass ? (rand() < .5 ? '#5d86b0' : '#6f98c2') : (rand() < .5 ? '#2a3448' : '#344058'));
        if (glass) g.fillRect(x * 32 + 2, y * 32 + 2, 29, 25); else g.fillRect(x * 32 + 7, y * 32 + 8, 18, 17);
        if (on) { h.fillStyle = col; if (glass) h.fillRect(x * 32 + 2, y * 32 + 2, 29, 25); else h.fillRect(x * 32 + 7, y * 32 + 8, 18, 17); }
      }
      const mk = cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
      return { color: mk(c), em: mk(e) };
    }
    // ар түрдүү имараттар: тепкичтүү мунара, айнек небоскреб, тегерек мунара, тепкич-торт, кирпич үй, дүкөн
    const dark = 0x2a2d35;
    function roofBox(x, y, z, w, h, d) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); roofGeoms.push(g.toNonIndexed()); }
    function roofStuff(x, z, w, d, h) {
      const n = 1 + ((rand() * 3) | 0);
      for (let k = 0; k < n; k++) roofBox(x + (rand() - .5) * w * 0.6, h, z + (rand() - .5) * d * 0.6, 1.5 + rand() * 2, 1 + rand(), 1.5 + rand() * 2);   // кондиционерлер
      if (rand() < 0.3) { const g = new THREE.CylinderGeometry(1.3, 1.3, 2.6, 10); g.translate(x + w * 0.25, h + 2.6, z - d * 0.2); roofGeoms.push(g.toNonIndexed()); roofBox(x + w * 0.25, h, z - d * 0.2, 0.3, 1.3, 0.3); }   // суу багы
    }
    function cylBuilding(x, z, r, h, k) {
      const g = new THREE.CylinderGeometry(r, r, h, 12, 1), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) { const v = uv.getY(i); uv.setXY(i, uv.getX(i) * (r * 6.28 / 32), v * h / 28); }
      // капкактар (үстү/асты) — дубал түсү
      const capStart = 13 * 2; for (let i = capStart; i < uv.count; i++) uv.setXY(i, 0.001, 0.001);
      g.translate(x, h / 2, z); buildGeoms[k].push(g.toNonIndexed());
      roofBox(x, h, z, r * 0.9, 0.6, r * 0.9);
    }
    function styledBuilding(x, z, w, d, h) {
      const r = rand();
      if (h > 58 && r < 0.38) { addBuilding(x, z, w, d, h, 2); roofBox(x, h, z, w * 0.5, 2.5, d * 0.5); const a = new THREE.CylinderGeometry(0.15, 0.25, 12, 5); a.translate(x, h + 2.5 + 6, z); roofGeoms.push(a.toNonIndexed()); roofLights.push(new THREE.Vector3(x, h + 15, z)); return; }
      if (h > 40 && r < 0.62) { const h1 = h * 0.62; addBuilding(x, z, w, d, h1, 0); addBuilding(x, z, w * 0.7, d * 0.7, h - h1, 2, h1); roofStuff(x, z, w * 0.7, d * 0.7, h); return; }   // тепкичтүү мунара
      if (h > 30 && r < 0.78 && Math.abs(w - d) < 8) { cylBuilding(x, z, Math.min(w, d) / 2, h, rand() < 0.5 ? 2 : 1); return; }
      if (h < 17 && r < 0.55) {      // дүкөн: түстүү чатыр-тенти
        addBuilding(x, z, w, d, Math.max(6, h * 0.6), 3);
        const cols = [0xd23a2e, 0x1f5fd1, 0x2fa37a, 0xffb547];
        const a = new THREE.BoxGeometry(w * 0.95, 0.25, 2.4); a.rotateX(0.25); a.translate(x, 3.6, z + d / 2 + 1.1); awnGeoms.push([a.toNonIndexed(), cols[(rand() * 4) | 0]]);
        roofStuff(x, z, w, d, Math.max(6, h * 0.6)); return;
      }
      if (r < 0.3 && h > 18) { addBuilding(x, z, w, d, h * 0.45, 4); addBuilding(x, z, w * 0.78, d * 0.78, h * 0.3, 4, h * 0.45); addBuilding(x, z, w * 0.55, d * 0.55, h * 0.25, 4, h * 0.75); roofStuff(x, z, w * 0.55, d * 0.55, h); return; }   // тепкич-торт
      addBuilding(x, z, w, d, h, r < 0.6 ? 3 : (rand() < 0.5 ? 0 : 1)); roofStuff(x, z, w, d, h);
    }
    function addBuilding(x, z, w, d, h, k, y0) {
      const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
      const ou = ((rand() * 8) | 0) / 8, ov = ((rand() * 8) | 0) / 8;
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        if (f === 2 || f === 3) { uv.setXY(i, 0.001, 0.001); continue; }
        const su = (f < 2 ? d : w) / 32, sv = h / 28;
        uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
      }
      g.translate(x, (y0 || 0) + h / 2, z); buildGeoms[k === undefined ? (rand() < 0.5 ? 0 : 1) : k].push(g.toNonIndexed());
      if ((y0 || 0) + h > 55) roofLights.push(new THREE.Vector3(x, (y0 || 0) + h + 0.6, z));
    }
    for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) {
      const x0 = i * P + R / 2, x1 = (i + 1) * P - R / 2, z0 = j * P + R / 2, z1 = (j + 1) * P - R / 2;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const isLot = (i === 0 && j === 1) || (i === -2 && j === -3) || (i === 2 && j === -1) || (i === -4 && j === 2) || rand() < 0.05;
      if (isLot) { lots.push({ cx, cz, size: x1 - x0 }); mapBlocks.push({ x0, z0, x1, z1, lot: true }); continue; }
      sidewalkPos.push([cx, cz]);
      const inner = 3, gap = 1.2, bx0 = x0 + inner, bz0 = z0 + inner, bs = (x1 - x0) - inner * 2;
      const tall = 1 - clamp(Math.hypot(cx, cz) / HALF, 0, 1);
      const split = rand() < 0.55 ? 2 : 1, splitZ = rand() < 0.5 ? 2 : 1, cw = bs / split, cd = bs / splitZ;
      let maxH = 0;
      for (let a = 0; a < split; a++) for (let b = 0; b < splitZ; b++) { const hh = rr(10, 34) + tall * tall * rr(20, 95); maxH = Math.max(maxH, hh + 16); styledBuilding(bx0 + cw * (a + .5), bz0 + cd * (b + .5), cw - gap, cd - gap, hh); }
      boxes.push({ x0: bx0, z0: bz0, x1: bx0 + bs, z1: bz0 + bs, h: maxH }); mapBlocks.push({ x0, z0, x1, z1, lot: false });
    }
    const bMats = [];
    [[0.32, '#a3a9b8'], [0.22, '#b8b0a4'], [0.26, '#4a6f94', true], [0.3, '#9a5a44'], [0.24, '#d8cfb8']].forEach(([lit, wall, glass], k) => {
      if (!buildGeoms[k].length) return;
      const tex = windowTexture(lit, wall, glass);
      const mat = glass ? new THREE.MeshPhongMaterial({ map: tex.color, color: 0xffffff, specular: 0x8aa8c8, shininess: 90, emissive: 0xffffff, emissiveMap: tex.em, emissiveIntensity: 0.95 })
                        : new THREE.MeshLambertMaterial({ map: tex.color, color: 0xffffff, emissive: 0xffffff, emissiveMap: tex.em, emissiveIntensity: 0.95 });
      bMats.push(mat); group.add(new THREE.Mesh(TK.mergeGeoms(buildGeoms[k]), mat));
    });
    if (roofGeoms.length) group.add(new THREE.Mesh(TK.mergeGeoms(roofGeoms), TK.patchMat(new THREE.MeshLambertMaterial({ color: 0x5a5f6a }), { season: 'roof' })));
    const awnBy = {}; awnGeoms.forEach(([g, c]) => (awnBy[c] = awnBy[c] || []).push(g));
    Object.keys(awnBy).forEach(c => group.add(new THREE.Mesh(TK.mergeGeoms(awnBy[c]), new THREE.MeshLambertMaterial({ color: +c }))));

    const sw = new THREE.InstancedMesh(new THREE.BoxGeometry(P - R, 0.22, P - R), new THREE.MeshLambertMaterial({ color: 0x4a4f5b }), sidewalkPos.length);
    sidewalkPos.forEach(([x, z], k) => { dummy.position.set(x, 0.11, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); sw.setMatrixAt(k, dummy.matrix); });
    group.add(sw);

    const lotMat = new THREE.MeshStandardMaterial({ color: 0x2c2f37, roughness: 0.7 }), lineMat = new THREE.MeshBasicMaterial({ color: 0xd9dbe2 });
    const conePositions = [];
    lots.forEach(l => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(l.size, l.size), lotMat); m.rotation.x = -Math.PI / 2; m.position.set(l.cx, 0.02, l.cz); group.add(m);
      const ring = new THREE.Mesh(new THREE.RingGeometry(9.6, 10, 48), lineMat); ring.rotation.x = -Math.PI / 2; ring.position.set(l.cx, 0.03, l.cz); group.add(ring);
      for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; conePositions.push([l.cx + Math.cos(t) * 4, l.cz + Math.sin(t) * 4]); }
    });
    const coneGeo = new THREE.ConeGeometry(0.35, 0.9, 10); coneGeo.translate(0, 0.45, 0);
    const cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshLambertMaterial({ color: 0xff7a1a, emissive: 0x401800 }), Math.max(1, conePositions.length));
    const ownBreak = !ctx.breakables, brk = ctx.breakables || new TK.Breakables(scene);
    conePositions.forEach(([x, z], k) => {
      dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); cones.setMatrixAt(k, dummy.matrix);
      brk.add({ x, z, y: 0, r: 0.35, mesh: cones, index: k, scale: 1, rotY: 0, kind: 'cone' });
    });
    group.add(cones);

    const dashes = [];
    for (let k = -N; k <= N; k++) for (let s = -HALF; s < HALF; s += 8) {
      const local = ((s % P) + P) % P; if (local < R / 2 + 2 || local > P - R / 2 - 2) continue;
      dashes.push([k * P, s + 2, 0]); dashes.push([s + 2, k * P, 1]);
    }
    const dashMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 3.2), new THREE.MeshBasicMaterial({ color: 0xc9b88a }), dashes.length);
    dashes.forEach(([x, z, rot], k) => { dummy.position.set(x, 0.03, z); dummy.rotation.set(-Math.PI / 2, 0, rot ? Math.PI / 2 : 0); dummy.updateMatrix(); dashMesh.setMatrixAt(k, dummy.matrix); });
    group.add(dashMesh);

    // чырактар
    const lampSpots = [];
    for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) lampSpots.push([i * P + R / 2 + 0.8, j * P + R / 2 + 0.8]);
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 8, 6), new THREE.MeshLambertMaterial({ color: 0x2a2d35 }), lampSpots.length);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.25, 0.5), headMat, lampSpots.length);
    const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolMat, lampSpots.length);
    lampSpots.forEach(([x, z], k) => {
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.position.set(x, 4, z); dummy.updateMatrix(); poles.setMatrixAt(k, dummy.matrix);
      dummy.position.set(x - 0.6, 8, z - 0.6); dummy.rotation.y = Math.PI / 4; dummy.updateMatrix(); heads.setMatrixAt(k, dummy.matrix);
      dummy.position.set(x - 2.5, 0.05, z - 2.5); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(26, 26, 1); dummy.updateMatrix(); pools.setMatrixAt(k, dummy.matrix);
    });
    group.add(poles, heads, pools);

    const roofMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const roof = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), roofMat, Math.max(1, roofLights.length));
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    roofLights.forEach((p, k) => { dummy.position.copy(p); dummy.updateMatrix(); roof.setMatrixAt(k, dummy.matrix); });
    group.add(roof);

    const wallMat = new THREE.MeshLambertMaterial({ color: 0x3b3f4a, emissive: 0x2a1a06 });
    // чоң дүйнөдө шаардын чети бүт ачык (каалаган көчөдөн чыгып кетсе болот); жабык картада — дубал
    const walls = W ? [] : [[0, EDGE, EDGE * 2, 1.4], [0, -EDGE, EDGE * 2, 1.4], [EDGE, 0, 1.4, EDGE * 2], [-EDGE, 0, 1.4, EDGE * 2]];
    walls.forEach(([x, z, w, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), wallMat); m.position.set(x, 0.55, z); group.add(m);
      if (W) boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, wall: true });
    });
    // кооздоо: дарактар (тротуар боюнда эмес, шаардын сыртында)
    if (!W) {
      const spots = [], tr = TK.util.seeded(99);
      for (let i = 0; i < 260; i++) { const a = tr() * 6.283, r = EDGE + 25 + tr() * 170; spots.push([Math.cos(a) * r, -0.2, Math.sin(a) * r]); }
      group.add(TK.Terrain.pines(spots, tr));
    }

    // транспорт
    const TRAFFIC_COLORS = [0x5b6475, 0xa8adb8, 0x283a5c, 0x7a1e1e, 0x2d4a3a, 0xc9c3b5, 0x3e3e46];
    const traffic = [], lanes = [];
    const headBasic = new THREE.MeshBasicMaterial({ color: 0xfff4dc });
    for (let k = -N + 1; k < N; k++) [1, -1].forEach(dir => { lanes.push({ axis: 'z', k, dir }); lanes.push({ axis: 'x', k, dir }); });
    lanes.sort(() => rand() - .5);
    const nTraffic = opts.traffic === undefined ? 16 : opts.traffic;
    const tPoolMats = [];
    for (let n = 0; n < nTraffic && n < lanes.length; n++) {
      const L = lanes[n], g = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: TRAFFIC_COLORS[n % TRAFFIC_COLORS.length] });
      const isVan = rand() < 0.25;
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, isVan ? 1.6 : 0.7, isVan ? 4.8 : 4.3), mat); b1.position.y = isVan ? 1.15 : 0.7; g.add(b1);
      if (!isVan) { const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.1), new THREE.MeshLambertMaterial({ color: 0x10141c })); b2.position.set(0, 1.3, -0.2); g.add(b2); }
      const hl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.05), headBasic); hl.position.set(0, 0.75, isVan ? 2.42 : 2.17); g.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0xd01818 })); tl.position.set(0, 0.8, isVan ? -2.42 : -2.17); g.add(tl);
      const pm = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xfff0d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }); tPoolMats.push(pm);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(4, 10), pm); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.04, 6.5); g.add(pool);
      group.add(g);
      const lane = L.k * P + (L.axis === 'z' ? -4 * L.dir : 4 * L.dir);
      traffic.push({ g, axis: L.axis, lane, dir: L.dir, pos: rr(-HALF, HALF), speed: rr(9, 15), base: 0, stall: 0, len: isVan ? 2.45 : 2.2 });
    }
    traffic.forEach(t => t.base = t.speed);

    const map = {
      id: 'city', group, boxes, lots, traffic, size: HALF, P, N, R, EDGE, mapBlocks,
      spawn: { x: 0, z: -10, h: 0 },
      intersection(i, j) { return { x: i * P, z: j * P }; },
      surface() { return { grip: 1, drag: 0 }; },
      collide(car) {
        const P = TK.Physics;
        for (const b of boxes) {
          if (car.x > b.x0 - 4 && car.x < b.x1 + 4 && car.z > b.z0 - 4 && car.z < b.z1 + 4) P.hitBox(car, b.x0, b.z0, b.x1, b.z1);
        }
        for (const l of lampSpots) if (Math.abs(l[0] - car.x) < 4 && Math.abs(l[1] - car.z) < 4) P.hitCircle(car, l[0], l[1], 0.2, 0.2);
        if (ownBreak) brk.collide(car);
        if (W) return this.collideTraffic(car);
        const lim = EDGE - 2;
        if (car.x > lim) P.hitWall(car, lim + 1, 0, -1, 0); if (car.x < -lim) P.hitWall(car, -lim - 1, 0, 1, 0);
        if (car.z > lim) P.hitWall(car, 0, lim + 1, 0, -1); if (car.z < -lim) P.hitWall(car, 0, -lim - 1, 0, 1);
        this.collideTraffic(car);
      },
      collideTraffic(car) {
        for (const t of traffic) {
          const p = t.g.position;
          if (Math.abs(p.x - car.x) > 8 || Math.abs(p.z - car.z) > 8) continue;
          const v = TK.Physics.hitCar(car, p.x, p.z, t.g.rotation.y, t.len || 2.2, 0.3); if (v > 0.05) TK.knockTraffic(t, car, v, p.x, p.z);
        }
      },
      respawn(car) {
        let best = [0, 0], bd = 1e9;
        for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) { const d = Math.hypot(i * P - car.x, j * P - car.z); if (d < bd) { bd = d; best = [i * P, j * P]; } }
        car.x = best[0]; car.z = best[1]; car.vx = car.vz = car.yaw = 0;
      },
      update(dt, e) {
        if (ownBreak) brk.update(dt);
        bMats.forEach(m => { m.emissiveIntensity = 1.1 * e.windows; const k = 1 - 0.7 * e.windows; m.color.setRGB(k, k * 1.02, k * 1.08); });
        poolMat.opacity = e.lamps; pools.visible = e.lamps > 0.02;
        headMat.color.setRGB(0.32, 0.34, 0.38).lerp(new THREE.Color(0xffc46b), e.lamps);
        tPoolMats.forEach(m => m.opacity = 0.6 * e.head);
        for (const t of traffic) {
          const K = t.kv, kn = K && K.on;
          if (kn) { if (TK.knockStep(K, dt)) t.pos = rr(-HALF, HALF); }
          else { t.speed += (t.base - t.speed) * Math.min(1, dt); t.pos += t.dir * t.speed * dt; }
          if (t.pos > HALF) t.pos = -HALF; if (t.pos < -HALF) t.pos = HALF;
          const ox = kn ? K.ox : 0, oz = kn ? K.oz : 0, oy = kn ? K.oy : 0, ro = kn ? K.rot : 0, rl = kn ? K.roll : 0;
          if (t.axis === 'z') { t.g.position.set(t.lane + ox, oy, t.pos + oz); t.g.rotation.set(0, (t.dir > 0 ? 0 : Math.PI) + ro, rl, 'YXZ'); }
          else { t.g.position.set(t.pos + ox, oy, t.lane + oz); t.g.rotation.set(0, (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + ro, rl, 'YXZ'); }
        }
        roofMat.color.setHex(Math.sin(performance.now() / 330) > 0.3 ? 0xff2a2a : 0x3a0808);
      },
      drawMinimap(mg, car, overlay) {
        for (const b of mapBlocks) {
          if (Math.abs(b.x0 - car.x) > 260 || Math.abs(b.z0 - car.z) > 260) continue;
          mg.fillStyle = b.lot ? 'rgba(255,181,71,.35)' : 'rgba(150,160,185,.38)';
          mg.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
        }
        mg.fillStyle = 'rgba(220,225,235,.75)';
        for (const t of traffic) { const p = t.g.position; mg.fillRect(p.x - 2, p.z - 2, 4, 4); }
        if (overlay) overlay(mg);
      },
      dispose() { if (ownBreak) brk.dispose(); scene.remove(group); TK.util.disposeTree(group); }
    };
    return map;
  };
})();
