/* Негизги ааламдык объект жана жалпы функциялар */
window.TK = {
  VERSION: '0.9.1',
  START_CASH: 30000,
  util: {
    rnd: (a, b) => a + Math.random() * (b - a),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    // детерминдүү кокус сан (бир эле дүйнө ар дайым бирдей чыгышы үчүн)
    seeded: function (seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); },
    money: v => '$' + Math.floor(v).toLocaleString('ru-RU'),
    disposeTree: function (obj) {
      obj.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      });
    }
  }
};
