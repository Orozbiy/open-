/* Карта: ЧОҢ АЧЫК ДҮЙНӨ — АРАЛ.
   Борбордо шаар; батышта (+x) кар баскан тоолор; чыгышта (−x) деңиз жана булуң (көпүрө менен);
   түндүктө көл; шакек жол (4 тилке) тоо кыркасынын ичинен туннель аркылуу өтөт;
   3 чоку (серпантин → чокудагы түз жол → тик ылдый → трамплин), түндүк/түштүк жаңы жерлер, өрөөн жолу;
   айыл үйлөрү, токойлор, жел тегирмендер, күн панелдери, дрифт зона, заправкалар, гараждар, маяк, кайыктар, трафик. */
(function () {
  TK.maps = TK.maps || {};
  const clamp = TK.util.clamp;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const EXT = 2500, CITY = 368, SEA = -3;
  const D3 = new THREE.Object3D();

  TK.maps.world = function (ctx) {
    const scene = ctx.scene, renderer = ctx.renderer, opts = ctx.opts || {};
    const quality = TK.save.data.settings.quality || 1;
    const trafficK = TK.save.data.settings.traffic === undefined ? 1 : TK.save.data.settings.traffic;
    const brk = new TK.Breakables(scene);
    const city = TK.maps.city({ scene, renderer, opts: { traffic: Math.round((opts.traffic || 16) * trafficK), world: true }, breakables: brk });
    const group = new THREE.Group(); scene.add(group);
    const noise = TK.Terrain.makeNoise(23), noise2 = TK.Terrain.makeNoise(57), noise3 = TK.Terrain.makeNoise(71);
    const anim = [];   // кыймылдуу объекттер
    const scircles = new TK.Grid(20);   // тегерек бекем нерселер: мамылар, таштар, тегирмендер
    const scircle = (x, z, r) => scircles.add(x, z, { x, z, r });

    // ---------- рельеф ----------
    const ringR = a => 850 + 80 * Math.sin(3 * a) + 40 * Math.cos(5 * a + 1);
    const ringPt = deg => { const a = deg * Math.PI / 180, r = ringR(a); return [Math.cos(a) * r, Math.sin(a) * r]; };
    const RIDGE = ringPt(-25), BAY = [-900, -470], LAKE = [300, 1180], PEAK = [1500, -800];
    const flatZones = [];   // заправка, гараж, дрифт зона үчүн тегиз жерлер
    const nM = TK.Terrain.makeNoise(131), nP = TK.Terrain.makeNoise(177);
    let Dgrid = null; const DC = 25, DN = Math.round(EXT * 2 / DC);
    function roadDist(x, z) {      // эң жакынкы жолго чейинки аралык (метр), торчодон
      if (!Dgrid) return 1e3;
      const fx = (x + EXT) / DC, fz = (z + EXT) / DC, i = clamp(Math.floor(fx), 0, DN - 1), j = clamp(Math.floor(fz), 0, DN - 1), u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1), W1 = DN + 1;
      return (Dgrid[j * W1 + i] * (1 - u) + Dgrid[j * W1 + i + 1] * u) * (1 - v) + (Dgrid[(j + 1) * W1 + i] * (1 - u) + Dgrid[(j + 1) * W1 + i + 1] * u) * v;
    }
    function landNat(x, z) {
      const rc = Math.max(Math.abs(x), Math.abs(z)), D = roadDist(x, z);
      const m = smooth(390, 650, rc);
      const n1 = noise(x * 0.0022 + 5, z * 0.0022 + 5), n2 = noise(x * 0.009, z * 0.009);
      // тегиз талаалар ↔ дөңсөөлүү жерлер (кезектешет)
      const amp = 0.2 + 0.8 * smooth(0.36, 0.6, nP(x * 0.0019 + 50, z * 0.0019));
      let h = m * amp * ((n1 - 0.36) * 60 + (n2 - 0.5) * 9);
      h += m * 46 * Math.exp(-((x - 880) ** 2 + (z - 880) ** 2) / (330 * 330));
      h += 72 * Math.exp(-((x - RIDGE[0]) ** 2 + (z - RIDGE[1]) ** 2) / (150 * 150));                 // туннелдүү кырка
      h += 175 * Math.exp(-((x - PEAK[0]) ** 2 + (z - PEAK[1]) ** 2) / (300 * 300));                  // Ак-Чоку (кар баскан бийик тоо)
      // тоо массивдери бүт аралда (жолдордон алыс — жолдор өрөөн менен өтөт)
      const mm = smooth(0.5, 0.66, nP(x * 0.0011 + 7, z * 0.0011 + 3)), rr = 1 - Math.abs(nM(x * 0.0032, z * 0.0032) * 2 - 1);
      const away = smooth(55, 240, D) * smooth(430, 700, rc);
      h = Math.max(h, -4) + mm * away * (70 + 230 * rr * rr);
      // батыштагы тоо кыркасы
      const wx = x + (noise2(z * 0.002, 1.3) - 0.5) * 320, mw = smooth(960, 1420, wx) * (0.35 + 0.65 * smooth(40, 200, D));
      const nr = noise2(x * 0.003 + 40, z * 0.003 + 40), ridge = 1 - Math.abs(nr * 2 - 1);
      h += mw * (60 + 290 * ridge * ridge);
      return h;
    }
    // чокулардын рельефи табигый рельефтин үстүнө кошулат
    function land(x, z) { let h = landNat(x, z); for (const S of SITES) if (S.field) h = S.apply(x, z, h); return h; }
    // аралдын жаңы бөлүктөрү (түндүк жана түштүк)
    const lobe = (x, z, cx, cz, ax, az) => 1 - smooth(0.8, 1.0, Math.hypot((x - cx) / ax, (z - cz) / az) + (noise3(x * 0.0025 + 11, z * 0.0025 + 4) - 0.5) * 0.2);
    function seaMask(x, z) {
      const coast = -1000 + (noise3(z * 0.003 + 9, 3) - 0.5) * 260;
      let s = smooth(coast + 40, coast - 140, x);
      const r = Math.hypot(x, z);
      let s2 = Math.max(smooth(1320, 1460, r) * (1 - smooth(780, 1000, x)), smooth(1760, 1940, r + (noise3(x * 0.002, z * 0.002) - 0.5) * 160));   // батышта да деңиз (арал бүт курчалган)
      s2 *= 1 - Math.max(lobe(x, z, -50, 1700, 1150, 620), lobe(x, z, -50, -1700, 1150, 620));
      s = Math.max(s, s2, smooth(EXT - 430, EXT - 190, Math.max(Math.abs(x), Math.abs(z))));
      s = Math.max(s, 1 - smooth(190, 300, Math.hypot(x - BAY[0], z - BAY[1])));
      s = Math.max(s, 1 - smooth(110, 200, Math.hypot(x - LAKE[0], z - LAKE[1])));
      return s;
    }
    function hills(x, z) {
      let h = land(x, z);
      const s = seaMask(x, z); if (s > 0) h = h * (1 - s) + (SEA - 14) * s;
      for (const f of flatZones) { const d = fzD(f, x, z); if (d < 45) h = f.y + (h - f.y) * smooth(0, 45, d); }
      return h;
    }
    function fzD(f, x, z) { if (f.rect) { const [x0, x1, z0, z1] = f.rect, dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); return Math.hypot(dx, dz); } return Math.hypot(x - f.x, z - f.z) - f.r; }
    function addFlat(x, z, r) { const y = Math.max(SEA + 2, land(x, z)); flatZones.push({ x, z, r, y }); return y; }

    // ---------- POI (заправка, гараж, дрифт зона) — жолдорго чейин аныкталат ----------

    // ---------- жолдор ----------
    const ringCtrl = []; for (let k = 0; k < 36; k++) ringCtrl.push(ringPt(k * 10));
    const DEF = [
      { id: 'ring', name: 'Шакек жол', half: 8.5, hw: true, closed: true, pts: ringCtrl, lamps: 90, traffic: 22 },
      { id: 'spokeN', name: 'Түндүк жол', half: 6, pts: [[0, 352], [0, 600], ringPt(90)], lamps: 30, traffic: 4, join: ['city', 'ring'] },
      { id: 'spokeS', name: 'Түштүк жол', half: 6, pts: [[0, -352], [0, -600], ringPt(270)], lamps: 30, traffic: 4, join: ['city', 'ring'] },
      { id: 'spokeE', name: 'Батыш жол', half: 6, pts: [[352, 0], [600, 0], ringPt(0)], lamps: 30, traffic: 4, join: ['city', 'ring'] },
      { id: 'spokeW', name: 'Жээк жолу', half: 6, pts: [[-352, 0], [-600, 0], ringPt(180)], lamps: 30, traffic: 4, join: ['city', 'ring'] },
      // шаардын бурчтарынан кошумча чыгуулар
      { id: 'exitNW', name: 'Көл жолу', half: 5.5, pts: [[-210, 352], [-250, 560], ringPt(106)], lamps: 14, traffic: 2, join: ['city', 'ring'] },
      { id: 'exitSW', name: 'Булуң жолу', half: 5.5, pts: [[-352, -210], [-560, -280], ringPt(200)], lamps: 14, traffic: 2, join: ['city', 'ring'] },
      { id: 'exitSE', name: 'Кен жолу', half: 5.5, pts: [[210, -352], [250, -580], ringPt(284)], lamps: 14, traffic: 2, join: ['city', 'ring'] },
      { id: 'exitNE', name: 'Бак жолу', half: 5.5, pts: [[352, 210], [560, 300], ringPt(33)], lamps: 14, traffic: 2, join: ['city', 'ring'] },
      { id: 'hill', name: 'Дөңсөө серпантини', half: 4.6, pts: [ringPt(18), [1000, 470], [1080, 690], [1010, 880], [890, 960], [760, 1060], [600, 1000], [470, 900], [380, 860], ringPt(66)], lamps: 0, traffic: 3, fence: true, join: ['ring', 'ring'] }
    ];
    // ---------- ЧОКУЛАР: тоонун башына чыгуучу серпантин → чокудагы узун түз жол → тик ылдый (учуу) → трамплин → конуу ----------
    // Жергиликтүү координаттар: u — түз жолдун багыты боюнча, w — серпантин жакка капталынан.
    //   w=360: 1-тилке (u: 0→Ls), w=180: 2-тилке (u: Ls→0), w=0: чокудагы түз жол (u: 0→Ls), андан ары ылдый/трамплин.
    const nR = TK.Terrain.makeNoise(613);
    const JUMP = [[12, 0, -0.16], [88, -0.16, -0.42], [80, -0.42, -0.42], [80, -0.42, 0], [50, 0, 0], [25, 0, 0.14], [5, 0.14, 0.14], [4, 0.14, -0.06], [150, -0.06, -0.225], [70, -0.225, -0.3], [90, -0.3, -0.06]];
    const PROF = (() => { const a = new Float32Array(1001); let y = 0, m = 0; JUMP.forEach(([L, p0, p1]) => { for (let k = 0; k < L; k++) { y += p0 + (p1 - p0) * (k + 0.5) / L; a[++m] = y; } }); return { a, m }; })();
    const tn = (x, z) => { const l = Math.hypot(x, z); return [x / l, z / l]; };
    const SITES = [
      { id: 'summitN', name: 'Түндүк чоку', A: [-420, 1820], t: [1, 0], nL: [0, -1], Ls: 400,
        pre: [ringPt(118), [-430, 1000], [-590, 1250], [-578, 1415], [-500, 1460]], post: [[860, 1760], [910, 1560], [850, 1300], [760, 1060]], join: ['ring', 'hill'] },
      { id: 'summitE', name: 'Батыш чоку', A: [1520, 40], t: tn(-0.3, 0.954), Ls: 400,
        pre: [ringPt(0), [985, -150], [1120, -250], [1200, -143]], post: [[1150, 1230], [1040, 1200], [950, 1080], [890, 960]], join: ['ring', 'hill'] },
      { id: 'summitS', name: 'Түштүк чоку', A: [-420, -1820], t: [1, 0], nL: [0, 1], Ls: 400,
        pre: [ringPt(250), [-430, -1000], [-590, -1250], [-578, -1415], [-500, -1460]], post: [[860, -1760], [980, -1560], [1080, -1250], [1160, -950], [1150, -640], [1120, -250]], join: ['ring', 'summitE'] }
    ];
    SITES[1].nL = [-SITES[1].t[1], SITES[1].t[0]];
    SITES.forEach(S => {
      const [ax, az] = S.A, [tx, tz] = S.t, [nx, nz] = S.nL, Ls = S.Ls, half = 6;
      const P = (u, w) => [ax + tx * u + nx * w, az + tz * u + nz * w];
      S.local = (x, z) => { const dx = x - ax, dz = z - az; return [dx * tx + dz * tz, dx * nx + dz * nz]; };
      const pts = S.pre.slice();
      for (let u = 0; u <= Ls; u += 50) pts.push(P(u, 360));
      for (let a = 75; a >= -75; a -= 15) { const r = a * Math.PI / 180; pts.push(P(Ls + 90 * Math.cos(r), 270 + 90 * Math.sin(r))); }
      for (let u = Ls; u >= 0; u -= 50) pts.push(P(u, 180));
      for (let a = 105; a <= 255; a += 15) { const r = a * Math.PI / 180; pts.push(P(90 * Math.cos(r), 90 + 90 * Math.sin(r))); }
      for (let u = 0; u <= Ls + 750; u += 50) pts.push(P(u, 0));
      S.post.forEach(p => pts.push(p));
      // жолдун чекиттери (DEF менен бирдей ыкма)
      const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal', 0.5);
      const L = curve.getLength(), n = Math.max(8, Math.round(L / 6)), raw = curve.getSpacedPoints(n), N = raw.length;
      const sArr = new Float32Array(N); for (let i = 1; i < N; i++) sArr[i] = sArr[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z);
      const near = (p, from) => { let b = from, bd = 1e12; for (let i = from; i < N; i++) { const d = (raw[i].x - p[0]) ** 2 + (raw[i].z - p[1]) ** 2; if (d < bd) { bd = d; b = i; } } return b; };
      const iL2 = near(P(0, 360), 0), iTop = near(P(0, 0), iL2 + 10), iB = near(P(Ls, 0), iTop + 5);
      const Yb = S.Yb !== undefined ? S.Yb : clamp(landNat(...P(0, 360)), SEA + 7, 40);
      const climb = sArr[iTop] - sArr[iL2], Ytop = Yb + 0.1 * climb;
      const YA = new Float32Array(N), fixed = new Uint8Array(N);
      let iJ = iB;
      for (let i = iL2; i < N; i++) {
        const [u, w] = S.local(raw[i].x, raw[i].z);
        if (i > iB && (u > Ls + 752 || Math.abs(w) > 4)) break;
        let y;
        if (i <= iTop) y = Yb + (sArr[i] - sArr[iL2]) / climb * (Ytop - Yb);
        else if (i <= iB) y = Ytop;
        else {
          const d = sArr[i] - sArr[iB];
          if (d <= PROF.m) { const k = Math.floor(d), f = d - k; y = Ytop + PROF.a[k] + (PROF.a[Math.min(PROF.m, k + 1)] - PROF.a[k]) * f; }
          else { const yE = Ytop + PROF.a[PROF.m]; y = Math.max(Yb + 3, yE - 0.06 * (d - PROF.m)); }
        }
        YA[i] = y; fixed[i] = 1; iJ = i;
      }
      Object.assign(S, { pts, N, YA, fixed, iL2, iTop, iB, iJ, Yb, Ytop, half, P });
      // серпантиндин тилкелеринин бийиктиги (u боюнча) — тоонун формасы үчүн
      const nb = Math.round(Ls / 10) + 1, Y2 = new Float32Array(nb).fill(NaN), Y3 = new Float32Array(nb).fill(NaN);
      for (let i = iL2; i <= iTop; i++) { const [u, w] = S.local(raw[i].x, raw[i].z); if (u < -2 || u > Ls + 2) continue; const k = clamp(Math.round(u / 10), 0, nb - 1); if (Math.abs(w - 360) < 12) Y2[k] = YA[i]; else if (Math.abs(w - 180) < 12) Y3[k] = YA[i]; }
      [Y2, Y3].forEach(T => { let last = -1; for (let k = 0; k < nb; k++) if (!isNaN(T[k])) { if (last < 0) for (let q = 0; q < k; q++) T[q] = T[k]; else for (let q = last + 1; q < k; q++) T[q] = T[last] + (T[k] - T[last]) * (q - last) / (k - last); last = k; } for (let q = last + 1; q < nb; q++) T[q] = T[last]; });
      const lerpT = (T, u) => { const f = clamp(u, 0, Ls) / 10, k = Math.min(nb - 2, Math.floor(f)); return T[k] + (T[k + 1] - T[k]) * (f - k); };
      S.G = (u, w) => {
        const uc = clamp(u, 0, Ls), y2 = lerpT(Y2, uc), y3 = lerpT(Y3, uc);
        let g;
        if (w <= 0) g = Ytop - 0.6 * Math.max(0, -w - 12);
        else if (w <= 180) g = Ytop + (y3 - Ytop) * w / 180;
        else if (w <= 360) g = y3 + (y2 - y3) * (w - 180) / 180;
        else g = y2 - 0.5 * Math.max(0, w - 372);
        if (u > Ls) g -= 0.6 * Math.max(0, u - Ls - 95 * smooth(60, 170, w));
        else if (u < 0) g -= 0.55 * Math.max(0, -u - 95 * (1 - smooth(200, 330, w)));
        return g;
      };
      // торчо: жолго чейинки аралык жана жолдун "конустары" (жолдун эки жагы 32° менен ылдый түшөт)
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let i = iL2; i <= iJ; i++) { x0 = Math.min(x0, raw[i].x); x1 = Math.max(x1, raw[i].x); z0 = Math.min(z0, raw[i].z); z1 = Math.max(z1, raw[i].z); }
      const C = 10, M = 300; x0 -= M; z0 -= M; x1 += M; z1 += M;
      const NXc = Math.ceil((x1 - x0) / C) + 1, NZc = Math.ceil((z1 - z0) / C) + 1;
      const DS = new Float32Array(NXc * NZc).fill(1e4), EE = new Float32Array(NXc * NZc).fill(-1e4);
      for (let i = iL2; i <= iJ; i++) {
        const px = raw[i].x, pz = raw[i].z, y = YA[i], R = M;
        const ci0 = Math.max(0, Math.floor((px - R - x0) / C)), ci1 = Math.min(NXc - 1, Math.ceil((px + R - x0) / C)), cj0 = Math.max(0, Math.floor((pz - R - z0) / C)), cj1 = Math.min(NZc - 1, Math.ceil((pz + R - z0) / C));
        for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
          const k = cj * NXc + ci, d = Math.hypot(x0 + ci * C - px, z0 + cj * C - pz);
          if (d < DS[k]) DS[k] = d;
          const e = y - 0.62 * Math.max(0, d - half - 3); if (e > EE[k]) EE[k] = e;
        }
      }
      const bil = (A, x, z) => { const fx = (x - x0) / C, fz = (z - z0) / C, i = clamp(Math.floor(fx), 0, NXc - 2), j = clamp(Math.floor(fz), 0, NZc - 2), u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1); return (A[j * NXc + i] * (1 - u) + A[j * NXc + i + 1] * u) * (1 - v) + (A[(j + 1) * NXc + i] * (1 - u) + A[(j + 1) * NXc + i + 1] * u) * v; };
      S.dist = (x, z) => (x < x0 || x > x1 || z < z0 || z > z1) ? 1e4 : bil(DS, x, z);
      S.apply = (x, z, h) => {
        if (x < x0 || x > x1 || z < z0 || z > z1) return h;
        const dS = bil(DS, x, z), wm = 1 - smooth(90, 270, dS); if (wm <= 0) return h;
        const [u, w] = S.local(x, z);
        let hs = Math.max(S.G(u, w), bil(EE, x, z), Yb - 1);
        hs += (nR(x * 0.018, z * 0.018) - 0.5) * 0.22 * Math.max(0, hs - Yb) * smooth(16, 45, dS);    // таштуу беттер
        return h + (hs - h) * wm;
      };
      S.field = true;
      DEF.push({ id: S.id, name: S.name + ' жолу', half, grade: 0.11, pts, lamps: 0, traffic: 0, fence: true, join: S.join, site: S });
    });
    // ---------- КӨП ЖАҢЫ ЖОЛДОР: ички шакек (шаар менен шакек жолдун ортосу), жээк жолдору, көл жолу, байланыштар ----------
    const defCurve = {};
    const onRoad = (id, t) => { const d = DEF.find(e => e.id === id); if (!defCurve[id]) defCurve[id] = new THREE.CatmullRomCurve3(d.pts.map(p => new THREE.Vector3(p[0], 0, p[1])), !!d.closed, 'centripetal', 0.5); const v = defCurve[id].getPointAt(t); return [v.x, v.z]; };
    const LK = (id, name, a, via, b, o) => DEF.push(Object.assign({ id, name, half: 5, pts: [onRoad(a[0], a[1])].concat(via, [onRoad(b[0], b[1])]), lamps: 10, traffic: 2, join: [a[0], b[0]] }, o || {}));
    LK('inN', 'Ички жол 1', ['spokeN', 0.72], [[-130, 600]], ['exitNW', 0.6]);
    LK('inNW', 'Ички жол 2', ['exitNW', 0.6], [[-330, 380], [-400, 200]], ['spokeW', 0.5]);
    LK('inW', 'Ички жол 3', ['spokeW', 0.5], [[-650, -150]], ['exitSW', 0.6]);
    LK('inSW', 'Ички жол 4', ['exitSW', 0.6], [[-420, -470]], ['spokeS', 0.45]);
    LK('inS', 'Ички жол 5', ['spokeS', 0.45], [[130, -610]], ['exitSE', 0.6]);
    LK('inSE', 'Ички жол 6', ['exitSE', 0.6], [[470, -470], [590, -220]], ['spokeE', 0.5]);
    LK('inE', 'Ички жол 7', ['spokeE', 0.5], [[660, 170]], ['exitNE', 0.6]);
    LK('inNE', 'Ички жол 8', ['exitNE', 0.6], [[420, 520], [180, 640]], ['spokeN', 0.72]);
    DEF.push({ id: 'coastN', name: 'Түндүк жээк жолу', half: 5.5, pts: [ringPt(150), [-880, 760], [-870, 1050], [-730, 1215], [-590, 1250]], lamps: 12, traffic: 2, join: ['ring', 'summitN'] });
    DEF.push({ id: 'coastS', name: 'Түштүк жээк жолу', half: 5.5, pts: [ringPt(222), [-720, -760], [-705, -1000], [-650, -1175], [-590, -1250]], lamps: 12, traffic: 2, join: ['ring', 'summitS'] });
    DEF.push({ id: 'lake', name: 'Көл жолу', half: 5, pts: [[470, 900], [320, 960], [120, 1060], [-150, 1075], [-430, 1000]], lamps: 8, traffic: 2, join: ['hill', 'summitN'] });
    DEF.push({ id: 'southLink', name: 'Кен-Арык өрөөнү', half: 5, pts: [[1080, -1250], [820, -1110], [600, -930], ringPt(300)], lamps: 0, traffic: 2, fence: true, join: ['summitS', 'ring'] });
    DEF.push({ id: 'airRoad', name: 'Аэропорт жолу', half: 5.5, pts: [[-730, 1215], [-712, 1320], [-703, 1405]], lamps: 8, traffic: 0, join: ['coastN', null] });
    DEF.push({ id: 'peaksLink', name: 'Чокулар аралыгы', half: 5, pts: [[910, 1560], [1040, 1430], [1150, 1230]], lamps: 0, traffic: 0, fence: true, join: ['summitN', 'summitE'] });
    // ---------- жолго чейинки аралык талаасы (жолдун геометриясы гана, бийиктиксиз) ----------
    {
      Dgrid = null; const D0 = new Float32Array((DN + 1) * (DN + 1)).fill(1e4), W1 = DN + 1;
      DEF.forEach(d => {
        const cv = new THREE.CatmullRomCurve3(d.pts.map(p => new THREE.Vector3(p[0], 0, p[1])), !!d.closed, 'centripetal', 0.5);
        cv.getSpacedPoints(Math.round(cv.getLength() / 10)).forEach(p => {
          const i = Math.round((p.x + EXT) / DC);
          for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = Math.round((p.z + EXT) / DC) + b; if (ii < 0 || jj < 0 || ii > DN || jj > DN) continue; const dd = Math.hypot(-EXT + ii * DC - p.x, -EXT + jj * DC - p.z); const k = jj * W1 + ii; if (dd < D0[k]) D0[k] = dd; }
        });
      });
      // шаар да "жол" сыяктуу (анын жанында тоо болбойт)
      for (let j = 0; j <= DN; j++) for (let i = 0; i <= DN; i++) { const x = -EXT + i * DC, z = -EXT + j * DC, rc = Math.max(Math.abs(x), Math.abs(z)); if (rc < CITY + 30) D0[j * W1 + i] = 0; }
      const c1 = DC, c2 = DC * 1.414;
      for (let j = 0; j <= DN; j++) for (let i = 0; i <= DN; i++) { const k = j * W1 + i; let v = D0[k]; if (i > 0) v = Math.min(v, D0[k - 1] + c1); if (j > 0) { v = Math.min(v, D0[k - W1] + c1); if (i > 0) v = Math.min(v, D0[k - W1 - 1] + c2); if (i < DN) v = Math.min(v, D0[k - W1 + 1] + c2); } D0[k] = v; }
      for (let j = DN; j >= 0; j--) for (let i = DN; i >= 0; i--) { const k = j * W1 + i; let v = D0[k]; if (i < DN) v = Math.min(v, D0[k + 1] + c1); if (j < DN) { v = Math.min(v, D0[k + W1] + c1); if (i < DN) v = Math.min(v, D0[k + W1 + 1] + c2); if (i > 0) v = Math.min(v, D0[k + W1 - 1] + c2); } D0[k] = v; }
      Dgrid = D0;
    }
    const pois = [];
    const DRIFT = [-560, 330];
    const driftY = addFlat(DRIFT[0], DRIFT[1], 75);
    // шаарчалар: шакек жол ичинен өтөт (тегиз жер)
    const TOWNS = [[150, 'Жээк-Сай'], [240, 'Түштүк-Кала'], [300, 'Кен-Арык']].map(([deg, name]) => { const p = ringPt(deg); return { x: p[0], z: p[1], r: 120, name, y: addFlat(p[0], p[1], 120) }; });
    // АЭРОПОРТ (түндүк жерде): 580 м тилке, ангар, мунара
    const AIR = { x: -740, z0: 1430, z1: 2010, w: 40, rect: [-785, -655, 1385, 2035] };
    AIR.y = Math.max(SEA + 3, landNat(-720, 1710)); flatZones.push({ rect: AIR.rect, y: AIR.y });
    pois.push({ type: 'airport', name: 'Аэропорт', x: -705, z: 1440, y: AIR.y, r: 30 });
    const inAir = (x, z, m) => x > AIR.rect[0] - m && x < AIR.rect[1] + m && z > AIR.rect[2] - m && z < AIR.rect[3] + m;
    TOWNS.push((() => { const x = 1010, z = 820; return { x, z, r: 60, name: 'Тоо айылы', y: addFlat(x, z, 60), village: true }; })());
    const roads = {}, rgrid = new TK.Grid(40);
    DEF.forEach(d => {
      const curve = new THREE.CatmullRomCurve3(d.pts.map(p => new THREE.Vector3(p[0], 0, p[1])), !!d.closed, 'centripetal', 0.5);
      const L = curve.getLength(), n = Math.max(8, Math.round(L / 6));
      const raw = curve.getSpacedPoints(n); if (d.closed) raw.pop();
      const N = raw.length, X = new Float32Array(N), Z = new Float32Array(N), Y = new Float32Array(N), NX = new Float32Array(N), NZ = new Float32Array(N), TX = new Float32Array(N), TZ = new Float32Array(N), K = new Float32Array(N);
      const tun = new Uint8Array(N), bri = new Uint8Array(N), cover = new Uint8Array(N);
      for (let i = 0; i < N; i++) { X[i] = raw[i].x; Z[i] = raw[i].z; Y[i] = hills(X[i], Z[i]); }
      const J = (i, k) => d.closed ? (i + k + N) % N : clamp(i + k, 0, N - 1);
      for (let i = 0; i < N; i++) {
        let tx = X[J(i, 1)] - X[J(i, -1)], tz = Z[J(i, 1)] - Z[J(i, -1)]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        TX[i] = tx; TZ[i] = tz; NX[i] = -tz; NZ[i] = tx;      // NX,NZ — жол боюнча караганда ОҢ жак
      }
      for (let i = 0; i < N; i++) { let a1 = Math.atan2(TX[J(i, 1)], TZ[J(i, 1)]) - Math.atan2(TX[i], TZ[i]); while (a1 > Math.PI) a1 -= 6.283; while (a1 < -Math.PI) a1 += 6.283; K[i] = a1 / 6; }
      const sm = (passes, win) => { for (let p = 0; p < passes; p++) { const c = Y.slice(); for (let i = 0; i < N; i++) { let s = 0, w = 0; for (let k = -win; k <= win; k++) { const j = d.closed ? (i + k + N) % N : i + k; if (j < 0 || j >= N) continue; s += c[j]; w++; } Y[i] = s / w; } } };
      // туннель (шакек жолдо, кырканын ичинде)
      if (d.id === 'ring') {
        const ang = i => { let a = Math.atan2(Z[i], X[i]) * 180 / Math.PI; return a < 0 ? a + 360 : a; };
        let i0 = -1, i1 = -1; for (let i = 0; i < N; i++) { const a = ang(i); if (a >= 308 && a <= 362) { if (i0 < 0) i0 = i; i1 = i; } }
        if (i0 >= 0) { for (let i = i0; i <= i1; i++) Y[i] = Y[i0] + (Y[i1] - Y[i0]) * (i - i0) / (i1 - i0); }
        sm(2, 10);
        for (let i = 0; i < N; i++) { const a = ang(i); if (a > 316 && a < 354 && land(X[i], Z[i]) - Y[i] > 10) tun[i] = 1; }
        for (let i = 0; i < N; i++) cover[i] = tun[i] && tun[J(i, -4)] && tun[J(i, 4)] ? 1 : 0;   // порталдан 24 м ичкериде гана жер жабылат
      }
      // көпүрө (суу үстүндө)
      for (let i = 0; i < N; i++) if (hills(X[i], Z[i]) < SEA + 1.2) for (let k = -4; k <= 4; k++) bri[J(i, k)] = 1;
      for (let i = 0; i < N; i++) if (bri[i]) Y[i] = Math.max(Y[i], SEA + 6);
      sm(3, 14);
      for (let i = 0; i < N; i++) if (bri[i]) Y[i] = Math.max(Y[i], SEA + 5);
      for (let i = 0; i < N; i++) { const rc = Math.max(Math.abs(X[i]), Math.abs(Z[i])); Y[i] *= smooth(CITY, CITY + 120, rc); }
      let fixed = null, YA = null;
      if (d.site) { if (d.site.N !== N) console.warn('site N mismatch', d.id, d.site.N, N); fixed = d.site.fixed; YA = d.site.YA; for (let i = 0; i < N; i++) if (fixed[i]) { Y[i] = YA[i]; bri[i] = 0; } }
      const r = Object.assign({}, d, { N, X, Y, Z, NX, NZ, TX, TZ, K, tun, bri, cover, length: L, fixed, YA });
      roads[d.id] = r;
      for (let i = 0; i < N; i++) rgrid.add(X[i], Z[i], { r, i });
    });

    // заправкалар жана гараждар — жолдун жанына
    function besideRoad(id, t, side, off) {
      const r = roads[id], i = Math.floor(t * (r.N - 1));
      return { x: r.X[i] + r.NX[i] * (r.half + off) * side, z: r.Z[i] + r.NZ[i] * (r.half + off) * side, ry: Math.atan2(-r.NX[i] * side, -r.NZ[i] * side), i, r };
    }
    [['spokeN', 0.55, 1], ['spokeS', 0.6, -1], ['ring', 0.62, -1], ['ring', 0.12, 1]].forEach(([id, t, sd], k) => {
      const p = besideRoad(id, t, sd, 16); p.y = addFlat(p.x, p.z, 22); pois.push({ type: 'fuel', name: 'Заправка', x: p.x, z: p.z, y: p.y, ry: p.ry, r: 13 });
    });
    [['spokeW', 0.45, 1], ['spokeE', 0.7, -1]].forEach(([id, t, sd]) => {
      const p = besideRoad(id, t, sd, 18); p.y = addFlat(p.x, p.z, 22); pois.push({ type: 'garage', name: 'Гараж', x: p.x, z: p.z, y: p.y, ry: p.ry, r: 11 });
    });
    pois.push({ type: 'drift', name: 'Дрифт зона', x: DRIFT[0], z: DRIFT[1], y: driftY, r: 60 });
    // жолдордун бийиктигин flatZones кийин жаңыртуу
    const flatRoads = () => Object.values(roads).forEach(r => { for (let i = 0; i < r.N; i++) for (const f of flatZones) { const dd = fzD(f, r.X[i], r.Z[i]); if (dd < 45 && !r.bri[i] && !r.tun[i] && !(r.fixed && r.fixed[i]) && Math.max(Math.abs(r.X[i]), Math.abs(r.Z[i])) > CITY + 60) r.Y[i] = f.y + (r.Y[i] - f.y) * smooth(0, 45, dd); } });
    flatRoads();

    // ---------- жол кесилиштери: бийиктиктерди бириктирүү ----------
    // жолдун эңкейишин чектөө (чоң жол ≤ 8%, серпантин ≤ 11%)
    function limitGrade(r) {
      const g = (r.grade || (r.id === 'hill' ? 0.11 : 0.08)) * 6, F = r.fixed;
      for (let pass = 0; pass < 4; pass++) {
        for (let q = 1; q < r.N + (r.closed ? r.N : 0); q++) { const i = q % r.N, p = (q - 1) % r.N; if (F && F[i]) continue; r.Y[i] = clamp(r.Y[i], r.Y[p] - g, r.Y[p] + g); }
        for (let q = r.N - 2 + (r.closed ? r.N : 0); q >= 0; q--) { const i = q % r.N, n = (q + 1) % r.N; if (F && F[i]) continue; r.Y[i] = clamp(r.Y[i], r.Y[n] - g, r.Y[n] + g); }
      }
    }
    const restore = r => { if (r.fixed) for (let i = 0; i < r.N; i++) if (r.fixed[i]) r.Y[i] = r.YA[i]; };
    // тик ийри: жолдун чокулары жылмакай болсун (ылдамдыкта машина учуп кетпесин), көпүрө суудан бийик калат
    function verticalCurve(r, passes, win) {
      for (let p = 0; p < passes; p++) {
        const c = r.Y.slice();
        for (let i = 0; i < r.N; i++) { let sm = 0, w = 0; for (let k = -win; k <= win; k++) { let j = i + k; if (r.closed) j = (j + r.N) % r.N; else if (j < 0 || j >= r.N) continue; const ww = 1 - Math.abs(k) / (win + 1); sm += c[j] * ww; w += ww; } r.Y[i] = sm / w; }
        for (let i = 0; i < r.N; i++) { if (r.bri[i]) r.Y[i] = Math.max(r.Y[i], SEA + 4.5); if (Math.max(Math.abs(r.X[i]), Math.abs(r.Z[i])) < CITY + 10) r.Y[i] = 0; }
      }
    }
    Object.values(roads).forEach(r => { verticalCurve(r, r.hw ? 8 : 5, r.hw ? 12 : 9); restore(r); });
    limitGrade(roads.ring);
    const ring = roads.ring, junctions = [];
    const nearestOn = (r, x, z) => { let b = 0, bd = 1e12; for (let i = 0; i < r.N; i++) { const d = (r.X[i] - x) ** 2 + (r.Z[i] - z) ** 2; if (d < bd) { bd = d; b = i; } } return b; };
    // кесилиштер: жолдун учу башка жолго (шакек, серпантин ж.б.) туташат — бийиктиктер бириктирилет
    const depth = (r, g) => (g > 8 || !r.join) ? 0 : Math.max(0, ...r.join.map(t => (!t || t === 'city' || t === 'ring') ? 0 : 1 + depth(roads[t], (g || 0) + 1)));
    const jroads = Object.values(roads).filter(r => r.join).sort((a, b) => depth(a) - depth(b));
    jroads.forEach(r => r.join.forEach((tid, side) => {
      if (!tid || tid === 'city') return;
      const T = roads[tid], e = side ? r.N - 1 : 0, k = nearestOn(T, r.X[e], r.Z[e]), yT = T.Y[k], L = 26;
      junctions.push({ x: T.X[k], z: T.Z[k], y: yT, k, T, r, e, rad: T.half + 7, ry: Math.atan2(T.TX[k], T.TZ[k]) });
      for (let q = 0; q <= L; q++) { const i = e === 0 ? q : e - q; if (i < 0 || i >= r.N || (r.fixed && r.fixed[i])) break; const w = smooth(0, 1, 1 - q / L); r.Y[i] = r.Y[i] * (1 - w) + yT * w; }
      for (let q = -8; q <= 8; q++) { let i = k + q; if (T.closed) i = (i + T.N) % T.N; else if (i < 0 || i >= T.N) continue; if (T.fixed && T.fixed[i]) continue; const w = 1 - Math.abs(q) / 9; T.Y[i] = T.Y[i] * (1 - w * 0.5) + yT * w * 0.5; }
    }));
    Object.values(roads).forEach(r => { if (r !== ring) limitGrade(r); });
    flatRoads(); Object.values(roads).forEach(restore);    // тегиз аянттар (аэропорт, заправка…) жолдун тик ийрисинен кийин да тегиз калат
    // акыркы бийиктиктер боюнча учтарды кайра бириктирүү (кесилиште тепкич калбасын)
    junctions.forEach(j => {
      const r = j.r, yT = j.T.Y[j.k], L = 20; j.y = yT;
      for (let q = 0; q <= L; q++) { const i = j.e === 0 ? q : j.e - q; if (i < 0 || i >= r.N || (r.fixed && r.fixed[i])) break; const w = smooth(0, 1, 1 - q / L); r.Y[i] = r.Y[i] * (1 - w) + yT * w; }
    });
    // кесилиш аянтынын бийиктиги — негизги жолдун бети (эңкейиш болсо да тепкичсиз)
    function padY(j, x, z) {
      const T = j.T; let b = j.k, bd = 1e12;
      for (let q = -7; q <= 7; q++) { let i = j.k + q; if (T.closed) i = (i + T.N) % T.N; else if (i < 0 || i >= T.N) continue; const d = (T.X[i] - x) ** 2 + (T.Z[i] - z) ** 2; if (d < bd) { bd = d; b = i; } }
      return roadYAt({ r: T, i: b }, x, z);
    }
    const nearJunction = (x, z, m) => junctions.some(j => Math.hypot(j.x - x, j.z - z) < m);
    // объект жолдун үстүндө эмеспи (бардык жолдорду текшерет)
    function clearOfRoads(x, z, m) {
      let ok = true;
      rgrid.near(x, z, sm => { if (!ok) return; const r = sm.r, i = sm.i, dx = x - r.X[i], dz = z - r.Z[i]; if (Math.abs(dx * r.TX[i] + dz * r.TZ[i]) < 4 && Math.abs(dx * r.NX[i] + dz * r.NZ[i]) < r.half + m) ok = false; });
      if (ok && Math.max(Math.abs(x), Math.abs(z)) < CITY + 4) ok = false;
      return ok;
    }
    // жолдун бийиктиги — эки чекиттин ортосунда жылмакай
    function roadYAt(q, x, z) {
      const r = q.r, i = q.i, lon = (x - r.X[i]) * r.TX[i] + (z - r.Z[i]) * r.TZ[i];
      let j = lon >= 0 ? i + 1 : i - 1;
      if (r.closed) j = (j + r.N) % r.N; else if (j < 0 || j >= r.N) return r.Y[i];
      return r.Y[i] + (r.Y[j] - r.Y[i]) * Math.min(1, Math.abs(lon) / 6);
    }

    function roadQuery(x, z) {
      let best = null, bd = 1e12;
      rgrid.near(x, z, s => { const dx = x - s.r.X[s.i], dz = z - s.r.Z[s.i], dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = s; } });
      if (!best || bd > 60 * 60) return null;
      const r = best.r, i = best.i, latS = (x - r.X[i]) * r.NX[i] + (z - r.Z[i]) * r.NZ[i];
      return { lat: Math.abs(latS), latS, y: r.Y[i], half: r.half, r, i, d: Math.sqrt(bd) };
    }
    // физика үчүн жердин бийиктиги: жолдо — жолдун бети, жолдон тышкары — көрүнгөн рельеф тору менен ДАЛ ЭЛЕ бирдей
    function H(x, z) {
      if (Math.max(Math.abs(x), Math.abs(z)) < CITY) return 0;
      const q = roadQuery(x, z);
      const ry = q ? roadYAt(q, x, z) + 0.14 * smooth(CITY, CITY + 25, Math.max(Math.abs(x), Math.abs(z))) : 0;
      if (q && q.lat < q.half + 0.8) return ry;
      for (const j of junctions) if (Math.hypot(j.x - x, j.z - z) < j.rad) return padY(j, x, z) + 0.13;
      const gy = gridH(x, z) - 0.06;
      if (q && q.lat < q.half + 4 && !q.r.bri[q.i] && !q.r.tun[q.i]) { const w = smooth(q.half + 0.8, q.half + 4, q.lat); return ry + (gy - ry) * w; }   // жолдун чети жумшак
      return gy;
    }
    function gridH(x, z) {
      const fx = (x + EXT) / STEP, fz = (z + EXT) / STEP, i = Math.floor(fx), j = Math.floor(fz);
      if (i < 0 || j < 0 || i >= NG || j >= NG) return SEA - 14;
      const u = fx - i, v = fz - j, W1 = NG + 1, a = heights[j * W1 + i], b = heights[j * W1 + i + 1], c = heights[(j + 1) * W1 + i], e = heights[(j + 1) * W1 + i + 1];
      return u + v <= 1 ? a + (b - a) * u + (c - a) * v : e + (c - e) * (1 - u) + (b - e) * (1 - v);
    }
    // көрүнүш үчүн рельеф (туннелдин үстү жабык)
    function meshH(x, z) {
      if (Math.max(Math.abs(x), Math.abs(z)) < CITY) return 0;
      const hh = hills(x, z), q = roadQuery(x, z);
      if (!q) return hh;
      if (q.r.cover[q.i]) return q.lat < q.half + 13 ? Math.max(hh, q.y + 11) : hh;
      if (q.r.tun[q.i]) return q.lat < q.half + 13 ? Math.min(hh, q.y - 0.4) : hh;
      if (q.r.bri[q.i]) return hh;
      const w = smooth(q.half + 1.5, q.half + 28, q.lat);
      return q.y + (hh - q.y) * w - 0.25 * (1 - smooth(q.half, q.half + 7, q.lat));
    }

    // ---------- рельеф тору ----------
    const STEP = quality < 1 ? 20 : 16, NG = Math.round(EXT * 2 / STEP);
    const pos = new Float32Array((NG + 1) * (NG + 1) * 3), heights = new Float32Array((NG + 1) * (NG + 1));
    for (let j = 0; j <= NG; j++) for (let i = 0; i <= NG; i++) {
      const x = -EXT + i * STEP, z = -EXT + j * STEP, k = j * (NG + 1) + i, y = meshH(x, z);
      heights[k] = y; pos[k * 3] = x; pos[k * 3 + 1] = y - 0.06; pos[k * 3 + 2] = z;
    }
    const idx = new Uint32Array(NG * NG * 6); let o = 0;
    for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) { const a = j * (NG + 1) + i, b = a + 1, c = a + NG + 1, e = c + 1; idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = e; }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setIndex(new THREE.BufferAttribute(idx, 1)); tg.computeVertexNormals();
    const nor = tg.attributes.normal.array, col = new Float32Array(pos.length);
    const C = h => new THREE.Color(h);
    const cG1 = C(0x4a7a3c), cG2 = C(0x6b8a3e), cAut = C(0x9a7a38), cDirt = C(0x7a6a4c), cRock = C(0x77736b), cSnow = C(0xf0f3f8), cSand = C(0xd8c79a), cSeabed = C(0x5d7f86), tmp = new THREE.Color();
    for (let k = 0; k < heights.length; k++) {
      const x = pos[k * 3], z = pos[k * 3 + 2], y = heights[k], ny = nor[k * 3 + 1];
      tmp.copy(cG1).lerp(cG2, noise(x * 0.01 + 3, z * 0.01 + 7)).lerp(cAut, smooth(0.55, 0.75, noise3(x * 0.004, z * 0.004)) * 0.5);
      tmp.lerp(cRock, smooth(0.92, 0.78, ny) * 0.9);
      tmp.lerp(cRock, smooth(110, 170, y)); tmp.lerp(cSnow, smooth(200, 250, y) * smooth(0.6, 0.8, ny));
      tmp.lerp(cSand, 1 - smooth(SEA + 1.5, SEA + 4, y)); tmp.lerp(cSeabed, 1 - smooth(SEA - 3, SEA - 0.5, y));
      const rc = Math.max(Math.abs(x), Math.abs(z));
      if (rc > CITY + 4 && y > SEA + 1) { const q = roadQuery(x, z); if (q && !q.r.tun[q.i]) tmp.lerp(cDirt, 0.35 * (1 - smooth(q.half + 2, q.half + 12, q.lat))); }
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    group.add(new THREE.Mesh(tg, TK.patchMat(new THREE.MeshLambertMaterial({ vertexColors: true }), { season: 'terrain' })));

    // ---------- суу (деңиз, булуң, көл) ----------
    const wc = document.createElement('canvas'); wc.width = wc.height = 128; const wg = wc.getContext('2d'), wn = TK.Terrain.makeNoise(3);
    const wid = wg.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const v = wn(x / 16, y / 16), o2 = (y * 128 + x) * 4; wid.data[o2] = 128 + (v - 0.5) * 120; wid.data[o2 + 1] = 128 + (wn(x / 16 + 30, y / 16) - 0.5) * 120; wid.data[o2 + 2] = 255; wid.data[o2 + 3] = 255; }
    wg.putImageData(wid, 0, 0);
    const wtex = new THREE.CanvasTexture(wc); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(220, 220);
    const waterMat = new THREE.MeshPhongMaterial({ color: 0x2f6f8f, shininess: 90, specular: 0x9fc8e0, normalMap: wtex, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.88 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = SEA; group.add(water);

    // ---------- жол беттери ----------
    const hwTex = (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#2d2f35'; g.fillRect(0, 0, 512, 256); const rr = TK.util.seeded(9);
      for (let i = 0; i < 5000; i++) { const v = 34 + rr() * 30; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(rr() * 512, rr() * 256, 1 + rr() * 2, 1 + rr() * 2); }
      g.fillStyle = '#e4e4e8'; g.fillRect(10, 0, 7, 256); g.fillRect(495, 0, 7, 256);
      g.fillRect(130, 20, 6, 100); g.fillRect(130, 148, 6, 100); g.fillRect(376, 20, 6, 100); g.fillRect(376, 148, 6, 100);
      g.fillStyle = '#e0b84a'; g.fillRect(248, 0, 5, 256); g.fillRect(259, 0, 5, 256);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
    })();
    const roadMat = new THREE.MeshStandardMaterial({ map: TK.asphaltTexture(renderer), roughness: 0.85, metalness: 0.04, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const hwMat = new THREE.MeshStandardMaterial({ map: hwTex, roughness: 0.85, metalness: 0.04, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const shMat = new THREE.MeshLambertMaterial({ color: 0x6b6352, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    function ribbon(r, a, b, dy, vscale, mat, filter) {
      const N = r.N, M = r.closed ? N + 1 : N, P = [], U = [], I = []; let v = 0;
      for (let q = 0; q < M; q++) {
        const i = q % N, y = r.Y[i] + dy * (0.3 + 0.7 * smooth(CITY, CITY + 25, Math.max(Math.abs(r.X[i]), Math.abs(r.Z[i])))); v = q * 6 / vscale;
        P.push(r.X[i] + r.NX[i] * a, y, r.Z[i] + r.NZ[i] * a, r.X[i] + r.NX[i] * b, y, r.Z[i] + r.NZ[i] * b); U.push(0, v, 1, v);
        if (q < M - 1 && (!filter || filter((q + 1) % N) && filter(i))) { const k = q * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
      return new THREE.Mesh(g, mat);
    }
    Object.values(roads).forEach((r, k) => {
      const main = r.hw ? null : (i => !nearJunction(r.X[i], r.Z[i], ring.half + 0.3));
      group.add(ribbon(r, -r.half, r.half, 0.14 + k * 0.004, r.hw ? 16 : 13, r.hw ? hwMat : roadMat, main));
      const open = r.hw ? (i => !r.bri[i] && !nearJunction(r.X[i], r.Z[i], 6 + 6)) : (i => !r.bri[i] && !nearJunction(r.X[i], r.Z[i], ring.half + 2.5));
      group.add(ribbon(r, r.half, r.half + 2.2, 0.09, 10, shMat, open));
      group.add(ribbon(r, -r.half - 2.2, -r.half, 0.09, 10, shMat, open));
    });
    // кесилиш аянттары (бурчтарды толтурат)
    const jMat = new THREE.MeshStandardMaterial({ color: 0x2c2e34, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    junctions.forEach(j => {
      const cg = new THREE.CircleGeometry(j.rad, 28, 0, Math.PI * 2); cg.rotateX(-Math.PI / 2);
      const pa = cg.attributes.position; for (let k = 0; k < pa.count; k++) { const x = pa.getX(k) + j.x, z = pa.getZ(k) + j.z; pa.setXYZ(k, x, padY(j, x, z) + 0.1, z); }
      cg.computeVertexNormals(); group.add(new THREE.Mesh(cg, jMat));
    });

    // ---------- көпүрө: мамылар жана бетон тосмолор ----------
    const pil = [], jw = [];
    Object.values(roads).forEach(r => {
      for (let i = 0; i < r.N; i++) {
        if (!r.bri[i]) continue;
        const ry = Math.atan2(r.TX[i], r.TZ[i]);
        [1, -1].forEach(s => jw.push([r.X[i] + r.NX[i] * (r.half + 0.4) * s, r.Y[i] + 0.1, r.Z[i] + r.NZ[i] * (r.half + 0.4) * s, ry, 'c', 6.1]));
        if (i % 5 === 0) { const floor = hills(r.X[i], r.Z[i]); if (r.Y[i] - floor > 2.5) [1, -1].forEach(s => pil.push([r.X[i] + r.NX[i] * (r.half - 2.5) * s, floor, r.Z[i] + r.NZ[i] * (r.half - 2.5) * s, r.Y[i] - 0.5 - floor, ry])); }
      }
    });
    if (pil.length) {
      const pg = new THREE.BoxGeometry(2.4, 1, 3.2); pg.translate(0, 0.5, 0);
      const pm = new THREE.InstancedMesh(pg, new THREE.MeshLambertMaterial({ color: 0xa9a59c }), pil.length);
      pil.forEach(([x, y, z, h, ry], i) => { D3.position.set(x, y, z); D3.rotation.set(0, ry, 0); D3.scale.set(1, h, 1); D3.updateMatrix(); pm.setMatrixAt(i, D3.matrix); });
      group.add(pm);
      const deck = []; Object.values(roads).forEach(r => { for (let i = 0; i < r.N; i++) if (r.bri[i]) deck.push(i); });
      Object.values(roads).forEach(r => { const g = ribbon(r, -r.half - 1, r.half + 1, -0.9, 10, new THREE.MeshLambertMaterial({ color: 0x8f8b84, side: THREE.DoubleSide }), i => r.bri[i]); group.add(g); });
    }

    // ---------- туннель ----------
    const tunMat = new THREE.MeshLambertMaterial({ color: 0x45433f, emissive: 0x141312, side: THREE.DoubleSide });
    const neonA = new THREE.MeshBasicMaterial({ color: 0x3cf0d0 }), neonB = new THREE.MeshBasicMaterial({ color: 0x38b6ff });
    const hazTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#e0b020'; g.beginPath(); g.moveTo(i * 8, 16); g.lineTo(i * 8 + 8, 0); g.lineTo(i * 8 + 16, 0); g.lineTo(i * 8 + 8, 16); g.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t; })();
    const tunnels = [];
    Object.values(roads).forEach(r => {
      let i = 0;
      while (i < r.N) {
        if (!r.tun[i]) { i++; continue; }
        let j = i; while (j + 1 < r.N && r.tun[j + 1]) j++;
        tunnels.push({ r, i0: i, i1: j }); i = j + 1;
      }
    });
    const arches = [];
    tunnels.forEach(t => {
      const r = t.r, Rt = r.half + 2.2, Rh = 7.8, SEG = 14, P = [], I = [], cnt = t.i1 - t.i0 + 1;
      for (let q = 0; q < cnt; q++) {
        const i = t.i0 + q;
        for (let s = 0; s <= SEG; s++) { const a = s / SEG * Math.PI, lat = Math.cos(a) * Rt, y = r.Y[i] + 0.1 + Math.sin(a) * Rh; P.push(r.X[i] + r.NX[i] * lat, y, r.Z[i] + r.NZ[i] * lat); }
        if (q < cnt - 1) for (let s = 0; s < SEG; s++) { const a = q * (SEG + 1) + s, b = a + SEG + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
        if (q % 3 === 0) arches.push(i);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
      group.add(new THREE.Mesh(g, tunMat));
      // сары-кара тилке
      const hz = new THREE.MeshBasicMaterial({ map: hazTex, side: THREE.DoubleSide });
      [1, -1].forEach(s => {
        const Q = [], U = [], II = [];
        for (let q = 0; q < cnt; q++) { const i = t.i0 + q, x = r.X[i] + r.NX[i] * (Rt - 0.3) * s, z = r.Z[i] + r.NZ[i] * (Rt - 0.3) * s; Q.push(x, r.Y[i] + 0.15, z, x, r.Y[i] + 1.0, z); U.push(q * 2, 0, q * 2, 1); if (q < cnt - 1) { const k = q * 2; II.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
        const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(Q, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); gg.setIndex(II);
        group.add(new THREE.Mesh(gg, hz));
      });
      // порталдар
      [[t.i0, 1], [t.i1, -1]].forEach(([i, dir]) => {
        const p = new THREE.Group(), cm = new THREE.MeshLambertMaterial({ color: 0xb9b5ad });
        const L = new THREE.Mesh(new THREE.BoxGeometry(14, 22, 3), cm); L.position.set(Rt + 7, 11, 0); p.add(L);
        const Rr = L.clone(); Rr.position.x = -Rt - 7; p.add(Rr);
        const T = new THREE.Mesh(new THREE.BoxGeometry(Rt * 2 + 28, 22 - Rh, 3), cm); T.position.set(0, Rh + (22 - Rh) / 2, 0); p.add(T);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.8), new THREE.MeshBasicMaterial({ map: TK.Decor.canvasText('ТУННЕЛЬ', 512, 92, '#0c5f3a', '#fff') }));
        sign.position.set(0, Rh + 2.2, -1.6); sign.rotation.y = Math.PI; p.add(sign);
        p.position.set(r.X[i], r.Y[i], r.Z[i]); p.rotation.y = Math.atan2(r.TX[i], r.TZ[i]) + (dir < 0 ? Math.PI : 0);
        p.translateZ(-1.5);
        group.add(p);
      });
    });
    if (arches.length) {
      const tg2 = new THREE.TorusGeometry(1, 0.035, 4, 28, Math.PI);
      const ia = new THREE.InstancedMesh(tg2, neonA, arches.length), ib = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.12, 2.2), new THREE.MeshBasicMaterial({ color: 0xf4f7ff }), arches.length);
      const r = roads.ring;
      arches.forEach((i, k) => {
        D3.position.set(r.X[i], r.Y[i] + 0.2, r.Z[i]); D3.rotation.set(0, Math.atan2(r.TX[i], r.TZ[i]), 0); D3.scale.set(r.half + 1.9, 7.3, 1); D3.updateMatrix(); ia.setMatrixAt(k, D3.matrix);
        D3.position.y = r.Y[i] + 7.75; D3.scale.set(1, 1, 1); D3.updateMatrix(); ib.setMatrixAt(k, D3.matrix);
        if (k % 2) ia.setColorAt(k, new THREE.Color(0x38b6ff)); else ia.setColorAt(k, new THREE.Color(0x3cf0d0));
      });
      if (ia.instanceColor) ia.instanceColor.needsUpdate = true;
      ia.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      group.add(ia, ib);
    }

    // ---------- жол чырактары ----------
    const lampList = [];
    Object.values(roads).forEach(r => { if (!r.lamps) return; const every = Math.max(4, Math.round(r.length / 6 / r.lamps)); let n = 0; for (let i = 3; i < r.N - 2; i += every) { if (r.tun[i]) continue; const sd = (n++ % 2) ? 1 : -1, off = r.bri[i] ? r.half + 0.4 : r.half + 1.4; if (!clearOfRoads(r.X[i] + r.NX[i] * off * sd, r.Z[i] + r.NZ[i] * off * sd, 0.6) || nearJunction(r.X[i], r.Z[i], 26)) continue; lampList.push([r, i, sd]); } });
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 6), new THREE.MeshLambertMaterial({ color: 0x5a5e66 }), lampList.length);
    const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.22, 0.5), lampHeadMat, lampList.length);
    const poolMat = new THREE.MeshBasicMaterial({ map: TK.glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolMat, lampList.length);
    lampList.forEach(([r, i, s], k) => {
      const off = r.bri[i] ? r.half + 0.4 : r.half + 1.4;
      const x = r.X[i] + r.NX[i] * off * s, z = r.Z[i] + r.NZ[i] * off * s, y = r.Y[i];
      D3.rotation.set(0, 0, 0); D3.scale.set(1, 1, 1); D3.position.set(x, y + 4.5, z); D3.updateMatrix(); poles.setMatrixAt(k, D3.matrix); scircle(x, z, 0.2);
      D3.position.set(x - r.NX[i] * 0.8 * s, y + 9, z - r.NZ[i] * 0.8 * s); D3.rotation.y = Math.atan2(r.NX[i], r.NZ[i]); D3.updateMatrix(); heads.setMatrixAt(k, D3.matrix);
      D3.position.set(x - r.NX[i] * 4 * s, y + 0.25, z - r.NZ[i] * 4 * s); D3.rotation.set(-Math.PI / 2, 0, 0); D3.scale.set(26, 26, 1); D3.updateMatrix(); pools.setMatrixAt(k, D3.matrix);
    });
    group.add(poles, heads, pools);
    const reflList = [];
    Object.values(roads).forEach(r => { if (r.hw) return; for (let i = 0; i < r.N; i += 5) { if (Math.max(Math.abs(r.X[i]), Math.abs(r.Z[i])) < CITY + 10 || r.bri[i]) continue; reflList.push([r, i, 1], [r, i, -1]); } });
    for (let k = reflList.length - 1; k >= 0; k--) { const [r, i, sd] = reflList[k]; if (!clearOfRoads(r.X[i] + r.NX[i] * (r.half + 2.6) * sd, r.Z[i] + r.NZ[i] * (r.half + 2.6) * sd, 1) || nearJunction(r.X[i], r.Z[i], 24)) reflList.splice(k, 1); }
    const refl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }), reflList.length);
    const reflCap = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), new THREE.MeshBasicMaterial({ color: 0xffa21a }), reflList.length);
    reflList.forEach(([r, i, s], k) => {
      const x = r.X[i] + r.NX[i] * (r.half + 2.6) * s, z = r.Z[i] + r.NZ[i] * (r.half + 2.6) * s, y = H(x, z);
      D3.rotation.set(0, 0, 0); D3.scale.set(1, 1, 1); D3.position.set(x, y + 0.45, z); D3.updateMatrix(); refl.setMatrixAt(k, D3.matrix);
      D3.position.y = y + 0.8; D3.updateMatrix(); reflCap.setMatrixAt(k, D3.matrix);
    });
    group.add(refl, reflCap);

    // ---------- коргоочу тосмолор (кыймылсыз объекттер — кагылышуу) ----------
    const solids = [];   // AABB: үйлөр, заправка, гараж
    function solid(x, z, w, d) { solids.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); }

    // ---------- айыл үйлөрү ----------
    const hr = TK.util.seeded(808);
    const wallM = new THREE.MeshLambertMaterial({ color: 0xd9cdb4 }), roofM = TK.patchMat(new THREE.MeshLambertMaterial({ color: 0x8a3b2a }), { season: 'roof' });
    const winLit = [];
    ['spokeN', 'spokeS', 'spokeE', 'spokeW'].forEach(id => {
      const r = roads[id];
      for (let k = 0; k < 5; k++) {
        const i = Math.floor(r.N * (0.25 + k * 0.12)); if (i >= r.N) continue;
        const s = k % 2 ? 1 : -1, off = r.half + 16 + hr() * 14;
        const x = r.X[i] + r.NX[i] * off * s, z = r.Z[i] + r.NZ[i] * off * s, w = 8 + hr() * 5, dd = 7 + hr() * 4, hh = 4.2, y = H(x, z);
        if (y < SEA + 1 || pois.some(p => Math.hypot(p.x - x, p.z - z) < 40) || !clearOfRoads(x, z, Math.max(w, dd) / 2 + 3)) continue;
        const g = new THREE.Group(); g.position.set(x, y - 0.3, z);
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, dd), wallM); b.position.y = hh / 2; g.add(b);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, dd) / 2 + 0.4, 3, 4), roofM); roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.hypot(w, dd) * 1.42, 1, dd / Math.hypot(w, dd) * 1.42); roof.position.y = hh + 1.5; g.add(roof);
        const wm = new THREE.MeshBasicMaterial({ color: 0x2a3448 }); winLit.push(wm);
        [-1, 1].forEach(q => { const wnd = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), wm); wnd.position.set(q * w * 0.25, hh * 0.55, dd / 2 + 0.02); g.add(wnd); const wb = wnd.clone(); wb.position.z = -dd / 2 - 0.02; wb.rotation.y = Math.PI; g.add(wb); });
        group.add(g); solid(x, z, w, dd);
      }
    });

    // ---------- ШААРЧАЛАР ----------
    const townMats = [];
    function facade(wall, seed) {
      const rnd = TK.util.seeded(seed), c = document.createElement('canvas'), e = document.createElement('canvas'); c.width = c.height = e.width = e.height = 128;
      const g = c.getContext('2d'), h = e.getContext('2d'); g.fillStyle = wall; g.fillRect(0, 0, 128, 128); h.fillStyle = '#000'; h.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const on = rnd() < 0.4; g.fillStyle = on ? '#e9d8b0' : '#2a3448'; g.fillRect(x * 32 + 8, y * 32 + 9, 16, 15); if (on) { h.fillStyle = rnd() < .5 ? '#ffd58a' : '#ffe7b8'; h.fillRect(x * 32 + 8, y * 32 + 9, 16, 15); } }
      const mk = cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
      const m = new THREE.MeshLambertMaterial({ map: mk(c), emissive: 0xffffff, emissiveMap: mk(e), emissiveIntensity: 0 }); townMats.push(m); return m;
    }
    const tf = [facade('#c9b79a', 11), facade('#a9b4c2', 12), facade('#d8d2c4', 13)], tgeo = [[], [], []];
    const tRoof = [[], [], []], troofM = [0x8a3b2a, 0x3b5a7a, 0x4a5a3a].map(c => TK.patchMat(new THREE.MeshLambertMaterial({ color: c }), { season: 'roof' }));
    const trr = TK.util.seeded(515);
    TOWNS.forEach((T, ti) => {
      const step = T.village ? 22 : 28;
      for (let gx = -T.r; gx <= T.r; gx += step) for (let gz = -T.r; gz <= T.r; gz += step) {
        if (Math.hypot(gx, gz) > T.r - 8) continue;
        const x = T.x + gx + (trr() - .5) * 6, z = T.z + gz + (trr() - .5) * 6;
        const w = T.village ? 8 + trr() * 3 : 11 + trr() * 7, d = T.village ? 7 + trr() * 3 : 11 + trr() * 7;
        const hgt = T.village ? 4.2 : 7 + trr() * trr() * 30;
        if (!clearOfRoads(x, z, Math.max(w, d) / 2 + 5) || pois.some(p => Math.hypot(p.x - x, p.z - z) < (p.r || 20) + 30)) continue;
        const y = H(x, z) - 0.3;
        if (y < SEA + 1) continue;
        const bg = new THREE.BoxGeometry(w, hgt, d), uv = bg.attributes.uv;
        for (let k = 0; k < uv.count; k++) { const fc = Math.floor(k / 4); if (fc === 2 || fc === 3) { uv.setXY(k, 0.01, 0.01); continue; } uv.setXY(k, uv.getX(k) * ((fc < 2 ? d : w) / 8), uv.getY(k) * (hgt / 8)); }
        bg.translate(x, y + hgt / 2, z); tgeo[(ti + Math.floor(trr() * 3)) % 3].push(bg.toNonIndexed());
        if (T.village || hgt < 10) { const rf = new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.4, 3, 4); rf.rotateY(Math.PI / 4); rf.scale(w / Math.hypot(w, d) * 1.42, 1, d / Math.hypot(w, d) * 1.42); rf.translate(x, y + hgt + 1.5, z); tRoof[(trr() * 3) | 0].push(rf.toNonIndexed()); }
        solid(x, z, w, d);
      }
      // шаарчанын аты (жолдун жанында)
      const q = roadQuery(T.x, T.z); if (q) { const r = q.r, i = (q.i + 22) % r.N, sx = r.X[i] + r.NX[i] * (r.half + 9), sz = r.Z[i] + r.NZ[i] * (r.half + 9);
        if (clearOfRoads(sx, sz, 4)) { const b = TK.Decor.billboard(T.name.toUpperCase(), T.village ? 'айыл' : 'шаарча', ['#0c5f3a', '#08452a'], '#fff'); b.scale.setScalar(0.6); b.position.set(sx, H(sx, sz), sz); b.rotation.y = Math.atan2(r.TX[i], r.TZ[i]) + Math.PI; group.add(b); } }
    });
    tgeo.forEach((list, k) => { if (list.length) group.add(new THREE.Mesh(TK.mergeGeoms(list), tf[k])); });
    tRoof.forEach((l, k) => { if (l.length) group.add(new THREE.Mesh(TK.mergeGeoms(l), troofM[k])); });
    TOWNS.forEach(T => pois.push({ type: 'town', name: T.name, x: T.x, z: T.z, y: T.y, r: T.r }));

    // ---------- POI курулуштары ----------
    pois.forEach(p => {
      if (p.type === 'fuel') { const g = TK.Decor.gasStation(); g.position.set(p.x, p.y, p.z); g.rotation.y = p.ry; group.add(g); const cs = Math.cos(p.ry), sn = Math.sin(p.ry); [[-6, -4, .3], [6, -4, .3], [-6, 4, .3], [6, 4, .3], [-3, 0, .7], [3, 0, .7]].forEach(([lx, lz, rr]) => scircle(p.x + lx * cs + lz * sn, p.z - lx * sn + lz * cs, rr)); const back = new THREE.Vector3(0, 0, -14).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.ry); solid(p.x + back.x, p.z + back.z, 12, 12); }
      if (p.type === 'garage') { const g = TK.Decor.garage(); g.position.set(p.x, p.y, p.z); g.rotation.y = p.ry; group.add(g); const back = new THREE.Vector3(0, 0, -8).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.ry); solid(p.x + back.x, p.z + back.z, 17, 17); }
    });
    // асфальт аянттар (заправка/гараж алдында)
    const padMat = new THREE.MeshStandardMaterial({ color: 0x2f3138, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 });
    pois.forEach(p => { if (p.type !== 'fuel' && p.type !== 'garage') return; const m = new THREE.Mesh(new THREE.CircleGeometry(22, 24), padMat); m.rotation.x = -Math.PI / 2; m.position.set(p.x, p.y + 0.05, p.z); group.add(m); });

    // ---------- ДРИФТ ЗОНА ----------
    const DZ = { x: DRIFT[0], z: DRIFT[1], y: driftY, w: 130, d: 90 };
    { const pad = new THREE.Mesh(new THREE.PlaneGeometry(DZ.w, DZ.d), new THREE.MeshStandardMaterial({ map: TK.asphaltTexture(renderer, '#2b2d33'), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1 }));
      pad.material.map.repeat.set(6, 4); pad.rotation.x = -Math.PI / 2; pad.position.set(DZ.x, DZ.y + 0.06, DZ.z); group.add(pad);
      const jl = [], bl = [];
      for (let x = -DZ.w / 2; x <= DZ.w / 2; x += 2.1) { if (Math.abs(x) > 9) jl.push([DZ.x + x, DZ.y, DZ.z - DZ.d / 2, Math.PI / 2]); jl.push([DZ.x + x, DZ.y, DZ.z + DZ.d / 2, Math.PI / 2]); }
      for (let z = -DZ.d / 2; z <= DZ.d / 2; z += 2.1) { jl.push([DZ.x - DZ.w / 2, DZ.y, DZ.z + z, 0]); jl.push([DZ.x + DZ.w / 2, DZ.y, DZ.z + z, 0]); }
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { for (let k = 0; k < 4; k++) bl.push([DZ.x + a * (DZ.w / 2 - 2 - k * 1.1), DZ.y, DZ.z + b * (DZ.d / 2 - 2)]); });
      group.add(TK.Decor.jersey(jl), TK.Decor.barrels(bl));
      DZ.walls = jl;
      // чатырлар жана жарнамалар
      const texts = [['DRIFT KG', 'ТҮНКҮ КӨЧӨ', ['#1d9e4b', '#0f6d35']], ['KG TIRES', 'дөңгөлөктөр', ['#111', '#333']], ['NITRO 9', 'энергия', ['#c62b2b', '#7a1010']], ['ALA-TOO', 'MOTORS', ['#1d4fd6', '#0b2f91']]];
      for (let k = 0; k < 4; k++) {
        const cx = DZ.x - DZ.w / 2 + 20 + k * 30, cz = DZ.z + DZ.d / 2 + 9;
        const c = TK.Decor.canopy(12, 8); c.position.set(cx, DZ.y, cz); group.add(c);
        const b = TK.Decor.billboard(texts[k][0], texts[k][1], texts[k][2]); b.scale.setScalar(0.5); b.position.set(cx, DZ.y, cz - 4.5); group.add(b);
      }
      // конустар (сынуучу)
      const cg = new THREE.ConeGeometry(0.35, 0.9, 10); cg.translate(0, 0.45, 0);
      const coneSpots = []; for (let k = 0; k < 8; k++) coneSpots.push([DZ.x - 40 + k * 11, DZ.z + (k % 2 ? 6 : -6)]);
      for (let a = 0; a < 10; a++) coneSpots.push([DZ.x + 40 + Math.cos(a / 10 * 6.283) * 9, DZ.z + Math.sin(a / 10 * 6.283) * 9]);
      const cm = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xff7a1a, emissive: 0x401800 }), coneSpots.length);
      coneSpots.forEach(([x, z], k) => { D3.position.set(x, DZ.y, z); D3.rotation.set(0, 0, 0); D3.scale.set(1, 1, 1); D3.updateMatrix(); cm.setMatrixAt(k, D3.matrix); brk.add({ x, z, y: DZ.y, r: 0.35, mesh: cm, index: k, scale: 1, rotY: 0, kind: 'cone' }); });
      group.add(cm);
    }

    // ---------- АЭРОПОРТ: тилке, аянт, ангар, мунара, шамал баштыгы, оттор ----------
    {
      const y = AIR.y, L = AIR.z1 - AIR.z0, cz = (AIR.z0 + AIR.z1) / 2;
      const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d'), rr2 = TK.util.seeded(31);
      g.fillStyle = '#34363c'; g.fillRect(0, 0, 256, 512); for (let i = 0; i < 2500; i++) { const v = 42 + rr2() * 26; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(rr2() * 256, rr2() * 512, 2, 2); }
      g.fillStyle = '#eee'; g.fillRect(8, 0, 6, 512); g.fillRect(242, 0, 6, 512); g.fillRect(124, 40, 8, 180); g.fillRect(124, 296, 8, 180);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, L / 80); t.anisotropy = 8;
      const rw = new THREE.Mesh(new THREE.PlaneGeometry(AIR.w, L), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 }));
      rw.rotation.x = -Math.PI / 2; rw.position.set(AIR.x, y + 0.08, cz); group.add(rw);
      // учтардагы ак тилкелер (порог)
      const thM = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
      [AIR.z0 + 12, AIR.z1 - 12].forEach(z => { for (let k = -6; k <= 6; k++) { if (!k) continue; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 20), thM); m.rotation.x = -Math.PI / 2; m.position.set(AIR.x + k * 2.6, y + 0.1, z); group.add(m); } });
      const apron = new THREE.Mesh(new THREE.PlaneGeometry(70, 180), new THREE.MeshStandardMaterial({ color: 0x45474e, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }));
      apron.rotation.x = -Math.PI / 2; apron.position.set(-690, y + 0.06, 1500); group.add(apron);
      // ангар
      const hg = new THREE.Group(), hm = new THREE.MeshLambertMaterial({ color: 0xb8bcc4 });
      const hb = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 36), hm); hb.position.y = 4; hg.add(hb);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 36, 18, 1, false, 0, Math.PI), new THREE.MeshLambertMaterial({ color: 0x8f949c })); roof.rotation.set(Math.PI / 2, 0, Math.PI / 2); roof.position.y = 8; hg.add(roof);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: 0x1a1c22 })); door.scale.set(1, 1, 1);
      const dm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7.5, 28), new THREE.MeshLambertMaterial({ color: 0x2a2d35 })); dm.position.set(-13.05, 3.8, 0); hg.add(dm);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: TK.Decor.canvasText('АЭРОПОРТ', 512, 96, '#1d4fd6', '#fff') })); sign.position.set(-13.2, 9.5, 0); sign.rotation.y = -Math.PI / 2; hg.add(sign);
      hg.position.set(-672, y, 1520); group.add(hg); solid(-672, 1520, 26, 36);
      // учуу мунарасы
      const tw = new THREE.Group();
      const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 20, 10), new THREE.MeshLambertMaterial({ color: 0xd9d4c8 })); col.position.y = 10; tw.add(col);
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(5, 4, 4, 8), new THREE.MeshPhongMaterial({ color: 0x3a6f9a, emissive: 0x0a2036, shininess: 90 })); cab.position.y = 22; tw.add(cab);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.8, 8), new THREE.MeshLambertMaterial({ color: 0x5a5f6a })); cap.position.y = 24.4; tw.add(cap);
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); bl.position.y = 25.6; tw.add(bl);
      tw.position.set(-675, y, 1585); group.add(tw); solid(-675, 1585, 6, 6);
      // шамал баштыгы
      const ws = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd })); pole.position.y = 3; ws.add(pole);
      const sock = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xff7a1a, side: THREE.DoubleSide })); sock.rotation.z = Math.PI / 2; sock.position.set(1.3, 5.8, 0); ws.add(sock);
      ws.position.set(-708, y, 1640); group.add(ws); scircle(-708, 1640, 0.2);
      // тилкенин четиндеги оттор
      const lp = []; for (let z = AIR.z0; z <= AIR.z1; z += 30) [-1, 1].forEach(sd => lp.push([AIR.x + sd * (AIR.w / 2 + 1.5), z]));
      const li = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: 0x9fd0ff }), lp.length);
      lp.forEach(([x, z], k) => { D3.position.set(x, y + 0.2, z); D3.rotation.set(0, 0, 0); D3.scale.set(1, 1, 1); D3.updateMatrix(); li.setMatrixAt(k, D3.matrix); }); group.add(li);
    }

    // ---------- жарнама такталары жол боюнда ----------
    const BB = [['ТҮНКҮ КӨЧӨ', 'шаар · дрифт · жарыш', ['#ffb547', '#e08a1c'], '#1a1205'], ['KG TIRES', 'кармоо ар бир бурулушта', ['#111', '#333'], '#ffb547'], ['NITRO 9', 'тездик үчүн', ['#c62b2b', '#7a1010'], '#fff'], ['DRIFT KG', 'дрифт мектеби', ['#1d9e4b', '#0f6d35'], '#fff'], ['ALA-TOO MOTORS', 'тюнинг жана сервис', ['#1d4fd6', '#0b2f91'], '#fff']];
    let bbk = 0; const boards = [];
    Object.values(roads).forEach(r => {
      for (let i = 30; i < r.N - 10; i += r.hw ? 70 : 55) {
        if (r.bri[i] || r.tun[i] || Math.max(Math.abs(r.X[i]), Math.abs(r.Z[i])) < CITY + 40) continue;
        const s = bbk % 2 ? 1 : -1, x = r.X[i] + r.NX[i] * (r.half + 12) * s, z = r.Z[i] + r.NZ[i] * (r.half + 12) * s, y = H(x, z);
        if (y < SEA + 1 || !clearOfRoads(x, z, 7) || nearJunction(x, z, 40)) continue;
        const t = BB[bbk++ % BB.length], b = TK.Decor.billboard(t[0], t[1], t[2], t[3]); b.scale.setScalar(0.85);
        b.position.set(x, y, z); b.rotation.y = Math.atan2(r.TX[i], r.TZ[i]) + Math.PI + s * 0.5; group.add(b); boards.push(b);
        [-4, 4].forEach(o => scircle(x + Math.cos(b.rotation.y) * o * 0.85, z - Math.sin(b.rotation.y) * o * 0.85, 0.35));
      }
    });

    // ---------- жел тегирмендер ----------
    const turbines = [];
    for (let k = 0; k < 9; k++) { const z = -880 + k * 220, x = -1320 - (k % 2) * 90; const t = TK.Decor.windTurbine(1); t.group.position.set(x, SEA - 1, z); t.group.rotation.y = Math.PI / 2 + 0.3; group.add(t.group); turbines.push(t); }
    [[-150, -1170], [120, -1210], [390, -1150], [620, -1060], [1040, 260]].forEach(([x, z]) => { const y = H(x, z); if (y > SEA + 1 && clearOfRoads(x, z, 8)) { const t = TK.Decor.windTurbine(0.9); t.group.position.set(x, y - 0.5, z); t.group.rotation.y = 0.8; group.add(t.group); turbines.push(t); scircle(x, z, 1.5); } });
    turbines.forEach((t, k) => t.ph = k * 0.7);

    // ---------- күн панелдери ----------
    const sol = [];
    for (let a = 0; a < 6; a++) for (let b = 0; b < 12; b++) { const x = 60 + b * 7.5, z = -700 - a * 6; const y = H(x, z); sol.push([x, y, z, Math.PI]); }
    TK.Decor.solarField(sol).forEach(m => group.add(m));

    // ---------- маяк жана кайыктар ----------
    let lh = null;
    { let x = -900; const z = 250; while (x > -1400 && hills(x, z) > SEA + 2.5) x -= 10; const y = hills(x + 25, z); lh = TK.Decor.lighthouse(); lh.group.position.set(x + 25, Math.max(y, SEA + 1), z); group.add(lh.group); }
    const boats = [];
    [[-1150, -520, 0xf0f0f0], [-1220, 150, 0xd23a2e], [-1100, 620, 0x1f5fd1], [-960, -380, 0xffffff], [-1380, -260, 0xffb547], [260, 1210, 0xeeeeee]].forEach(([x, z, c], k) => { const b = TK.Decor.boat(c); b.position.set(x, SEA, z); b.rotation.y = k * 1.3; group.add(b); boats.push(b); });

    // ---------- бурулуш белгилери жана жыгач тосмолор ----------
    const chev = [], fen = [];
    Object.values(roads).forEach(r => {
      for (let i = 5; i < r.N - 5; i += 9) {
        if (Math.abs(r.K[i]) < 0.011 || r.bri[i] || r.tun[i]) continue;
        const s = r.K[i] > 0 ? -1 : 1;   // бурулуштун сырткы жагы
        const x = r.X[i] + r.NX[i] * (r.half + 3.2) * s, z = r.Z[i] + r.NZ[i] * (r.half + 3.2) * s;
        if (!clearOfRoads(x, z, 1.5) || nearJunction(x, z, 30)) continue;
        chev.push([x, H(x, z), z, Math.atan2(r.TX[i], r.TZ[i]) + Math.PI, r.K[i] > 0 ? -1 : 1]);
      }
      if (r.fence) for (let i = 0; i < r.N - 1; i++) [1, -1].forEach(s => {
        if ((i + (s > 0 ? 0 : 20)) % 60 > 38) return;
        const a = r.half + 4.5, x0 = r.X[i] + r.NX[i] * a * s, z0 = r.Z[i] + r.NZ[i] * a * s, x1 = r.X[i + 1] + r.NX[i + 1] * a * s, z1 = r.Z[i + 1] + r.NZ[i + 1] * a * s;
        if (!clearOfRoads(x0, z0, 2) || !clearOfRoads(x1, z1, 2) || nearJunction(x0, z0, 34)) return;
        fen.push([x0, H(x0, z0), z0, x1, H(x1, z1), z1]);
      });
    });
    if (chev.length) TK.Decor.chevrons(chev).forEach(m => group.add(m));
    if (fen.length) {
      const [posts, rails] = TK.Decor.fence(fen); group.add(posts, rails);
      // ар бир тосмо бөлүгү сынат: машина тийсе мамы жана тактайлар учуп кетет
      fen.forEach(([x0, y0, z0, x1, y1, z1], i) => { const L = Math.hypot(x1 - x0, z1 - z0); brk.add({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: (y0 + y1) / 2, r: Math.max(0.9, L * 0.5), kind: 'fence', parts: [[posts, i], [rails, i * 2], [rails, i * 2 + 1]], scale: 1, strength: 0 }); });
    }

    // ---------- токойлор, пальмалар, бадалдар, таштар ----------
    const TG = TK.treeGeoms(), tr = TK.util.seeded(4242), cand = { pine: [], round: [], tall: [] }, palmL = [], bushL = [], rockL = [];
    const forest = TK.Terrain.makeNoise(99), TREE_MAX = quality < 1 ? 5000 : (quality > 1.2 ? 18000 : 12000);
    const solGrid = new TK.Grid(40); solids.forEach(b => solGrid.add((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, b));
    const nearPoi = (x, z, m) => pois.some(p => Math.hypot(p.x - x, p.z - z) < (p.r || 20) + m) || (Math.abs(x - DZ.x) < DZ.w / 2 + 12 && Math.abs(z - DZ.z) < DZ.d / 2 + 22) || inAir(x, z, 6);
    const RX = () => -1150 + tr() * 2950, RZ = () => (tr() * 2 - 1) * 2200;
    for (let t = 0; t < 300000 && cand.pine.length + cand.round.length + cand.tall.length < TREE_MAX; t++) {
      const x = RX(), z = RZ(), rc = Math.max(Math.abs(x), Math.abs(z));
      if (rc < CITY + 14) continue;
      const y = H(x, z); if (y < SEA + 1.2 || y > 150) continue;
      if (!clearOfRoads(x, z, 6) || nearJunction(x, z, 30)) continue;
      if (nearPoi(x, z, 8)) continue;
      let inSolid = false; solGrid.near(x, z, b => { if (x > b.x0 - 5 && x < b.x1 + 5 && z > b.z0 - 5 && z < b.z1 + 5) inSolid = true; }); if (inSolid) continue;
      if (y < SEA + 4.5) { if (tr() < 0.35 && palmL.length < 260) palmL.push([x, y - 0.1, z, 0.8 + tr() * 0.5]); continue; }
      const f = forest(x * 0.004, z * 0.004);
      if (f < 0.4 && tr() > 0.12) { if (tr() < 0.05 && clearOfRoads(x, z, 4)) rockL.push([x, y, z, 0.6 + tr() * 2, tr() * 6]); continue; }
      (y > 35 || f > 0.62 ? cand.pine : (tr() < 0.25 ? cand.tall : cand.round)).push([x, y, z]);
    }
    Object.values(roads).forEach(r => { for (let i = 0; i < r.N; i += 2) { if (r.bri[i] || r.tun[i] || tr() > 0.45) continue; const s = tr() < 0.5 ? 1 : -1, a = r.half + 3.5 + tr() * 18, x = r.X[i] + r.NX[i] * a * s, z = r.Z[i] + r.NZ[i] * a * s, y = H(x, z); if (y < SEA + 1 || !clearOfRoads(x, z, 2) || nearJunction(x, z, 24) || nearPoi(x, z, 4)) continue; bushL.push([x, y, z, 0.5 + tr() * 0.9]); } });
    // шаардагы дарактар
    city.boxes.forEach(b => { if (b.wall) return; [[b.x1 + 1.6, b.z1 + 1.6], [b.x0 - 1.6, b.z1 + 1.6], [b.x1 + 1.6, b.z0 - 1.6]].forEach(([x, z]) => { if (tr() < 0.55) cand.round.push([x, 0, z]); }); });
    const autumn = [0x4f7d34, 0x5c8a3a, 0x6f8f32, 0xb8862b, 0xc0552a, 0x9a3a24, 0x4a7a3c].map(c => new THREE.Color(c));
    const pineCols = [0x2f5a35, 0x2a5030, 0x35603a].map(c => new THREE.Color(c));
    [['pine', TG.pine, pineCols], ['round', TG.round, autumn], ['tall', TG.tall, autumn]].forEach(([k, geo, cols]) => {
      const list = cand[k]; if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, TK.patchMat(new THREE.MeshLambertMaterial({ color: 0xffffff }), { wind: k === 'pine' ? { amp: 0.010, minY: 1.8, speed: 1.3 } : { amp: 0.016, minY: 2.2, speed: 1.6 }, season: k === 'pine' ? 'pine' : 'tree' }), list.length);
      list.forEach((p, i) => {
        const sc = (p[1] === 0 && k === 'round') ? 0.6 + tr() * 0.25 : 0.75 + Math.pow(tr(), 1.4) * 1.5, ry = tr() * 6.28;
        D3.position.set(p[0], p[1] - 0.15, p[2]); D3.rotation.set(0, ry, 0); D3.scale.set(sc, sc, sc); D3.updateMatrix(); im.setMatrixAt(i, D3.matrix);
        im.setColorAt(i, cols[(tr() * cols.length) | 0]);
        brk.add({ x: p[0], z: p[2], y: p[1] - 0.15, r: 0.45 * sc, mesh: im, index: i, scale: sc, rotY: ry, kind: 'tree', tkind: k, autumn: k !== 'pine', strength: 0 });
      });
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      group.add(im);
    });
    if (palmL.length) TK.Decor.palms(palmL).forEach(m => group.add(m));
    if (bushL.length) group.add(TK.Decor.bushes(bushL));
    for (let k = 0; k < 260; k++) { const x = 1000 + tr() * 700, z = (tr() * 2 - 1) * 1900, y = H(x, z); if (y > SEA + 2 && clearOfRoads(x, z, 4)) rockL.push([x, y, z, 1 + tr() * 4, tr() * 6]); }
    // ---------- ГҮЛДӨР жана ЧӨП (бош талааларды толтурат) ----------
    const flowerL = [], grassL = [], nF = TK.Terrain.makeNoise(303), FMAX = quality < 1 ? 4000 : 14000, GMAX = quality < 1 ? 5000 : 16000;
    for (let t = 0; t < 14000 && flowerL.length < FMAX; t++) {
      const cx = RX(), cz = RZ();
      if (Math.max(Math.abs(cx), Math.abs(cz)) < CITY + 12 || nF(cx * 0.006, cz * 0.006) < 0.5) continue;
      const cy = H(cx, cz); if (cy < SEA + 3 || cy > 90) continue;
      const ci = (tr() * 7) | 0, n = 12 + (tr() * 26) | 0, rad = 5 + tr() * 9;
      for (let k = 0; k < n; k++) {
        const a = tr() * 6.283, d = Math.sqrt(tr()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!clearOfRoads(x, z, 1.5) || nearPoi(x, z, 3)) continue;
        flowerL.push([x, H(x, z) - 0.05, z, 0.9 + tr() * 0.7, tr() < 0.75 ? ci : (tr() * 7) | 0]);
      }
    }
    for (let t = 0; t < 90000 && grassL.length < GMAX; t++) {
      const x = RX(), z = RZ();
      if (Math.max(Math.abs(x), Math.abs(z)) < CITY + 8) continue;
      const y = H(x, z); if (y < SEA + 2 || y > 110 || !clearOfRoads(x, z, 1.2) || nearPoi(x, z, 2)) continue;
      grassL.push([x, y - 0.05, z, 1.0 + tr() * 1.1]);
    }
    const flowerMeshes = flowerL.length ? TK.Decor.flowers(flowerL) : []; flowerMeshes.forEach(m => group.add(m));
    if (grassL.length) group.add(TK.Decor.grass(grassL));
    // ЖЫШ ЧӨП машинанын айланасында (плиткалар менен — алыстаганда кайра коюлат, ар дайым жыш)
    const grassField = (() => {
      const cap = quality < 1 ? 5000 : (quality > 1.2 ? 20000 : 13000), R = quality < 1 ? 55 : (quality > 1.2 ? 95 : 80), T = 24, C = quality < 1 ? 2.1 : 1.6;
      const im = TK.Decor.grass([], cap); im.count = 0; im.frustumCulled = false; group.add(im);
      const tints = [0xffffff, 0xe6f2c8, 0xd4e8b0, 0xf2efc8, 0xc6dca0].map(c => new THREE.Color(c));
      im.setColorAt(0, tints[0]);
      const cache = new Map(), nG = TK.Terrain.makeNoise(911); let lti = 1e9, ltj = 1e9;
      // ар бир көрсөтүлгөн түп: кайсы плитка, кайсы орун (басылган убакыт плиткада сакталат)
      const kT = new Array(cap), kO = new Int32Array(cap), buckets = new Map(), BK = 3, active = new Set();
      const REC = 9;   // басылган чөп ушунча секундда кайра турат
      function tile(ti, tj) {
        const key = ti * 100003 + tj; let d = cache.get(key); if (d) return d;
        const out = [], rr = TK.util.seeded(((ti * 73856093) ^ (tj * 19349663)) >>> 0 || 7), M = Math.round(T / C);
        for (let a = 0; a < M; a++) for (let b = 0; b < M; b++) {
          const x = ti * T + (a + rr()) * C, z = tj * T + (b + rr()) * C, r1 = rr(), r2 = rr(), r3 = rr();
          if (Math.max(Math.abs(x), Math.abs(z)) < CITY + 6) continue;
          if (nG(x * 0.03, z * 0.03) < 0.32 && r1 < 0.7) continue;                       // тактар (бош жерлер)
          const y = H(x, z); if (y < SEA + 1.6 || y > 140) continue;
          const q = roadQuery(x, z); if (q && q.lat < q.half + 2.8) continue;
          if (nearJunction(x, z, 18) || nearPoi(x, z, 2)) continue;
          out.push(x, y - 0.06, z, 0.75 + r2 * 0.95, r3 * 6.283);
        }
        d = { a: new Float32Array(out), pr: new Float32Array(out.length / 5).fill(-1e9), lean: new Float32Array(out.length / 5) };
        cache.set(key, d); if (cache.size > 900) cache.delete(cache.keys().next().value); return d;
      }
      const now = () => performance.now() / 1000;
      function setInst(k) {
        const d = kT[k], o = kO[k], i5 = o * 5, f = Math.min(1, Math.max(0, (now() - d.pr[o]) / REC)), e = f * f * (3 - 2 * f);
        D3.position.set(d.a[i5], d.a[i5 + 1], d.a[i5 + 2]);
        D3.rotation.set((1 - e) * 1.25, d.a[i5 + 4], 0, 'YXZ');                       // жатып калган → акырындап турат
        D3.scale.set(d.a[i5 + 3], d.a[i5 + 3] * (0.25 + 0.75 * e), d.a[i5 + 3]); D3.updateMatrix(); im.setMatrixAt(k, D3.matrix);
        return f < 1;
      }
      function follow(x, z) {
        const ti = Math.floor(x / T), tj = Math.floor(z / T); if (ti === lti && tj === ltj) return; lti = ti; ltj = tj;
        const nT = Math.ceil(R / T); let k = 0; buckets.clear(); active.clear();
        for (let a = -nT; a <= nT; a++) for (let b = -nT; b <= nT; b++) {
          if (Math.hypot((ti + a + 0.5) * T - x, (tj + b + 0.5) * T - z) > R + T * 0.7) continue;
          const d = tile(ti + a, tj + b), n = d.a.length / 5;
          for (let o = 0; o < n && k < cap; o++) {
            kT[k] = d; kO[k] = o;
            if (setInst(k)) active.add(k);
            im.setColorAt(k, tints[k % 5]);
            const bk = Math.floor(d.a[o * 5] / BK) * 65536 + Math.floor(d.a[o * 5 + 2] / BK); let L = buckets.get(bk); if (!L) buckets.set(bk, L = []); L.push(k);
            k++;
          }
        }
        im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
      // машина чөптү басат (дөңгөлөктөрдүн астында)
      function press(x, z, r) {
        const t = now(), cx = Math.floor(x / BK), cz = Math.floor(z / BK), n = Math.ceil(r / BK);
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
          const L = buckets.get((cx + i) * 65536 + (cz + j)); if (!L) continue;
          for (const k of L) { const d = kT[k], o = kO[k]; if (Math.hypot(d.a[o * 5] - x, d.a[o * 5 + 2] - z) < r) { d.pr[o] = t; active.add(k); } }
        }
      }
      function tick() {
        if (!active.size) return;
        for (const k of active) if (!setInst(k)) active.delete(k);
        im.instanceMatrix.needsUpdate = true;
      }
      return { follow, press, tick };
    })();
    // ---------- чокулардагы белгилер: аты, ылдамдык өлчөгүч дарбаза, «тик ылдый», «трамплин» ----------
    const speedTraps = [], gantryMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
    function gantry(r, i, title, sub, colors) {
      const g = new THREE.Group(), w = r.half + 1.6, ry = Math.atan2(r.TX[i], r.TZ[i]);
      [-1, 1].forEach(sd => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), gantryMat); p.position.set(sd * w, 4, 0); g.add(p); const wx = r.X[i] + r.NX[i] * w * sd, wz = r.Z[i] + r.NZ[i] * w * sd; scircle(wx, wz, 0.4); });
      const bm = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.5, 0.5, 0.5), gantryMat); bm.position.y = 7.8; g.add(bm);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.6, 1.9), new THREE.MeshBasicMaterial({ map: TK.Decor.canvasText(title, 512, 120, colors[0], '#fff', sub), side: THREE.DoubleSide }));
      face.position.set(0, 6.6, 0); g.add(face);
      g.position.set(r.X[i], r.Y[i], r.Z[i]); g.rotation.y = ry + Math.PI; group.add(g);
    }
    SITES.forEach(S => {
      const r = roads[S.id], it = S.iTop + 4, ib = S.iB, sd = 1;
      const sx = r.X[it] + r.NX[it] * (r.half + 7) * sd, sz = r.Z[it] + r.NZ[it] * (r.half + 7) * sd;
      const b = TK.Decor.billboard(S.name.toUpperCase(), 'бийиктик ' + Math.round(1800 + S.Ytop * 8) + ' м · түз жол 400 м', ['#0c5f3a', '#08452a'], '#fff');
      b.scale.setScalar(0.65); b.position.set(sx, H(sx, sz), sz); b.rotation.y = Math.atan2(r.TX[it], r.TZ[it]) + Math.PI; group.add(b);
      gantry(r, it + 2, 'ТЕЗДИК ЖОЛУ', 'ылдамдыгыңды өлчө →', ['#b8221a']);
      gantry(r, ib - 1, 'ТИК ЫЛДЫЙ', '42% · учуп кетесиң!', ['#d2691a']);
      const ik = ib + Math.round(302 / 6); if (ik < r.N) gantry(r, ik, 'ТРАМПЛИН', 'СЕКИРИК ▲', ['#1d4fd6']);
      speedTraps.push({ x: r.X[ib - 1], z: r.Z[ib - 1], name: S.name });
      const im = Math.round((S.iTop + ib) / 2);
      pois.push({ type: 'town', name: S.name, x: r.X[im], z: r.Z[im], y: r.Y[im], r: 10 });
    });
    // ========== PR ТРЮКТАР (Forza сыяктуу): ылдамдык камерасы, ылдамдык зонасы, коркунуч белгиси (секирик) ==========
    const stunts = [];
    const atT = (id, t) => { const r = roads[id]; return [r, clamp(Math.round(t * (r.N - 1)), 0, r.N - 1)]; };
    SITES.forEach(S => {   // чокулардагы камера (түз жолдун аягында) + 2 секирик
      const r = roads[S.id], ib = S.iB, ik = Math.min(r.N - 1, ib + Math.round(302 / 6));
      stunts.push({ id: 'trap_' + S.id, type: 'trap', name: S.name, x: r.X[ib - 1], z: r.Z[ib - 1], stars: [150, 180, 210], unit: 'км/с' });
      stunts.push({ id: 'jump1_' + S.id, type: 'jump', name: S.name + ' · тик ылдый', x: r.X[ib + 2], z: r.Z[ib + 2], stars: [50, 90, 130], unit: 'м' });
      stunts.push({ id: 'jump2_' + S.id, type: 'jump', name: S.name + ' · трамплин', x: r.X[ik], z: r.Z[ik], stars: [40, 80, 120], unit: 'м' });
    });
    [['ring', 0.45, 'Шакек жол'], ['ring', 0.8, 'Туннель алды'], ['spokeE', 0.62, 'Батыш жол'], ['coastS', 0.5, 'Түштүк жээк'], ['lake', 0.45, 'Көл жолу'], ['southLink', 0.5, 'Кен-Арык өрөөнү']].forEach(([id, t, name], k) => {
      const [r, i] = atT(id, t); gantry(r, i, 'ЫЛДАМДЫК КАМЕРАСЫ', name, ['#c2185b']);
      stunts.push({ id: 'trap_' + id + k, type: 'trap', name, x: r.X[i], z: r.Z[i], stars: r.hw ? [170, 200, 230] : [130, 160, 190], unit: 'км/с' });
    });
    [['ring', 0.12, 0.2, 'Шакек зонасы'], ['coastN', 0.25, 0.62, 'Жээк зонасы'], ['spokeN', 0.1, 0.8, 'Түндүк зона'], ['southLink', 0.12, 0.42, 'Өрөөн зонасы']].forEach(([id, t0, t1, name]) => {
      const [r, i0] = atT(id, t0), [, i1] = atT(id, t1);
      gantry(r, i0, 'ЫЛДАМДЫК ЗОНАСЫ', 'БАШТАЛЫШ ▶', ['#6a1b9a']); gantry(r, i1, 'ЫЛДАМДЫК ЗОНАСЫ', 'АЯГЫ ■', ['#6a1b9a']);
      stunts.push({ id: 'zone_' + id, type: 'zone', name, x: r.X[(i0 + i1) >> 1], z: r.Z[(i0 + i1) >> 1], a: [r.X[i0], r.Z[i0]], b: [r.X[i1], r.Z[i1]], len: (i1 - i0) * 6, stars: r.hw ? [140, 170, 200] : [110, 135, 160], unit: 'км/с' });
    });

    // ========== XP ТАКТАЛАРЫ: 30 талкалануучу такта бүт аралда (табылганы кайра чыкпайт) ==========
    const boardsDone = new Set(TK.save.data.boards || []), boardSpots = [], bRnd = TK.util.seeded(7070);
    const rlist = Object.values(roads).filter(r => !r.hw || bRnd() < 2);
    for (let t = 0; t < 4000 && boardSpots.length < 30; t++) {
      const r = rlist[(bRnd() * rlist.length) | 0], i = (bRnd() * r.N) | 0, sd = bRnd() < 0.5 ? 1 : -1, off = r.half + 7 + bRnd() * 12;
      const x = r.X[i] + r.NX[i] * off * sd, z = r.Z[i] + r.NZ[i] * off * sd, y = H(x, z);
      if (y < SEA + 1.5 || Math.max(Math.abs(x), Math.abs(z)) < CITY + 20 || !clearOfRoads(x, z, 4) || nearPoi(x, z, 10) || nearJunction(x, z, 30)) continue;
      if (boardSpots.some(b => Math.hypot(b.x - x, b.z - z) < 220)) continue;
      boardSpots.push({ id: boardSpots.length, x, y, z, ry: Math.atan2(r.TX[i], r.TZ[i]) + Math.PI / 2 * sd });
    }
    const boardsLive = boardSpots.filter(b => !boardsDone.has(b.id));
    if (boardsLive.length) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 256, 128);
      gr.addColorStop(0, '#ff2d87'); gr.addColorStop(1, '#ff8a1f'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#fff'; g.font = '900 64px "Arial Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('XP', 128, 58); g.font = '700 16px Arial'; g.fillText('ТАЛКАЛА!', 128, 104);
      g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 122);
      const face = new THREE.InstancedMesh(new THREE.BoxGeometry(3.2, 1.6, 0.12), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }), boardsLive.length);
      const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), new THREE.MeshLambertMaterial({ color: 0x3a3f4a }), boardsLive.length * 2);
      boardsLive.forEach((b, k) => {
        D3.position.set(b.x, b.y + 2.3, b.z); D3.rotation.set(0, b.ry, 0); D3.scale.set(1, 1, 1); D3.updateMatrix(); face.setMatrixAt(k, D3.matrix);
        [-1.3, 1.3].forEach((o, q) => { D3.position.set(b.x + Math.cos(b.ry) * o, b.y + 1.3, b.z - Math.sin(b.ry) * o); D3.updateMatrix(); posts.setMatrixAt(k * 2 + q, D3.matrix); });
        brk.add({ x: b.x, z: b.z, y: b.y, r: 1.7, kind: 'board', boardId: b.id, parts: [[face, k], [posts, k * 2], [posts, k * 2 + 1]], scale: 1, strength: 0 });
      });
      group.add(face, posts);
    }

    // ========== БАРН ФАЙНДЫ: эски сарайларда унутулган машиналар ==========
    const barns = [];
    [[-180, 2020, 'porsche_930'], [1560, 620, 'muscle_v8'], [560, -2010, 'euro_gt']].forEach(([cx, cz, carId], k) => {
      let best = null;
      for (let t = 0; t < 400 && !best; t++) {
        const a = t * 2.4, d = t * 0.9, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = H(x, z);
        if (y < SEA + 2.5 || !clearOfRoads(x, z, 20) || Math.abs(H(x + 6, z) - H(x - 6, z)) > 3 || Math.abs(H(x, z + 6) - H(x, z - 6)) > 3) continue;
        best = { x, z, y };
      }
      if (!best) return;
      const b = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: 0x7a4a2a }), roof = TK.patchMat(new THREE.MeshLambertMaterial({ color: 0x8a2a22 }), { season: 'roof' });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 14), wood); wall.position.y = 2.5; b.add(wall);
      const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 7.4, 3.4, 4, 1), roof); rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 1.38); rf.position.y = 6.7; b.add(rf);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4), new THREE.MeshLambertMaterial({ color: 0x3d2414 })); door.position.set(0, 2, 7.02); b.add(door);
      const x1 = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 0.1), new THREE.MeshLambertMaterial({ color: 0xd8cfb8 })); x1.position.set(0, 2, 7.08); x1.rotation.z = 0.7; b.add(x1); const x2 = x1.clone(); x2.rotation.z = -0.7; b.add(x2);
      [[-6, 3], [6.5, -4], [-5.5, -6]].forEach(([hx, hz]) => { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.3, 10), new THREE.MeshLambertMaterial({ color: 0xd9b45a })); h.rotation.z = Math.PI / 2; h.position.set(hx, 0.9, hz); b.add(h); });
      b.position.set(best.x, best.y - 0.2, best.z); b.rotation.y = k * 1.3; group.add(b); solid(best.x, best.z, 13, 13);
      barns.push({ id: 'barn' + k, x: best.x, z: best.z, car: carId, hint: [best.x + (bRnd() - 0.5) * 160, best.z + (bRnd() - 0.5) * 160] });
    });
    if (rockL.length) { group.add(TK.Decor.rocks(rockL)); rockL.forEach(([x, y, z, sc]) => { if (sc > 1.1) scircle(x, z, sc * 1.05); }); }

    // ---------- трафик (шаардан тышкары) ----------
    const tmats = [0x5b6475, 0xa8adb8, 0x283a5c, 0x7a1e1e, 0x2d4a3a, 0xc9c3b5, 0x3e3e46, 0xe8e8e8].map(c => new THREE.MeshLambertMaterial({ color: c }));
    const tGeo = { body: new THREE.BoxGeometry(1.9, 0.7, 4.3), cab: new THREE.BoxGeometry(1.6, 0.55, 2.1), van: new THREE.BoxGeometry(2.0, 1.7, 5.2), light: new THREE.BoxGeometry(1.5, 0.12, 0.05), wheel: new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10) };
    tGeo.wheel.rotateZ(Math.PI / 2);
    const cabMat = new THREE.MeshLambertMaterial({ color: 0x10141c }), headM = new THREE.MeshBasicMaterial({ color: 0xfff4dc }), tailM = new THREE.MeshBasicMaterial({ color: 0xd01818 }), wheelM = new THREE.MeshLambertMaterial({ color: 0x111111 });
    function trafficCar(k) {
      const g = new THREE.Group(), van = k % 5 === 2, m = tmats[k % tmats.length];
      const b = new THREE.Mesh(van ? tGeo.van : tGeo.body, m); b.position.y = van ? 1.2 : 0.7; g.add(b);
      if (!van) { const c = new THREE.Mesh(tGeo.cab, cabMat); c.position.set(0, 1.3, -0.2); g.add(c); }
      const L = van ? 2.62 : 2.17;
      const h1 = new THREE.Mesh(tGeo.light, headM); h1.position.set(0, 0.78, L); g.add(h1);
      const t1 = new THREE.Mesh(tGeo.light, tailM); t1.position.set(0, 0.82, -L); g.add(t1);
      [[0.9, 1.4], [-0.9, 1.4], [0.9, -1.4], [-0.9, -1.4]].forEach(([x, z]) => { const w = new THREE.Mesh(tGeo.wheel, wheelM); w.position.set(x, 0.34, z * (van ? 1.15 : 1)); g.add(w); });
      return g;
    }
    const rtraffic = []; let tk = 0;
    Object.values(roads).forEach(r => {
      const n = Math.round((r.traffic || 0) * trafficK), lanes = r.hw ? [2.2, 6.2] : [r.half * 0.5];
      for (let k = 0; k < n; k++) {
        const dir = k % 2 ? 1 : -1, lane = lanes[k % lanes.length] * dir, g = trafficCar(tk++);
        group.add(g);
        if (!r.closed && r.s1 === undefined) { r.s0 = 2; while (r.s0 < r.N - 1 && nearJunction(r.X[r.s0], r.Z[r.s0], ring.half + 5)) r.s0++; r.s1 = r.N - 3; while (r.s1 > r.s0 && nearJunction(r.X[r.s1], r.Z[r.s1], ring.half + 5)) r.s1--; }
        rtraffic.push({ len: k % 5 === 2 ? 2.62 : 2.2, r, s: r.closed ? tr() * r.N : r.s0 + tr() * (r.s1 - r.s0), dir, lane, v: (r.hw ? 22 : 15) * (0.85 + tr() * 0.3), base: 0, stall: 0, g, x: 0, z: 0 });
      }
    });
    rtraffic.forEach(t => t.base = t.v);
    function sampleAt(r, s) {
      const N = r.N, f = r.closed ? ((s % N) + N) % N : clamp(s, 0, N - 1.001), i = Math.floor(f), j = r.closed ? (i + 1) % N : Math.min(N - 1, i + 1), t = f - i;
      return { x: r.X[i] + (r.X[j] - r.X[i]) * t, y: r.Y[i] + (r.Y[j] - r.Y[i]) * t, z: r.Z[i] + (r.Z[j] - r.Z[i]) * t, i };
    }

    // ---------- маршрут графы ----------
    const gX = [], gZ = [], adj = [];
    const addNode = (x, z) => { gX.push(x); gZ.push(z); adj.push([]); return gX.length - 1; };
    const link = (a, b) => { const c = Math.hypot(gX[a] - gX[b], gZ[a] - gZ[b]); adj[a].push([b, c]); adj[b].push([a, c]); };
    const cityNode = {};
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) cityNode[i + ',' + j] = addNode(i * 70, j * 70);
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) { if (i < 5) link(cityNode[i + ',' + j], cityNode[(i + 1) + ',' + j]); if (j < 5) link(cityNode[i + ',' + j], cityNode[i + ',' + (j + 1)]); }
    const roadNodes = {};
    Object.values(roads).forEach(r => {
      const ids = []; for (let i = 0; i < r.N; i += 4) ids.push(addNode(r.X[i], r.Z[i]));
      if (!r.closed && (r.N - 1) % 4) ids.push(addNode(r.X[r.N - 1], r.Z[r.N - 1]));
      for (let k = 1; k < ids.length; k++) link(ids[k - 1], ids[k]);
      if (r.closed) link(ids[ids.length - 1], ids[0]);
      roadNodes[r.id] = ids;
    });
    const nearestOf = (ids, x, z) => { let b = ids[0], bd = 1e12; ids.forEach(n => { const d = (gX[n] - x) ** 2 + (gZ[n] - z) ** 2; if (d < bd) { bd = d; b = n; } }); return b; };
    const cityIds = Object.values(cityNode);
    Object.values(roads).forEach(r => { if (!r.join) return; const ids = roadNodes[r.id]; r.join.forEach((tid, side) => { if (!tid) return; const n = side ? ids[ids.length - 1] : ids[0]; link(n, nearestOf(tid === 'city' ? cityIds : roadNodes[tid], gX[n], gZ[n])); }); });
    pois.forEach(p => { const a = addNode(p.x, p.z); let b = 0, bd = 1e12; for (let n = 0; n < a; n++) { const d = (gX[n] - p.x) ** 2 + (gZ[n] - p.z) ** 2; if (d < bd) { bd = d; b = n; } } link(a, b); });
    const NN = gX.length;
    function nearestNode(x, z) { let b = 0, bd = 1e12; for (let n = 0; n < NN; n++) { const d = (gX[n] - x) ** 2 + (gZ[n] - z) ** 2; if (d < bd) { bd = d; b = n; } } return b; }
    function route(fx, fz, tx, tz) {
      const goal = nearestNode(tx, tz), dist = new Float64Array(NN).fill(Infinity), prev = new Int32Array(NN).fill(-1), done = new Uint8Array(NN);
      dist[goal] = 0;
      for (;;) {
        let u = -1, ud = Infinity; for (let n = 0; n < NN; n++) if (!done[n] && dist[n] < ud) { ud = dist[n]; u = n; }
        if (u < 0) break; done[u] = 1;
        for (const [v, c] of adj[u]) if (ud + c < dist[v]) { dist[v] = ud + c; prev[v] = u; }
      }
      let start = 0, best = Infinity;
      for (let n = 0; n < NN; n++) { const d = Math.hypot(gX[n] - fx, gZ[n] - fz); if (d < 160 && d * 1.3 + dist[n] < best) { best = d * 1.3 + dist[n]; start = n; } }
      if (best === Infinity) start = nearestNode(fx, fz);
      const pts = [[fx, fz]]; let u = start, guard = 0;
      while (u >= 0 && guard++ < 5000) { pts.push([gX[u], gZ[u]]); u = prev[u]; }
      pts.push([tx, tz]);
      return pts;
    }

    // ---------- карта сүрөтү (жылмакай рельеф + көлөкө, жол, шаар) ----------
    const IMG = quality < 1 ? 1280 : 1792, img = document.createElement('canvas'); img.width = img.height = IMG;
    (function paint() {
      // 1) ар бир тор чекити үчүн түс (бийиктик + эңкейиш + көлөкө)
      const W1 = NG + 1, vc = new Float32Array(W1 * W1 * 3), fN = TK.Terrain.makeNoise(99);
      const Lx = 0.45, Ly = 0.75, Lz = 0.48, C = (r, g2, b2) => [r / 255, g2 / 255, b2 / 255], mix = (a1, b1, t) => [a1[0] + (b1[0] - a1[0]) * t, a1[1] + (b1[1] - a1[1]) * t, a1[2] + (b1[2] - a1[2]) * t];
      const LOW = C(150, 178, 112), FOR = C(96, 132, 82), HIL = C(170, 165, 128), ROCK = C(160, 154, 146), SNOW = C(246, 248, 250), SAND = C(232, 218, 170), SH = C(122, 190, 214), DEEP = C(42, 104, 150);
      for (let k = 0; k < heights.length; k++) {
        const x = pos[k * 3], z = pos[k * 3 + 2], y = heights[k];
        let c;
        if (y < SEA) c = mix(SH, DEEP, clamp((SEA - y) / 12, 0, 1));
        else {
          c = mix(LOW, FOR, smooth(0.45, 0.62, fN(x * 0.004, z * 0.004)) * 0.8);
          c = mix(c, HIL, smooth(25, 90, y)); c = mix(c, ROCK, smooth(90, 160, y)); c = mix(c, SNOW, smooth(190, 240, y));
          c = mix(c, SAND, 1 - smooth(SEA + 1.2, SEA + 3.5, y));
          const sh = 0.62 + 0.55 * Math.max(0, nor[k * 3] * Lx + nor[k * 3 + 1] * Ly + nor[k * 3 + 2] * Lz);
          c = [c[0] * sh, c[1] * sh, c[2] * sh];
        }
        vc[k * 3] = c[0]; vc[k * 3 + 1] = c[1]; vc[k * 3 + 2] = c[2];
      }
      // 2) пикселдер — билинеардык (жылмакай, блоктор жок)
      const g = img.getContext('2d'), id = g.createImageData(IMG, IMG), k = IMG / (EXT * 2), d = id.data;
      for (let py = 0; py < IMG; py++) {
        const fz = (py / k) / STEP, j = Math.min(NG - 1, Math.floor(fz)), v = fz - j;
        for (let px = 0; px < IMG; px++) {
          const fx = (px / k) / STEP, i = Math.min(NG - 1, Math.floor(fx)), u = fx - i;
          const a0 = (j * W1 + i) * 3, a1 = a0 + 3, b0 = a0 + W1 * 3, b1 = b0 + 3, o2 = (py * IMG + px) * 4;
          for (let ch = 0; ch < 3; ch++) d[o2 + ch] = 255 * Math.min(1, (vc[a0 + ch] * (1 - u) + vc[a1 + ch] * u) * (1 - v) + (vc[b0 + ch] * (1 - u) + vc[b1 + ch] * u) * v);
          d[o2 + 3] = 255;
        }
      }
      g.putImageData(id, 0, 0);
      g.setTransform(k, 0, 0, k, EXT * k, EXT * k);
      // шаар
      g.fillStyle = '#c9ced6'; g.fillRect(-CITY, -CITY, CITY * 2, CITY * 2);
      city.mapBlocks.forEach(b2 => { g.fillStyle = b2.lot ? '#e9b45a' : '#8e98a8'; g.fillRect(b2.x0 + 2, b2.z0 + 2, b2.x1 - b2.x0 - 4, b2.z1 - b2.z0 - 4); });
      // дрифт зона
      g.fillStyle = '#4a4f5a'; g.fillRect(DZ.x - DZ.w / 2, DZ.z - DZ.d / 2, DZ.w, DZ.d); g.strokeStyle = '#e94b4b'; g.lineWidth = 3; g.strokeRect(DZ.x - DZ.w / 2, DZ.z - DZ.d / 2, DZ.w, DZ.d);
      // жолдор: кара контур + ак ички
      const path = r => { g.beginPath(); for (let i = 0; i < r.N; i++) i ? g.lineTo(r.X[i], r.Z[i]) : g.moveTo(r.X[i], r.Z[i]); if (r.closed) g.closePath(); };
      g.lineCap = 'round'; g.lineJoin = 'round';
      Object.values(roads).forEach(r => { g.strokeStyle = 'rgba(40,46,58,.85)'; g.lineWidth = r.half * 2.6 + 9; path(r); g.stroke(); });
      Object.values(roads).forEach(r => { g.strokeStyle = r.hw ? '#ffffff' : (r.site || r.id === 'hill' ? '#f6e7bf' : '#eef1f5'); g.lineWidth = r.half * 2.6; path(r); g.stroke(); });
      Object.values(roads).forEach(r => { for (let i = 0; i < r.N - 1; i++) if (r.bri[i]) { g.strokeStyle = '#7a8597'; g.lineWidth = r.half * 2.6 + 9; g.beginPath(); g.moveTo(r.X[i], r.Z[i]); g.lineTo(r.X[i + 1], r.Z[i + 1]); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = r.half * 2.6; g.stroke(); } });
      tunnels.forEach(t => { g.strokeStyle = '#2a2f3a'; g.setLineDash([16, 12]); g.lineWidth = t.r.half * 2.6 + 4; g.beginPath(); for (let i = t.i0; i <= t.i1; i++) i === t.i0 ? g.moveTo(t.r.X[i], t.r.Z[i]) : g.lineTo(t.r.X[i], t.r.Z[i]); g.stroke(); g.setLineDash([]); });
      // аэропорт
      g.fillStyle = '#4b4e56'; g.fillRect(AIR.x - AIR.w / 2, AIR.z0, AIR.w, AIR.z1 - AIR.z0); g.fillRect(-725, 1410, 70, 180);
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.setLineDash([26, 18]); g.beginPath(); g.moveTo(AIR.x, AIR.z0 + 10); g.lineTo(AIR.x, AIR.z1 - 10); g.stroke(); g.setLineDash([]);
      // үйлөр жана имараттар
      g.fillStyle = '#d9cdb5'; g.strokeStyle = 'rgba(60,50,40,.5)'; g.lineWidth = 1.5; solids.forEach(b2 => { g.fillRect(b2.x0, b2.z0, b2.x1 - b2.x0, b2.z1 - b2.z0); g.strokeRect(b2.x0, b2.z0, b2.x1 - b2.x0, b2.z1 - b2.z0); });
    })();

    const isWalled = (q) => q && (q.r.bri[q.i] || q.r.tun[q.i]);
    const map = {
      id: 'world', viewR: 2150, breakables: brk, group, city, roads, pois, lots: city.lots, traffic: city.traffic, boxes: city.boxes, EXT, SEA, driftZone: DZ,
      spawn: { x: 0, z: -10, h: 0 },
      intersection: city.intersection,
      groundY: H, roadQuery, route, airport: AIR,
      seasonal(v) { const on = v[0] < 0.35 && v[1] < 0.7; flowerMeshes.forEach(m => m.visible = on); },
      runway(x, z) { return Math.abs(x - AIR.x) < AIR.w / 2 + 25 && z > AIR.z0 - 30 && z < AIR.z1 + 30; },
      buildingAt(x, z) { for (const b of city.boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return (b.h || 30) + 1; let h = 0; solGrid.near(x, z, b => { if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) h = 14; }); return h; }, speedTraps, stunts, barns, boards: boardSpots, sites: SITES, follow: grassField.follow, press: grassField.press,
      point(spec) {
        if (Array.isArray(spec)) return city.intersection(spec[0], spec[1]);
        if (spec.poi) { const p = pois.find(q => q.type === spec.poi); return { x: p.x, z: p.z }; }
        const r = roads[spec.road], i = clamp(Math.round(spec.t * (r.N - 1)), 0, r.N - 1);
        return { x: r.X[i], z: r.Z[i] };
      },
      snapToRoad(x, z) {
        const n = nearestNode(x, z), rc = Math.max(Math.abs(gX[n]), Math.abs(gZ[n]));
        let h = 0; const q = roadQuery(gX[n], gZ[n]);
        if (q && rc > CITY) h = Math.atan2(q.r.TX[q.i], q.r.TZ[q.i]);
        else { const a = adj[n][0]; if (a) h = Math.atan2(gX[a[0]] - gX[n], gZ[a[0]] - gZ[n]); }
        return { x: gX[n], z: gZ[n], h };
      },
      inWater(car) { return H(car.x, car.z) < SEA - 4.5; },     // тайыз сууда (≤4.5 м) машина сууда жүрөт, терең болсо — чөгөт
      poiAt(x, z) { return pois.find(p => (p.type === 'fuel' || p.type === 'garage' || p.type === 'airport') && Math.hypot(p.x - x, p.z - z) < p.r) || null; },
      trafficList() { return city.traffic.map(t => t.g.position).concat(rtraffic.map(t => t.g.position)); },
      surface(car) {
        if (Math.max(Math.abs(car.x), Math.abs(car.z)) < CITY) return { grip: 1, drag: 0 };
        if (H(car.x, car.z) < SEA - 0.25) return { grip: 0.62, drag: 0.32, water: 1 };
        if (Math.abs(car.x - DZ.x) < DZ.w / 2 && Math.abs(car.z - DZ.z) < DZ.d / 2) return { grip: 1, drag: 0 };
        if (inAir(car.x, car.z, -18)) return { grip: 1, drag: 0 };
        if (pois.some(p => (p.type === 'fuel' || p.type === 'garage') && Math.hypot(p.x - car.x, p.z - car.z) < 22)) return { grip: 1, drag: 0 };
        const q = roadQuery(car.x, car.z);
        if (q && q.lat <= q.half) return { grip: 1, drag: 0 };
        if (q && q.lat <= q.half + 2.4) return { grip: 0.88, drag: 0.01, dirt: 0.4 };
        return { grip: 0.78, drag: 0.008, dirt: 1 };     // чөп/топурак: тайгак, бирок 140 км/с чейин айдаса болот
      },
      collide(car) {
        const P = TK.Physics;
        city.collide(car);
        for (const b of solids) if (car.x > b.x0 - 4 && car.x < b.x1 + 4 && car.z > b.z0 - 4 && car.z < b.z1 + 4) P.hitBox(car, b.x0, b.z0, b.x1, b.z1);
        scircles.near(car.x, car.z, o => { if (Math.abs(o.x - car.x) < o.r + 3 && Math.abs(o.z - car.z) < o.r + 3) P.hitCircle(car, o.x, o.z, o.r, 0.2); });
        // көпүрө (бетон тосмо) жана туннелдин дубалдары
        const q = roadQuery(car.x, car.z);
        if (isWalled(q) && q.lat < q.half + 6) {
          const r = q.r, i = q.i, sg = Math.sign(q.latS) || 1, wl = r.bri[i] ? r.half + 0.15 : r.half + 1.9;
          if (q.lat > wl - 3) P.hitWall(car, r.X[i] + r.NX[i] * wl * sg, r.Z[i] + r.NZ[i] * wl * sg, -r.NX[i] * sg, -r.NZ[i] * sg);
        }
        // дрифт зонанын бетон тосмолору
        const lx = car.x - DZ.x, lz = car.z - DZ.z;
        if (Math.abs(lx) < DZ.w / 2 + 1 && Math.abs(lz) < DZ.d / 2 + 1) {
          const hw = DZ.w / 2 - 0.3, hd = DZ.d / 2 - 0.3;
          if (lx > hw - 3) P.hitWall(car, DZ.x + hw, 0, -1, 0);
          if (lx < -hw + 3) P.hitWall(car, DZ.x - hw, 0, 1, 0);
          if (lz > hd - 3) P.hitWall(car, 0, DZ.z + hd, 0, -1);
          if (lz < -hd + 3 && Math.abs(lx) > 9.5) P.hitWall(car, 0, DZ.z - hd, 0, 1);
        }
        // жол трафиги
        for (const t of rtraffic) { if (Math.abs(t.x - car.x) < 8 && Math.abs(t.z - car.z) < 8) { const v = P.hitCar(car, t.x, t.z, t.g.rotation.y, t.len, 0.3); if (v > 0.05) TK.knockTraffic(t, car, v, t.x, t.z); } }
        brk.collide(car, (it, sp) => { if (map.onBreak) map.onBreak(it); });
        const BW = EXT - 160;
        if (car.x > BW - 3) P.hitWall(car, BW, 0, -1, 0); if (car.x < -BW + 3) P.hitWall(car, -BW, 0, 1, 0);
        if (car.z > BW - 3) P.hitWall(car, 0, BW, 0, -1); if (car.z < -BW + 3) P.hitWall(car, 0, -BW, 0, 1);
      },
      respawn(car) { const s = this.snapToRoad(car.x, car.z); car.x = s.x; car.z = s.z; car.h = s.h; car.vx = car.vz = car.yaw = 0; },
      update(dt, e) {
        city.update(dt, e);
        brk.update(dt, H);
        poolMat.opacity = e.lamps; pools.visible = e.lamps > 0.02;
        lampHeadMat.color.setRGB(0.32, 0.34, 0.38).lerp(new THREE.Color(0xffc46b), e.lamps);
        winLit.forEach((m, i) => m.color.setHex(e.windows > 0.3 && i % 3 ? 0xffd58a : 0x2a3448));
        townMats.forEach(m => m.emissiveIntensity = e.windows);
        const t = performance.now() / 1000; TK.WIND.value = t; grassField.tick();
        turbines.forEach(tb => tb.rotor.rotation.z = t * 0.9 + tb.ph);
        boats.forEach((b, k) => { b.position.y = SEA + Math.sin(t * 0.9 + k) * 0.25; b.rotation.z = Math.sin(t * 0.7 + k) * 0.04; });
        if (lh) { lh.piv.rotation.y = t * 0.8; lh.beamMat.opacity = 0.25 * e.lamps; lh.piv.visible = e.lamps > 0.05; }
        wtex.offset.x = t * 0.004; wtex.offset.y = t * 0.006;
        waterMat.color.setRGB(0.18, 0.43, 0.56).lerp(new THREE.Color(0x0a1626), e.windows * 0.85);
        boards.forEach(b => b.userData.face.color.setScalar(0.55 + 0.45 * Math.max(1 - e.windows, e.lamps * 0.9)));
        // жол трафиги
        for (const tt of rtraffic) {
          const K = tt.kv;
          if (K && K.on) { if (TK.knockStep(K, dt)) tt.s = tt.r.closed ? tt.s + tt.r.N * 0.35 : tt.r.s0 + Math.random() * (tt.r.s1 - tt.r.s0); }
          else { tt.v += (tt.base - tt.v) * Math.min(1, dt); tt.s += tt.dir * tt.v * dt / 6; }
          if (!tt.r.closed) {   // жолдун учунда артка бурулат (кесилишке кирбейт)
            if (tt.s > tt.r.s1) { tt.s = tt.r.s1; tt.dir = -1; tt.lane = -Math.abs(tt.lane); }
            if (tt.s < tt.r.s0) { tt.s = tt.r.s0; tt.dir = 1; tt.lane = Math.abs(tt.lane); }
          }
          const p = sampleAt(tt.r, tt.s), r = tt.r, i = p.i;
          const kn = K && K.on;
          tt.x = p.x + r.NX[i] * tt.lane + (kn ? K.ox : 0); tt.z = p.z + r.NZ[i] * tt.lane + (kn ? K.oz : 0);
          tt.g.position.set(tt.x, (kn ? H(tt.x, tt.z) + K.oy : p.y) + 0.14, tt.z); tt.g.rotation.set(0, Math.atan2(r.TX[i], r.TZ[i]) + (tt.dir < 0 ? Math.PI : 0) + (kn ? K.rot : 0), kn ? K.roll : 0, 'YXZ');
        }
      },
      drawMinimap(mg, car, overlay) {
        mg.drawImage(img, -EXT, -EXT, EXT * 2, EXT * 2);
        mg.fillStyle = 'rgba(230,235,245,.85)';
        for (const t of city.traffic) { const p = t.g.position; mg.fillRect(p.x - 2.5, p.z - 2.5, 5, 5); }
        for (const t of rtraffic) mg.fillRect(t.x - 3, t.z - 3, 6, 6);
        if (overlay) overlay(mg);
      },
      dispose() { brk.dispose(); city.dispose(); scene.remove(group); TK.util.disposeTree(group); }
    };
    return map;
  };
})();
