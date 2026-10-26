/* Күн / күүгүм / түн: асман, туман, жарык, жылдыздар. Бир сахнага туташтырылат, убакыт жумшак алмашат. */
(function () {
  const C = h => new THREE.Color(h);
  const PRESETS = {
    day:    { name: 'Күн',    top: C(0x2f6fd0), horizon: C(0xb9d4ee), fog: C(0xa9c3de), fogD: 0.00062, hemiSky: C(0xcfe0ff), hemiGround: C(0x6a6a58), hemiI: 0.78, sun: C(0xfff0d2), sunI: 0.85, sunDir: [0.45, 0.8, 0.35], windows: 0, lamps: 0, stars: 0, head: 0, glow: C(0xfff2c8), glowS: 120, glowO: 0.9 },
    sunset: { name: 'Күүгүм', top: C(0x25295e), horizon: C(0xff8c4d), fog: C(0xa9593a), fogD: 0.0012, hemiSky: C(0xff9a68), hemiGround: C(0x3b2a30), hemiI: 0.78, sun: C(0xff8a45), sunI: 0.95, sunDir: [-0.85, 0.16, 0.5], windows: 0.55, lamps: 0.65, stars: 0.18, head: 0.7, glow: C(0xff9a50), glowS: 190, glowO: 0.95 },
    night:  { name: 'Түн',    top: C(0x03050e), horizon: C(0x16203a), fog: C(0x0b0f1c), fogD: 0.0026, hemiSky: C(0x5b6c9e), hemiGround: C(0x14121a), hemiI: 0.75, sun: C(0x9fb3ff), sunI: 0.38, sunDir: [-0.5, 0.8, -0.3], windows: 1, lamps: 1, stars: 1, head: 1, glow: C(0xcfe0ff), glowS: 55, glowO: 0.8 }
  };

  function Environment(scene) {
    const self = this;
    this.scene = scene;
    this.preset = 'night';
    this.p = cloneP(PRESETS.night);
    this.target = PRESETS.night;
    this.wx = { fog: 1, sun: 1, gray: 0 }; this.wxT = { fog: 1, sun: 1, gray: 0 }; this.weather = 'clear';
    scene.fog = new THREE.FogExp2(this.p.fog.getHex(), this.p.fogD);

    this.hemi = new THREE.HemisphereLight(0x5b6c9e, 0x14121a, 0.75);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(this.hemi, this.sun, this.sun.target);

    // асман куполу
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); float t = pow(h,0.55); gl_FragColor = vec4(mix(hor, top, t),1.0); }'
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 14), this.skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false; scene.add(this.sky);

    // жылдыздар
    const sp = [], rn = TK.util.seeded(7);
    for (let i = 0; i < 700; i++) {
      const u = rn() * 2 - 1, th = rn() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const y = Math.abs(u) * 0.95 + 0.05;
      sp.push(r * Math.cos(th) * 1400, y * 1400, r * Math.sin(th) * 1400);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false; scene.add(this.stars);

    // күн / ай жаркырактары
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    this.disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.disc.renderOrder = -9; scene.add(this.disc);
    this.apply(0);
  }
  function cloneP(t) {
    const o = {};
    for (const k in t) o[k] = t[k] && t[k].isColor ? t[k].clone() : (Array.isArray(t[k]) ? t[k].slice() : t[k]);
    return o;
  }
  Environment.prototype.setTime = function (name, instant) {
    if (!PRESETS[name]) name = 'night';
    this.preset = name; this.target = PRESETS[name];
    if (instant) { this.p = cloneP(PRESETS[name]); this.apply(0); }
  };
  const WX = { clear: { fog: 1, sun: 1, gray: 0 }, cloudy: { fog: 1.5, sun: 0.55, gray: 0.45 }, rain: { fog: 2.6, sun: 0.35, gray: 0.7 }, fog: { fog: 5, sun: 0.5, gray: 0.55 } };
  Environment.prototype.setWeather = function (w, instant) { this.weather = WX[w] ? w : 'clear'; this.wxT = WX[this.weather]; if (instant) Object.assign(this.wx, this.wxT); };
  Environment.prototype.update = function (dt, camPos) {
    const t = 1 - Math.exp(-2.2 * dt), p = this.p, T = this.target;
    for (const k in this.wxT) this.wx[k] += (this.wxT[k] - this.wx[k]) * t;
    for (const k in T) {
      if (k === 'name') { p.name = T.name; continue; }
      if (T[k].isColor) p[k].lerp(T[k], t);
      else if (Array.isArray(T[k])) for (let i = 0; i < T[k].length; i++) p[k][i] += (T[k][i] - p[k][i]) * t;
      else p[k] += (T[k] - p[k]) * t;
    }
    this.apply(dt, camPos);
  };
  Environment.prototype.apply = function (dt, camPos) {
    const p = this.p, s = this.scene;
    const w = this.wx, lum = 0.2 + 0.8 * (1 - p.windows * 0.85), grayC = new THREE.Color(0x8d939c).multiplyScalar(lum);
    s.fog.color.copy(p.fog).lerp(grayC, w.gray * 0.8); s.fog.density = p.fogD * w.fog;
    this.skyMat.uniforms.top.value.copy(p.top).lerp(grayC, w.gray); this.skyMat.uniforms.hor.value.copy(p.fog).lerp(p.horizon, 0.6).lerp(grayC, w.gray * 0.85);
    this.hemi.color.copy(p.hemiSky); this.hemi.groundColor.copy(p.hemiGround); this.hemi.intensity = p.hemiI * (1 - 0.2 * w.gray);
    this.sun.color.copy(p.sun); this.sun.intensity = p.sunI * w.sun;
    const d = p.sunDir, L = Math.hypot(d[0], d[1], d[2]) || 1;
    const cp = camPos || this.sky.position;
    this.sun.position.set(cp.x + d[0] / L * 300, Math.max(20, d[1] / L * 300), cp.z + d[2] / L * 300);
    this.sun.target.position.set(cp.x, 0, cp.z);
    this.sky.position.copy(cp); this.stars.position.copy(cp);
    this.stars.material.opacity = p.stars;
    this.disc.position.set(cp.x + d[0] / L * 1200, cp.y + d[1] / L * 1200 + 20, cp.z + d[2] / L * 1200);
    this.disc.material.color.copy(p.glow); this.disc.material.opacity = p.glowO * w.sun; this.stars.material.opacity = p.stars * (1 - w.gray); this.disc.scale.setScalar(p.glowS * 2);
  };
  Environment.PRESETS = PRESETS;
  TK.Environment = Environment;
})();
