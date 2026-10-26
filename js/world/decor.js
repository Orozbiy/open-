/* Декор куруучулар: жел тегирмен, күн панели, жарнама тактасы, чатыр, тосмолор, бочка, жыгач тосмо,
   бурулуш белгиси, маяк, кайык, заправка, гараж, таш, бадал. Баары low-poly, көбү InstancedMesh. */
(function () {
  const D = new THREE.Object3D();
  function canvasText(lines, w, h, bg, fg, sub) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    if (Array.isArray(bg)) { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]); g.fillStyle = gr; } else g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${Math.round(h * (sub ? 0.42 : 0.55))}px "Arial Black", Arial, sans-serif`;
    g.fillText(lines, w / 2, h * (sub ? 0.4 : 0.52));
    if (sub) { g.font = `700 ${Math.round(h * 0.18)}px Arial, sans-serif`; g.globalAlpha = 0.85; g.fillText(sub, w / 2, h * 0.8); }
    g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = h * 0.04; g.strokeRect(0, 0, w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  const mat = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const box = (w, h, d, m, x, y, z, p) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (p) p.add(o); return o; };
  const cyl = (a, b, h, m, x, y, z, p, seg) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(a, b, h, seg || 10), m); o.position.set(x, y, z); if (p) p.add(o); return o; };

  const M = {};   // жалпы материалдар (бир жолу түзүлөт)
  function mats() {
    if (M.white) return M;
    M.white = mat(0xe8eaee); M.grey = mat(0x8c9097); M.dark = mat(0x2a2d35); M.red = mat(0xc62b2b); M.concrete = mat(0xb9b5ad);
    M.orange = mat(0xff7a1a, { emissive: 0x2a1000 }); M.wood = mat(0x7b5a3a); M.solar = new THREE.MeshStandardMaterial({ color: 0x1b2d5a, metalness: 0.6, roughness: 0.25 });
    M.glass = mat(0x9fd8ff, { emissive: 0x335577 }); M.rock = new THREE.MeshLambertMaterial({ color: 0x8a8780 });
    M.bush = new THREE.MeshLambertMaterial({ color: 0x4d7a35 }); M.palmLeaf = TK.patchMat(mat(0x3f8a3a), { wind: { amp: 0.02, minY: 6, speed: 1.4 } }); M.palmTrunk = mat(0x8b6b45);
    return M;
  }

  const Decor = {
    canvasText, mats,
    windTurbine(scale) {
      const m = mats(), g = new THREE.Group();
      cyl(0.9, 1.6, 60, m.white, 0, 30, 0, g, 12);
      box(2.2, 2.2, 5, m.white, 0, 61, 0.8, g);
      const rotor = new THREE.Group(); rotor.position.set(0, 61, 3.4); g.add(rotor);
      cyl(0.9, 0.9, 1.6, m.white, 0, 0, 0, rotor).rotation.x = Math.PI / 2;
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 0.3), m.white); b.geometry.translate(0, 13.5, 0); b.rotation.z = i * Math.PI * 2 / 3; rotor.add(b); }
      g.scale.setScalar(scale || 1);
      return { group: g, rotor };
    },
    solarField(list) {
      const m = mats(), panel = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 0.12, 3.2), m.solar, list.length);
      const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), m.grey, list.length);
      list.forEach(([x, y, z, ry], i) => {
        D.position.set(x, y + 1.8, z); D.rotation.set(-0.45, ry, 0, 'YXZ'); D.scale.set(1, 1, 1); D.updateMatrix(); panel.setMatrixAt(i, D.matrix);
        D.position.set(x, y + 0.8, z); D.rotation.set(0, ry, 0); D.updateMatrix(); legs.setMatrixAt(i, D.matrix);
      });
      return [panel, legs];
    },
    billboard(text, sub, bg, fg) {
      const m = mats(), g = new THREE.Group();
      cyl(0.25, 0.3, 9, m.dark, -4, 4.5, 0, g); cyl(0.25, 0.3, 9, m.dark, 4, 4.5, 0, g);
      const tex = canvasText(text, 512, 192, bg || ['#1d9e4b', '#0f6d35'], fg || '#fff', sub);
      const face = new THREE.MeshBasicMaterial({ map: tex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(12, 4.5, 0.3), [m.dark, m.dark, m.dark, m.dark, face, face]); b.position.y = 9.5; g.add(b);
      g.userData.face = face;
      return g;
    },
    canopy(w, d) {
      const m = mats(), g = new THREE.Group();
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(0.12, 0.12, 4, m.dark, a * w / 2, 2, b * d / 2, g));
      const roof = box(w + 0.6, 0.15, d + 0.6, mat(0xd7d9de, { side: THREE.DoubleSide }), 0, 4.1, 0, g); roof.rotation.x = 0.08;
      for (let i = -2; i <= 2; i++) box(0.12, 0.25, d + 0.6, m.dark, i * w / 4, 3.95, 0, g);
      return g;
    },
    jersey(list) {   // кызыл-ак бетон тосмолор
      const geo = new THREE.BoxGeometry(0.6, 0.85, 2.0); geo.translate(0, 0.42, 0);
      const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
      const cr = new THREE.Color(0xcc2a2a), cw = new THREE.Color(0xeeeeee), cc = new THREE.Color(0xb9b5ad);
      list.forEach(([x, y, z, ry, kind, len], i) => { D.position.set(x, y, z); D.rotation.set(0, ry, 0); D.scale.set(1, 1, (len || 2) / 2); D.updateMatrix(); im.setMatrixAt(i, D.matrix); im.setColorAt(i, kind === 'c' ? cc : (i % 2 ? cr : cw)); });
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      return im;
    },
    barrels(list) {
      const geo = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12); geo.translate(0, 0.55, 0);
      const im = new THREE.InstancedMesh(geo, mats().orange, list.length);
      list.forEach(([x, y, z], i) => { D.position.set(x, y, z); D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); D.updateMatrix(); im.setMatrixAt(i, D.matrix); });
      return im;
    },
    fence(segs) {    // segs: [x0,y0,z0,x1,y1,z1]
      const m = mats(), posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), m.wood, segs.length);
      const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.14, 1), m.wood, segs.length * 2);
      segs.forEach(([x0, y0, z0, x1, y1, z1], i) => {
        D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); D.position.set(x0, y0 + 0.6, z0); D.updateMatrix(); posts.setMatrixAt(i, D.matrix);
        const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), pitch = Math.atan2(y1 - y0, L);
        [0.55, 1.0].forEach((h, k) => { D.position.set((x0 + x1) / 2, (y0 + y1) / 2 + h, (z0 + z1) / 2); D.rotation.set(-pitch, ry, 0, 'YXZ'); D.scale.set(1, 1, L); D.updateMatrix(); rails.setMatrixAt(i * 2 + k, D.matrix); });
      });
      return [posts, rails];
    },
    chevrons(list) {   // [x,y,z,ry,dir]
      const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#c62020'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(34, 18); g.lineTo(76, 64); g.lineTo(34, 110); g.lineTo(56, 110); g.lineTo(98, 64); g.lineTo(56, 18); g.closePath(); g.fill();
      const face = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide });
      const board = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.1), face, list.length);
      const pole = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), mats().grey, list.length);
      list.forEach(([x, y, z, ry, dir], i) => {
        D.position.set(x, y + 0.8, z); D.rotation.set(0, ry, 0); D.scale.set(1, 1, 1); D.updateMatrix(); pole.setMatrixAt(i, D.matrix);
        D.position.y = y + 1.8; D.scale.set(dir, 1, 1); D.updateMatrix(); board.setMatrixAt(i, D.matrix);
      });
      return [board, pole];
    },
    lighthouse() {
      const g = new THREE.Group(), m = mats();
      for (let i = 0; i < 6; i++) cyl(2.6 - i * 0.2, 2.8 - i * 0.2, 4, i % 2 ? m.red : m.white, 0, 2 + i * 4, 0, g, 14);
      cyl(1.8, 1.8, 2.4, m.glass, 0, 25.2, 0, g, 12); cyl(0.3, 2.2, 1.6, m.red, 0, 27.2, 0, g, 12);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 120, 16, 1, true), beamMat); beam.geometry.translate(0, -60, 0); beam.rotation.z = Math.PI / 2;
      const piv = new THREE.Group(); piv.position.y = 25.2; piv.add(beam); g.add(piv);
      return { group: g, piv, beamMat };
    },
    boat(color) {
      const g = new THREE.Group(), m = mats();
      const hull = box(3.2, 1.3, 9, mat(color || 0xf0f0f0), 0, 0.3, 0, g); hull.scale.set(1, 1, 1);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 4), mat(color || 0xf0f0f0)); bow.rotation.set(Math.PI / 2, Math.PI / 4, 0); bow.position.set(0, 0.3, 5.8); bow.scale.set(1, 1, 0.55); g.add(bow);
      box(2.4, 1.6, 3.2, m.white, 0, 1.7, -1, g); box(2.42, 0.5, 3.0, mat(0x223344), 0, 2.1, -1, g);
      return g;
    },
    gasStation() {
      const g = new THREE.Group(), m = mats();
      [[-6, -4], [6, -4], [-6, 4], [6, 4]].forEach(([x, z]) => cyl(0.3, 0.3, 5.5, m.white, x, 2.75, z, g));
      box(16, 0.8, 12, mat(0x1d7fd6), 0, 5.8, 0, g);
      box(16.2, 0.3, 12.2, m.white, 0, 5.3, 0, g);
      [[-3, 0], [3, 0]].forEach(([x, z]) => { box(1, 1.6, 0.7, m.red, x, 0.8, z, g); box(1.05, 0.3, 0.75, m.white, x, 1.45, z, g); });
      const s = Decor.billboard('ЗАПРАВКА', '92 · 95 · 98', ['#1d7fd6', '#0b4f91'], '#fff'); s.scale.setScalar(0.6); s.position.set(-11, 0, 0); s.rotation.y = Math.PI / 2; g.add(s);
      box(12, 4, 8, mat(0xdfe3e8), 0, 2, -14, g); box(12.2, 0.4, 8.2, mat(0x1d7fd6), 0, 4.2, -14, g); box(6, 2, 0.1, m.glass, 0, 1.8, -9.95, g);
      return g;
    },
    garage() {
      const g = new THREE.Group(), m = mats();
      box(18, 7, 14, mat(0x3a3f4a), 0, 3.5, -4, g);
      box(18.4, 0.5, 14.4, mat(0xffb547), 0, 7.2, -4, g);
      box(8, 5, 0.2, mat(0x1a1d24), 0, 2.5, 3.05, g);
      const s = Decor.billboard('ГАРАЖ', 'тюнинг · боёк · машиналар', ['#ffb547', '#e08a1c'], '#1a1205'); s.scale.setScalar(0.55); s.position.set(0, 4.2, 3.6); g.add(s);
      return g;
    },
    rocks(list) {
      const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mats().rock, list.length);
      list.forEach(([x, y, z, s, ry], i) => { D.position.set(x, y + s * 0.3, z); D.rotation.set(ry, ry * 2, 0); D.scale.set(s * 1.3, s * 0.8, s); D.updateMatrix(); im.setMatrixAt(i, D.matrix); });
      return im;
    },
    bushes(list) {
      const geo = new THREE.IcosahedronGeometry(0.9, 0); geo.translate(0, 0.5, 0);
      const im = new THREE.InstancedMesh(geo, TK.patchMat(new THREE.MeshLambertMaterial({ color: 0xffffff }), { wind: { amp: 0.05, minY: 0.2, speed: 2 }, season: 'tree' }), list.length);
      const cs = [0x4d7a35, 0x6a8a3a, 0x8a7a34, 0xa3562b, 0x3f6a32].map(c => new THREE.Color(c));
      list.forEach(([x, y, z, s], i) => { D.position.set(x, y, z); D.rotation.set(0, s * 7, 0); D.scale.set(s, s * 0.7, s); D.updateMatrix(); im.setMatrixAt(i, D.matrix); im.setColorAt(i, cs[i % cs.length]); });
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      return im;
    },
    palms(list) {   // [x,y,z,s] → [ствол, жалбырактар]
      const t = new THREE.CylinderGeometry(0.22, 0.38, 9, 6); t.translate(0, 4.5, 0);
      const parts = [];
      for (let i = 0; i < 7; i++) { const l = new THREE.BoxGeometry(0.9, 0.1, 4.2); l.translate(0, 0, 2.1); l.rotateX(0.4); l.rotateY(i * Math.PI * 2 / 7); l.translate(0, 9, 0); parts.push(l.toNonIndexed()); }
      const trunk = new THREE.InstancedMesh(t, mats().palmTrunk, list.length), leaves = new THREE.InstancedMesh(TK.mergeGeoms(parts), mats().palmLeaf, list.length);
      list.forEach(([x, y, z, s], i) => { D.position.set(x, y, z); D.rotation.set(0.06 * Math.sin(i), i, 0.06 * Math.cos(i)); D.scale.set(s, s, s); D.updateMatrix(); trunk.setMatrixAt(i, D.matrix); leaves.setMatrixAt(i, D.matrix); });
      return [trunk, leaves];
    }
  };
  // ЧОҢ ГҮЛДӨР: сабагы + түстүү башы (instance түстөрү); list: [x,y,z,scale,colorIndex]
  Decor.flowers = function (list) {
    const stemG = new THREE.CylinderGeometry(0.03, 0.04, 1, 4); stemG.translate(0, 0.5, 0);
    const headG = new THREE.IcosahedronGeometry(0.3, 0); headG.scale(1, 0.6, 1);
    const stems = new THREE.InstancedMesh(stemG, new THREE.MeshLambertMaterial({ color: 0x3f7a2e }), list.length);
    const heads = new THREE.InstancedMesh(headG, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x111111 }), list.length);
    const cols = [0xe8344a, 0xffd23f, 0xffffff, 0x9b5de5, 0xff7b29, 0xff8fc6, 0x4cc9f0].map(c => new THREE.Color(c));
    list.forEach(([x, y, z, sc, ci], i) => {
      D.rotation.set(0, 0, 0); D.position.set(x, y, z); D.scale.set(sc, sc, sc); D.updateMatrix(); stems.setMatrixAt(i, D.matrix);
      D.position.set(x, y + sc, z); D.rotation.set(0.2 * Math.sin(i), i, 0); D.scale.set(sc * 1.4, sc * 1.4, sc * 1.4); D.updateMatrix(); heads.setMatrixAt(i, D.matrix);
      heads.setColorAt(i, cols[ci % cols.length]);
    });
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    return [stems, heads];
  };
  // чөп түптөрү (кайчылаш тегиз беттер — арзан)
  let grassMat = null;
  Decor.grass = function (list, cap) {
    // 3 кайчылаш бет, бийик жана жыш чөп (текстурада 70 сабак)
    const p1 = new THREE.PlaneGeometry(1.9, 1.15); p1.translate(0, 0.56, 0); const p2 = p1.clone(); p2.rotateY(Math.PI / 3); const p3 = p1.clone(); p3.rotateY(-Math.PI / 3);
    const geo = TK.mergeGeoms([p1.toNonIndexed(), p2.toNonIndexed(), p3.toNonIndexed()]);
    if (!grassMat) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
      for (let i = 0; i < 70; i++) { const x = 4 + Math.random() * 120, h = 30 + Math.random() * 92; g.strokeStyle = ['#4f8a34', '#6a9a3a', '#3d6e2a', '#8aa848', '#5c9440', '#9ab052'][i % 6]; g.lineWidth = 2 + Math.random() * 2.5; g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + (Math.random() - .5) * 20, 128 - h * 0.5, x + (Math.random() - .5) * 34, 128 - h); g.stroke(); }
      grassMat = TK.patchMat(new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }), { wind: { amp: 0.13, minY: 0.05, speed: 2.3 }, season: 'grass' });
    }
    const im = new THREE.InstancedMesh(geo, grassMat, Math.max(1, cap || list.length));
    list.forEach(([x, y, z, sc], i) => { D.position.set(x, y, z); D.rotation.set(0, i * 1.7, 0); D.scale.set(sc, sc, sc); D.updateMatrix(); im.setMatrixAt(i, D.matrix); });
    return im;
  };
  TK.Decor = Decor;
})();
