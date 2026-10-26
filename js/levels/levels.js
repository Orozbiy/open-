/* Деңгээлдер (миссиялар). Жаңы деңгээл кошуу — төмөнкү тизмеге объект кошуу.
   type: 'free' | 'checkpoints' | 'drift' | 'race'
   time: 'day' | 'sunset' | 'night'   (free үчүн — оюнчу кирерде тандайт)
   map : 'world' (чоң ачык дүйнө) | 'touge' (тоо жолу трассасы)
   cps : [i, j] — шаардагы кесилиш, {road:'ring'|'spokeN'|'spokeS'|'spokeE'|'spokeW'|'hill', t:0..1} — шаардан тышкаркы жол */
TK.LEVELS = [
  {
    id: 'city_free', name: 'Эркин айдоо', sub: 'Шаар · дөңсөө · тоо · токой', map: 'world', time: 'pick', type: 'free', traffic: 16, reward: [0, 0, 0],
    desc: 'Чоң ачык дүйнө. Кирерде күн, күүгүм же түндү тандайсыз. M — карта, каалаган жерге баруу.'
  },
  {
    id: 'city_sprint', name: 'Шаар спринти', sub: '10 чекит · түн', map: 'world', time: 'night', type: 'checkpoints', traffic: 16, marker: [0, -40],
    limit: 60, bonus: 7, stars: [90, 108, 999],      // жалпы убакыт (сек): ≤90 → 3★, ≤108 → 2★, калганы 1★
    cps: [[0, 2], [3, 2], [3, -1], [0, -3], [-3, -3], [-3, 0], [-2, 3], [1, 4], [4, 0], [0, 0]],
    reward: [1500, 3000, 5000], desc: 'Көк маршрут сызыгы боюнча жарык чекиттерден тартип менен өтүңүз. Ар бир чекит убакыт кошот.'
  },
  {
    id: 'drift_lot', name: 'Дрифт аянты', sub: '90 секунд · күүгүм', map: 'world', time: 'sunset', type: 'drift', traffic: 4, limit: 90,
    spawn: { x: 35, z: 92, h: 0 }, stars: [3000, 8000, 15000], marker: [35, 105],
    reward: [1500, 3500, 7000], desc: 'Убакыт бүткөнчө мүмкүн болушунча көп дрифт упайын топтоңуз.'
  },
  {
    id: 'drift_park', name: 'Дрифт зона', sub: '120 секунд · жээкте · күн', map: 'world', time: 'day', type: 'drift', traffic: 6, limit: 120,
    spawn: 'driftZone', stars: [6000, 14000, 26000], marker: 'driftZone',
    reward: [2500, 5000, 9000], desc: 'Деңиз жээгиндеги жабык дрифт аянты: чатырлар, тосмолор, конустар. Упай топтоңуз.'
  },
  {
    id: 'country_run', name: 'Дөңсөө маршруту', sub: '9 чекит · күн · шаардан тышкары', map: 'world', time: 'day', type: 'checkpoints', traffic: 10, marker: [0, 330],
    limit: 70, bonus: 20, stars: [175, 215, 999],
    cps: [[0, 5], { road: 'spokeN', t: 1 }, { road: 'ring', t: 0.18 }, { road: 'hill', t: 0.3 }, { road: 'hill', t: 0.55 }, { road: 'hill', t: 0.85 }, { road: 'ring', t: 0.0 }, { road: 'spokeE', t: 0.4 }, [0, 0]],
    reward: [2500, 5000, 8000], desc: 'Шаардан чыгып, шакек жол жана дөңсөө серпантини аркылуу кайтып келиңиз.'
  },
  {
    id: 'summit_run', name: 'Чоку секириги', sub: '8 чекит · серпантин · 2 трамплин', map: 'world', time: 'sunset', type: 'checkpoints', traffic: 6, marker: [-220, 1820],
    spawn: { road: 'summitN', t: 0.17 }, limit: 50, bonus: 14, stars: [118, 140, 999],
    cps: [{ road: 'summitN', t: 0.3 }, { road: 'summitN', t: 0.42 }, { road: 'summitN', t: 0.5 }, { road: 'summitN', t: 0.56 }, { road: 'summitN', t: 0.64 }, { road: 'summitN', t: 0.7 }, { road: 'summitN', t: 0.78 }, { road: 'summitN', t: 0.86 }],
    reward: [3000, 6000, 10000], desc: 'Түндүк чокуга серпантин менен чыгып, түз жолдо ылдамдык алып, тик ылдыйдан жана трамплинден учуп өтүңүз.'
  },
  {
    id: 'touge_day', name: 'Тоо жолу · Күн', sub: '2 айлампа · 3 рақиб', map: 'touge', time: 'day', type: 'race', marker: [890, 960], laps: 2, rivals: 3, rivalSpeed: 40, rivalGrip: 17,
    reward: [2500, 5000, 9000], desc: 'Тоодогу ийри-буйру жол. Рақибдерден озуп, биринчи болуп финишке жетиңиз.'
  },
  {
    id: 'touge_dusk', name: 'Тоо жолу · Күүгүм', sub: '3 айлампа · 4 рақиб', map: 'touge', time: 'sunset', type: 'race', marker: [760, 1060], laps: 3, rivals: 4, rivalSpeed: 46, rivalGrip: 20,
    reward: [4000, 8000, 14000], desc: 'Күүгүмдө, кыйыныраак рақибдер менен.'
  },
  {
    id: 'touge_night', name: 'Тоо жолу · Түн', sub: '3 айлампа · 5 рақиб', map: 'touge', time: 'night', type: 'race', marker: [600, 1000], laps: 3, rivals: 5, rivalSpeed: 52, rivalGrip: 23,
    reward: [6000, 12000, 22000], desc: 'Түнкү тоо — эң тез рақибдер, караңгы бурулуштар.'
  }
];
TK.levelById = id => TK.LEVELS.find(l => l.id === id);
