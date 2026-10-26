/* САМОЛЁТ: аэропорттон учуп, бүт аралды айланып, кайра конуу.
   Башкаруу: W — газ (тартылуу) көбөйөт, S — азаят / жерде тормоз; A/D — канатты кыйшайтуу (бурулуу);
   ↓ же Space — тумшугун көтөрүү (өйдө), ↑ же Shift — тумшугун түшүрүү (ылдый); E — жерде токтогондо түшүү; R — тилкеге кайтуу.
   Физика (жөнөкөйлөтүлгөн, бирок чыныгыга окшош): тартылуу күчү, аба каршылыгы, өйдө учканда ылдамдык азаят,
   ылдамдык 120 км/с төмөн болсо — «сток» (тумшугу түшөт, түшө баштайт), бурулуу — канаттын кыйшаюусу менен,
   катуу конуу же жерге/сууга/имаратка тийүү — кырсык. */
(function () {
  const clamp = TK.util.clamp, G = 9.8, GEAR = 1.45, VSTALL = 33;
  function model() {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f3f5, metalness: 0.3, roughness: 0.4 });
    const red = new THREE.MeshStandardMaterial({ color: 0xd23a2e, metalness: 0.3, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.6 });
    const glass = new THREE.MeshPhongMaterial({ color: 0x1d2e44, shininess: 100, specular: 0x9fc8e0 });
    const add = (geo, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); body.add(o); return o; };
    // фюзеляж (алды +z)
    const fus = new THREE.CylinderGeometry(0.62, 0.28, 7.2, 14); fus.rotateX(Math.PI / 2); add(fus, white, 0, 0, -0.6);
    const nose = new THREE.CylinderGeometry(0.42, 0.62, 1.2, 14); nose.rotateX(Math.PI / 2); add(nose, red, 0, 0, 3.6);
    add(new THREE.SphereGeometry(0.42, 12, 8), red, 0, 0, 4.2);
    const cab = add(new THREE.SphereGeometry(0.58, 14, 10), glass, 0, 0.42, 1.4); cab.scale.set(0.95, 0.75, 1.9);
    add(new THREE.BoxGeometry(1.3, 0.1, 6.5), red, 0, -0.05, -0.6).scale.set(1, 1, 1);           // кызыл тилке
    // канаттар
    add(new THREE.BoxGeometry(11, 0.16, 1.7), white, 0, 0.15, 0.9);
    [1, -1].forEach(s => { add(new THREE.BoxGeometry(1.2, 0.17, 1.72), red, s * 5.0, 0.15, 0.9); add(new THREE.BoxGeometry(0.3, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: s > 0 ? 0x22ff55 : 0xff2a2a }), s * 5.55, 0.2, 0.9); });
    // куйрук
    add(new THREE.BoxGeometry(3.8, 0.12, 1.0), white, 0, 0.12, -3.9);
    add(new THREE.BoxGeometry(0.12, 1.5, 1.1), red, 0, 0.85, -3.95, -0.25);
    // пропеллер
    const prop = new THREE.Group(); prop.position.set(0, 0, 4.66); body.add(prop);
    prop.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.06), dark)); prop.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 0.06), dark));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.18, side: THREE.DoubleSide })); prop.add(disc);
    // шасси
    const wg = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12); wg.rotateZ(Math.PI / 2);
    [[0.9, -1.1, 0.4], [-0.9, -1.1, 0.4], [0, -1.1, 3.2]].forEach(([x, y, z]) => { add(wg, dark, x, y, z); add(new THREE.BoxGeometry(0.08, 0.9, 0.08), dark, x, -0.65, z); });
    return { g, body, prop };
  }

  TK.PlaneMode = function (ctx) {
    const { scene, camera, fx } = ctx;
    const M = model(); M.g.visible = false; scene.add(M.g);
    const P = { active: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, v: 0, thr: 0, air: false, crashT: 0, vy: 0, sink: 0, h: 0 };
    const cam = new THREE.Vector3(), look = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const hudEl = document.getElementById('planeHud');
    function spawn() {
      const A = ctx.airport(); if (!A) return;
      Object.assign(P, { x: A.x, z: A.z0 + 25, yaw: 0, pitch: 0, roll: 0, v: 0, thr: 0, air: false, crashT: 0, vy: 0, sink: 0 });
      P.y = ctx.groundY(P.x, P.z) + GEAR; snap();
    }
    function fwd() { const cp = Math.cos(P.pitch); return [Math.sin(P.yaw) * cp, Math.sin(P.pitch), Math.cos(P.yaw) * cp]; }
    function snap() { const f = fwd(); cam.set(P.x - f[0] * 22, P.y + 6, P.z - f[2] * 22); camera.position.copy(cam); look.set(P.x + f[0] * 12, P.y + 1, P.z + f[2] * 12); camera.lookAt(look); }
    function enter() { P.active = true; M.g.visible = true; spawn(); if (hudEl) hudEl.hidden = false; document.getElementById('hud').classList.add('plane'); TK.HUD.toast('САМОЛЁТ', 'W — газ · ↓/Space — өйдө · A/D — бурулуу', 3); }
    function exit() { P.active = false; M.g.visible = false; if (hudEl) hudEl.hidden = true; document.getElementById('hud').classList.remove('plane'); camera.up.set(0, 1, 0); }
    function crash(why) {
      P.crashT = 2.2; P.v = 0; ctx.shake(0.9); TK.audio.beep(60, 0.6, 'sawtooth', 0.4);
      for (let k = 0; k < 70; k++) fx.spawn(k % 3 ? 'smoke' : 'spark', P.x, P.y, P.z, (Math.random() - .5) * 14, Math.random() * 10, (Math.random() - .5) * 14);
      TK.HUD.toast('КЫРСЫК!', why + ' · тилкеге кайтасыз', 2);
    }
    function step(h, inp) {
      const keys = TK.input.keys;
      const pitchIn = (inp.hb ? 1 : 0) + (keys.ArrowDown ? 1 : 0) - (inp.n2o ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
      const thrIn = (inp.gas && !keys.ArrowUp ? 1 : 0) - (inp.brake && !keys.ArrowDown ? 1 : 0), rollIn = inp.steer;
      P.thr = clamp(P.thr + thrIn * 0.55 * h, 0, 1);
      const gy = ctx.groundY(P.x, P.z) + GEAR, auth = clamp(P.v / 45, 0.12, 1);
      // ылдамдык жол боюнча: тартылуу − каршылык − гравитация (өйдө учса жайлайт)
      let acc = P.thr * 9.5 - 0.0016 * P.v * P.v - 0.01 * P.v - G * Math.sin(P.pitch);
      if (!P.air) { acc -= 0.5; if (thrIn < 0 && P.thr < 0.05) acc -= 7; }
      P.v = Math.max(0, P.v + acc * h);
      // башкаруу
      P.pitch += pitchIn * 0.6 * auth * h;
      if (P.air) {
        P.roll += rollIn * 1.8 * auth * h; if (!rollIn) P.roll *= Math.exp(-1.1 * h);
        P.roll = clamp(P.roll, -1.35, 1.35);
        P.yaw -= G * Math.tan(P.roll) / Math.max(P.v, 18) * h;                // кыйшайып бурулуу
        P.pitch -= (1 - Math.cos(P.roll)) * 0.4 * h;                          // кыйшайганда көтөрүү күчү азаят
        const st = clamp(1 - P.v / VSTALL, 0, 1);                              // сток
        P.pitch -= st * 0.9 * h; P.sink = st * 9;
      } else {
        P.roll *= Math.exp(-6 * h); P.sink = 0;
        P.yaw -= rollIn * 0.55 * h * clamp(P.v / 8, 0, 1);                    // жерде тумшук дөңгөлөгү менен буруу
        if (P.v < 28) P.pitch = Math.min(P.pitch, 0);                          // тумшук дөңгөлөгү жерде
        P.pitch = clamp(P.pitch, 0, 0.22);
      }
      P.pitch = clamp(P.pitch, -1.1, 1.0);
      const f = fwd();
      P.vy = P.v * f[1] - P.sink;
      P.x += P.v * f[0] * h; P.z += P.v * f[2] * h; P.y += P.vy * h;
      const gy2 = ctx.groundY(P.x, P.z) + GEAR;
      if (P.y <= gy2) {
        if (P.air) {                                                         // конуу
          if (P.vy < -7.5 || Math.abs(P.roll) > 0.5 || P.pitch < -0.28) return crash(P.vy < -7.5 ? 'катуу конуу' : 'туура эмес конуу');
          if (!ctx.runway(P.x, P.z) && P.v > 24) return crash('тилкеден тышкары конуу');
          TK.HUD.toast('КОНДУ', Math.round(-P.vy * 10) / 10 + ' м/с', 1.2); P.air = false;
        }
        P.y = gy2; if (P.pitch < 0) P.pitch = 0;
        if (!ctx.runway(P.x, P.z) && P.v > 12) { P.v *= Math.exp(-1.5 * h); }   // чөптө жайлайт
      } else if (P.y > gy2 + 0.4) P.air = true;
      if (ctx.inWater(P.x, P.z) && P.y < ctx.sea + 1.5) return crash('сууга түштү');
      const bh = ctx.buildingAt(P.x, P.z); if (bh && P.y < bh) return crash('имаратка урунду');
      const B = ctx.bound; if (Math.abs(P.x) > B - 150 || Math.abs(P.z) > B - 150) {   // дүйнөнүн чети: самолёт акырындап аралды карай бурулат
        let d = Math.atan2(-P.x, -P.z) - P.yaw; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283;
        P.yaw += clamp(d, -1, 1) * 0.9 * h; P.x = clamp(P.x, -B, B); P.z = clamp(P.z, -B, B);
        if (!P.warnB) { TK.HUD.toast('ЧЕК', 'аралга кайтып жатасыз', 1.4); P.warnB = 1; }
      } else P.warnB = 0;
      P.y = Math.min(P.y, 1500);
    }
    function update(dt, inp) {
      if (P.crashT > 0) { P.crashT -= dt; if (P.crashT <= 0) spawn(); }
      else { const n = 3; for (let i = 0; i < n && P.active && P.crashT <= 0; i++) step(dt / n, inp); }
      // визуал
      M.g.position.set(P.x, P.y - GEAR + 1.1, P.z);
      M.g.rotation.set(-P.pitch, P.yaw, P.roll, 'YXZ');
      M.g.visible = P.crashT <= 0;
      M.prop.rotation.z += (8 + P.thr * 60) * dt;
      // камера: артта жана бир аз өйдө, канат менен бир аз кыйшаят
      const f = fwd(), k = 1 - Math.exp(-4 * dt);
      const back = 20 + P.v * 0.05;
      cam.x += (P.x - f[0] * back - cam.x) * k; cam.z += (P.z - f[2] * back - cam.z) * k;
      cam.y += (P.y - f[1] * back * 0.6 + 5.5 - cam.y) * k;
      const cg = ctx.groundY(cam.x, cam.z) + 2; if (cam.y < cg) cam.y = cg;
      camera.position.copy(cam);
      look.set(P.x + f[0] * 14, P.y + f[1] * 14 + 1.2, P.z + f[2] * 14);
      up.set(-Math.cos(P.yaw) * Math.sin(P.roll) * 0.35, 1, Math.sin(P.yaw) * Math.sin(P.roll) * 0.35).normalize();
      camera.up.copy(up); camera.lookAt(look);
      if (hudEl) {
        const agl = Math.max(0, P.y - GEAR - ctx.groundY(P.x, P.z));
        hudEl.innerHTML = `<div><small>ЫЛДАМДЫК</small><b>${Math.round(P.v * 3.6)}</b><i>км/с</i></div><div><small>БИЙИКТИК</small><b>${Math.round(P.y - ctx.sea)}</b><i>м</i></div><div><small>ЖЕРДЕН</small><b>${Math.round(agl)}</b><i>м</i></div><div class="thr"><small>ГАЗ</small><span><em style="height:${Math.round(P.thr * 100)}%"></em></span><i>${Math.round(P.thr * 100)}%</i></div>${P.v < VSTALL && P.air ? '<div class="warn">СТОК!</div>' : ''}<div class="keys">${P.air ? 'A/D бурулуу · ↓/Space өйдө · ↑/Shift ылдый' : (P.v < 8 ? 'W — газ · E — түшүү' : 'Space/↓ — көтөрүлүү (≥120 км/с)')}</div>`;
      }
    }
    return { enter, exit, update, spawn, P, get active() { return P.active; }, proxy: { get x() { return P.x; }, get z() { return P.z; }, get h() { return P.yaw; }, get y() { return P.y; } } };
  };
})();
