/* Аба ырайы: булуттар жана жамгыр. Environment.setWeather менен бирге иштейт. */
(function () {
  TK.Weather = function (scene, env) {
    // булут текстурасы
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = TK.util.seeded(12);
    for (let i = 0; i < 26; i++) { const x = 20 + r() * 88, y = 40 + r() * 50, rad = 14 + r() * 26, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    const tex = new THREE.CanvasTexture(c);
    const clouds = [], N = 46;
    for (let i = 0; i < N; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0 });
      const s = new THREE.Sprite(m); const a = r() * 6.283, d = 300 + r() * 1100;
      s.userData = { ox: Math.cos(a) * d, oz: Math.sin(a) * d, y: 240 + r() * 220, k: 0.5 + r() * 0.5 };
      s.scale.set(380 + r() * 380, 150 + r() * 120, 1); s.renderOrder = -8; scene.add(s); clouds.push(s);
    }
    // жамгыр
    const RN = 1600, rp = new Float32Array(RN * 6);
    for (let i = 0; i < RN; i++) { const x = (r() - .5) * 70, y = r() * 40, z = (r() - .5) * 70; rp.set([x, y, z, x + 0.05, y - 0.9, z], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaab8cc, transparent: true, opacity: 0.45 }));
    rain.frustumCulled = false; rain.visible = false; scene.add(rain);
    // кар: камеранын айланасында акырын түшкөн, тербелген ак бүртүкчөлөр
    const SN = 2600, sp = new Float32Array(SN * 3), sph = new Float32Array(SN);
    for (let i = 0; i < SN; i++) { sp[i * 3] = (r() - .5) * 90; sp[i * 3 + 1] = r() * 45; sp[i * 3 + 2] = (r() - .5) * 90; sph[i] = r() * 6.28; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const fc = document.createElement('canvas'); fc.width = fc.height = 32; const fg = fc.getContext('2d'), fgr = fg.createRadialGradient(16, 16, 0, 16, 16, 16); fgr.addColorStop(0, 'rgba(255,255,255,1)'); fgr.addColorStop(1, 'rgba(255,255,255,0)'); fg.fillStyle = fgr; fg.fillRect(0, 0, 32, 32);
    const snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.35, map: new THREE.CanvasTexture(fc), transparent: true, depthWrite: false, opacity: 0.9 }));
    snow.frustumCulled = false; snow.visible = false; scene.add(snow);
    let snowAmt = 0, snowT = 0;
    let drift = 0, rainY = 0;
    const AMT = { clear: 0.25, cloudy: 0.9, rain: 1, fog: 0.6 };
    return {
      update(dt, cam) {
        drift += dt * 4;
        const amt = AMT[env.weather] || 0.25, p = env.p, lum = 1 - p.windows * 0.8;
        const col = new THREE.Color(0xffffff).lerp(p.horizon, 0.35).multiplyScalar(0.35 + 0.65 * lum).lerp(new THREE.Color(0x777d86), env.wx.gray * 0.6);
        clouds.forEach((s, i) => {
          const u = s.userData; let x = u.ox + drift, z = u.oz;
          x = ((x + 1500) % 3000 + 3000) % 3000 - 1500;
          s.position.set(cam.x + x, u.y, cam.z + z);
          const target = (i / N < amt ? 1 : 0) * (0.55 + 0.4 * u.k) * (env.weather === 'rain' ? 1.1 : 1);
          s.material.opacity += (target - s.material.opacity) * Math.min(1, dt * 0.8);
          s.material.color.copy(col);
        });
        this.updateSnow(dt, cam);
        rain.visible = env.weather === 'rain';
        if (rain.visible) { rainY = (rainY - dt * 32) % 40; if (rainY < 0) rainY += 40; rain.position.set(cam.x, cam.y - 20 + rainY - 20 + 20, cam.z); rain.material.opacity = 0.35 + 0.2 * lum; }
      },
      setSnow(k) { snowAmt = k; },
      updateSnow(dt, cam) {
        snow.visible = snowAmt > 0.05; if (!snow.visible) return;
        snowT += dt; const a = sg.attributes.position.array, n = Math.floor(SN * Math.min(1, snowAmt));
        for (let i = 0; i < SN; i++) {
          let y = a[i * 3 + 1] - dt * (1.6 + (i % 7) * 0.12); if (y < 0) y += 45; a[i * 3 + 1] = i < n ? y : -999;
          a[i * 3] += Math.sin(snowT * 0.9 + sph[i]) * dt * 0.6;
        }
        sg.attributes.position.needsUpdate = true;
        // камера жылганда бүртүкчөлөр айланасында калат
        snow.position.set(Math.floor(cam.x / 90) * 90, cam.y - 20, Math.floor(cam.z / 90) * 90);
        for (let i = 0; i < SN; i++) { const wx = snow.position.x + a[i * 3], wz = snow.position.z + a[i * 3 + 2]; if (wx - cam.x > 45) a[i * 3] -= 90; else if (wx - cam.x < -45) a[i * 3] += 90; if (wz - cam.z > 45) a[i * 3 + 2] -= 90; else if (wz - cam.z < -45) a[i * 3 + 2] += 90; }
      },
      get wet() { return env.weather === 'rain'; }
    };
  };
})();
