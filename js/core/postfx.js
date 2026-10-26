/* ЫЛДАМДЫК БҮДӨМҮГҮ (motion blur) жана кабинанын ичи.
   PostFX: сахна текстурага тартылат, анан экранга радиалдык (ылдамдыкта четтери созулат)
   жана бурулганда капталдык бүдөмүк менен чыгарылат. Борбору ачык калат — Forza сыяктуу. */
(function () {
  TK.PostFX = function (renderer) {
    const size = new THREE.Vector2();
    const RT = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget;
    let rt = null;
    function ensure() {
      renderer.getDrawingBufferSize(size);
      if (rt && rt.width === size.x && rt.height === size.y) return;
      if (rt) rt.dispose();
      rt = new RT(size.x, size.y, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
      if (rt.samples !== undefined) rt.samples = 4;
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uZoom: { value: 0 }, uSide: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.52) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uZoom; uniform float uSide; uniform vec2 uCenter; varying vec2 vUv;
        void main(){
          vec2 d = vUv - uCenter; float r = length(d);
          float m = smoothstep(0.12, 0.62, r);                 // борбору ачык, четтери бүдөмүк
          vec2 step = d * uZoom * m + vec2(uSide * m * 0.5 + uSide * 0.35, 0.0);
          vec4 c = vec4(0.0); float w = 0.0;
          for (int i = 0; i < 10; i++) { float t = float(i) / 9.0; float k = 1.0 - t * 0.6; c += texture2D(tDiffuse, vUv - step * t) * k; w += k; }
          gl_FragColor = c / w;
        }`,
      depthTest: false, depthWrite: false
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
    const qs = new THREE.Scene(); qs.add(quad); const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return {
      // zoom: 0..~0.06 (ылдамдыкка жараша), side: бурулуудан (−0.02..0.02)
      render(scene, camera, zoom, side) {
        if (zoom < 0.002 && Math.abs(side) < 0.0015) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
        ensure();
        renderer.setRenderTarget(rt); renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        mat.uniforms.tDiffuse.value = rt.texture; mat.uniforms.uZoom.value = zoom; mat.uniforms.uSide.value = side;
        renderer.render(qs, qc);
      }
    };
  };

  /* ---------- КАБИНА: торпедо, руль, приборлор, тирөөчтөр, күзгү ---------- */
  TK.buildCockpit = function (spec) {
    const g = new THREE.Group(); g.visible = false;
    const cab = spec.cabin || [[0.8, 0.68, 0.78, 0.9], [0.3, 0.66, 0.78, 1.25], [-0.5, 0.64, 0.78, 1.28], [-1.4, 0.55, 0.78, 1.0]];
    const wsZ = cab[0][0], roofY = Math.max(...cab.map(c => c[3])), z1c = cab[cab.length - 1][0];
    // кабинанын астындагы кузовдун эң бийик жери — пол ошонун үстүнө коюлат
    const tubTop = Math.max(cab[0][2], ...(spec.tub || []).filter(t => t[0] <= wsZ + 0.3 && t[0] >= z1c - 0.2).map(t => t[3]));
    const yb = tubTop;
    const top = cab.filter(c => c[3] > roofY - 0.08), roofZ0 = top[0][0], roofZ1 = top[top.length - 1][0];
    const hw = Math.max(...cab.map(c => c[1])) - 0.05;
    const eye = new THREE.Vector3(hw * 0.5, Math.min(yb + 0.42, roofY - 0.12), Math.min(roofZ0 - 0.25, wsZ - 0.85));
    const dark = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.8 }), trim = new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.6, metalness: 0.2 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.75 });
    const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
    // торпедо (приборлор панели) — көздөн ылдыйыраак, алдыда
    const dz = eye.z + 0.85, dy = eye.y - 0.31;
    box(hw * 2, 0.12, 0.55, dark, 0, dy, dz + 0.15).rotation.x = -0.1;
    box(hw * 2, 0.05, 0.25, trim, 0, dy - 0.12, dz - 0.15);
    const hood = box(0.42, 0.05, 0.16, dark, eye.x, dy + 0.075, dz - 0.04);           // приборлордун козырьогу
    // приборлор (канваста ылдамдык жана обороттор)
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 112; const tex = new THREE.CanvasTexture(cv);
    const gauges = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.16), new THREE.MeshBasicMaterial({ map: tex }));
    gauges.position.set(eye.x, dy + 0.0, dz - 0.12); gauges.rotation.set(-0.2, Math.PI, 0); g.add(gauges);
    // кабинанын асты жана эшиктер (кузовдун ички кызыл бетин жабат)
    box(hw * 2, 0.04, dz - eye.z + 0.9, new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.95 }), 0, yb + 0.02, (dz + eye.z - 0.9) / 2 + 0.2);
    [1, -1].forEach(sd => box(0.06, 0.3, dz - eye.z + 0.9, trim, sd * hw * 0.99, yb + 0.12, (dz + eye.z - 0.9) / 2 + 0.2));
    // ортоңку экран
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13), new THREE.MeshBasicMaterial({ color: 0x1d4f7a })); scr.position.set(0, dy - 0.04, dz - 0.18); scr.rotation.set(-0.3, Math.PI, 0); g.add(scr);
    // руль (кабинадан караганда төмөнкү бөлүгүндө көрүнөт)
    const wheel = new THREE.Group(); wheel.position.set(eye.x, eye.y - 0.33, eye.z + 0.5); wheel.rotation.x = -0.32; g.add(wheel);
    // тирөөчтөр (A-стойка), төбө, эшиктер
    [1, -1].forEach(sd => {
      const len = Math.hypot(roofZ0 - wsZ, roofY - yb), ang = Math.atan2(roofY - yb, wsZ - roofZ0);
      const p = box(0.07, 0.07, len, dark, sd * hw * 0.98, (yb + roofY) / 2, (wsZ + roofZ0) / 2); p.rotation.x = ang;
      box(0.05, 0.32, Math.abs(wsZ - roofZ1) * 0.9, trim, sd * hw, yb - 0.1, (wsZ + roofZ1) / 2);           // эшиктин ички бети
    });
    box(hw * 2, 0.03, Math.abs(roofZ0 - roofZ1) + 0.2, new THREE.MeshStandardMaterial({ color: 0x55585f, roughness: 0.9 }), 0, roofY - 0.04, (roofZ0 + roofZ1) / 2);
    box(hw * 1.9, 0.07, 0.07, dark, 0, roofY - 0.06, roofZ0 + 0.02);                                         // шамал айнектин үстү
    box(0.22, 0.06, 0.02, new THREE.MeshStandardMaterial({ color: 0x9aa3b0, metalness: 0.9, roughness: 0.15 }), 0, roofY - 0.13, roofZ0 - 0.05);   // арткы күзгү
    // отургучтар жана берүү ручкасы
    [1, -1].forEach(sd => box(0.48, 0.55, 0.12, leather, sd * hw * 0.5, yb + 0.05, eye.z - 0.35));
    box(0.04, 0.16, 0.04, trim, 0, yb - 0.18, eye.z + 0.25); box(0.07, 0.07, 0.07, leather, 0, yb - 0.08, eye.z + 0.25);
    let tAcc = 0;
    function draw(kmh, rpm, gear) {
      const c = cv.getContext('2d'); c.fillStyle = '#07080c'; c.fillRect(0, 0, 256, 112);
      [[64, rpm, 'x1000', 8], [192, Math.min(1, kmh / 300), 'km/h', 300]].forEach(([cx, v, u, mx], k) => {
        c.strokeStyle = '#3a3f4a'; c.lineWidth = 3; c.beginPath(); c.arc(cx, 60, 46, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
        if (k === 0) { c.strokeStyle = '#d23a2e'; c.beginPath(); c.arc(cx, 60, 46, Math.PI * 0.75 + Math.PI * 1.5 * 0.85, Math.PI * 2.25); c.stroke(); }
        const a = Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1, v));
        c.strokeStyle = '#ff6a1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, 60); c.lineTo(cx + Math.cos(a) * 40, 60 + Math.sin(a) * 40); c.stroke();
        c.fillStyle = '#9aa0ab'; c.font = '10px Arial'; c.textAlign = 'center'; c.fillText(u, cx, 98);
      });
      c.fillStyle = '#fff'; c.font = 'bold 22px Arial'; c.textAlign = 'center'; c.fillText(Math.round(kmh), 192, 68);
      c.fillStyle = '#ffb547'; c.font = 'bold 20px Arial'; c.fillText(gear, 64, 68);
      tex.needsUpdate = true;
    }
    return {
      group: g, eye, wheel,
      update(dt, steer, kmh, rpm, gear) {
        wheel.rotation.z = -steer * 1.9;
        tAcc += dt; if (tAcc > 1 / 20) { tAcc = 0; draw(kmh, rpm, gear); }
      }
    };
  };
})();
