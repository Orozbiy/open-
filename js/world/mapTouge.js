/* Карта 2: Тоо жолу (touge). Жабык айлануучу жол, тоолор, карагайлар, тосмолор. Рақибдер ушул жол боюнча жарышат. */
(function () {
  TK.maps = TK.maps || {};
  const clamp = TK.util.clamp;
  const ROAD = 6.5, CURB = 7.7, SHOULDER = 10.4, WALL = 11.2;
  const CTRL = [[0, 0], [120, -30], [260, -20], [360, 60], [380, 180], [300, 260], [180, 230], [120, 300], [130, 420], [40, 500], [-90, 470], [-160, 380], [-120, 280], [-200, 200], [-300, 170], [-360, 60], [-300, -60], [-190, -100], [-100, -60]];

  function asphaltTexture(renderer) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d'); g.fillStyle = '#2b2d33'; g.fillRect(0, 0, 256, 256);
    const r = TK.util.seeded(5);
    for (let i = 0; i < 2600; i++) { const v = 30 + r() * 30; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    g.fillStyle = '#d8d8dc'; g.fillRect(10, 0, 5, 256); g.fillRect(241, 0, 5, 256);       // жээк сызыктары
    g.fillStyle = '#e0b84a'; g.fillRect(125, 20, 6, 90); g.fillRect(125, 148, 6, 90);      // ортоңку үзүк сызык
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }
  function curbTexture() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#d8d8dc'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#cc2b2b'; g.fillRect(0, 32, 32, 32);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  TK.maps.touge = function (ctx) {
    const scene = ctx.scene, renderer = ctx.renderer;
    const group = new THREE.Group(); scene.add(group);
    const curve = new THREE.CatmullRomCurve3(CTRL.map(p => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal');
    const NS = 1200, raw = curve.getSpacedPoints(NS);
    raw.pop();
    const n = raw.length, X = new Float32Array(n), Z = new Float32Array(n), TX = new Float32Array(n), TZ = new Float32Array(n), NX = new Float32Array(n), NZ = new Float32Array(n), K = new Float32Array(n);
    for (let i = 0; i < n; i++) { X[i] = raw[i].x; Z[i] = raw[i].z; }
    let len = 0; const seg = Math.hypot(X[1] - X[0], Z[1] - Z[0]);
    for (let i = 0; i < n; i++) {
      const a = (i + 1) % n, b = (i - 1 + n) % n;
      let tx = X[a] - X[b], tz = Z[a] - Z[b]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
      TX[i] = tx; TZ[i] = tz; NX[i] = -tz; NZ[i] = tx;           // сол жактагы нормаль
      len += Math.hypot(X[a] - X[i], Z[a] - Z[i]);
    }
    const ang = new Float32Array(n);
    for (let i = 0; i < n; i++) ang[i] = Math.atan2(TX[i], TZ[i]);
    const kr = new Float32Array(n);
    for (let i = 0; i < n; i++) { let d = ang[(i + 1) % n] - ang[i]; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; kr[i] = Math.abs(d) / (seg || 1.8); }
    for (let i = 0; i < n; i++) { let s = 0; for (let j = -10; j <= 10; j++) s += kr[(i + j + n) % n]; K[i] = s / 21; }

    // ---- жолдун бети ----
    function ribbon(a, b, y, vscale, mat, dbl) {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const k = i % n, v = i * seg / vscale;
        pos.push(X[k] + NX[k] * a, y, Z[k] + NZ[k] * a, X[k] + NX[k] * b, y, Z[k] + NZ[k] * b); uv.push(0, v, 1, v);
        if (i < n) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); return m;
    }
    const at = asphaltTexture(renderer);
    const roadMat = new THREE.MeshStandardMaterial({ map: at, roughness: 0.85, metalness: 0.04, side: THREE.DoubleSide });
    group.add(ribbon(-ROAD, ROAD, 0.03, 13, roadMat));
    const ct = curbTexture(), curbMat = new THREE.MeshLambertMaterial({ map: ct, side: THREE.DoubleSide });
    group.add(ribbon(ROAD, CURB, 0.05, 3, curbMat)); group.add(ribbon(-CURB, -ROAD, 0.05, 3, curbMat));
    const gravMat = new THREE.MeshLambertMaterial({ color: 0x5b5648, side: THREE.DoubleSide });
    group.add(ribbon(CURB, SHOULDER + 1.5, 0.02, 10, gravMat)); group.add(ribbon(-SHOULDER - 1.5, -CURB, 0.02, 10, gravMat));

    // ---- тосмолор ----
    const railMat = new THREE.MeshStandardMaterial({ color: 0xaab0ba, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
    [1, -1].forEach(s => {
      const pos = [], idx = [];
      for (let i = 0; i <= n; i++) { const k = i % n, ox = X[k] + NX[k] * WALL * s, oz = Z[k] + NZ[k] * WALL * s; pos.push(ox, 0.4, oz, ox, 0.95, oz); if (i < n) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      group.add(new THREE.Mesh(g, railMat));
    });
    const postN = Math.floor(n / 6) * 2, posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), new THREE.MeshLambertMaterial({ color: 0x70757e }), postN);
    const refl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0xffb040 }), postN);
    const d = new THREE.Object3D(); let pi = 0;
    for (let i = 0; i < n - 5 && pi < postN; i += 6) [1, -1].forEach(s => {
      if (pi >= postN) return;
      d.position.set(X[i] + NX[i] * WALL * s, 0.55, Z[i] + NZ[i] * WALL * s); d.rotation.y = Math.atan2(TX[i], TZ[i]); d.updateMatrix(); posts.setMatrixAt(pi, d.matrix);
      d.position.y = 0.85; d.position.x -= NX[i] * 0.1 * s; d.position.z -= NZ[i] * 0.1 * s; d.updateMatrix(); refl.setMatrixAt(pi, d.matrix); pi++;
    });
    group.add(posts, refl);

    // ---- жер (рельеф) ----
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < n; i++) { minX = Math.min(minX, X[i]); maxX = Math.max(maxX, X[i]); minZ = Math.min(minZ, Z[i]); maxZ = Math.max(maxZ, Z[i]); }
    const PAD = 560; minX -= PAD; maxX += PAD; minZ -= PAD; maxZ += PAD;
    const noise = TK.Terrain.makeNoise(17), STEP = 15;
    function dist2road(x, z) { let m = 1e12; for (let i = 0; i < n; i += 3) { const dx = x - X[i], dz = z - Z[i], dd = dx * dx + dz * dz; if (dd < m) m = dd; } return Math.sqrt(m); }
    const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    function hAt(x, z) {
      const dr = dist2road(x, z), ramp = smooth(34, 300, dr);
      const edge = Math.min(x - minX, maxX - x, z - minZ, maxZ - z), fade = smooth(0, 220, edge);
      const nz = noise(x * 0.004 + 10, z * 0.004 + 10), ridge = 1 - Math.abs(nz * 2 - 1);
      return -0.3 + ramp * fade * (30 + 210 * ridge * ridge) + (noise(x * 0.03, z * 0.03) - 0.5) * 9 * ramp;
    }
    const nx = Math.ceil((maxX - minX) / STEP), nz = Math.ceil((maxZ - minZ) / STEP), pos = [], col = [], idx = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = minX + i * STEP, z = minZ + j * STEP; pos.push(x, hAt(x, z), z); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1; idx.push(a, c, b, b, c, e); }
    let tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    tg = tg.toNonIndexed(); tg.computeVertexNormals();
    const TP = tg.attributes.position, TN = tg.attributes.normal;
    for (let i = 0; i < TP.count; i++) TK.Terrain.heightColor(TP.getY(i), Math.abs(TN.getY(i)), col);
    tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    group.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true })));
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ color: 0x3c5a34 }));
    grass.rotation.x = -Math.PI / 2; grass.position.y = -0.6; grass.position.set((minX + maxX) / 2, -0.6, (minZ + maxZ) / 2); group.add(grass);

    // карагайлар
    const tr = TK.util.seeded(31), spots = [];
    for (let tries = 0; tries < 5000 && spots.length < 1100; tries++) {
      const i = (tr() * n) | 0, s = tr() < 0.5 ? 1 : -1, off = WALL + 6 + Math.pow(tr(), 1.6) * 170;
      const x = X[i] + NX[i] * off * s + (tr() - .5) * 20, z = Z[i] + NZ[i] * off * s + (tr() - .5) * 20;
      if (dist2road(x, z) < WALL + 5) continue;
      const h = hAt(x, z); if (h > 70) continue;
      spots.push([x, h - 0.2, z]);
    }
    group.add(TK.Terrain.pines(spots, tr));

    // старт/финиш дарбазасы
    const gate = new THREE.Group(); const gm = new THREE.MeshLambertMaterial({ color: 0x2a2d35 });
    [1, -1].forEach(s => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), gm); p.position.set(NX[0] * (ROAD + 1.4) * s, 3.5, NZ[0] * (ROAD + 1.4) * s); gate.add(p); p.position.x += X[0]; p.position.z += Z[0]; });
    const bc = document.createElement('canvas'); bc.width = 512; bc.height = 96; const bg = bc.getContext('2d');
    bg.fillStyle = '#111'; bg.fillRect(0, 0, 512, 96); bg.fillStyle = '#ffb547'; bg.font = '800 54px Arial Black, Arial'; bg.textAlign = 'center'; bg.textBaseline = 'middle'; bg.fillText('СТАРТ · ФИНИШ', 256, 50);
    const bt = new THREE.CanvasTexture(bc), bannerMat = new THREE.MeshBasicMaterial({ map: bt, color: 0xffffff });
    const banner = new THREE.Mesh(new THREE.BoxGeometry((ROAD + 1.4) * 2, 1.6, 0.4), bannerMat); banner.position.set(X[0], 6.8, Z[0]); banner.rotation.y = Math.atan2(-TX[0], -TZ[0]); gate.add(banner);
    group.add(gate);
    const chk = document.createElement('canvas'); chk.width = chk.height = 64; const cg = chk.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { cg.fillStyle = (x + y) % 2 ? '#111' : '#eee'; cg.fillRect(x * 8, y * 8, 8, 8); }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD * 2, 2.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(chk) }));
    line.rotation.set(-Math.PI / 2, Math.atan2(-TX[0], -TZ[0]), 0, 'YXZ'); line.position.set(X[0], 0.07, Z[0]);
    group.add(line);

    function nearest(x, z, hint) {
      let best = 0, bd = 1e12, from = 0, to = n;
      if (hint !== undefined && hint >= 0) { from = hint - 40; to = hint + 40; }
      for (let q = from; q < to; q++) { const i = ((q % n) + n) % n, dx = x - X[i], dz = z - Z[i], dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = i; } }
      if (hint !== undefined && hint >= 0 && bd > 60 * 60) return nearest(x, z);
      return best;
    }
    const track = { n, X, Z, TX, TZ, NX, NZ, K, seg, length: len, ROAD, nearest, hAt };

    const map = {
      id: 'touge', viewR: 700, group, track,
      spawn: { x: X[0] - TX[0] * 6, z: Z[0] - TZ[0] * 6, h: Math.atan2(TX[0], TZ[0]) },
      surface(car) {
        const a = Math.abs(car.lat || 0);
        if (a <= ROAD) return { grip: 1, drag: 0 };
        if (a <= CURB) return { grip: 0.97, drag: 0.1 };
        if (a <= SHOULDER) return { grip: 0.7, drag: 0.5 };
        return { grip: 0.55, drag: 0.9 };
      },
      collide(car) {
        const i = nearest(car.x, car.z, car.trackIdx === undefined ? -1 : car.trackIdx); car.trackIdx = i;
        const lat = (car.x - X[i]) * NX[i] + (car.z - Z[i]) * NZ[i]; car.lat = lat;
        if (Math.abs(lat) > WALL - 3) { const sg = Math.sign(lat); TK.Physics.hitWall(car, X[i] + NX[i] * WALL * sg, Z[i] + NZ[i] * WALL * sg, -NX[i] * sg, -NZ[i] * sg); }
      },
      respawn(car) {
        const i = car.trackIdx === undefined ? 0 : car.trackIdx;
        car.x = X[i]; car.z = Z[i]; car.h = Math.atan2(TX[i], TZ[i]); car.vx = car.vz = car.yaw = 0; car.lat = 0;
      },
      update(dt, e) {
        bannerMat.color.setScalar(0.55 + e.windows * 0.45);
        roadMat.color.setScalar(1 + (1 - e.windows) * 0.35);
      },
      drawMinimap(mg, car, overlay) {
        mg.lineJoin = 'round'; mg.lineWidth = 16; mg.strokeStyle = 'rgba(190,198,220,.5)'; mg.beginPath();
        let started = false;
        for (let i = 0; i <= n; i += 4) { const k = i % n; if (!car.full && (Math.abs(X[k] - car.x) > 330 || Math.abs(Z[k] - car.z) > 330)) { started = false; continue; } if (!started) { mg.moveTo(X[k], Z[k]); started = true; } else mg.lineTo(X[k], Z[k]); }
        mg.stroke();
        mg.fillStyle = '#fff'; mg.fillRect(X[0] - 8, Z[0] - 3, 16, 6);
        if (overlay) overlay(mg);
      },
      dispose() { scene.remove(group); TK.util.disposeTree(group); }
    };
    return map;
  };
})();
