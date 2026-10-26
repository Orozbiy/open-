/* Сактоо: акча, машиналар, рекорддор, жөндөөлөр (localStorage) */
(function () {
  const KEY = 'tk2_save';
  const def = () => ({
    cash: TK.START_CASH, owned: ['drift_coupe'], car: 'drift_coupe', paint: {}, stars: {}, best: {},
    settings: { quality: 1, sound: true, daytime: 'auto' }
  });
  let d = def();
  try { const raw = localStorage.getItem(KEY); if (raw) { const p = JSON.parse(raw); d = Object.assign(def(), p); d.settings = Object.assign(def().settings, p.settings || {}); } } catch (_) {}
  TK.save = {
    data: d,
    commit() { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (_) {} },
    addCash(v) { d.cash += v; this.commit(); },
    reset() { d = def(); this.data = d; this.commit(); }
  };
})();
