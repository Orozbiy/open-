/* Машинанын физикасы.
   Айдоо: чыныгыга жакын — тездетүү 0→100 ≈ 4–6 с, тормоз ≈ 1g, руль ылдамдыкта азаят,
   бурулуу дөңгөлөктүн кармоосу менен чектелет (жогорку ылдамдыкта кескин бурулбайт), дрифт — кол тормоз же газ менен.
   Кагылышуу: машина 3 тегерек менен (узундугу/туурасы боюнча) берилет; тийген чекитте импульс,
   айлануу (тийген жерине жараша машина буруулат), сүрүлүү. Тоскоолдук чын эле тийгенде гана иштейт. */
(function () {
  const clamp = TK.util.clamp;
  const ENGINE_K = 0.55, DRAG = 0.00085, BRAKE = 10.5, G = 9.8;

  function newCar(x, z, h) {
    return { x: x || 0, z: z || 0, h: h || 0, vx: 0, vz: 0, yaw: 0, spin: 0, steer: 0, wheelRot: 0, vf: 0, vl: 0, impact: 0, hw: 0.95, hl: 2.2 };
  }

  function step(car, input, dt, S, surface, collide) {
    const sf = surface || { grip: 1, drag: 0 };
    const s = Math.sin(car.h), c = Math.cos(car.h);
    let vf = car.vx * s + car.vz * c;
    let vl = -car.vx * c + car.vz * s;
    const speed = Math.hypot(car.vx, car.vz);
    const slip = Math.abs(vl);

    // АБАДА: дөңгөлөктөр жерге тийбейт — газ/тормоз/руль иштебейт, машина инерция менен учат
    if (sf.air) {
      car.steer += (input.steer - car.steer) * (1 - Math.exp(-3 * dt));
      vf -= vf * Math.abs(vf) * DRAG * dt; vl -= vl * Math.abs(vl) * DRAG * dt;
      car.yaw *= Math.exp(-0.6 * dt); car.spin *= Math.exp(-1.5 * dt);
      car.vx = s * vf - c * vl; car.vz = c * vf + s * vl; car.vf = vf; car.vl = vl;
      car.h += (car.yaw + car.spin) * dt; car.x += car.vx * dt; car.z += car.vz * dt;
      car.wheelRot += vf / 0.34 * dt;
      if (collide) collide(car);
      return;
    }
    // руль: ылдамдыкта жайыраак айланат
    const rate = (input.steer === 0 ? 7 : 5) / (1 + speed / 70);
    car.steer += (input.steer - car.steer) * (1 - Math.exp(-rate * dt));

    // узунунан: кыймылдаткыч, тормоз, аба каршылыгы, тоголонуу
    if (input.gas) {
      const traction = Math.min(1, 0.55 + speed / 12);     // стартта дөңгөлөк тайгаланат
      vf += (sf.tc && slip > 3 ? 0.75 : 1) * S.engine * ENGINE_K * traction * Math.max(0, 1 - vf / S.maxSpeed) * dt * (sf.dirt ? 0.97 : 1);
    }
    if (input.brake) { if (vf > 0.5) vf -= BRAKE * sf.grip * dt; else vf = Math.max(vf - 4 * dt, -9); }
    if (input.hb) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 4 * dt);
    if (!input.gas && !input.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (0.6 + Math.abs(vf) * 0.012) * dt);   // мотор менен басуу
    vf -= vf * Math.abs(vf) * DRAG * dt;
    if (sf.drag) vf -= vf * sf.drag * dt;
    if (sf.slope) vf -= G * clamp(sf.slope, -0.7, 0.7) * dt;
    if (sf.slopeL) vl += G * clamp(sf.slopeL, -0.7, 0.7) * dt * 0.8;    // каптал эңкейиште ылдый тайгалат

    // капталынан кармоо
    let grip = input.hb ? 1.1 / S.drift : (slip > 3.5 ? 2.6 / S.drift : 8 * S.grip);
    if (sf.tc && !input.hb && slip > 1.5) grip *= 1.9;
    if (slip > 3.5 && input.gas) grip *= 0.8;
    grip *= sf.grip;
    const newVl = vl * Math.exp(-grip * dt);
    if (vf > 2) vf += (Math.abs(vl) - Math.abs(newVl)) * 0.18;
    vl = newVl;

    // бурулуу: рулдун бурчу ылдамдыкта азаят + капталдагы ылдамдануу ≈ 1.1g чегинен ашпайт
    const steerAngle = car.steer * S.steer * (0.52 - 0.40 * clamp(speed / 38, 0, 1));
    let targetYaw = -vf * Math.tan(steerAngle) / S.wheelbase;
    const drifting = slip > 3.5 || input.hb;
    if (!drifting) { const lim = (10.5 * S.grip * sf.grip) / Math.max(4, Math.abs(vf)); targetYaw = clamp(targetYaw, -lim, lim); }
    const k = drifting ? 2.4 : 6;
    car.yaw += (targetYaw - car.yaw) * (1 - Math.exp(-k * dt));
    if (input.hb && speed > 7) car.yaw += -car.steer * 2.2 * dt * Math.sign(vf);
    if (slip > 3 && input.gas && vf > 8) car.yaw += -car.steer * 1.6 * dt;
    car.yaw = clamp(car.yaw, -3.2, 3.2);
    car.spin *= Math.exp(-2.2 * dt);                        // кагылышуудан кийинки айлануу акырындап басылат

    car.vx = s * vf - c * vl;
    car.vz = c * vf + s * vl;
    car.vf = vf; car.vl = vl;
    car.h += (car.yaw + car.spin) * dt;
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    car.wheelRot += vf / 0.34 * dt;
    if (collide) collide(car);
  }

  /* ===================== КАГЫЛЫШУУ ===================== */
  const INERTIA = 1.9;   // массага бөлүнгөн инерция моменти (4.4 × 1.9 м кутуча)
  function circles(car) {
    const s = Math.sin(car.h), c = Math.cos(car.h), L = car.hl - car.hw;
    return [[car.x + s * L, car.z + c * L], [car.x, car.z], [car.x - s * L, car.z - c * L]];
  }
  // n — тоскоолдуктан машинага карай; px,pz — тийген чекит; k — тоскоолдуктун "оордугу" (1 = кыймылсыз)
  function resolve(car, nx, nz, depth, px, pz, e, k) {
    car.x += nx * depth; car.z += nz * depth;
    const rx = px - car.x, rz = pz - car.z, w = car.yaw + car.spin;
    const vx = car.vx + w * rz, vz = car.vz - w * rx;
    const vn = vx * nx + vz * nz;
    if (vn >= 0) return 0;
    const cn = nx * rz - nz * rx;
    const j = -(1 + e) * vn / (1 + cn * cn / INERTIA) * k;
    car.vx += j * nx; car.vz += j * nz; car.spin += j * cn / INERTIA * 0.8;
    const tx = -nz, tz = nx, vt = vx * tx + vz * tz, ct = tx * rz - tz * rx;
    const jt = clamp(-vt * 0.35 / (1 + ct * ct / INERTIA), -0.45 * j, 0.45 * j);
    car.vx += jt * tx; car.vz += jt * tz; car.spin += jt * ct / INERTIA * 0.8;
    car.spin = clamp(car.spin, -4, 4);
    car.impact = Math.max(car.impact, -vn);
    return -vn;
  }
  // тегерек тоскоолдук (дарак, мамы, таш). Кайтарат: урунуу ылдамдыгы (0 — тийген жок)
  function hitCircle(car, ox, oz, or, e, k, probe) {
    let best = 0;
    for (const [cx, cz] of circles(car)) {
      const dx = cx - ox, dz = cz - oz, d = Math.hypot(dx, dz), R = car.hw + or;
      if (d >= R || d < 1e-5) continue;
      const nx = dx / d, nz = dz / d;
      if (probe) { const rx = ox + nx * or - car.x, rz = oz + nz * or - car.z, w = car.yaw + car.spin; const vn = (car.vx + w * rz) * nx + (car.vz - w * rx) * nz; best = Math.max(best, -vn, 0.01); continue; }
      best = Math.max(best, resolve(car, nx, nz, R - d, ox + nx * or, oz + nz * or, e === undefined ? 0.25 : e, k || 1) || 0.01);
    }
    return best;
  }
  // AABB тоскоолдук (үй, имарат)
  function hitBox(car, x0, z0, x1, z1, e) {
    let best = 0;
    for (const [cx, cz] of circles(car)) {
      let qx = clamp(cx, x0, x1), qz = clamp(cz, z0, z1), dx = cx - qx, dz = cz - qz, d = Math.hypot(dx, dz);
      if (d >= car.hw) continue;
      let nx, nz, depth;
      if (d < 1e-5) {   // борбору ичинде — эң жакын бетке түртөт
        const m = Math.min(cx - x0, x1 - cx, cz - z0, z1 - cz);
        if (m === cx - x0) { nx = -1; nz = 0; qx = x0; } else if (m === x1 - cx) { nx = 1; nz = 0; qx = x1; } else if (m === cz - z0) { nx = 0; nz = -1; qz = z0; } else { nx = 0; nz = 1; qz = z1; }
        depth = m + car.hw;
      } else { nx = dx / d; nz = dz / d; depth = car.hw - d; }
      best = Math.max(best, resolve(car, nx, nz, depth, qx, qz, e === undefined ? 0.2 : e, 1) || 0.01);
    }
    return best;
  }
  // башка машина (трафик/рақиб): анын да 3 тегереги бар. k<1 — ал да түртүлөт
  function hitCar(car, ox, oz, oh, ohl, k) {
    const s = Math.sin(oh), c = Math.cos(oh), L = (ohl || 2.2) - 0.95;
    let best = 0;
    for (const t of [-L, 0, L]) best = Math.max(best, hitCircle(car, ox + s * t, oz + c * t, 0.95, 0.3, k || 0.7));
    return best;
  }
  // сызыктуу дубал: (px,pz) — дубалдын чекити, (nx,nz) — ичине карай нормаль
  function hitWall(car, px, pz, nx, nz, e) {
    let best = 0;
    for (const [cx, cz] of circles(car)) {
      const d = (cx - px) * nx + (cz - pz) * nz;
      if (d >= car.hw) continue;
      best = Math.max(best, resolve(car, nx, nz, car.hw - d, cx - nx * d, cz - nz * d, e === undefined ? 0.2 : e, 1) || 0.01);
    }
    return best;
  }
  TK.Physics = { newCar, step, circles, resolve, hitCircle, hitBox, hitCar, hitWall };
})();
