/* Табият: шамал (дарак/чөп тербелет), мезгилдер (жаз · жай · күз · кыш), сынык бөлүктөрдүн физикасы.
   TK.WIND — убакыт (ар бир кадрда жаңыланат); TK.SEASON — кар / күз / жаз күчү (0..1), шейдерлерге берилет.
   TK.patchMat(mat, {wind, season}) — Lambert/Phong материалына шамал жана мезгил кошот.
   TK.Debris — учуп кеткен бөлүктөр: гравитация, айлануу, жерге урунуп секирүү, сүрүлүү, акырындап жок болуу. */
(function () {
  TK.WIND = { value: 0 };
  TK.SEASON = { uSnow: { value: 0 }, uAutumn: { value: 0 }, uSpring: { value: 0 } };

  // season: 'terrain' | 'tree' | 'pine' | 'grass' | 'roof'
  TK.patchMat = function (mat, o) {
    o = o || {};
    const w = o.wind, sk = o.season;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uWind = TK.WIND;
      Object.assign(sh.uniforms, TK.SEASON);
      let vs = 'uniform float uWind; uniform float uSnow; varying float vSeasonN;\n' + sh.vertexShader;
      vs = vs.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n vSeasonN = objectNormal.y;');
      let inject = '';
      if (w) inject += `
        #ifdef USE_INSTANCING
          float wph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17;
        #else
          float wph = position.x * 0.05;
        #endif
        float whf = max(0.0, transformed.y - ${(w.minY || 0).toFixed(2)});
        transformed.x += sin(uWind * ${(w.speed || 1.6).toFixed(2)} + wph) * ${w.amp.toFixed(4)} * whf;
        transformed.z += cos(uWind * ${((w.speed || 1.6) * 0.8).toFixed(2)} + wph * 1.3) * ${(w.amp * 0.7).toFixed(4)} * whf;`;
      if (sk === 'grass') inject += '\n transformed.y *= 1.0 - 0.8 * uSnow;';
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>' + inject);
      sh.vertexShader = vs;
      let fs = 'uniform float uSnow; uniform float uAutumn; uniform float uSpring; varying float vSeasonN;\n' + sh.fragmentShader;
      let fx = '';
      const green = 'float gr = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 5.0, 0.0, 1.0);';
      if (sk === 'terrain') fx = green + `
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.85, 1.18, 0.8), uSpring * gr);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.35, 0.95, 0.5) + vec3(0.06, 0.02, 0.0), uAutumn * gr * 0.85);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), uSnow * smoothstep(0.45, 0.8, vSeasonN));`;
      if (sk === 'tree') fx = green + `
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 1.15, 0.85), uSpring * gr);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.42, 0.12), uAutumn * gr * 0.75);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.38, 0.34), uSnow * gr * 0.55);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.96, 1.0), uSnow * smoothstep(0.25, 0.8, vSeasonN) * 0.9);`;
      if (sk === 'pine') fx = `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.96, 1.0), uSnow * smoothstep(0.15, 0.6, vSeasonN) * 0.92);`;
      if (sk === 'grass') fx = `
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 1.2, 0.85), uSpring);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.45, 1.05, 0.45), uAutumn * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.97, 1.0), uSnow * 0.92);`;
      if (sk === 'roof') fx = `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.96, 1.0), uSnow * smoothstep(0.3, 0.7, vSeasonN));`;
      fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + fx);
      sh.fragmentShader = fs;
    };
    mat.customProgramCacheKey = () => 'tk_' + (sk || '') + (w ? 'w' + w.amp : '');
    mat.needsUpdate = true;
    return mat;
  };

  /* ---------- сынык бөлүктөр ---------- */
  TK.Debris = function (scene) {
    const list = [], dq = new THREE.Quaternion(), ax = new THREE.Vector3();
    return {
      // m — даяр Mesh; v — ылдамдык; w — бурчтук ылдамдык (рад/с); r — жерге чейинки жарым-бийиктик
      add(m, v, w, life, r, own) { scene.add(m); list.push({ m, v, w, t: 0, life: life || 5, r: r || 0.3, own, s0: m.scale.clone() }); },
      update(dt, groundY) {
        for (let i = list.length - 1; i >= 0; i--) {
          const d = list[i]; d.t += dt;
          d.v.y -= 9.8 * dt; d.m.position.addScaledVector(d.v, dt);
          const wl = d.w.length(); if (wl > 1e-3) { ax.copy(d.w).multiplyScalar(1 / wl); dq.setFromAxisAngle(ax, wl * dt); d.m.quaternion.premultiply(dq); }
          const gy = groundY ? groundY(d.m.position.x, d.m.position.z) : 0;
          if (d.m.position.y - d.r < gy) {
            d.m.position.y = gy + d.r;
            if (d.v.y < 0) d.v.y *= -0.32;
            d.v.x *= 0.72; d.v.z *= 0.72; d.w.multiplyScalar(0.75);
            if (Math.abs(d.v.y) < 0.6) d.v.y = 0;
          }
          const fade = d.t - (d.life - 1.2);
          if (fade > 0) { const k = Math.max(0.001, 1 - fade / 1.2); d.m.scale.copy(d.s0).multiplyScalar(k); }
          if (d.t > d.life) { scene.remove(d.m); if (d.own && d.own.mat) d.m.material.dispose(); list.splice(i, 1); }
        }
      },
      clear() { list.forEach(d => scene.remove(d.m)); list.length = 0; },
      get count() { return list.length; }
    };
  };

  /* ---------- дарактын 3 бөлүгү (сынганда) ---------- */
  let parts = null;
  TK.treeParts = function () {
    if (parts) return parts;
    const tr = (g, y) => { g.translate(0, y, 0); return g; };
    parts = {
      pine: [tr(new THREE.CylinderGeometry(.3, .4, 2.2, 5), 0), tr(new THREE.ConeGeometry(2.2, 6.5, 7), 0), tr(new THREE.ConeGeometry(1.7, 5, 7), 0)],
      round: [tr(new THREE.CylinderGeometry(.28, .38, 3.4, 5), 0), tr(new THREE.IcosahedronGeometry(2.6, 0), 0), tr(new THREE.IcosahedronGeometry(1.9, 0), 0)],
      tall: [tr(new THREE.CylinderGeometry(.22, .32, 4.5, 5), 0), (() => { const g = new THREE.IcosahedronGeometry(1.6, 0); g.scale(1, 1.4, 1); return g; })(), (() => { const g = new THREE.IcosahedronGeometry(1.4, 0); g.scale(1, 1.3, 1); return g; })()],
      // бөлүктөрдүн дарактын түбүнөн бийиктиги
      off: { pine: [1.1, 5.2, 8], round: [1.7, 5.2, 6.4], tall: [2.25, 6.2, 8.6] },
      trunk: new THREE.MeshLambertMaterial({ color: 0x6b4a2e })
    };
    return parts;
  };
})();
