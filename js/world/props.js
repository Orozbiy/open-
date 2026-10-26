/* Жалпы куралдар: мейкиндик торчосу (тез издөө), сынуучу нерселер (дарак, конус) жана алардын кулашы. */
(function () {
  /* ---- мейкиндик торчосу ---- */
  function Grid(cell) { this.cell = cell; this.map = new Map(); }
  Grid.prototype.key = function (cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); };   // кагылышуусуз уникалдуу ачкыч
  Grid.prototype.add = function (x, z, item) {
    const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); } a.push(item);
  };
  Grid.prototype.near = function (x, z, fn) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = this.map.get(this.key(cx + i, cz + j)); if (a) for (let k = 0; k < a.length; k++) fn(a[k]); }
  };
  TK.Grid = Grid;

  /* ---- сынуучу нерселер ----
     item: { x, z, y, r, mesh(InstancedMesh), index, geo, mat, scale, rotY, kind:'tree'|'cone', alive } */
  function Breakables(scene) {
    this.scene = scene; this.grid = new Grid(16); this.items = []; this.falling = [];
    this.dummy = new THREE.Object3D(); this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.debris = TK.Debris(scene);
  }
  // strength — канча ылдамдыкта (м/с) сынат. Дарактар, тосмолор, конустар — баары сынат (0)
  Breakables.prototype.add = function (it) {
    it.alive = true;
    if (it.strength === undefined) it.strength = 0;
    this.items.push(it); this.grid.add(it.x, it.z, it);
  };
  Breakables.prototype.collide = function (car, onBreak) {
    this.grid.near(car.x, car.z, it => {
      if (!it.alive || Math.abs(it.x - car.x) > it.r + 4 || Math.abs(it.z - car.z) > it.r + 4) return;
      const v = TK.Physics.hitCircle(car, it.x, it.z, it.r, 0, 1, true);     // тийдиби? (текшерүү гана)
      if (!v) return;
      if (v >= it.strength) {
        const sp = Math.hypot(car.vx, car.vz);
        this.breakIt(it, car.vx, car.vz, sp, v);
        // сынган нерсе машинаны бир аз гана жайлатат (токтотпойт)
        const k = it.kind === "tree" ? 1 - Math.min(0.12, 0.03 + 0.045 * it.scale) : (it.kind === 'fence' ? 0.96 : 0.985);
        car.vx *= k; car.vz *= k;
        if (onBreak) onBreak(it, sp);
      } else TK.Physics.hitCircle(car, it.x, it.z, it.r, 0.15, 1);
    });
  };
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const rnd = () => Math.random() - 0.5;
  Breakables.prototype.breakIt = function (it, vx, vz, speed, impact) {
    it.alive = false;
    const imp = Math.max(impact || speed, 3);
    if (it.kind === 'tree') {
      // дарак 3 бөлүккө бөлүнөт: сөңгөк жана эки бутак/таажы — ар бири өзүнчө учат
      it.mesh.getColorAt && it.mesh.instanceColor && it.mesh.getColorAt(it.index, _c);
      it.mesh.setMatrixAt(it.index, this.zero); it.mesh.instanceMatrix.needsUpdate = true;
      const P = TK.treeParts(), tk = it.tkind || 'round', sc = it.scale;
      const crown = new THREE.MeshLambertMaterial({ color: it.mesh.instanceColor ? _c.clone() : 0x4a7a3c });
      P[tk].forEach((geo, k) => {
        const m = new THREE.Mesh(geo, k === 0 ? P.trunk : crown);
        m.position.set(it.x, it.y + P.off[tk][k] * sc, it.z); m.scale.setScalar(sc); m.rotation.y = it.rotY;
        const push = 0.45 + Math.random() * 0.45 + k * 0.12;
        const v = new THREE.Vector3(vx * push + rnd() * 4, 1.5 + k * 1.6 + imp * 0.12 + Math.random() * 2, vz * push + rnd() * 4);
        const w = new THREE.Vector3(rnd() * 4, rnd() * 3, rnd() * 4).multiplyScalar(1 + imp * 0.06);
        this.debris.add(m, v, w, 4.5 + Math.random(), (k === 0 ? 0.4 : 1.6) * sc);
      });
      return;
    }
    if (it.parts) {
      // жыгач тосмо: мамы жана тактайлар үзүлүп, урунуунун күчүнө жараша учат
      it.parts.forEach(([mesh, idx], k) => {
        mesh.getMatrixAt(idx, _m); _m.decompose(_p, _q, _s);
        mesh.setMatrixAt(idx, this.zero); mesh.instanceMatrix.needsUpdate = true;
        const m = new THREE.Mesh(mesh.geometry, mesh.material); m.position.copy(_p); m.quaternion.copy(_q); m.scale.copy(_s);
        const push = 0.55 + Math.random() * 0.6;
        const v = new THREE.Vector3(vx * push + rnd() * imp * 0.25, 1 + imp * (0.18 + Math.random() * 0.2), vz * push + rnd() * imp * 0.25);
        const w = new THREE.Vector3(rnd(), rnd(), rnd()).multiplyScalar(4 + imp * 0.6);
        this.debris.add(m, v, w, 6 + Math.random() * 2, 0.15);
      });
      return;
    }
    it.mesh.setMatrixAt(it.index, this.zero); it.mesh.instanceMatrix.needsUpdate = true;
    const m = new THREE.Mesh(it.mesh.geometry, it.mesh.material);
    m.position.set(it.x, it.y + 0.45, it.z); m.scale.setScalar(it.scale); m.rotation.y = it.rotY;
    this.debris.add(m, new THREE.Vector3(vx * 0.8 + rnd() * 3, 3 + speed * 0.18, vz * 0.8 + rnd() * 3), new THREE.Vector3(rnd() * 10, rnd() * 4, rnd() * 10), 5, 0.3);
  };
  Breakables.prototype.update = function (dt, groundY) { this.debris.update(dt, groundY); };
  Breakables.prototype.dispose = function () { this.debris.clear(); };
  TK.Breakables = Breakables;

  /* ---- дарак геометриялары ---- */
  const ni = g => (g.index ? g.toNonIndexed() : g);
  TK.treeGeoms = function () {
    const pine = TK.mergeGeoms([
      (() => { const g = new THREE.ConeGeometry(2.2, 6.5, 7); g.translate(0, 5.2, 0); return ni(g); })(),
      (() => { const g = new THREE.ConeGeometry(1.7, 5, 7); g.translate(0, 8, 0); return ni(g); })(),
      (() => { const g = new THREE.CylinderGeometry(.3, .4, 2.2, 5); g.translate(0, 1.1, 0); return ni(g); })()
    ]);
    const round = TK.mergeGeoms([
      (() => { const g = new THREE.IcosahedronGeometry(2.6, 0); g.translate(0, 5.2, 0); return ni(g); })(),
      (() => { const g = new THREE.IcosahedronGeometry(1.9, 0); g.translate(1.2, 6.4, 0.6); return ni(g); })(),
      (() => { const g = new THREE.CylinderGeometry(.28, .38, 3.4, 5); g.translate(0, 1.7, 0); return ni(g); })()
    ]);
    const tall = TK.mergeGeoms([     // бийик терек
      (() => { const g = new THREE.IcosahedronGeometry(1.6, 0); g.scale(1, 2.6, 1); g.translate(0, 7.5, 0); return ni(g); })(),
      (() => { const g = new THREE.CylinderGeometry(.22, .32, 4.5, 5); g.translate(0, 2.25, 0); return ni(g); })()
    ]);
    return { pine, round, tall };
  };

  /* ---- жалпы асфальт текстурасы ---- */
  TK.asphaltTexture = function (renderer, center) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d'); g.fillStyle = '#2b2d33'; g.fillRect(0, 0, 256, 256);
    const r = TK.util.seeded(5);
    for (let i = 0; i < 2600; i++) { const v = 30 + r() * 30; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    g.fillStyle = '#d8d8dc'; g.fillRect(10, 0, 5, 256); g.fillRect(241, 0, 5, 256);
    g.fillStyle = center || '#e0b84a'; g.fillRect(125, 20, 6, 90); g.fillRect(125, 148, 6, 90);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  };
})();

