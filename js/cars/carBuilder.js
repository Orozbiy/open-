/* Машина куруучу.
   Кузов "loft" ыкмасы менен курулат: машинанын узундугу боюнча кесилиштер (станциялар) берилет,
   алардын ортосу жылмакай бет менен туташтырылат. Станциялардын мааниси сүрөттөн (көрүнүштөрдөн) алынат:
   [z, жарым-туурасы, төмөнкү бийиктик, жогорку бийиктик]  (z>0 — машинанын алды). */
(function () {
  const sg = v => (v < 0 ? -1 : 1);
  const GLASS = [0.07, 0.09, 0.12], PAINT = [1, 1, 1];

  function loft(sts, M, n, colorFn) {
    const S = sts.length, P = [], tri = [], tcol = [], e = 2 / n;
    for (let i = 0; i < S; i++) {
      const z = sts[i][0], hw = sts[i][1], yb = sts[i][2], yt = sts[i][3];
      const yc = (yb + yt) / 2, hh = (yt - yb) / 2;
      for (let k = 0; k < M; k++) {
        const th = k / M * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        P.push(hw * sg(c) * Math.pow(Math.abs(c), e), yc + hh * sg(s) * Math.pow(Math.abs(s), e), z);
      }
    }
    const a0 = S * M, a1 = S * M + 1;
    P.push(0, (sts[0][2] + sts[0][3]) / 2, sts[0][0]);
    P.push(0, (sts[S - 1][2] + sts[S - 1][3]) / 2, sts[S - 1][0]);
    for (let i = 0; i < S - 1; i++) for (let k = 0; k < M; k++) {
      const k2 = (k + 1) % M;
      const a = i * M + k, b = i * M + k2, c = (i + 1) * M + k, d = (i + 1) * M + k2;
      const col = colorFn(i, (k + 0.5) / M * Math.PI * 2);
      tri.push(a, c, b, b, c, d); tcol.push(col, col);
    }
    for (let k = 0; k < M; k++) {
      const k2 = (k + 1) % M;
      tri.push(a0, k, k2); tcol.push(PAINT);
      tri.push(a1, (S - 1) * M + k2, (S - 1) * M + k); tcol.push(PAINT);
    }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setIndex(tri);
    g.computeVertexNormals();
    g = g.toNonIndexed();
    const cols = new Float32Array(tri.length * 3);
    for (let t = 0; t < tri.length / 3; t++) for (let v = 0; v < 3; v++) { const c = tcol[t]; cols.set(c, (t * 3 + v) * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  }

  // Кузовдун кесилишинин туурасын (x) бул бийиктикте эсептөө — дөңгөлөк аркасы үчүн
  function sideX(sts, z, y, n) {
    let a = sts[0], b = sts[sts.length - 1];
    for (let i = 0; i < sts.length - 1; i++) if (z <= sts[i][0] && z >= sts[i + 1][0]) { a = sts[i]; b = sts[i + 1]; break; }
    const t = (a[0] - z) / ((a[0] - b[0]) || 1);
    const hw = a[1] + (b[1] - a[1]) * t, yb = a[2] + (b[2] - a[2]) * t, yt = a[3] + (b[3] - a[3]) * t;
    const u = Math.min(0.999, Math.abs((y - (yb + yt) / 2) / ((yt - yb) / 2)));
    return hw * Math.pow(1 - Math.pow(u, n), 1 / n);
  }

  function box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); if (parent) parent.add(m); return m;
  }
  function cyl(rt, rb, h, mat, x, y, z, parent, rot) {
    const g = new THREE.CylinderGeometry(rt, rb, h, 14);
    if (rot === 'x') g.rotateX(Math.PI / 2); else if (rot === 'z') g.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m;
  }

  function makeWheel(r, w, style, mats) {
    const spin = new THREE.Group();
    const tg = new THREE.CylinderGeometry(r, r, w, 22); tg.rotateZ(Math.PI / 2);
    spin.add(new THREE.Mesh(tg, mats.tire));
    const rg = new THREE.CylinderGeometry(r * 0.72, r * 0.72, w * 1.04, 20); rg.rotateZ(Math.PI / 2);
    spin.add(new THREE.Mesh(rg, style.dark ? mats.rimDark : mats.rim));
    const nsp = style.spokes || 5;
    for (let i = 0; i < nsp; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, r * 1.38, r * 0.15), mats.rimLight);
      sp.rotation.x = i / nsp * Math.PI * 2; spin.add(sp);
    }
    const cg = new THREE.CylinderGeometry(r * 0.2, r * 0.2, w * 1.16, 12); cg.rotateZ(Math.PI / 2);
    spin.add(new THREE.Mesh(cg, mats.dark));
    return spin;
  }

  function plateTexture(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 60);
    g.fillStyle = '#1f5fd1'; g.fillRect(4, 4, 34, 56); g.fillStyle = '#fff'; g.font = '700 16px Arial'; g.textAlign = 'center'; g.fillText('KG', 21, 52);
    g.fillStyle = '#ffcf26'; g.beginPath(); g.arc(21, 24, 8, 0, 6.3); g.fill();
    g.fillStyle = '#111'; g.font = '900 40px "Arial Narrow", Arial'; g.textBaseline = 'middle'; g.fillText(String(text).toUpperCase().slice(0, 9), 146, 34);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function build(spec, paintHex, style) {
    style = style || {};
    const ST = TK.Cars && TK.Cars.STYLE, opt = id => style[id] || 0, col = (id) => { const d = ST && ST.find(q => q.id === id); return d && d.cols ? d.cols[opt(id)] : 0; };
    const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
    const paint = new THREE.MeshStandardMaterial({ color: paintHex || '#d23a2e', metalness: 0.35, roughness: 0.34, vertexColors: true });
    const mats = {
      paint,
      dark: new THREE.MeshStandardMaterial({ color: 0x0d0f14, metalness: 0.2, roughness: 0.55 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 0.8, roughness: 0.25 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 }),
      rim: new THREE.MeshStandardMaterial({ color: 0x9aa0ab, metalness: 0.75, roughness: 0.3 }),
      rimLight: new THREE.MeshStandardMaterial({ color: 0xc9ced8, metalness: 0.8, roughness: 0.25 }),
      rimDark: new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0.6, roughness: 0.4 }),
      paintFlat: new THREE.MeshStandardMaterial({ color: paintHex || '#d23a2e', metalness: 0.35, roughness: 0.34 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
      head: new THREE.MeshBasicMaterial({ color: 0xfff4dc }),
      amber: new THREE.MeshBasicMaterial({ color: 0xffa21a }),
      tail: new THREE.MeshBasicMaterial({ color: 0x8a0d0d })
    };
    const tub = new THREE.Mesh(loft(spec.tub, 30, spec.nTub || 3.2, () => PAINT), paint);
    body.add(tub);
    if (spec.cabin) {
      const cs = spec.cabin;
      const gl = [GLASS, [0.035, 0.045, 0.06], [0.01, 0.012, 0.016]][opt('tint')] || GLASS;
      const cm = new THREE.Mesh(loft(cs, 24, spec.nCabin || 2.6, (i, th) => (cs[i][4] && cs[i + 1][4] && Math.sin(th) > 0.5) ? PAINT : gl), paint);
      body.add(cm);
    }
    // дөңгөлөктөр жана аркалары
    const W = spec.wheels, wheels = [];
    [[1, W.fz, W.fr, W.fw, true], [-1, W.fz, W.fr, W.fw, true], [1, -W.rz, W.rr, W.rw, false], [-1, -W.rz, W.rr, W.rw, false]].forEach(([sx, z, r, w, front]) => {
      const sxw = sideX(spec.tub, z, r, spec.nTub || 3.2);
      const x = sx * (sxw - w * 0.5 + (W.out || 0.05));
      const pivot = new THREE.Group(); pivot.position.set(x, r, z); group.add(pivot);
      const rs = [spec.rimStyle || {}, { spokes: 10 }, { spokes: 5, dark: true }, { spokes: 14 }, { spokes: 7 }][opt('rim')] || spec.rimStyle || {};
      const spin = makeWheel(r, w, rs, mats); pivot.add(spin);
      wheels.push({ pivot, spin, front });
      const arch = cyl(r + 0.075, r + 0.075, 0.03, mats.dark, sx * (sxw * 0.985), r + 0.02, z, group, 'z');
    });
    if (opt('rimCol')) { mats.rim.color.setHex(col('rimCol')); mats.rimLight.color.setHex(col('rimCol')); mats.rimDark.color.setHex(col('rimCol')); }
    const ctx = { group, body, mats, box: (w, h, d, m, x, y, z, p) => box(w, h, d, m, x, y, z, p || body), cyl: (a, b, h, m, x, y, z, p, rot) => cyl(a, b, h, m, x, y, z, p || body, rot) };
    if (spec.extras) spec.extras(ctx);
    // ----- жасалга -----
    const T = spec.tub, topAt = z => { for (let i = 0; i < T.length - 1; i++) if (z <= T[i][0] && z >= T[i + 1][0]) { const t = (T[i][0] - z) / ((T[i][0] - T[i + 1][0]) || 1); return T[i][3] + (T[i + 1][3] - T[i][3]) * t; } return T[T.length - 1][3]; };
    const zF = T[0][0], zR = T[T.length - 1][0], cab = spec.cabin || [], cabZ0 = cab.length ? cab[0][0] : 0, cabZ1 = cab.length ? cab[cab.length - 1][0] : 0;
    const wingY = cab.length ? Math.max(topAt(zR + 0.25) + 0.3, cab[cab.length - 1][3] - 0.05) : topAt(zR + 0.25) + 0.3;
    const sp = opt('spoiler');
    if (sp === 1) { const lip = ctx.box(1.5, 0.05, 0.22, mats.dark, 0, topAt(zR + 0.15) + 0.04, zR + 0.15); lip.rotation.x = -0.25; }
    if (sp >= 2) {
      const big = sp === 3, h = big ? 0.42 : 0.26, wz = zR + (big ? 0.32 : 0.28);
      ctx.box(big ? 1.95 : 1.75, 0.05, big ? 0.48 : 0.36, mats.dark, 0, topAt(wz) + h + 0.03, wz).rotation.x = 0.08;
      [1, -1].forEach(s => { ctx.box(0.06, h, 0.14, mats.dark, s * 0.55, topAt(wz) + h / 2, wz); ctx.box(0.04, 0.24, big ? 0.52 : 0.4, mats.dark, s * (big ? 0.98 : 0.88), topAt(wz) + h + 0.05, wz); });
    }
    const stp = opt('stripe');
    if (stp) {
      const sm = new THREE.MeshStandardMaterial({ color: stp === 3 ? 0x111111 : (col('stripeCol') || 0xf2f2f2), metalness: 0.2, roughness: 0.5 });
      for (let i = 0; i < T.length - 1; i++) {
        const z0 = T[i][0], z1 = T[i + 1][0]; if (stp === 3 && (z0 < cabZ0 || z1 < cabZ0)) continue;            // кара капот — алды гана
        const zc = (z0 + z1) / 2, L = Math.abs(z0 - z1), y = (T[i][3] + T[i + 1][3]) / 2 + 0.012, pitch = Math.atan2(T[i][3] - T[i + 1][3], z0 - z1);
        if (stp === 1) [0.17, -0.17].forEach(x => { if (zc < cabZ0 && zc > cabZ1) return; const b = ctx.box(0.17, 0.01, L + 0.02, sm, x, y, zc); b.rotation.x = -pitch; });
        if (stp === 3) { const b = ctx.box(Math.min(T[i][1], T[i + 1][1]) * 1.5, 0.01, L + 0.02, sm, 0, y, zc); b.rotation.x = -pitch; }
      }
      if (stp === 1) cab.forEach((c, i) => { if (i === cab.length - 1) return; const n = cab[i + 1], L = Math.abs(c[0] - n[0]), y = (c[3] + n[3]) / 2 + 0.012, pitch = Math.atan2(c[3] - n[3], c[0] - n[0]); [0.17, -0.17].forEach(x => { const b = ctx.box(0.17, 0.01, L + 0.02, sm, x, y, (c[0] + n[0]) / 2); b.rotation.x = -pitch; }); });
      if (stp === 2) [1, -1].forEach(s => { const W = Math.max(...T.map(t => t[1])); ctx.box(0.02, 0.09, (zF - zR) * 0.82, sm, s * (W + 0.005), (T[2][2] + T[2][3]) / 2 + 0.05, (zF + zR) / 2); });
    }
    const nc = col('neon');
    if (nc) {
      const c2 = document.createElement('canvas'); c2.width = c2.height = 64; const g2 = c2.getContext('2d'), gr = g2.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, (zF - zR) + 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c2), color: nc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.04; group.add(glow);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, (zF - zR) * 0.8), new THREE.MeshBasicMaterial({ color: nc })); bar.position.y = 0.16; group.add(bar);
    }
    const lowY = [0, 0.04, 0.08][opt('low')]; body.position.y = -lowY;
    // жарыктар
    const spot = new THREE.SpotLight(0xfff1d6, 2.4, 110, 0.55, 0.5, 1.0);
    spot.position.set(0, 0.8, spec.len / 2 - 0.2);
    const tgt = new THREE.Object3D(); tgt.position.set(0, 0, 22);
    group.add(spot, tgt); spot.target = tgt;
    const tailGlow = new THREE.PointLight(0xff2a1a, 0, 9, 2); tailGlow.position.set(0, 0.7, -spec.len / 2 - 0.4); group.add(tailGlow);
    // номер белгиси
    if (spec.plate) {
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshBasicMaterial({ map: plateTexture(TK.save.data.plate || 'KG 777 TK') }));
      pm.position.set(0, spec.plate[0], spec.plate[1]); pm.rotation.y = Math.PI; body.add(pm); mats.plate = pm.material;
    }
    const setPaint = hex => { mats.paint.color.set(hex); mats.paintFlat.color.set(hex); };
    return { group, body, wheels, mats, paint, setPaint, spot, tailGlow, tailMat: mats.tail, spec, lowY };
  }

  TK.CarBuilder = { loft, build, box, cyl, makeWheel, sideX, plateTexture };
})();
