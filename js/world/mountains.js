/* Тоолор жана бадалдар (low-poly). Жалпы жардамчылар. */
(function () {
  // жөнөкөй 2D шум (value noise) + fBm
  function makeNoise(seed) {
    const r = TK.util.seeded(seed), perm = new Float32Array(256 * 256);
    for (let i = 0; i < perm.length; i++) perm[i] = r();
    const at = (x, y) => perm[((y & 255) << 8) | (x & 255)];
    const sm = t => t * t * (3 - 2 * t);
    function n(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      const u = sm(xf), v = sm(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    return (x, y) => { let s = 0, a = 0.5, f = 1; for (let o = 0; o < 5; o++) { s += n(x * f, y * f) * a; f *= 2; a *= 0.5; } return s; };
  }

  const tint = (h, k) => { const c = new THREE.Color(h); c.multiplyScalar(k); return c; };
  function heightColor(h, slope, out) {
    // h: метр. жашыл → боз-күрөң → кар
    let c;
    if (h < 14) c = tint(0x44693a, 0.9 + slope * 0.1);
    else if (h < 60) c = new THREE.Color(0x44693a).lerp(new THREE.Color(0x6e6a5c), (h - 14) / 46);
    else if (h < 120) c = new THREE.Color(0x6e6a5c).lerp(new THREE.Color(0x8a8780), (h - 60) / 60);
    else c = new THREE.Color(0x8a8780).lerp(new THREE.Color(0xf1f4f8), Math.min(1, (h - 120) / 40));
    c.multiplyScalar(0.9 + slope * 0.25);
    out.push(c.r, c.g, c.b);
  }

  /* Шаардын айланасындагы тоолор шакеги */
  function ring(inner, outer, maxH, seed) {
    const noise = makeNoise(seed || 3), A = 160, Rr = 18, pos = [], col = [], idx = [];
    for (let j = 0; j <= Rr; j++) for (let i = 0; i < A; i++) {
      const t = j / Rr, r = inner + (outer - inner) * t, a = i / A * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const ramp = Math.pow(Math.sin(Math.min(1, t * 1.15) * Math.PI / 2), 1.4);
      const nz = noise(x * 0.0035 + 40, z * 0.0035 + 40);
      const ridge = 1 - Math.abs(nz * 2 - 1);
      const h = ramp * maxH * (0.25 + 0.95 * ridge * ridge) + (noise(x * 0.02, z * 0.02) - 0.5) * 14 * ramp - 0.5;
      pos.push(x, h, z);
    }
    for (let j = 0; j < Rr; j++) for (let i = 0; i < A; i++) {
      const a = j * A + i, b = j * A + (i + 1) % A, c = (j + 1) * A + i, d = (j + 1) * A + (i + 1) % A;
      idx.push(a, c, b, b, c, d);
    }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    g = g.toNonIndexed(); g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) heightColor(P.getY(i), Math.abs(N.getY(i)), col);
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  }

  /* Нокталар (карагайлар) — бир InstancedMesh */
  function pines(spots, rnd) {
    const g1 = new THREE.ConeGeometry(2.2, 6.5, 7); g1.translate(0, 5.2, 0);
    const g2 = new THREE.ConeGeometry(1.7, 5, 7); g2.translate(0, 8, 0);
    const g3 = new THREE.CylinderGeometry(.3, .4, 2, 5); g3.translate(0, 1, 0);
    const geo = TK.mergeGeoms([g1, g2, g3].map(g => g.toNonIndexed()));
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x2f5a35 }), spots.length);
    const d = new THREE.Object3D();
    spots.forEach((s, i) => { const k = 0.7 + rnd() * 0.9; d.position.set(s[0], s[1], s[2]); d.rotation.set(0, rnd() * 6, 0); d.scale.set(k, k * (0.9 + rnd() * 0.5), k); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    return m;
  }

  TK.mergeGeoms = function (list) {
    let count = 0; list.forEach(g => count += g.attributes.position.count);
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
    let o = 0;
    list.forEach(g => {
      pos.set(g.attributes.position.array, o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
    });
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return m;
  };
  TK.Terrain = { makeNoise, ring, pines, heightColor };
})();
