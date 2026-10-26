/* Меню: башкы меню, деңгээлдер, гараж, жөндөөлөр, тыным, жыйынтык */
(function () {
  const $ = id => document.getElementById(id);
  const S = () => TK.save.data;
  const hooks = {};      // game.js толтурат
  let current = null, garageSel = null, garageTab = 'car';

  const screens = ['main', 'levels', 'free', 'garage', 'settings', 'pause', 'result', 'loading', 'spin'];
  function show(name) {
    screens.forEach(n => $('scr-' + n).hidden = n !== name);
    current = name;
    if (name !== 'loading' && builders[name]) builders[name]();
  }
  function hideAll() { screens.forEach(n => $('scr-' + n).hidden = true); current = null; }

  const unlocked = i => i <= 1 || (S().stars[TK.LEVELS[i - 1].id] || 0) > 0;
  const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const money = TK.util.money;

  const builders = {
    main() {
      const car = TK.Cars.byId[S().car];
      $('scr-main').innerHTML = `
        <div class="top"><div class="brand"><small>Ачык дүйнө · Дрифт · Жарыш</small>Түнкү Көчө</div>
          <div class="pcard"><b class="plv">${S().lvl || 1}</b><div><span>ОЮНЧУ · ${S().plate || 'KG 777 TK'}</span><i><em style="width:${Math.round(((S().xp || 0) / (TK.progress ? TK.progress.needXP(S().lvl || 1) : 1200)) * 100)}%"></em></i></div><div class="wallet">${money(S().cash)}</div></div></div>
        <nav class="mainnav">
          <button class="big primary" data-go="levels"><span>ЖАРЫШ<small>${TK.LEVELS.length - 1} деңгээл · тоо жолу</small></span></button>
          <button class="big" data-go="free"><span>ЭРКИН АЙДОО<small>чоң дүйнө · күн же түн</small></span></button>
          <button class="big" data-go="garage"><span>ГАРАЖ<small>${TK.Cars.list.length} машина</small></span></button>
          <button class="big" data-go="settings"><span>ЖӨНДӨӨЛӨР<small>убакыт · сапат · үн</small></span></button>
          ${(S().spins || 0) > 0 ? `<button class="big spinbtn" data-go="spin"><span>🎰 WHEELSPIN · ${S().spins}<small>дөңгөлөк айлантып сыйлык утуңуз</small></span></button>` : ''}
        </nav>
        <div class="carcap"><span>${car.tag}</span><b>${car.name}</b></div>
        <div class="ver">v${TK.VERSION}</div>`;
      hooks.showroom && hooks.showroom('main');
    },
    levels() {
      const cards = TK.LEVELS.map((l, i) => {
        const open = unlocked(i), st = S().stars[l.id] || 0;
        const best = S().best[l.id];
        return `<button class="card ${open ? '' : 'locked'}" data-level="${l.id}" ${open ? '' : 'aria-disabled="true"'}>
          <div class="thumb ${l.time === 'auto' ? 'night' : l.time}"><span class="badge">${l.map === 'touge' ? 'Тоо жолу' : 'Шаар'}</span>${l.type === 'free' ? '' : `<span class="stars">${starStr(st)}</span>`}${open ? '' : '<div class="lock">ЖАБЫК</div>'}</div>
          <div class="body"><h3>${l.name}</h3><div class="sub">${l.sub}</div><p>${l.desc}</p>${best ? `<p>Рекорд: <b style="color:var(--amber)">${best}</b></p>` : ''}</div></button>`;
      }).join('');
      $('scr-levels').innerHTML = `<div class="top"><button class="back" data-go="main">← АРТКА</button><h2>Деңгээлдер</h2><div class="wallet">${money(S().cash)}</div></div><div class="grid">${cards}</div>`;
      hooks.showroom && hooks.showroom('levels');
    },
    free() {
      const last = S().settings.daytime;
      const opt = [['day', 'КҮН', 'Ачык асман, кар баскан тоолор'], ['sunset', 'КҮҮГҮМ', 'Кызгылт асман, күйгөн чырактар'], ['night', 'ТҮН', 'Шаардын жарыктары, жылдыздар']];
      $('scr-free').innerHTML = `<div class="top"><button class="back" data-go="main">← АРТКА</button><h2>Эркин айдоо</h2><div class="wallet">${money(S().cash)}</div></div>
        <p class="sub" style="margin:0 0 16px;line-height:1.7">Убакытты тандаңыз — оюн ошол убакытта башталат. Оюн ичинде тыныгуудан (Esc) алмаштырса болот.</p>
        <div class="picks">${opt.map(([v, t, d]) => `<button class="card ${v === last ? 'last' : ''}" data-free="${v}"><div class="thumb ${v}">${t}</div><div class="body"><p>${d}</p></div></button>`).join('')}</div>`;
      hooks.showroom && hooks.showroom('levels');
    },
    garage() {
      if (!garageSel || !TK.Cars.byId[garageSel]) garageSel = S().car;
      const sel = TK.Cars.byId[garageSel], owned = S().owned.includes(sel.id), cur = S().car === sel.id;
      const paint = (S().paint[sel.id]) || TK.Cars.PAINTS[1][0];
      const bar = (label, v) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.round(Math.min(1, v) * 100)}%"></i></div></div>`;
      const st = TK.Cars.tunedStats(sel.id), C = TK.Cars;
      const tabs = `<div class="tabs gtabs">${[['car', 'МАШИНА'], ['tune', 'ТЮНИНГ'], ['style', 'ЖАСАЛГА']].map(([v, t]) => `<button data-gtab="${v}" aria-pressed="${v === garageTab}">${t}</button>`).join('')}</div>`;
      const head = `<div class="top"><button class="back" data-go="main">← АРТКА</button><h2>Гараж</h2><div class="wallet">${money(S().cash)}</div></div>`;
      const statBars = `<div>${bar('Тездетүү', st.engine / 24)}${bar('Ылдамдык', st.maxSpeed / 84)}${bar('Кармоо', st.grip / 1.35)}${bar('Дрифт', st.drift / 1.45)}</div>`;
      if (garageTab !== 'car') {
        let body;
        if (!owned) body = `<p class="sub" style="line-height:1.7">Тюнинг жана жасалга үчүн алгач бул машинаны сатып алыңыз.</p>`;
        else if (garageTab === 'tune') {
          const t = C.tuneOf(sel.id);
          body = C.TUNE.map(u => { const l = t[u.id] || 0, full = l >= u.max, cost = full ? 0 : C.tuneCost(sel, l + 1);
            return `<div class="trow"><div><b>${u.name}</b><small>${u.sub}</small><span class="pips">${Array.from({ length: u.max }, (_, k) => `<i class="${k < l ? 'on' : ''}"></i>`).join('')}</span></div>
              <button class="act ${full ? 'ghost' : ''}" data-tune="${u.id}" ${full || S().cash < cost ? 'disabled' : ''}>${full ? 'МАКС' : 'УЛУТУУ · ' + money(cost)}</button></div>`; }).join('');
        } else {
          const y = C.styleOf(sel.id);
          body = C.STYLE.map(o => `<div class="srow"><label>${o.name}</label><div class="seg">${o.opts.map((t, k) => `<button data-style="${o.id}" data-val="${k}" aria-pressed="${(y[o.id] || 0) === k}">${o.cols && o.cols[k] ? `<i class="dot" style="background:#${o.cols[k].toString(16).padStart(6, '0')}"></i>` : ''}${t}</button>`).join('')}</div></div>`).join('') + `<p class="sub">Жасалга акысыз — каалаганча алмаштырыңыз.</p>`;
        }
        $('scr-garage').innerHTML = `${head}<div class="garage"><div class="gpanel">${tabs}<div><div class="sub" style="margin-bottom:6px">${sel.tag}</div><h2 style="font-size:22px">${sel.name}</h2></div>${statBars}${body}</div></div>`;
        hooks.preview && hooks.preview(garageSel, paint); hooks.showroom && hooks.showroom('garage');
        return;
      }
      $('scr-garage').innerHTML = `
        ${head}
        <div class="garage"><div class="gpanel">${tabs}
          <div class="cars">${TK.Cars.list.map(c => `<button class="cbtn ${c.id === garageSel ? 'sel' : ''}" data-car="${c.id}"><b>${c.name}</b><span class="${S().owned.includes(c.id) ? 'own' : ''}">${S().owned.includes(c.id) ? (S().car === c.id ? 'ТАНДАЛГАН' : 'СИЗДИКИ') : money(c.price)}</span></button>`).join('')}</div>
          <div><div class="sub" style="margin-bottom:6px">${sel.tag}</div><h2 style="font-size:22px">${sel.name}</h2></div>
          ${statBars}
          <div><div class="sub" style="margin-bottom:8px">Боёк</div><div class="sws">${TK.Cars.PAINTS.map(([hex, nm]) => `<button class="sw" data-paint="${hex}" aria-label="${nm}" aria-pressed="${hex === paint}" style="background:${hex}"></button>`).join('')}</div></div>
          <div><div class="sub" style="margin-bottom:8px">Номер белгиси</div><div class="plate-row"><input id="plateIn" maxlength="9" value="${S().plate || 'KG 777 TK'}" aria-label="Номер белгиси"><button class="act ghost" data-act="plate">САКТОО</button></div></div>
          ${owned ? `<button class="act" data-pick="${sel.id}" ${cur ? 'disabled' : ''}>${cur ? 'ТАНДАЛГАН' : 'ТАНДОО'}</button>`
                  : `<button class="act" data-buy="${sel.id}" ${S().cash >= sel.price ? '' : 'disabled'}>САТЫП АЛУУ · ${money(sel.price)}</button>`}
        </div></div>`;
      hooks.preview && hooks.preview(garageSel, paint);
      hooks.showroom && hooks.showroom('garage');
    },
    settings() {
      const s = S().settings, tab = builders._tab || 'video';
      const seg = (key, opts) => `<div class="seg">${opts.map(([v, t]) => `<button data-set="${key}" data-val="${v}" aria-pressed="${String(s[key]) === String(v)}">${t}</button>`).join('')}</div>`;
      const rng = (key, min, max, step, fmtv) => `<div class="rng"><input type="range" data-rng="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"><b>${fmtv ? fmtv(s[key]) : s[key]}</b></div>`;
      const row = (l, c) => `<div class="row"><label>${l}</label>${c}</div>`;
      const TABS = [['video', 'ВИДЕО'], ['sound', 'ҮН'], ['game', 'ОЮН'], ['camera', 'КАМЕРА'], ['weather', 'АБА ЫРАЙЫ ЖАНА УБАКЫТ'], ['controls', 'БАШКАРУУ']];
      let body = '';
      if (tab === 'video') body = row('Кыймыл бүдөмүгү (размытие)', seg('blur', [[0, 'Жок'], [1, 'Аз'], [2, 'Күчтүү']])) + row('График сапаты', seg('quality', [[0.75, 'Төмөн'], [1, 'Орто'], [1.5, 'Жогору'], [2, 'Ультра']])) + row('Макс. кадр жыштыгы', seg('fpsCap', [[30, '30'], [60, '60'], [0, 'Чексиз']])) + row('Жарыктык', rng('brightness', 0, 1, 0.05, v => (+v).toFixed(2))) + row('FPS көрсөтүү', seg('showFps', [[true, 'Ооба'], [false, 'Жок']])) + '<p class="sub" style="line-height:1.7">«Төмөн» — телефон үчүн: дарактар азаят, рельеф жөнөкөйлөнөт (кийинки жүктөөдө).</p>';
      if (tab === 'sound') body = row('Үн', seg('sound', [[true, 'Күйүк'], [false, 'Өчүк']])) + row('Үндүн көлөмү', rng('volume', 0, 1, 0.05, v => Math.round(v * 100) + '%'));
      if (tab === 'game') body = row('Ылдамдык бирдиги', seg('units', [['kmh', 'км/с'], ['mph', 'mph']])) + row('Мини-карта', seg('mapRotate', [[true, 'Машина менен айланат'], [false, 'Түндүк өйдө']])) + row('Трафик', seg('traffic', [[0, 'Жок'], [0.5, 'Аз'], [1, 'Орто'], [1.6, 'Көп']])) + row('Прогресс', '<button class="act ghost" data-act="reset" style="padding:12px 16px;font-size:12px">ӨЧҮРҮҮ</button>');
      if (tab === 'camera') body = row('Камера түрү', seg('camMode', [['chase', 'Артта'], ['far', 'Алыс'], ['hood', 'Капоттон'], ['cockpit', 'Кабинадан']])) + row('Көрүү бурчу (FOV)', rng('fov', 50, 80, 1, v => v + '°')) + row('Камеранын аралыгы', rng('camDist', 0.7, 1.5, 0.05, v => (+v).toFixed(2)))
        + row('Фото режим', builders._fromPause ? '<button class="act ghost" data-act="photo" style="padding:12px 16px;font-size:12px">📷 АЧУУ</button>' : '<span class="sub">оюн ичинде <b>F</b> же 📷 баскычы</span>')
        + row('Дрон режими', builders._fromPause ? '<button class="act ghost" data-act="drone" style="padding:12px 16px;font-size:12px">✈ УЧУРУУ</button>' : '<span class="sub">оюн ичинде <b>G</b></span>')
        + '<p class="sub" style="line-height:1.7">Фото режимде оюн токтойт, интерфейс жашырылат: машинаны каалаган бурчтан тартып, убакытты жана аба ырайын алмаштырып, <b>P</b> менен PNG сүрөт сактайсыз. Дрон менен бүт дүйнөнү учуп көрөсүз (WASD, E/Q өйдө-ылдый, чычкан менен буруу).</p>';
      if (tab === 'weather') body = row('Эркин айдоодогу убакыт', seg('daytime', [['auto', 'Саат боюнча'], ['day', 'Күн'], ['sunset', 'Күүгүм'], ['night', 'Түн']])) + row('Аба ырайы', seg('weather', [['clear', 'Ачык'], ['cloudy', 'Булуттуу'], ['rain', 'Жамгыр'], ['fog', 'Туман']])) + '<p class="sub" style="line-height:1.7">Жамгырда жол тайгак болот. Оюн ичинде да тыныгуудан (Esc) алмаштырса болот.</p>';
      if (tab === 'controls') body = `<div class="keys">${[['W / ↑', 'Газ'], ['S / ↓', 'Тормоз / артка'], ['A D / ← →', 'Руль'], ['Space', 'Дрифт (кол тормоз)'], ['Shift / N', 'Нитро (N2O)'], ['T', 'TC (тайгаланууну көзөмөлдөө)'], ['C', 'Камера'], ['F', 'Фото режим'], ['G', 'Дрон'], ['P', 'Сүрөткө тартуу (фото/дрондо)'], ['M', 'Чоң карта'], ['E', 'Гаражга кирүү / самолётко отуруу'], ['✈', 'Самолёт: W/S газ · A/D бурулуу · ↓/Space өйдө · ↑/Shift ылдый'], ['Z', 'Артка тартуу (кармап туруу)'], ['R', 'Жолго кайтаруу'], ['Esc', 'Тыным']].map(([k, t]) => `<div><i>${k}</i>${t}</div>`).join('')}</div><p class="sub" style="line-height:1.7">Телефондо: экрандагы баскычтар (◀ ▶, ГАЗ, ТОРМОЗ, ДРИФТ, N2O).</p>`;
      $('scr-settings').innerHTML = `
        <div class="top"><button class="back" data-go="${builders._fromPause ? 'pause' : 'main'}">← АРТКА</button><h2>Жөндөөлөр</h2><div></div></div>
        <div class="tabs">${TABS.map(([v, t]) => `<button data-tab="${v}" aria-pressed="${v === tab}">${t}</button>`).join('')}</div>
        <div class="settings">${body}</div>`;
      $('scr-settings').querySelectorAll('[data-rng]').forEach(r => r.addEventListener('input', () => {
        S().settings[r.dataset.rng] = +r.value; TK.save.commit(); r.nextElementSibling.textContent = { brightness: (+r.value).toFixed(2), volume: Math.round(r.value * 100) + '%', fov: r.value + '°', camDist: (+r.value).toFixed(2) }[r.dataset.rng];
        hooks.settings && hooks.settings();
      }));
      hooks.showroom && hooks.showroom('settings');
    },
    pause() {
      builders._fromPause = false;
      $('scr-pause').innerHTML = `<div class="panel"><h2>Тыным</h2>
        <button class="act" data-act="resume">УЛАНТУУ</button>
        ${hooks.isFree && hooks.isFree() ? `<div class="row"><label>Убакыт</label><div class="seg">${[['day', 'Күн'], ['sunset', 'Күүгүм'], ['night', 'Түн']].map(([v, t]) => `<button data-time="${v}" aria-pressed="${hooks.curTime() === v}">${t}</button>`).join('')}</div></div>` : ''}
        ${hooks.isFree && hooks.isFree() ? `<div class="row"><label>Мезгил</label><div class="seg">${[['auto', 'Авто (6 мүн)'], ['spring', 'Жаз'], ['summer', 'Жай'], ['autumn', 'Күз'], ['winter', 'Кыш']].map(([v, t]) => `<button data-season="${v}" aria-pressed="${hooks.curSeason() === v}">${t}</button>`).join('')}</div></div>` : ''}
        ${hooks.isFree && hooks.isFree() ? `<div class="row"><label>Аба ырайы</label><div class="seg">${[['clear', 'Ачык'], ['cloudy', 'Булут'], ['rain', 'Жамгыр'], ['fog', 'Туман']].map(([v, t]) => `<button data-wx="${v}" aria-pressed="${hooks.curWeather() === v}">${t}</button>`).join('')}</div></div>` : ''}
        <div class="row2"><button class="act ghost" data-act="photo">📷 ФОТО РЕЖИМ</button><button class="act ghost" data-act="drone">🚁 ДРОН</button></div>
        ${hooks.isFree && hooks.isFree() ? '<button class="act ghost" data-act="plane">✈ САМОЛЁТ (аэропорт)</button>' : ''}
        <button class="act ghost" data-act="settings">ЖӨНДӨӨЛӨР</button>
        <button class="act ghost" data-act="restart">КАЙРА БАШТОО</button>
        <button class="act ghost" data-act="mute">ҮН: ${TK.audio.muted ? 'ӨЧҮК' : 'КҮЙҮК'}</button>
        <button class="act ghost" data-act="menu">МЕНЮГА ЧЫГУУ</button></div>`;
    },
    result() { /* showResult толтурат */ },
    spin() {
      const n = S().spins || 0;
      $('scr-spin').innerHTML = `<div class="spinbox"><h2>🎰 WHEELSPIN</h2><p class="sub">Калган айлантуу: <b>${n}</b> · ар бир жаңы деңгээлде +1</p>
        <div class="reel"><div class="strip" id="spStrip"></div><i class="mark"></i></div>
        <div class="spinres" id="spRes"></div>
        <div class="row2"><button class="act" data-act="dospin" ${n > 0 ? '' : 'disabled'}>АЙЛАНТУУ</button><button class="act ghost" data-go="main">АРТКА</button></div></div>`;
    }
  };

  function showResult(r) {
    const stars = r.stars === undefined ? '' : `<div class="stars">${'★'.repeat(r.stars)}<i>${'★'.repeat(3 - r.stars)}</i></div>`;
    $('scr-result').innerHTML = `<div class="panel result"><div class="sub">${r.sub || ''}</div><h1 style="color:${r.win ? 'var(--amber)' : 'var(--hot)'}">${r.title}</h1>${stars}
      <ul>${(r.lines || []).map(l => `<li>${l}</li>`).join('')}</ul>
      ${r.reward ? `<div class="wallet" style="align-self:flex-start">+${money(r.reward)}</div>` : ''}
      ${r.canNext ? '<button class="act" data-act="next">КИЙИНКИ ДЕҢГЭЭЛ</button>' : ''}
      <button class="act ${r.canNext ? 'ghost' : ''}" data-act="restart">КАЙРА ОЙНОО</button>
      <button class="act ghost" data-act="menu">МЕНЮ</button></div>`;
    screens.forEach(n => $('scr-' + n).hidden = n !== 'result'); current = 'result';
  }

  // ---- окуялар ----
  let inited = false;
  function init() {
    if (inited) return; inited = true;
    document.getElementById('ui').addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      TK.audio.init(); TK.audio.click();
      const d = t.dataset;
      if (d.go) { show(d.go); return; }
      if (d.level) { const i = TK.LEVELS.findIndex(l => l.id === d.level); if (i >= 0 && unlocked(i)) hooks.start(d.level); return; }
      if (d.free) { S().settings.daytime = d.free; TK.save.commit(); hooks.start('city_free', { time: d.free }); return; }
      if (d.time) { hooks.setTime(d.time); builders.pause(); return; }
      if (d.wx) { hooks.setWeather(d.wx); builders.pause(); return; }
      if (d.tab) { builders._tab = d.tab; builders.settings(); return; }
      if (d.car) { garageSel = d.car; builders.garage(); return; }
      if (d.act === 'dospin') {
        if (!(S().spins > 0)) return;
        const btn = t; btn.disabled = true; S().spins--; TK.save.commit();
        const { prize, pool } = TK.Wheelspin.roll(), strip = $('spStrip'), cards = [], W = 150;
        const col = r => ({ 'ЖӨНӨКӨЙ': '#5b6475', 'СЕЙРЕК': '#1d7fd6', 'ЭПИК': '#8c5cd6', 'ЛЕГЕНДА': '#e0a020' }[r]);
        for (let k = 0; k < 42; k++) cards.push(k === 36 ? prize : pool[(Math.random() * pool.length) | 0]);
        strip.innerHTML = cards.map(p => `<div class="card" style="--c:${col(p.r)}"><small>${p.r}</small><b>${p.t === 'car' ? '🚗' : (p.t === 'xp' ? '⭐' : '💰')}</b><span>${TK.Wheelspin.label(p)}</span></div>`).join('');
        strip.style.transition = 'none'; strip.style.transform = 'translateX(0)'; void strip.offsetWidth;
        const box = strip.parentElement.clientWidth, x = -(36 * W + W / 2 - box / 2) + (Math.random() - 0.5) * 60;
        strip.style.transition = 'transform 4.2s cubic-bezier(.12,.75,.15,1)'; strip.style.transform = `translateX(${x}px)`;
        let ticks = 0; const tk = setInterval(() => { TK.audio.click(); if (++ticks > 26) clearInterval(tk); }, 140);
        setTimeout(() => {
          TK.Wheelspin.give(prize); TK.audio.gate();
          $('spRes').innerHTML = `<div class="won" style="--c:${col(prize.r)}"><small>${prize.r}</small><b>${TK.Wheelspin.label(prize)}</b>${prize.t === 'car' ? '<span>гаражга кошулду!</span>' : ''}</div>`;
          const p2 = $('scr-spin').querySelector('.sub b'); if (p2) p2.textContent = S().spins; btn.disabled = !(S().spins > 0);
        }, 4400);
        return;
      }
      if (d.season) { hooks.setSeason(d.season); builders.pause(); return; }
      if (d.gtab) { garageTab = d.gtab; builders.garage(); return; }
      if (d.tune) {
        const sel = TK.Cars.byId[garageSel], t = TK.Cars.tuneOf(sel.id), u = TK.Cars.TUNE.find(q => q.id === d.tune), l = t[u.id] || 0, cost = TK.Cars.tuneCost(sel, l + 1);
        if (l < u.max && S().cash >= cost) { S().cash -= cost; t[u.id] = l + 1; TK.save.commit(); TK.audio.gate(); builders.garage(); }
        return;
      }
      if (d.style) { TK.Cars.styleOf(garageSel)[d.style] = +d.val; TK.save.commit(); hooks.rebuild && hooks.rebuild(garageSel); builders.garage(); return; }
      if (d.paint) {
        const id = garageSel;
        if (S().owned.includes(id)) { S().paint[id] = d.paint; TK.save.commit(); }
        hooks.preview(id, d.paint);
        $('scr-garage').querySelectorAll('.sw').forEach(x => x.setAttribute('aria-pressed', x.dataset.paint === d.paint));
        return;
      }
      if (d.pick) { S().car = d.pick; TK.save.commit(); builders.garage(); return; }
      if (d.buy) {
        const c = TK.Cars.byId[d.buy];
        if (S().cash >= c.price) { S().cash -= c.price; S().owned.push(c.id); S().car = c.id; S().paint[c.id] = $('scr-garage').querySelector('.sw[aria-pressed="true"]').dataset.paint; TK.save.commit(); TK.audio.gate(); builders.garage(); }
        return;
      }
      if (d.set) {
        let v = d.val; if (v === 'true') v = true; else if (v === 'false') v = false; else if (!isNaN(+v) && d.set === 'quality') v = +v;
        S().settings[d.set] = v; TK.save.commit();
        if (!isNaN(+v) && typeof v === 'string' && ['fpsCap', 'traffic'].includes(d.set)) S().settings[d.set] = +v;
        hooks.settings && hooks.settings();
        builders.settings(); return;
      }
      if (d.act) {
        if (d.act === 'resume') hooks.resume();
        else if (d.act === 'restart') hooks.restart();
        else if (d.act === 'menu') hooks.toMenu();
        else if (d.act === 'next') hooks.next();
        else if (d.act === 'plane') { hooks.plane && hooks.plane(); }
        else if (d.act === 'photo' || d.act === 'drone') { builders._fromPause = false; hooks.photo && hooks.photo(d.act); }
        else if (d.act === 'settings') { builders._fromPause = true; show('settings'); }
        else if (d.act === 'plate') { const v = ($('plateIn').value || '').toUpperCase().replace(/[^0-9A-ZА-ЯӨҮҢЁ ]/g, '').slice(0, 9) || 'KG 777 TK'; S().plate = v; TK.save.commit(); hooks.plate && hooks.plate(); builders.garage(); }
        else if (d.act === 'mute') { TK.audio.setMuted(!TK.audio.muted); S().settings.sound = !TK.audio.muted; TK.save.commit(); builders.pause(); }
        else if (d.act === 'reset') {
          if (t.dataset.sure) { TK.save.reset(); garageSel = null; hooks.quality && hooks.quality(); show('settings'); }
          else { t.dataset.sure = 1; t.textContent = 'ЧЫНЫНДА ӨЧҮРҮҮ?'; }
        }
      }
    });
  }
  TK.Menu = { init, show, hideAll, showResult, hooks, get current() { return current; }, unlocked, rebuild() { if (current && builders[current]) builders[current](); } };
})();
