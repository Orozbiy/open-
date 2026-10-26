/* Бөлүкчөлөр: дөңгөлөк түтүнү, чаң, суу чачырандысы, жалбырактар. Бир Points объект — телефон үчүн арзан. */
(function () {
  const MAX = 500;
  TK.FX = function (scene) {
    const pos = new Float32Array(MAX * 3), size = new Float32Array(MAX), col = new Float32Array(MAX * 4);
    const P = []; for (let i = 0; i < MAX; i++) P.push({ life: 0 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('col', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { scale: { value: innerHeight / 2 }, light: { value: 1 } },
      vertexShader: 'attribute float size; attribute vec4 col; varying vec4 vC; uniform float scale; void main(){ vC = col; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*scale/max(0.5,-mv.z); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying vec4 vC; uniform float light; void main(){ vec2 d = gl_PointCoord-0.5; float r = dot(d,d)*4.0; if(r>1.0) discard; gl_FragColor = vec4(vC.rgb*light, vC.a*(1.0-r)*(1.0-r)); }'
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    let n = 0;
    const T = {
      smoke: { c: [0.86, 0.86, 0.88], a: 0.38, s0: 1.2, s1: 6.5, life: 1.8, g: -0.4, drag: 1.6 },
      dust: { c: [0.62, 0.52, 0.38], a: 0.45, s0: 1.4, s1: 6, life: 1.4, g: -0.2, drag: 1.4 },
      splash: { c: [0.85, 0.93, 1.0], a: 0.8, s0: 0.8, s1: 2.2, life: 1.1, g: 9.8, drag: 0.3 },
      leaf: { c: [0.35, 0.6, 0.25], a: 0.95, s0: 0.35, s1: 0.3, life: 2.2, g: 3, drag: 1.2 },
      leafA: { c: [0.85, 0.45, 0.15], a: 0.95, s0: 0.35, s1: 0.3, life: 2.2, g: 3, drag: 1.2 },
      leafF: { c: [0.9, 0.5, 0.12], a: 0.95, s0: 0.32, s1: 0.3, life: 6, g: 0.6, drag: 2.5 },
      spark: { c: [1.0, 0.75, 0.3], a: 1, s0: 0.25, s1: 0.05, life: 0.5, g: 9.8, drag: 0.5 }
    };
    return {
      mat,
      spawn(type, x, y, z, vx, vy, vz) {
        const t = T[type]; if (!t) return;
        const p = P[n]; n = (n + 1) % MAX;
        p.t = t; p.life = t.life * (0.8 + Math.random() * 0.4); p.age = 0;
        p.x = x; p.y = y; p.z = z; p.vx = vx || 0; p.vy = vy || 0; p.vz = vz || 0;
      },
      update(dt, light) {
        mat.uniforms.light.value = light; mat.uniforms.scale.value = innerHeight / 2;
        for (let i = 0; i < MAX; i++) {
          const p = P[i];
          if (p.life <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
          p.age += dt; p.life -= dt;
          const t = p.t, k = p.age / (p.age + p.life), dr = Math.exp(-t.drag * dt);
          p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - t.g * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
          size[i] = t.s0 + (t.s1 - t.s0) * k;
          col[i * 4] = t.c[0]; col[i * 4 + 1] = t.c[1]; col[i * 4 + 2] = t.c[2]; col[i * 4 + 3] = t.a * (1 - k) * Math.min(1, p.age * 8);
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.size.needsUpdate = true; geo.attributes.col.needsUpdate = true;
      },
      clear() { P.forEach(p => p.life = 0); }
    };
  };
})();
