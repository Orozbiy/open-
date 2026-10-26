/* Менюдагы 3D шоу-рум: айланып турган машина, неон жарыктар, түнкү шаардын чырактары */
(function () {
  TK.Showroom = function (renderer) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070912);
    scene.fog = new THREE.Fog(0x070912, 16, 46);
    const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 120);

    scene.add(new THREE.HemisphereLight(0x6f7fb0, 0x141018, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(-5, 7, 6); scene.add(key);
    const rimA = new THREE.PointLight(0xffa83a, 2.2, 16, 1.6); rimA.position.set(-4.5, 2.2, -4); scene.add(rimA);
    const rimB = new THREE.PointLight(0x38d4ff, 2.0, 16, 1.6); rimB.position.set(4.5, 1.6, -3.5); scene.add(rimB);
    const rimC = new THREE.PointLight(0xff3d8b, 1.2, 14, 1.8); rimC.position.set(0, 1.2, 5.5); scene.add(rimC);

    // аянтча
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.75, metalness: 0.25 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.14, 48), new THREE.MeshStandardMaterial({ color: 0x1b1e27, roughness: 0.6, metalness: 0.4 }));
    plat.position.y = 0.07; scene.add(plat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.04, 8, 90), new THREE.MeshBasicMaterial({ color: 0xffb547 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; scene.add(ring);
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,181,71,.5)'); gr.addColorStop(1, 'rgba(255,181,71,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; scene.add(glow);

    // арткы шаар чырактары (неон тилкелер)
    const r = TK.util.seeded(4), cols = [0xffb547, 0x38d4ff, 0xff3d8b, 0xe8edf5];
    const bars = [];
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * (0.18 + 0.64 * (i / 70)) + Math.PI, rad = 20 + r() * 12, h = 2 + r() * r() * 22, w = 0.8 + r() * 2.2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshBasicMaterial({ color: 0x0d1222 }));
      b.position.set(Math.cos(a) * rad, h / 2, Math.sin(a) * rad); scene.add(b);
      const n = 1 + ((r() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.12, w * 1.02), new THREE.MeshBasicMaterial({ color: cols[(r() * cols.length) | 0] }));
        s.position.set(b.position.x, 0.5 + r() * h, b.position.z); scene.add(s);
      }
    }

    const holder = new THREE.Group(); scene.add(holder);
    let car = null, view = 'main', t = 0, rot = 0.6, userRot = 0, idle = 0, camX = 0, camXT = 0;
    const api = {
      scene, camera, active: false,
      setCar(obj) {
        if (car) holder.remove(car.group);
        car = obj; holder.add(car.group); car.group.position.y = 0.14;
        if (car.spot) car.spot.intensity = 1.6;
        if (car.tailGlow) car.tailGlow.intensity = 0.6;
        if (car.tailMat && car.tailMat.color) car.tailMat.color.setHex(0xff2a1a);
      },
      get car() { return car; },
      setView(v) { view = v; camXT = v === 'garage' ? 1.9 : (v === 'main' ? -2.2 : 0); },
      resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); },
      update(dt) {
        t += dt; idle -= dt;
        if (idle <= 0) rot += dt * 0.35;
        if (car) { car.group.rotation.y = rot; car.wheels.forEach(w => w.spin.rotation.x += dt * 1.2); }
        camX += (camXT - camX) * Math.min(1, dt * 3);
        const asp = camera.aspect, R = asp < 1 ? 15 : 11.5;
        camera.position.set(camX * 0.4, 1.9 + Math.sin(t * 0.3) * 0.1, R);
        camera.lookAt(camX, 0.7, 0);
        // машинаны экрандын бош жагына жылдыруу
        holder.position.x = 0; camera.setViewOffset && 0;
        ring.rotation.z = t * 0.2;
        rimA.intensity = 2.2 + Math.sin(t * 1.3) * 0.4;
      },
      render() { renderer.render(scene, camera); }
    };
    // сүйрөп айландыруу
    let down = false, lx = 0;
    const cvs = renderer.domElement;
    cvs.addEventListener('pointerdown', e => { if (!api.active) return; down = true; lx = e.clientX; });
    addEventListener('pointerup', () => { down = false; });
    addEventListener('pointermove', e => { if (!down || !api.active) return; rot += (e.clientX - lx) * 0.012; lx = e.clientX; idle = 2.5; });
    return api;
  };
})();
