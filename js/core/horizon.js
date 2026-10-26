/* FORZA HORIZON сыяктуу система:
   • PR трюктар — ылдамдык камерасы, ылдамдык зонасы (орточо ылдамдык), коркунуч белгиси (секириктин узундугу); ар биринде 1–3 ★
   • XP такталары — 30 такта аралда жашырылган; талкалаганда XP
   • Барн файнд — эски сарайлардан унутулган машина табасыз (картада «?» аймак)
   • Артка тартуу (REWIND) — Z / Backspace же ⟲ баскычы: акыркы 10 секунд артка кайтат
   • Кир — топуракта машина кирдейт, сууда/жамгырда тазаланат
   • Wheelspin — ар бир жаңы деңгээлде дөңгөлөк айлантуу (CR же машина утасыз) */
(function () {
  const clamp = TK.util.clamp;
  const S = () => TK.save.data;
  const starsOf = (st, v) => v >= st.stars[2] ? 3 : v >= st.stars[1] ? 2 : v >= st.stars[0] ? 1 : 0;
  const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  TK.Horizon = function (ctx) {
    const H = { rec: [], rewinding: false, zone: null, air: null, cool: {}, dirt: 0, washMsg: 0 };
    const save = () => { const d = S(); d.stunts = d.stunts || {}; d.barns = d.barns || []; d.boards = d.boards || []; return d; };

    function result(st, v) {
      const d = save(), old = d.stunts[st.id] || 0, oS = starsOf(st, old), nS = starsOf(st, v);
      if (v > old) d.stunts[st.id] = Math.round(v);
      const title = { trap: 'ЫЛДАМДЫК КАМЕРАСЫ', zone: 'ЫЛДАМДЫК ЗОНАСЫ', jump: 'КОРКУНУЧ БЕЛГИСИ' }[st.type];
      const txt = Math.round(v) + ' ' + st.unit + '  ' + starStr(nS) + (v > old && old ? '  · ЖАҢЫ РЕКОРД' : '');
      TK.HUD.toast(title + ' · ' + st.name.toUpperCase(), txt + (nS < 3 ? '  (кийинки ★: ' + st.stars[nS] + ' ' + st.unit + ')' : ''), 2.6);
      if (nS > oS) { const gain = nS - oS; ctx.addXP(400 * gain); ctx.addCash(1500 * gain); TK.audio.gate && TK.audio.gate(); }
      ctx.earn(Math.round(v * 6), title.split(' ')[0] + ' <em>' + Math.round(v) + '</em>');
      TK.save.commit();
    }

    // ----- ар бир кадр (оюн учурунда) -----
    function update(dt, car, speed, onWater, rain, free) {
      const map = ctx.map(); if (!map) return;
      // 1) артка тартуу үчүн жазуу (30 кадр/сек, 10 сек)
      H.recT = (H.recT || 0) + dt;
      if (H.recT >= 1 / 30) { H.recT = 0; H.rec.push([car.x, car.z, car.y, car.h, car.vx, car.vz, car.vy || 0, car.yaw, car.spin, car.steer, car.vf, car.vl, car.n2o, car.airT || 0]); if (H.rec.length > 300) H.rec.shift(); }
      // 6) кир: топуракта кирдейт, сууда / жамгырда тазаланат
      const sf = ctx.surface ? ctx.surface() : {};
      if (sf.dirt && speed > 3) H.dirt = Math.min(1, H.dirt + dt * 0.012 * sf.dirt * (speed / 15));
      if (onWater || rain) { const was = H.dirt; H.dirt = Math.max(0, H.dirt - dt * (onWater ? 0.35 : 0.03)); if (was > 0.3 && H.dirt < 0.05 && onWater) TK.HUD.toast('💧 ЖУУЛДУ', 'машина тап-таза', 1.2); }
      ctx.applyDirt(H.dirt);
      if (!free) return;
      const sts = map.stunts || [];
      // 2) ылдамдык камерасы
      for (const st of sts) {
        if (st.type !== 'trap') continue;
        if (H.cool[st.id] > 0) { H.cool[st.id] -= dt; continue; }
        if (Math.hypot(st.x - car.x, st.z - car.z) < 15) { H.cool[st.id] = 5; result(st, speed * 3.6); }
      }
      // 3) ылдамдык зонасы: башталыш дарбазасынан аягына чейинки орточо ылдамдык
      if (H.zone) {
        const z = H.zone; z.t += dt;
        if (Math.hypot(z.st.b[0] - car.x, z.st.b[1] - car.z) < 14) { result(z.st, z.st.len / z.t * 3.6); H.zone = null; }
        else if (z.t > 120 || Math.hypot(z.st.x - car.x, z.st.z - car.z) > z.st.len) { TK.HUD.toast('ЫЛДАМДЫК ЗОНАСЫ', 'жолдон чыгып кеттиңиз', 1.4); H.zone = null; }
        else TK.HUD.prompt('⏱ ' + z.st.name + ' · ' + Math.round(z.t) + ' с · орточо ' + Math.round(Math.hypot(car.x - z.st.a[0], car.z - z.st.a[1]) / Math.max(0.5, z.t) * 3.6) + ' км/с');
      } else for (const st of sts) {
        if (st.type !== 'zone' || H.cool[st.id] > 0) { if (H.cool[st.id] > 0) H.cool[st.id] -= dt; continue; }
        if (Math.hypot(st.a[0] - car.x, st.a[1] - car.z) < 14) { H.zone = { st, t: 0 }; H.cool[st.id] = 8; TK.HUD.toast('ЫЛДАМДЫК ЗОНАСЫ', st.name + ' · ' + starStr(starsOf(st, (save().stunts[st.id] || 0))) + ' · ' + st.stars[0] + ' / ' + st.stars[1] + ' / ' + st.stars[2] + ' км/с', 1.6); }
      }
      // 4) секирик: учуп кеткен жер коркунуч белгисинин жанында болсо — узундугу өлчөнөт
      const inAir = (car.airT || 0) > 0;
      if (inAir && !H.air) { H.air = { x: car.x, z: car.z, st: sts.find(st => st.type === 'jump' && Math.hypot(st.x - car.x, st.z - car.z) < 45) }; }
      if (!inAir && H.air) { const a = H.air; H.air = null; if (a.st) { const d = Math.hypot(car.x - a.x, car.z - a.z); if (d > 8) result(a.st, d); } }
      // 5) барн файнд
      for (const b of map.barns || []) {
        if (save().barns.includes(b.id)) continue;
        const d = Math.hypot(b.x - car.x, b.z - car.z);
        if (d < 30) foundBarn(b);
        else if (d < 140 && !(H.cool[b.id] > 0)) { H.cool[b.id] = 12; TK.HUD.toast('🏚 ЭСКИ САРАЙ ЖАКЫН', 'бир нерсе жашырылгандай…', 1.8); }
        if (H.cool[b.id] > 0) H.cool[b.id] -= dt;
      }
    }
    function foundBarn(b) {
      const d = save(); d.barns.push(b.id);
      const spec = TK.Cars.byId[b.car];
      if (spec && !d.owned.includes(b.car)) { d.owned.push(b.car); TK.HUD.toast('🏚 БАРН ФАЙНД!', spec.name + ' табылды — гаражга кошулду!', 4); }
      else { ctx.addCash(25000); TK.HUD.toast('🏚 БАРН ФАЙНД!', 'запас бөлүктөр сатылды: +25 000 CR', 3.5); }
      ctx.addXP(1500); TK.audio.gate && TK.audio.gate(); TK.save.commit();
    }
    function boardHit(it) {
      const d = save(); if (d.boards.includes(it.boardId)) return;
      d.boards.push(it.boardId); ctx.addXP(800);
      const n = (ctx.map().boards || []).length || 30;
      TK.HUD.toast('XP ТАКТА ' + d.boards.length + ' / ' + n, '+800 XP', 1.8); TK.save.commit();
    }
    // ----- артка тартуу: эки эсе ылдам артка ойнотулат -----
    function rewind(dt, car) {
      if (H.rec.length < 2) return false;
      H.rwT = (H.rwT || 0) + dt; let n = 0;
      while (H.rwT >= 1 / 60 && H.rec.length > 1) { H.rwT -= 1 / 60; H.rec.pop(); n++; }
      const r = H.rec[H.rec.length - 1];
      [car.x, car.z, car.y, car.h, car.vx, car.vz, car.vy, car.yaw, car.spin, car.steer, car.vf, car.vl, car.n2o, car.airT] = r;
      H.zone = null; H.air = null;
      return true;
    }
    function clearRec() { H.rec.length = 0; }

    // ----- картадагы белгилер -----
    function drawIcons(g, px, car) {
      const map = ctx.map(); if (!map) return;
      const d = save(), big = px < 0.4;
      for (const st of map.stunts || []) {
        const n = starsOf(st, d.stunts[st.id] || 0);
        TK.mapIcon(g, st.x, st.z, { trap: '⚡', zone: '⏱', jump: '▲' }[st.type], n === 3 ? '#c9a227' : '#c2185b', big ? 12 : 10);
        if (big && px < 0.25) { g.save(); g.fillStyle = '#ffd34d'; g.font = 'bold ' + Math.round(13 / px * 0.08) + 'px Arial'; g.restore(); }
      }
      for (const b of map.barns || []) {
        if (d.barns.includes(b.id)) { TK.mapIcon(g, b.x, b.z, '🏚', '#6d4c41', big ? 12 : 10); continue; }
        g.save(); g.fillStyle = 'rgba(255,200,60,.16)'; g.strokeStyle = 'rgba(255,200,60,.7)'; g.lineWidth = 3; g.setLineDash([10, 8]); g.beginPath(); g.arc(b.hint[0], b.hint[1], 170, 0, 6.283); g.fill(); g.stroke(); g.restore();
        TK.mapIcon(g, b.hint[0], b.hint[1], '?', '#e0a020', big ? 12 : 10);
      }
      for (const bd of map.boards || []) if (d.boards.includes(bd.id)) { g.fillStyle = 'rgba(255,45,135,.8)'; g.fillRect(bd.x - 5, bd.z - 5, 10, 10); }
    }
    return { update, rewind, clearRec, boardHit, drawIcons, starsOf, get dirt() { return H.dirt; }, set dirt(v) { H.dirt = v; }, get recLen() { return H.rec.length; } };
  };

  /* ===== WHEELSPIN: призов тизмеси айланып, бирөөнө токтойт ===== */
  TK.Wheelspin = {
    roll() {
      const d = S(), notOwned = TK.Cars.list.filter(c => !d.owned.includes(c.id));
      const pool = [
        { w: 30, t: 'cr', v: 5000, r: 'ЖӨНӨКӨЙ' }, { w: 24, t: 'cr', v: 10000, r: 'ЖӨНӨКӨЙ' }, { w: 16, t: 'cr', v: 20000, r: 'СЕЙРЕК' },
        { w: 10, t: 'cr', v: 40000, r: 'ЭПИК' }, { w: 3, t: 'cr', v: 100000, r: 'ЛЕГЕНДА' }, { w: 12, t: 'xp', v: 3000, r: 'СЕЙРЕК' }
      ];
      notOwned.forEach(c => pool.push({ w: c.price > 50000 ? 2 : 5, t: 'car', v: c.id, r: c.price > 50000 ? 'ЛЕГЕНДА' : 'ЭПИК' }));
      let sum = pool.reduce((a, p) => a + p.w, 0), x = Math.random() * sum;
      for (const p of pool) { x -= p.w; if (x <= 0) return { prize: p, pool }; }
      return { prize: pool[0], pool };
    },
    label(p) { return p.t === 'cr' ? TK.util.money(p.v) : p.t === 'xp' ? '+' + p.v + ' XP' : TK.Cars.byId[p.v].name; },
    give(p) {
      const d = S();
      if (p.t === 'cr') d.cash += p.v;
      else if (p.t === 'xp') { d.xp = (d.xp || 0) + p.v; }
      else if (!d.owned.includes(p.v)) d.owned.push(p.v);
      TK.save.commit();
    }
  };
})();
