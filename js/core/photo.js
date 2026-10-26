/* Фото режим жана Дрон режими.
   ФОТО (F): оюн токтойт, HUD жашырылат, камера машинанын айланасында (чычкан/манжа менен буруу, дөңгөлөк — жакын/алыс),
             FOV, кыйшайтуу (roll), убакыт, аба ырайы. «СҮРӨТКӨ ТАРТУУ» — PNG болуп сакталат (интерфейссиз, таза кадр).
   ДРОН (G): камера каалаган жакка учат. W/S алга-артка, A/D капталга, E/Space өйдө, Q/Ctrl ылдый,
             жебелер же чычкан менен бурулат, дөңгөлөк — ылдамдык, Shift — тез. Телефондо: сол джойстик, оң жагы — карап буруу. */
(function () {
  const clamp = TK.util.clamp;
  TK.PhotoMode = function (ctx) {
    const { camera, renderer, canvas } = ctx;
    const ui = document.getElementById('photo');
    const st = { on: false, mode: 'photo', yaw: 0, pitch: 0.18, dist: 7.5, fov: 55, roll: 0, ty: 1,
      pos: new THREE.Vector3(), dyaw: 0, dpitch: 0, vel: new THREE.Vector3(), speed: 18, hide: false };
    const keys = TK.input.keys;
    const joy = { x: 0, y: 0, up: 0, down: 0 };
    let saveFov = 62, shots = 0;

    function el(id) { return document.getElementById(id); }
    function build() {
      ui.innerHTML = `
        <div class="ph-top">
          <div class="ph-mode"><button data-pm="photo">ФОТО</button><button data-pm="drone">ДРОН</button></div>
          <div class="ph-hint" id="phHint"></div>
          <button class="ph-x" id="phExit" aria-label="Чыгуу">✕</button>
        </div>
        <div class="ph-side" id="phSide">
          <label>Көрүү бурчу <b id="phFovV"></b><input type="range" id="phFov" min="18" max="100" step="1"></label>
          <label>Кыйшайтуу <b id="phRollV"></b><input type="range" id="phRoll" min="-35" max="35" step="1"></label>
          <label id="phSpdL">Дрон ылдамдыгы <b id="phSpdV"></b><input type="range" id="phSpd" min="3" max="90" step="1"></label>
          <div class="ph-seg" id="phTime">${[['day', 'Күн'], ['sunset', 'Күүгүм'], ['night', 'Түн']].map(([v, t]) => `<button data-t="${v}">${t}</button>`).join('')}</div>
          <div class="ph-seg" id="phWx">${[['clear', 'Ачык'], ['cloudy', 'Булут'], ['rain', 'Жамгыр'], ['fog', 'Туман']].map(([v, t]) => `<button data-w="${v}">${t}</button>`).join('')}</div>
          <button class="ph-small" id="phCar">МАШИНАГА КАЙТУУ</button>
        </div>
        <div class="ph-joy" id="phJoy"><i></i></div>
        <div class="ph-ud"><button id="phUp">▲</button><button id="phDn">▼</button></div>
        <button class="ph-shot" id="phShot" aria-label="Сүрөткө тартуу"><i></i></button>
        <img class="ph-thumb" id="phThumb" alt="" hidden>
        <div class="ph-flash" id="phFlash"></div>`;
      ui.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => setMode(b.dataset.pm));
      el('phExit').onclick = () => exit();
      el('phShot').onclick = () => shot();
      el('phCar').onclick = () => { if (st.mode === 'drone') dronefromCar(); else { st.yaw = 0; st.pitch = 0.18; st.dist = 7.5; } };
      el('phFov').oninput = e => { st.fov = +e.target.value; sync(); };
      el('phRoll').oninput = e => { st.roll = +e.target.value; sync(); };
      el('phSpd').oninput = e => { st.speed = +e.target.value; sync(); };
      ui.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { ctx.setTime(b.dataset.t); sync(); });
      ui.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { ctx.setWeather(b.dataset.w); sync(); });
      // джойстик (телефон)
      const J = el('phJoy'), knob = J.firstChild; let jid = null;
      const jm = e => { const r = J.getBoundingClientRect(), R = r.width / 2; let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joy.x = x; joy.y = y; knob.style.transform = `translate(${x * R * 0.6}px,${y * R * 0.6}px)`; };
      J.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); jid = e.pointerId; try { J.setPointerCapture(jid); } catch (_) {} jm(e); });
      J.addEventListener('pointermove', e => { if (e.pointerId === jid) jm(e); });
      const je = e => { if (e.pointerId !== jid) return; jid = null; joy.x = joy.y = 0; knob.style.transform = ''; };
      J.addEventListener('pointerup', je); J.addEventListener('pointercancel', je);
      [['phUp', 'up'], ['phDn', 'down']].forEach(([id, k]) => { const b = el(id); b.addEventListener('pointerdown', e => { e.preventDefault(); joy[k] = 1; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => joy[k] = 0)); });
    }
    function sync() {
      ui.querySelectorAll('[data-pm]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pm === st.mode));
      ui.querySelectorAll('[data-t]').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === ctx.curTime()));
      ui.querySelectorAll('[data-w]').forEach(b => b.setAttribute('aria-pressed', b.dataset.w === ctx.curWeather()));
      el('phFov').value = st.fov; el('phFovV').textContent = st.fov + '°';
      el('phRoll').value = st.roll; el('phRollV').textContent = st.roll + '°';
      el('phSpd').value = st.speed; el('phSpdV').textContent = Math.round(st.speed * 3.6) + ' км/с';
      el('phSpdL').hidden = st.mode !== 'drone';
      ui.classList.toggle('drone', st.mode === 'drone');
      ui.classList.toggle('clean', st.hide);
      el('phHint').innerHTML = st.mode === 'drone'
        ? '<b>W A S D</b> учуу · <b>E/Space</b> өйдө · <b>Q/Ctrl</b> ылдый · <b>чычкан / жебелер</b> буруу · <b>дөңгөлөк</b> ылдамдык · <b>Shift</b> тез · <b>P</b> сүрөт · <b>H</b> жашыруу'
        : '<b>чычкан</b> айландыруу · <b>дөңгөлөк</b> жакын/алыс · <b>W/S</b> бийиктик · <b>P / Enter</b> сүрөт · <b>G</b> дрон · <b>H</b> жашыруу · <b>Esc</b> чыгуу';
    }
    function dronefromCar() {
      const c = ctx.getCar(), y = ctx.carY();
      st.dyaw = Math.atan2(Math.sin(c.h), Math.cos(c.h)); st.dpitch = -0.25;
      st.pos.set(c.x - Math.sin(c.h) * 10, y + 5, c.z - Math.cos(c.h) * 10); st.vel.set(0, 0, 0);
    }
    function setMode(m) {
      if (m === 'drone' && st.mode !== 'drone') {
        // дрон камеранын азыркы ордунан учуп баштайт
        st.pos.copy(camera.position); const d = new THREE.Vector3(); camera.getWorldDirection(d);
        st.dyaw = Math.atan2(d.x, d.z); st.dpitch = Math.asin(clamp(d.y, -1, 1)); st.vel.set(0, 0, 0);
      }
      if (m === 'photo' && st.mode !== 'photo') { const c = ctx.getCar(); st.yaw = Math.atan2(camera.position.x - c.x, camera.position.z - c.z) - c.h; st.dist = clamp(Math.hypot(camera.position.x - c.x, camera.position.z - c.z), 3, 40); }
      st.mode = m; sync();
    }
    function enter(m) {
      if (!ui.innerHTML) build();
      st.on = true; saveFov = camera.fov; st.fov = Math.round(camera.fov); st.roll = 0; st.hide = false;
      const c = ctx.getCar(); st.mode = 'photo';
      st.yaw = Math.atan2(camera.position.x - c.x, camera.position.z - c.z) - c.h;
      st.dist = clamp(Math.hypot(camera.position.x - c.x, camera.position.z - c.z), 4, 12); st.pitch = 0.2; st.ty = 1;
      ui.hidden = false; setMode(m || 'photo'); sync();
    }
    function exit() {
      if (!st.on) return; st.on = false; ui.hidden = true; camera.fov = saveFov; camera.up.set(0, 1, 0); camera.updateProjectionMatrix();
      joy.x = joy.y = joy.up = joy.down = 0; ctx.onExit();
    }
    function shot() {
      renderer.render(ctx.scene, camera);
      let url;
      try {
        // экрандагы жарыктык (CSS фильтр) сүрөткө да колдонулат
        const c2 = document.createElement('canvas'); c2.width = canvas.width; c2.height = canvas.height;
        const g2 = c2.getContext('2d'); const f = canvas.style.filter; if (f && 'filter' in g2) g2.filter = f;
        g2.drawImage(canvas, 0, 0); url = c2.toDataURL('image/png');
      } catch (e) { try { url = canvas.toDataURL('image/png'); } catch (e2) { TK.HUD.toast('СҮРӨТ', 'сактоо мүмкүн болгон жок', 1.5); return; } }
      const d = new Date(), p = n => String(n).padStart(2, '0');
      const a = document.createElement('a'); a.href = url; a.download = `tunku-kocho_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      const th = el('phThumb'); th.src = url; th.hidden = false; th.classList.remove('pop'); void th.offsetWidth; th.classList.add('pop');
      const f = el('phFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
      TK.audio.click && TK.audio.click(); shots++;
    }

    // ----- чычкан / манжа -----
    let drag = null;
    canvas.addEventListener('pointerdown', e => { if (!st.on) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} });
    canvas.addEventListener('pointermove', e => {
      if (!st.on || !drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (st.mode === 'photo') { st.yaw -= dx * 0.008; st.pitch = clamp(st.pitch + dy * 0.006, -0.15, 1.45); }
      else { st.dyaw -= dx * 0.004; st.dpitch = clamp(st.dpitch - dy * 0.004, -1.5, 1.5); }
    });
    const up = e => { if (drag && drag.id === e.pointerId) drag = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => {
      if (!st.on) return; e.preventDefault();
      if (st.mode === 'photo') st.dist = clamp(st.dist * Math.exp(e.deltaY * 0.0012), 2.6, 60);
      else st.speed = clamp(st.speed * Math.exp(-e.deltaY * 0.0012), 3, 90);
      sync();
    }, { passive: false });
    addEventListener('keydown', e => {
      if (!st.on || e.repeat || (e.target && e.target.tagName === 'INPUT')) return;
      if (e.code === 'KeyP' || e.code === 'Enter') { e.stopImmediatePropagation(); shot(); }
      else if (e.code === 'KeyH') { st.hide = !st.hide; sync(); }
      else if (e.code === 'KeyG') setMode(st.mode === 'drone' ? 'photo' : 'drone');
      else if (e.code === 'KeyF') setMode('photo');
      else if (e.code === 'Escape') { e.stopImmediatePropagation(); exit(); }
    }, true);

    // ----- ар бир кадр -----
    const tmp = new THREE.Vector3();
    function update(dt) {
      if (!st.on) return;
      const c = ctx.getCar(), cy = ctx.carY();
      if (st.mode === 'photo') {
        if (keys.KeyW || keys.ArrowUp) st.ty = clamp(st.ty + dt * 1.5, 0.2, 4);
        if (keys.KeyS || keys.ArrowDown) st.ty = clamp(st.ty - dt * 1.5, 0.2, 4);
        if (keys.KeyA || keys.ArrowLeft) st.yaw += dt * 1.2;
        if (keys.KeyD || keys.ArrowRight) st.yaw -= dt * 1.2;
        const a = c.h + st.yaw, hd = st.dist * Math.cos(st.pitch);
        let x = c.x + Math.sin(a) * hd, z = c.z + Math.cos(a) * hd, y = cy + st.ty + Math.sin(st.pitch) * st.dist;
        y = Math.max(y, ctx.groundY(x, z) + 0.35);
        camera.position.set(x, y, z); tmp.set(c.x, cy + st.ty * 0.8, c.z);
        camera.up.set(0, 1, 0); camera.lookAt(tmp);
      } else {
        // дрон: инерциясы бар жумшак учуу
        const turn = 1.6 * dt;
        if (keys.ArrowLeft) st.dyaw += turn; if (keys.ArrowRight) st.dyaw -= turn;
        if (keys.ArrowUp) st.dpitch = clamp(st.dpitch + turn * 0.7, -1.5, 1.5); if (keys.ArrowDown) st.dpitch = clamp(st.dpitch - turn * 0.7, -1.5, 1.5);
        const fw = ((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0)) - joy.y, sd = ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)) + joy.x;
        const ud = ((keys.KeyE || keys.Space ? 1 : 0) - (keys.KeyQ || keys.ControlLeft || keys.KeyC ? 1 : 0)) + joy.up - joy.down;
        const boost = (keys.ShiftLeft || keys.ShiftRight) ? 3 : 1, sp = st.speed * boost;
        const sy = Math.sin(st.dyaw), cyw = Math.cos(st.dyaw), cp = Math.cos(st.dpitch), spch = Math.sin(st.dpitch);
        // алга — карап турган жакка (бийиктикти да өзгөртөт), каптал — горизонталдуу
        tmp.set(sy * cp * fw - cyw * sd, spch * fw + ud, cyw * cp * fw + sy * sd);
        if (tmp.lengthSq() > 1) tmp.normalize();
        tmp.multiplyScalar(sp);
        st.vel.lerp(tmp, 1 - Math.exp(-4 * dt));
        st.pos.addScaledVector(st.vel, dt);
        const g = ctx.groundY(st.pos.x, st.pos.z);
        if (st.pos.y < g + 0.8) { st.pos.y = g + 0.8; if (st.vel.y < 0) st.vel.y = 0; }
        st.pos.y = Math.min(st.pos.y, 900);
        const B = ctx.bound || 1900; st.pos.x = clamp(st.pos.x, -B, B); st.pos.z = clamp(st.pos.z, -B, B);
        camera.position.copy(st.pos);
        tmp.set(st.pos.x + sy * cp, st.pos.y + spch, st.pos.z + cyw * cp);
        camera.up.set(0, 1, 0); camera.lookAt(tmp);
      }
      if (st.roll) camera.rotateZ(-st.roll * Math.PI / 180);
      if (Math.abs(camera.fov - st.fov) > 0.01) { camera.fov = st.fov; camera.updateProjectionMatrix(); }
    }
    return { enter, exit, update, shot, setMode, get on() { return st.on; }, get mode() { return st.mode; }, st };
  };
})();
