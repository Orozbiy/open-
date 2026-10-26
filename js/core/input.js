/* Башкаруу: клавиатура + телефон баскычтары.
   W/S газ-тормоз · A/D руль · Space дрифт · Shift/N нитро · T — TC · C — камера · F — фото · G — дрон · E — аракет (гараж) · M — карта · R — жолго · Esc — тыным */
(function () {
  const keys = {};
  const touch = { left: 0, right: 0, gas: 0, brake: 0, hb: 0, n2o: 0, rw: 0 };
  const hooks = { reset: null, pause: null, map: null, tc: null, cam: null, action: null, photo: null, drone: null };
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys[e.code] = true;
    if (['Space', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyR' && hooks.reset) hooks.reset();
    if ((e.code === 'Escape' || e.code === 'KeyP') && hooks.pause) hooks.pause(e.code);
    if (e.code === 'KeyM' && hooks.map) hooks.map();
    if (e.code === 'KeyT' && hooks.tc) hooks.tc();
    if (e.code === 'KeyC' && hooks.cam) hooks.cam();
    if (e.code === 'KeyF' && hooks.photo) hooks.photo();
    if (e.code === 'KeyG' && hooks.drone) hooks.drone();
    if ((e.code === 'KeyE' || e.code === 'Enter') && hooks.action) hooks.action();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  function bindTouch() {
    document.querySelectorAll('[data-ctl]').forEach(el => {
      const k = el.dataset.ctl;
      const on = e => { e.preventDefault(); touch[k] = 1; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (_) {} };
      const off = () => { touch[k] = 0; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
      el.addEventListener('contextmenu', e => e.preventDefault());
    });
  }
  TK.input = {
    hooks, bindTouch, keys,
    _force: null,
    read() {
      if (this._force) return Object.assign({ gas: 0, brake: 0, hb: 0, n2o: 0, steer: 0 }, this._force);
      return {
        gas: (keys.KeyW || keys.ArrowUp || touch.gas) ? 1 : 0,
        brake: (keys.KeyS || keys.ArrowDown || touch.brake) ? 1 : 0,
        hb: (keys.Space || touch.hb) ? 1 : 0,
        n2o: (keys.ShiftLeft || keys.ShiftRight || keys.KeyN || touch.n2o) ? 1 : 0,
        rewind: (keys.KeyZ || keys.Backspace || touch.rw) ? 1 : 0,
        steer: ((keys.KeyD || keys.ArrowRight || touch.right) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft || touch.left) ? 1 : 0)
      };
    },
    clear() { for (const k in touch) touch[k] = 0; for (const k in keys) keys[k] = false; document.querySelectorAll('[data-ctl].on').forEach(e => e.classList.remove('on')); }
  };
})();
