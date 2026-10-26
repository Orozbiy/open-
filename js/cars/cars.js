/* Машиналар каталогу.
   Жаңы машина кошуу үчүн — төмөндөгү LIST ичине жаңы объект кошуңуз (docs/ADD_CARS.md караңыз).
   Эки түрү бар:
     1) процедуралык (tub/cabin станциялары менен) — интернетсиз, эч кандай файл керек эмес;
     2) glb: 'assets/models/файл.glb' — даяр 3D модель (жергиликтүү сервер керек, Live Server). */
(function () {
  const PAINTS = [['#e8edf5', 'Ак'], ['#d23a2e', 'Кызыл'], ['#1f5fd1', 'Көк'], ['#ffb547', 'Сары'], ['#17191f', 'Кара'], ['#2fa37a', 'Жашыл'], ['#8c5cd6', 'Кызгылт көк'], ['#c0c4cc', 'Күмүш']];

  const LIST = [
    /* ---------- 1. Дрифт купе (баштапкы, бекер) ---------- */
    {
      id: 'drift_coupe', name: 'Дрифт купе', tag: 'Баштапкы', price: 0, len: 4.5,
      stats: { engine: 14, maxSpeed: 60, grip: 1.0, drift: 1.0, steer: 1.0, wheelbase: 2.7, pitch: 1.0 },
      nTub: 3.2, nCabin: 2.6,
      tub: [[2.2, .55, .28, .50], [2.1, .80, .22, .62], [1.8, .90, .20, .72], [1.0, .93, .18, .80], [0, .94, .18, .84], [-1.0, .94, .18, .88], [-1.8, .92, .20, .90], [-2.1, .80, .26, .84], [-2.25, .5, .32, .70]],
      cabin: [[.8, .68, .76, .88, 0], [.35, .64, .76, 1.18, 0], [.1, .63, .76, 1.28, 1], [-.5, .62, .76, 1.30, 1], [-1.0, .56, .76, 1.15, 1], [-1.4, .52, .76, 1.0, 0], [-1.8, .5, .76, .88, 0]],
      wheels: { fz: 1.35, rz: 1.30, fr: .33, rr: .35, fw: .25, rw: .30 }, rimStyle: { spokes: 6, dark: true }, plate: [.52, -2.27], exhaust: [.45, .28, -2.4],
      extras(c) {
        const m = c.mats;
        c.box(1.9, .04, .42, m.dark, 0, .15, 2.15); // сплиттер
        [1, -1].forEach(s => {
          c.box(.5, .07, .05, m.head, s * .62, .62, 2.12);
          c.box(.08, .12, 2.3, m.dark, s * .93, .27, 0); // босого
          c.box(.07, .34, .12, m.dark, s * .7, 1.08, -1.95); // вингдин таянычы
          c.box(.05, .26, .46, m.dark, s * .96, 1.32, -1.98); // вингдин четтери
          c.cyl(.045, .045, .22, m.chrome, s * .45, .28, -2.3, null, 'x');
        });
        c.box(1.9, .05, .42, m.dark, 0, 1.28, -1.98); // ГТ вин
        c.box(1.6, .08, .05, m.tail, 0, .74, -2.14);
        c.box(1.5, .2, .1, m.dark, 0, .32, -2.2);
        c.box(.28, .08, .1, m.dark, 0, 1.15, -.6); // төбөдөгү дөмпөчөк
      }
    },
    /* ---------- 2. 911 Turbo (930) — Hum3D сүрөтүндөгү 6 көрүнүштөн ---------- */
    {
      id: 'porsche_930', name: '911 Turbo (930)', tag: 'Классика', price: 20000, len: 4.3,
      stats: { engine: 16, maxSpeed: 64, grip: .95, drift: 1.15, steer: 1.0, wheelbase: 2.27, pitch: 1.0 },
      nTub: 4.0, nCabin: 2.5,
      tub: [[2.15, .72, .30, .50], [2.10, .80, .24, .62], [1.90, .84, .20, .70], [1.45, .86, .17, .78], [.95, .88, .17, .84], [0, .89, .17, .90], [-.9, .90, .17, .94], [-1.4, .92, .17, .99], [-1.8, .91, .20, .97], [-2.08, .82, .26, .86], [-2.15, .74, .32, .78]],
      cabin: [[.95, .66, .78, .88, 0], [.55, .63, .78, 1.17, 0], [.30, .62, .78, 1.29, 1], [-.30, .63, .78, 1.31, 1], [-.80, .61, .78, 1.26, 1], [-1.25, .56, .78, 1.10, 0], [-1.70, .50, .78, .98, 0]],
      wheels: { fz: 1.18, rz: 1.12, fr: .31, rr: .33, fw: .22, rw: .28 }, rimStyle: { spokes: 5 }, plate: [.53, -2.17], exhaust: [.38, .27, -2.33],
      extras(c) {
        const m = c.mats;
        c.box(1.56, .27, .14, m.dark, 0, .36, 2.08);   // алдынкы бампер
        [1, -1].forEach(s => {
          const hl = new THREE.Mesh(new THREE.SphereGeometry(.095, 14, 10), m.head); hl.scale.set(1, 1, .6);
          hl.position.set(s * .6, .76, 1.8); c.body.add(hl);                       // тегерек фара
          c.cyl(.115, .115, .06, m.dark, s * .6, .75, 1.76, null, 'x');
          c.box(.16, .07, .05, m.amber, s * .43, .40, 2.175);                       // бурулуш чырагы
          c.box(.12, .08, .12, m.dark, s * .76, 1.0, .58);                          // күзгү
          c.box(.08, .11, 1.9, m.dark, s * .845, .27, 0);                           // босого
          c.cyl(.04, .04, .22, m.chrome, s * .38, .27, -2.22, null, 'x');          // чыгаруу түтүгү
          c.box(.05, .1, .62, m.paintFlat, s * .74, 1.0, -1.78).rotation.x = .1;     // "кит куйругу" капталы
        });
        c.box(1.2, .05, .4, m.dark, 0, 1.0, -1.5);                                  // кыштын торчосу
        const tail = c.box(1.5, .045, .62, m.paintFlat, 0, 1.04, -1.78); tail.rotation.x = .1;  // кит куйругу
        const lip = c.box(1.52, .05, .06, m.dark, 0, 1.095, -2.08); lip.rotation.x = .1;
        c.box(1.3, .11, .05, m.tail, 0, .75, -2.15);                                // арткы чырак тасмасы
        c.box(1.7, .26, .16, m.dark, 0, .34, -2.06);                                // арткы бампер
      }
    },
    /* ---------- 3. Маслкар V8 ---------- */
    {
      id: 'muscle_v8', name: 'Маслкар V8', tag: 'Күч', price: 35000, len: 4.8,
      stats: { engine: 19, maxSpeed: 66, grip: .85, drift: 1.2, steer: .92, wheelbase: 2.9, pitch: 1.3 },
      nTub: 4.0, nCabin: 3.0,
      tub: [[2.4, .70, .38, .62], [2.3, .88, .28, .86], [1.4, .93, .25, .92], [.5, .95, .25, .95], [-.8, .95, .25, .97], [-1.8, .94, .27, .99], [-2.25, .88, .34, .94], [-2.4, .62, .40, .84]],
      cabin: [[.15, .72, .90, 1.0, 0], [-.30, .70, .90, 1.36, 1], [-1.10, .68, .90, 1.37, 1], [-1.6, .62, .90, 1.12, 0], [-1.9, .56, .90, 1.0, 0]],
      wheels: { fz: 1.45, rz: 1.35, fr: .35, rr: .37, fw: .26, rw: .32 }, rimStyle: { spokes: 5 }, plate: [.6, -2.43], exhaust: [.5, .26, -2.67],
      extras(c) {
        const m = c.mats;
        c.box(.7, .1, .9, m.dark, 0, .99, 1.0);           // капот чөмүчү
        c.box(1.9, .1, .14, m.chrome, 0, .40, 2.38);      // хром бампер
        c.box(1.9, .1, .14, m.chrome, 0, .42, -2.4);
        [1, -1].forEach(s => {
          c.box(.34, .14, .06, m.head, s * .6, .72, 2.4);
          c.box(.08, .1, 2.4, m.dark, s * .955, .3, 0);
          c.cyl(.06, .06, .3, m.chrome, s * .5, .26, -2.52, null, 'x');
        });
        c.box(1.6, .15, .05, m.tail, 0, .8, -2.42);
        c.box(1.3, .04, .3, m.paintFlat, 0, 1.01, -2.05);  // кичинекей куйрук
      }
    },
    /* ---------- 4. Гипер GT ---------- */
    {
      id: 'hyper_gt', name: 'Гипер GT', tag: 'Топ', price: 90000, len: 4.5,
      stats: { engine: 21, maxSpeed: 78, grip: 1.15, drift: .9, steer: 1.05, wheelbase: 2.7, pitch: .9 },
      nTub: 3.2, nCabin: 2.4,
      tub: [[2.1, .50, .22, .42], [2.0, .80, .18, .58], [1.5, .92, .14, .66], [.7, .96, .12, .74], [0, .98, .12, .80], [-.8, 1.0, .12, .82], [-1.6, .98, .14, .84], [-2.1, .85, .20, .78], [-2.25, .55, .25, .65]],
      cabin: [[.9, .72, .70, .86, 0], [.35, .68, .70, 1.04, 0], [.1, .66, .70, 1.10, 1], [-.5, .66, .70, 1.12, 1], [-1.2, .68, .70, .96, 0], [-1.8, .68, .70, .82, 0]],
      wheels: { fz: 1.35, rz: 1.35, fr: .34, rr: .36, fw: .28, rw: .34 }, rimStyle: { spokes: 10, dark: false }, plate: [.45, -2.27], exhaust: [.3, .32, -2.38],
      extras(c) {
        const m = c.mats;
        c.box(2.0, .035, .45, m.dark, 0, .12, 2.05);                 // сплиттер
        c.box(1.5, .14, .35, m.dark, 0, .2, -2.12);                  // диффузор
        c.box(1.8, .045, .4, m.dark, 0, 1.02, -2.05);                // канат
        [1, -1].forEach(s => {
          c.box(.55, .045, .05, m.head, s * .55, .5, 2.02);
          c.box(.06, .2, .8, m.dark, s * .985, .46, -.4);            // каптал абаа алуу
          c.box(.05, .3, .1, m.dark, s * .6, .88, -2.0);
          c.cyl(.05, .05, .2, m.chrome, s * .3, .32, -2.28, null, 'x');
        });
        c.box(1.7, .05, .05, m.tail, 0, .7, -2.2);
        c.box(.06, .4, 1.1, m.dark, 0, .93, -1.1);                    // арткы капоттун ортосу
      }
    }
    ,
    /* ---------- 5. Мини ---------- */
    {
      id: 'kei_mini', name: 'Мини', tag: 'Шаардык', price: 5000, len: 3.5,
      stats: { engine: 11, maxSpeed: 48, grip: 1.05, drift: .9, steer: 1.12, wheelbase: 2.2, pitch: 1.1 },
      nTub: 3.4, nCabin: 3.2,
      tub: [[1.72, .6, .30, .62], [1.6, .74, .25, .72], [1.2, .78, .22, .80], [.5, .80, .22, .86], [-.5, .80, .22, .88], [-1.4, .79, .24, .90], [-1.72, .72, .28, .86]],
      cabin: [[.75, .64, .84, .90, 0], [.45, .66, .84, 1.28, 0], [.2, .66, .84, 1.42, 1], [-.7, .66, .84, 1.44, 1], [-1.45, .64, .84, 1.40, 0], [-1.68, .6, .84, 1.25, 0]],
      wheels: { fz: 1.15, rz: 1.15, fr: .27, rr: .27, fw: .18, rw: .18 }, rimStyle: { spokes: 4 }, plate: [.55, -1.74], exhaust: [.3, .24, -1.8],
      extras(c) {
        const m = c.mats;
        c.box(1.3, .04, 2.1, m.white, 0, 1.445, -.6);                 // ак төбө
        c.box(1.5, .16, .1, m.chrome, 0, .34, 1.74); c.box(1.5, .16, .1, m.chrome, 0, .34, -1.75);
        [1, -1].forEach(s => { const hl = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 8), m.head); hl.scale.z = .5; hl.position.set(s * .5, .66, 1.68); c.body.add(hl); c.box(.16, .12, .04, m.tail, s * .6, .7, -1.74); });
      }
    },
    /* ---------- 6. Хэтчбек GTI ---------- */
    {
      id: 'hatch_gti', name: 'Хэтчбек GTI', tag: 'Шаардык', price: 9000, len: 4.1,
      stats: { engine: 13.5, maxSpeed: 57, grip: 1.05, drift: .95, steer: 1.06, wheelbase: 2.55, pitch: 1.0 },
      nTub: 3.4, nCabin: 2.8,
      tub: [[2.05, .62, .30, .60], [1.95, .80, .24, .72], [1.4, .86, .22, .82], [.5, .88, .22, .88], [-.6, .88, .22, .92], [-1.6, .86, .24, .94], [-2.0, .80, .28, .92], [-2.05, .7, .32, .86]],
      cabin: [[.75, .70, .86, .92, 0], [.3, .68, .86, 1.32, 0], [0, .67, .86, 1.40, 1], [-1.2, .66, .86, 1.40, 1], [-1.8, .64, .86, 1.34, 0], [-2.0, .6, .86, 1.1, 0]],
      wheels: { fz: 1.3, rz: 1.25, fr: .31, rr: .31, fw: .22, rw: .22 }, rimStyle: { spokes: 5 }, plate: [.6, -2.07], exhaust: [.5, .28, -2.1],
      extras(c) {
        const m = c.mats;
        c.box(1.3, .14, .06, m.dark, 0, .58, 2.05); c.box(1.3, .03, .065, m.tail, 0, .5, 2.06);   // кызыл тилкелүү тор
        c.box(1.25, .05, .3, m.dark, 0, 1.38, -1.95);                                              // төбө спойлер
        [1, -1].forEach(s => { c.box(.3, .08, .05, m.head, s * .58, .64, 2.03); c.box(.2, .18, .05, m.tail, s * .7, .8, -2.06); });
      }
    },
    /* ---------- 7. Спорт седан ---------- */
    {
      id: 'sedan_s', name: 'Спорт седан', tag: 'Седан', price: 16000, len: 4.8,
      stats: { engine: 16, maxSpeed: 65, grip: 1.0, drift: 1.05, steer: 1.0, wheelbase: 2.85, pitch: 1.0 },
      nTub: 3.4, nCabin: 2.6,
      tub: [[2.4, .62, .30, .58], [2.3, .84, .24, .72], [1.6, .90, .22, .80], [.5, .92, .22, .84], [-.8, .92, .22, .88], [-1.9, .90, .24, .90], [-2.3, .82, .28, .86], [-2.4, .68, .32, .80]],
      cabin: [[.9, .70, .84, .88, 0], [.4, .68, .84, 1.30, 0], [.1, .67, .84, 1.38, 1], [-1.0, .66, .84, 1.38, 1], [-1.5, .64, .84, 1.24, 0], [-1.95, .62, .84, .96, 0]],
      wheels: { fz: 1.45, rz: 1.4, fr: .33, rr: .33, fw: .24, rw: .26 }, rimStyle: { spokes: 10, dark: true }, plate: [.55, -2.42], exhaust: [.55, .27, -2.48],
      extras(c) {
        const m = c.mats;
        [1, -1].forEach(s => { c.box(.42, .07, .05, m.head, s * .58, .66, 2.36); c.box(.4, .1, .05, m.tail, s * .55, .8, -2.42); c.box(.1, .07, .1, m.dark, s * .82, .98, .7); });
        c.box(1.2, .03, .2, m.dark, 0, .9, -2.3);
      }
    },
    /* ---------- 8. Ралли ---------- */
    {
      id: 'rally_wrc', name: 'Ралли WRC', tag: 'Топурак', price: 28000, len: 4.2,
      stats: { engine: 16.5, maxSpeed: 60, grip: 1.1, drift: 1.1, steer: 1.1, wheelbase: 2.5, pitch: 1.0, dirt: 1 },
      nTub: 3.2, nCabin: 2.8,
      tub: [[2.1, .66, .32, .62], [2.0, .86, .26, .74], [1.4, .93, .24, .84], [.5, .95, .24, .90], [-.6, .95, .24, .94], [-1.6, .93, .26, .96], [-2.05, .86, .30, .92], [-2.1, .72, .34, .86]],
      cabin: [[.75, .72, .88, .94, 0], [.3, .70, .88, 1.34, 0], [0, .69, .88, 1.42, 1], [-1.2, .68, .88, 1.42, 1], [-1.8, .66, .88, 1.34, 0], [-2.0, .62, .88, 1.12, 0]],
      wheels: { fz: 1.3, rz: 1.25, fr: .33, rr: .33, fw: .26, rw: .26 }, rimStyle: { spokes: 6, dark: false }, plate: [.62, -2.12], exhaust: [.55, .3, -2.18],
      extras(c) {
        const m = c.mats;
        c.box(1.85, .05, .5, m.dark, 0, 1.36, -1.9);                         // чоң канат
        [1, -1].forEach(s => { c.box(.06, .38, .2, m.dark, s * .82, 1.15, -1.9); c.box(.3, .3, .03, m.dark, s * .7, .2, -1.4); c.box(.3, .3, .03, m.dark, s * .7, .2, 1.05);
          c.cyl(.12, .12, .06, m.head, s * .28, .7, 2.12, null, 'x'); });   // кошумча фаралар
        c.box(.45, .1, .5, m.dark, 0, 1.47, -.4);                            // төбөдөгү аба алгыч
        c.box(1.7, .25, .12, m.white, 0, .42, 2.08);                          // ак бампер
      }
    },
    /* ---------- 9. Жол тандабас 4x4 ---------- */
    {
      id: 'suv_4x4', name: 'Жол тандабас 4x4', tag: 'Тоо', price: 24000, len: 4.7,
      stats: { engine: 15, maxSpeed: 55, grip: .92, drift: .85, steer: .9, wheelbase: 2.8, pitch: 1.3, dirt: 1 },
      nTub: 4.2, nCabin: 4.5,
      tub: [[2.3, .78, .48, .95], [2.2, .92, .42, 1.08], [1.5, .96, .40, 1.14], [.5, .97, .40, 1.16], [-.8, .97, .40, 1.16], [-1.9, .96, .42, 1.16], [-2.3, .90, .46, 1.12]],
      cabin: [[1.0, .80, 1.10, 1.16, 0], [.6, .80, 1.10, 1.70, 0], [.3, .80, 1.10, 1.82, 1], [-1.6, .80, 1.10, 1.84, 1], [-2.15, .80, 1.10, 1.78, 0], [-2.25, .76, 1.10, 1.4, 0]],
      wheels: { fz: 1.45, rz: 1.4, fr: .43, rr: .43, fw: .30, rw: .30, out: .1 }, rimStyle: { spokes: 6, dark: true }, plate: [.75, -2.32], exhaust: [.6, .42, -2.36],
      extras(c) {
        const m = c.mats;
        c.box(1.4, .06, 1.8, m.dark, 0, 1.9, -.6);                            // төбө багажниги
        c.cyl(.4, .4, .22, m.tire, 0, 1.0, -2.42, null, 'x');                 // запас дөңгөлөк
        c.box(1.6, .5, .08, m.dark, 0, .75, 2.36); c.box(1.75, .12, .3, m.chrome, 0, .55, 2.35);   // буга тосмо
        [1, -1].forEach(s => { c.box(.3, .14, .05, m.head, s * .6, .98, 2.31); c.box(.14, .3, .05, m.tail, s * .82, 1.0, -2.32); c.box(.1, .08, 3.2, m.dark, s * 1.0, .5, 0); });
      }
    },
    /* ---------- 10. Пикап ---------- */
    {
      id: 'pickup', name: 'Пикап', tag: 'Жүк', price: 18000, len: 5.2,
      stats: { engine: 15.5, maxSpeed: 57, grip: .9, drift: 1.15, steer: .92, wheelbase: 3.1, pitch: 1.3, dirt: .7 },
      nTub: 4.2, nCabin: 4.2,
      tub: [[2.6, .80, .45, .92], [2.5, .94, .40, 1.02], [1.8, .97, .40, 1.08], [.5, .98, .40, 1.10], [-1.0, .98, .40, 1.12], [-2.4, .98, .42, 1.12], [-2.6, .92, .45, 1.08]],
      cabin: [[1.2, .84, 1.06, 1.10, 0], [.8, .84, 1.06, 1.62, 0], [.5, .83, 1.06, 1.75, 1], [-.6, .83, 1.06, 1.76, 1], [-.75, .82, 1.06, 1.6, 0], [-.8, .8, 1.06, 1.2, 0]],
      wheels: { fz: 1.7, rz: 1.6, fr: .42, rr: .42, fw: .3, rw: .3, out: .08 }, rimStyle: { spokes: 6, dark: false }, plate: [.7, -2.62], exhaust: [.6, .4, -2.66],
      extras(c) {
        const m = c.mats;
        c.box(1.7, .04, 1.65, m.dark, 0, 1.125, -1.65);                       // кузовдун түбү
        [1, -1].forEach(s => { c.box(.06, .3, 1.75, m.paintFlat, s * .92, 1.26, -1.65); c.box(.32, .14, .05, m.head, s * .62, .9, 2.56); c.box(.12, .32, .05, m.tail, s * .86, .95, -2.62); });
        c.box(1.84, .3, .06, m.paintFlat, 0, 1.26, -2.5); c.box(1.84, .35, .06, m.dark, 0, 1.3, -.82);
        c.box(1.6, .3, .1, m.chrome, 0, .6, 2.58); c.box(1.8, .2, .14, m.chrome, 0, .55, -2.62);
      }
    },
    /* ---------- 11. Ротор купе (JDM) ---------- */
    {
      id: 'jdm_rx', name: 'Ротор купе', tag: 'JDM', price: 30000, len: 4.3,
      stats: { engine: 17, maxSpeed: 67, grip: 1.04, drift: 1.25, steer: 1.06, wheelbase: 2.45, pitch: 1.0 },
      nTub: 3.0, nCabin: 2.4,
      tub: [[2.15, .55, .25, .45], [2.05, .80, .20, .58], [1.5, .88, .18, .66], [.6, .90, .18, .72], [-.6, .90, .18, .78], [-1.6, .89, .20, .82], [-2.05, .80, .24, .80], [-2.15, .6, .28, .74]],
      cabin: [[.6, .66, .72, .80, 0], [.2, .64, .72, 1.12, 0], [0, .63, .72, 1.18, 1], [-.6, .62, .72, 1.18, 1], [-1.2, .58, .72, 1.0, 0], [-1.7, .55, .72, .86, 0]],
      wheels: { fz: 1.25, rz: 1.2, fr: .32, rr: .33, fw: .24, rw: .28 }, rimStyle: { spokes: 6, dark: true }, plate: [.52, -2.17], exhaust: [.0, .25, -2.22],
      extras(c) {
        const m = c.mats;
        c.box(1.75, .04, .38, m.dark, 0, 1.0, -1.95); [1, -1].forEach(s => { c.box(.05, .2, .3, m.dark, s * .82, .9, -1.95); c.box(.44, .05, .05, m.head, s * .52, .5, 2.12); c.cyl(.07, .07, .04, m.tail, s * .62, .7, -2.15, null, 'x'); c.cyl(.07, .07, .04, m.tail, s * .42, .7, -2.15, null, 'x'); });
        c.box(1.8, .04, .4, m.dark, 0, .14, 2.05);
      }
    },
    /* ---------- 12. Евро GT ---------- */
    {
      id: 'euro_gt', name: 'Евро GT', tag: 'Гран Туризмо', price: 52000, len: 4.7,
      stats: { engine: 19, maxSpeed: 72, grip: 1.08, drift: .95, steer: 1.0, wheelbase: 2.8, pitch: .95 },
      nTub: 3.0, nCabin: 2.4,
      tub: [[2.35, .58, .26, .52], [2.25, .84, .20, .66], [1.6, .92, .18, .74], [.7, .93, .18, .78], [-.3, .95, .18, .80], [-1.4, .97, .20, .84], [-2.1, .88, .24, .82], [-2.35, .62, .30, .74]],
      cabin: [[.2, .68, .76, .82, 0], [-.2, .66, .76, 1.16, 0], [-.45, .65, .76, 1.24, 1], [-1.0, .64, .76, 1.22, 1], [-1.6, .6, .76, 1.0, 0], [-2.1, .56, .76, .86, 0]],
      wheels: { fz: 1.45, rz: 1.35, fr: .34, rr: .35, fw: .26, rw: .3 }, rimStyle: { spokes: 5, dark: false }, plate: [.5, -2.37], exhaust: [.45, .28, -2.42],
      extras(c) {
        const m = c.mats;
        c.box(.9, .2, .06, m.dark, 0, .4, 2.33);
        [1, -1].forEach(s => { c.box(.4, .06, .05, m.head, s * .6, .58, 2.28); c.box(.5, .06, .05, m.tail, s * .5, .74, -2.36); c.box(.08, .12, .5, m.dark, s * .93, .55, 1.0); });
        c.box(1.4, .03, .25, m.paintFlat, 0, .83, -2.2);
      }
    },
    /* ---------- 13. Суперкар V12 ---------- */
    {
      id: 'super_v12', name: 'Суперкар V12', tag: 'Клин', price: 75000, len: 4.6,
      stats: { engine: 21, maxSpeed: 76, grip: 1.12, drift: .95, steer: 1.05, wheelbase: 2.7, pitch: .9 },
      nTub: 2.4, nCabin: 2.0,
      tub: [[2.25, .5, .18, .36], [2.1, .85, .15, .50], [1.4, .96, .12, .62], [.5, 1.0, .12, .70], [-.5, 1.02, .12, .74], [-1.5, 1.0, .14, .76], [-2.1, .9, .18, .72], [-2.3, .7, .22, .62]],
      cabin: [[1.0, .70, .62, .66, 0], [.5, .68, .62, .92, 0], [.1, .66, .62, 1.06, 1], [-.5, .62, .62, 1.08, 1], [-1.4, .55, .62, .86, 0], [-2.0, .5, .62, .74, 0]],
      wheels: { fz: 1.35, rz: 1.35, fr: .34, rr: .37, fw: .28, rw: .36 }, rimStyle: { spokes: 5, dark: true }, plate: [.42, -2.3], exhaust: [.15, .35, -2.36],
      extras(c) {
        const m = c.mats;
        c.box(1.9, .03, .4, m.dark, 0, .1, 2.15); c.box(1.6, .16, .3, m.dark, 0, .2, -2.2);
        [1, -1].forEach(s => { c.box(.42, .035, .05, m.head, s * .6, .38, 2.12); c.box(.08, .3, .9, m.dark, s * 1.02, .45, -.8); c.box(.6, .04, .05, m.tail, s * .45, .62, -2.28); });
        c.box(1.5, .04, .3, m.dark, 0, .84, -2.0);
      }
    },
    /* ---------- 14. Электро седан ---------- */
    {
      id: 'electric_s', name: 'Электро седан', tag: 'Электр', price: 45000, len: 4.9,
      stats: { engine: 20, maxSpeed: 69, grip: 1.08, drift: .9, steer: 1.0, wheelbase: 2.9, pitch: .9 },
      nTub: 2.8, nCabin: 2.2,
      tub: [[2.45, .6, .28, .56], [2.35, .86, .22, .70], [1.6, .94, .20, .78], [.5, .96, .20, .82], [-.8, .96, .20, .86], [-1.9, .94, .22, .88], [-2.35, .84, .26, .86], [-2.45, .66, .30, .80]],
      cabin: [[1.0, .72, .82, .86, 0], [.5, .70, .82, 1.26, 0], [.2, .69, .82, 1.38, 1], [-1.2, .68, .82, 1.38, 1], [-1.9, .64, .82, 1.12, 0], [-2.3, .6, .82, .92, 0]],
      wheels: { fz: 1.5, rz: 1.45, fr: .34, rr: .34, fw: .25, rw: .27 }, rimStyle: { spokes: 10, dark: false }, plate: [.5, -2.47], exhaust: [0, -5, 0],
      extras(c) {
        const m = c.mats;
        c.box(1.5, .035, .05, m.head, 0, .62, 2.42); c.box(1.6, .05, .05, m.tail, 0, .78, -2.45);   // толук туурасы жарык тилкелер
        c.box(1.2, .02, 1.6, m.dark, 0, 1.385, -.5);                                             // айнек төбө
      }
    },
    /* ---------- 15. Полиция ---------- */
    {
      id: 'police', name: 'Полиция', tag: 'Кызмат', price: 40000, len: 4.9,
      stats: { engine: 18, maxSpeed: 68, grip: 1.05, drift: 1.0, steer: 1.0, wheelbase: 2.9, pitch: 1.0 },
      nTub: 3.4, nCabin: 2.6,
      tub: [[2.45, .62, .30, .58], [2.35, .86, .24, .72], [1.6, .92, .22, .80], [.5, .93, .22, .84], [-.8, .93, .22, .88], [-1.9, .91, .24, .90], [-2.35, .83, .28, .86], [-2.45, .68, .32, .80]],
      cabin: [[.9, .70, .84, .88, 0], [.4, .68, .84, 1.30, 0], [.1, .67, .84, 1.38, 1], [-1.0, .66, .84, 1.38, 1], [-1.5, .64, .84, 1.24, 0], [-1.95, .62, .84, .96, 0]],
      wheels: { fz: 1.5, rz: 1.45, fr: .34, rr: .34, fw: .25, rw: .26 }, rimStyle: { spokes: 6, dark: true }, plate: [.55, -2.47], exhaust: [.55, .27, -2.52],
      extras(c) {
        const m = c.mats;
        c.box(1.0, .12, .3, m.dark, 0, 1.44, -.2);
        c.box(.46, .1, .26, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), -.26, 1.53, -.2);   // кызыл/көк чырак
        c.box(.46, .1, .26, new THREE.MeshBasicMaterial({ color: 0x2a6bff }), .26, 1.53, -.2);
        [1, -1].forEach(s => { c.box(.05, .34, 1.5, m.white, s * .925, .62, -.3); c.box(.4, .07, .05, m.head, s * .58, .66, 2.41); c.box(.4, .1, .05, m.tail, s * .55, .8, -2.47); });
        c.box(1.7, .35, .1, m.dark, 0, .5, 2.48);                                                // буга тосмо
      }
    }
  ];

  const byId = {}; LIST.forEach(c => byId[c.id] = c);

  /* GLB кошуу үчүн мисал (docs/ADD_CARS.md): TK.Cars.register({id:'my_car', name:'...', price:50000, len:4.5, glb:'assets/models/my_car.glb', stats:{...}}) */
  function register(spec) {
    spec.stats = Object.assign({ engine: 16, maxSpeed: 64, grip: 1, drift: 1, steer: 1, wheelbase: 2.7, pitch: 1 }, spec.stats || {});
    spec.price = spec.price || 0; spec.tag = spec.tag || 'Жаңы';
    LIST.push(spec); byId[spec.id] = spec;
  }

  function makeGLB(spec, paintHex) {
    const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
    const paintMats = [];
    const obj = { group, body, wheels: [], mats: {}, spec, paint: null, tailMat: new THREE.MeshBasicMaterial(), spot: null, tailGlow: null,
      setPaint(hex) { paintMats.forEach(m => m.color.set(hex)); } };
    const spot = new THREE.SpotLight(0xfff1d6, 2.4, 80, 0.5, 0.55, 1.2); spot.position.set(0, 0.8, spec.len / 2 - 0.2);
    const tgt = new THREE.Object3D(); tgt.position.set(0, 0, 22); group.add(spot, tgt); spot.target = tgt;
    const tg = new THREE.PointLight(0xff2a1a, 0, 9, 2); tg.position.set(0, 0.7, -spec.len / 2 - 0.4); group.add(tg);
    obj.spot = spot; obj.tailGlow = tg;
    if (THREE.GLTFLoader) new THREE.GLTFLoader().load(spec.glb, g => {
      const m = g.scene, bb = new THREE.Box3().setFromObject(m), size = bb.getSize(new THREE.Vector3());
      const k = spec.len / Math.max(size.x, size.z); m.scale.setScalar(k);
      bb.setFromObject(m); const c = bb.getCenter(new THREE.Vector3());
      m.position.set(-c.x, -bb.min.y, -c.z); m.rotation.y = spec.yaw || 0;
      m.traverse(o => { if (o.isMesh && o.material) { const n = (o.material.name || '').toLowerCase(); if (/paint|body|carpaint|кузов/.test(n)) { o.material = o.material.clone(); paintMats.push(o.material); } } });
      paintMats.forEach(x => x.color.set(paintHex));
      body.add(m);
    }, undefined, () => console.warn('GLB жүктөлгөн жок (Live Server керек):', spec.glb));
    return obj;
  }

  /* ---------- ТЮНИНГ (мүнөздөмө) жана ЖАСАЛГА (сырткы көрүнүш) ---------- */
  const TUNE = [
    { id: 'eng', name: 'Кыймылдаткыч', sub: 'тездетүү', max: 3, fx: (s, l) => { s.engine *= 1 + 0.09 * l; } },
    { id: 'turbo', name: 'Турбо', sub: 'тездетүү + макс. ылдамдык', max: 3, fx: (s, l) => { s.engine *= 1 + 0.05 * l; s.maxSpeed *= 1 + 0.035 * l; } },
    { id: 'tire', name: 'Дөңгөлөктөр', sub: 'кармоо', max: 3, fx: (s, l) => { s.grip *= 1 + 0.06 * l; } },
    { id: 'susp', name: 'Амортизатор', sub: 'башкаруу, кузов аз ийилет', max: 3, fx: (s, l) => { s.steer *= 1 + 0.035 * l; s.pitch *= 1 - 0.12 * l; } },
    { id: 'drift', name: 'Дрифт жөндөө', sub: 'тайгалануу оңой', max: 2, fx: (s, l) => { s.drift *= 1 + 0.1 * l; } },
    { id: 'n2o', name: 'Нитро баллон', sub: 'нитро узагыраак', max: 2, fx: (s, l) => { s.n2oK = 1 + 0.45 * l; } },
    { id: 'weight', name: 'Салмак азайтуу', sub: 'карбон бөлүктөр', max: 2, fx: (s, l) => { s.engine *= 1 + 0.04 * l; s.grip *= 1 + 0.02 * l; } }
  ];
  const STYLE = [
    { id: 'spoiler', name: 'Канат', opts: ['Заводдук', 'Кичине', 'GT канат', 'Чоң канат'] },
    { id: 'rim', name: 'Дисктер', opts: ['Заводдук', '10 нур', 'Терең 5', 'Тор', 'Турбина'] },
    { id: 'rimCol', name: 'Дисктин түсү', opts: ['Күмүш', 'Кара', 'Алтын', 'Кызыл', 'Ак'], cols: [0x9aa0ab, 0x1a1c22, 0xd4a12a, 0xc8261e, 0xeeeeee] },
    { id: 'stripe', name: 'Тилкелер', opts: ['Жок', 'Ортодо эки', 'Капталда', 'Кара капот'] },
    { id: 'stripeCol', name: 'Тилкенин түсү', opts: ['Ак', 'Кара', 'Сары', 'Кызыл', 'Көк'], cols: [0xf2f2f2, 0x111111, 0xffc01f, 0xd23a2e, 0x1f5fd1] },
    { id: 'neon', name: 'Неон (асты)', opts: ['Жок', 'Көк', 'Кызгылт', 'Жашыл', 'Кызгылт сары'], cols: [0, 0x2f8cff, 0xff3fb0, 0x2fff8a, 0xff8a1f] },
    { id: 'tint', name: 'Айнек', opts: ['Кадимки', 'Карараак', 'Кара'] },
    { id: 'low', name: 'Бийиктик', opts: ['Заводдук', 'Төмөн', 'Абдан төмөн'] }
  ];
  const ld = () => TK.save.data;
  const tuneOf = id => { const d = ld(); d.tune = d.tune || {}; return d.tune[id] || (d.tune[id] = {}); };
  const styleOf = id => { const d = ld(); d.style = d.style || {}; return d.style[id] || (d.style[id] = {}); };
  const tuneCost = (spec, lvl) => Math.round((1200 + spec.price * 0.04) * lvl * (1 + 0.35 * lvl) / 100) * 100;
  function tunedStats(id) {
    const spec = byId[id] || LIST[0], s = Object.assign({ n2oK: 1, dirt: 0 }, spec.stats), t = tuneOf(spec.id);
    TUNE.forEach(u => { const l = t[u.id] || 0; if (l) u.fx(s, l); });
    return s;
  }

  TK.Cars = {
    PAINTS, list: LIST, byId, register, TUNE, STYLE, tuneOf, styleOf, tuneCost, tunedStats,
    make(id, paintHex) {
      const spec = byId[id] || LIST[0];
      const paint = paintHex || (TK.save.data.paint[id]) || PAINTS[1][0];
      const o = spec.glb ? makeGLB(spec, paint) : TK.CarBuilder.build(spec, paint, styleOf(spec.id));
      if (o.setPaint) o.setPaint(paint);
      return o;
    }
  };
})();