/* ---- трафик машинаны түртүү: урунганда ал жылып, айланып, катуу болсо учуп кетет; 6 сек кийин кайра жолго чыгат ---- */
(function () {
  TK.knockTraffic = function (t, car, hitV, tx, tz) {
    const K = t.kv || (t.kv = { x: 0, z: 0, y: 0, s: 0, ox: 0, oz: 0, oy: 0, rot: 0, roll: 0, t: 0, on: false });
    const dx = tx - car.x, dz = tz - car.z, L = Math.hypot(dx, dz) || 1;
    if (!K.on) { K.ox = K.oz = K.oy = K.rot = K.roll = 0; K.x = K.z = K.y = K.s = 0; }
    K.on = true; K.t = 0;
    const f = Math.min(1, hitV / 6);
    K.x += (car.vx * 0.55 + dx / L * hitV * 0.6) * f; K.z += (car.vz * 0.55 + dz / L * hitV * 0.6) * f;
    K.s += (Math.random() - 0.5) * hitV * 0.5;
    if (hitV > 13) { K.y = Math.max(K.y, (hitV - 10) * 0.45); K.rs = (Math.random() - 0.5) * hitV * 0.25; }
  };
  // true — түртүлүү бүттү (машина кайра жолго коюлат)
  TK.knockStep = function (K, dt) {
    K.t += dt;
    K.ox += K.x * dt; K.oz += K.z * dt; K.rot += K.s * dt;
    if (K.oy > 0 || K.y > 0) { K.y -= 9.8 * dt; K.oy += K.y * dt; K.roll += (K.rs || 0) * dt; if (K.oy <= 0) { K.oy = 0; K.y = K.y < -3 ? -K.y * 0.25 : 0; K.rs = (K.rs || 0) * 0.4; } }
    else { const fr = Math.exp(-1.6 * dt); K.x *= fr; K.z *= fr; K.s *= Math.exp(-2 * dt); K.roll *= Math.exp(-3 * dt); }
    if (K.t > 6) { K.on = false; K.ox = K.oz = K.oy = K.rot = K.roll = 0; return true; }
    return false;
  };
})();
