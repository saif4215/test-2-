import * as THREE from "three";
import { fbm, grey, pixelTexture, rng, studioEnvironment } from "./kit";

/** A burger built from layers (bun, patty, cheese, lettuce, onion, tomato, bun). `setExploded(true)` pulls it apart. */
export function createBurger(canvas, { reduceMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const FOV = 32;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xffe8c4, 0x1a120a, 0.35));
  const key = new THREE.DirectionalLight(0xffdcae, 2.0);
  key.position.set(3, 9, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -6, near: 1, far: 30 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.PointLight(0xd4a24c, 50, 30); rim.position.set(-4, 4, -4); scene.add(rim);

  const V = (x, y) => new THREE.Vector2(x, y);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const phys = (color, rough, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, ...extra });
  /* smooth lathe through a handful of profile points */
  const lathe = (pts, seg = 80) => new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(([x, y]) => V(x, y))).getPoints(pts.length * 10), seg);
  /* paint vertices by a function of position */
  function paint(geo, fn) {
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { fn(c, p.getX(i), p.getY(i), p.getZ(i)); col.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  }
  const lerpHex = (c, a, b, t) => c.set(a).lerp(new THREE.Color(b), clamp(t, 0, 1));

  /* surface detail: fine pores on the bun, a craggy seared patty, veined lettuce */
  const poreN = fbm(256, { seed: 21, scale: 28, octaves: 3, gain: 0.55 });
  const bunBump = pixelTexture(256, (i) => grey(poreN[i] * 255), false);
  const pattyN = fbm(256, { seed: 31, scale: 9, octaves: 5 }), flecks = rng(77);
  const pattyMap = pixelTexture(256, (i) => {
    let v = 150 + pattyN[i] * 105;
    if (pattyN[i] < 0.36) v *= 0.55;               // charred crust
    else if (flecks() < 0.012) v = 255;             // fat flecks
    return [v, v * 0.93, v * 0.88];
  });
  const pattyBump = pixelTexture(256, (i) => grey(Math.pow(pattyN[i], 1.4) * 255), false);
  const veinTex = (() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 512;
    const g = cv.getContext("2d"), r = rng(5);
    g.fillStyle = "#c9c9c9"; g.fillRect(0, 0, 512, 512);
    g.lineCap = "round"; g.strokeStyle = "#ffffff";
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + r() * 0.2; g.lineWidth = 7;
      g.beginPath(); g.moveTo(256, 256);
      let x = 256, y = 256;
      for (let s = 1; s <= 8; s++) {
        const aa = a + (r() - 0.5) * 0.25; x += Math.cos(aa) * 32; y += Math.sin(aa) * 32; g.lineTo(x, y);
        if (s > 2 && s < 8) { g.save(); g.lineWidth = 3; for (const side of [-1, 1]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(aa + side * 0.9) * 26, y + Math.sin(aa + side * 0.9) * 26); g.stroke(); } g.restore(); }
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  })();

  /* tomato slice top: skin ring, flesh, seed chambers */
  function tomatoTexture() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 512;
    const g = cv.getContext("2d"); g.translate(256, 256);
    g.fillStyle = "#b3241a"; g.beginPath(); g.arc(0, 0, 256, 0, 7); g.fill();
    g.fillStyle = "#e0432e"; g.beginPath(); g.arc(0, 0, 238, 0, 7); g.fill();
    for (let i = 0; i < 6; i++) {
      g.save(); g.rotate((i * Math.PI) / 3);
      g.fillStyle = "#f0674d"; g.beginPath(); g.ellipse(128, 0, 78, 56, 0, 0, 7); g.fill();
      g.fillStyle = "#f5d683";
      for (let s = 0; s < 6; s++) { g.beginPath(); g.ellipse(100 + Math.random() * 60, (Math.random() - 0.5) * 60, 8, 5, Math.random() * 3, 0, 7); g.fill(); }
      g.restore();
    }
    g.fillStyle = "#f6cdb7"; g.beginPath(); g.arc(0, 0, 36, 0, 7); g.fill();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }

  const layers = [];  // bottom to top
  const root = new THREE.Group();
  function layer(name, y, anchorY = 0) {
    const g = new THREE.Group(), anchor = new THREE.Object3D();
    anchor.position.y = anchorY; g.add(anchor); g.position.y = y; root.add(g);
    layers.push({ name, group: g, anchor, base: y });
    return g;
  }
  const dropMat = phys(0xffffff, 0.02, { transparent: true, opacity: 0.38, clearcoat: 1 });
  function droplets(g, n, radius, y, rMax) {
    const geo = new THREE.SphereGeometry(1, 10, 8).scale(1, 0.55, 1);
    const im = new THREE.InstancedMesh(geo, dropMat, n), o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 7, d = Math.sqrt(Math.random()) * rMax, s = radius * (0.5 + Math.random());
      o.position.set(Math.cos(a) * d, y, Math.sin(a) * d); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    }
    g.add(im);
  }

  const BUN_LIP = 1.52;
  // 0 · bottom brioche bun
  {
    const g = layer("Brioche bottom", 0, 0.22);
    const side = paint(lathe([[1.15, 0], [1.42, 0.05], [1.53, 0.17], [1.52, 0.31], [1.4, 0.42], [1.3, 0.45]]),
      (c, x, y) => lerpHex(c, 0xd88a2c, 0xe9aa4a, y / 0.45));
    g.add(new THREE.Mesh(side, phys(0xffffff, 0.45, { vertexColors: true, clearcoat: 0.5, clearcoatRoughness: 0.4, bumpMap: bunBump, bumpScale: 0.45 })));
    const top = new THREE.Mesh(new THREE.CircleGeometry(1.3, 56), phys(0xd9a050, 0.85));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.45;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(1.2, 40), phys(0xc98a34, 0.85));
    bottom.rotation.x = Math.PI / 2; bottom.position.y = 0.005;
    g.add(top, bottom);
  }
  // 1 · patty: dark, craggy, seared
  {
    const g = layer("Beef patty", 0.67, 0);
    const prof = [V(0, -0.2)];
    for (let r = 0.2; r <= 1.28; r += 0.08) prof.push(V(r, -0.2));
    for (let a = -0.5; a <= 0.5 + 1e-6; a += 0.125) prof.push(V(1.28 + Math.cos(a * Math.PI) * 0.16, Math.sin(a * Math.PI) * 0.2));
    for (let r = 1.28; r >= 0; r -= 0.08) prof.push(V(Math.max(r, 0), 0.2));
    const geo = new THREE.LatheGeometry(prof, 96);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = Math.sin(x * 6.3 + z * 1.7) * Math.cos(z * 5.1) * 0.045 + Math.sin(x * 13 + z * 9) * 0.03 + Math.sin(z * 21 - x * 11) * 0.02 + Math.sin(x * 33 + z * 29) * 0.012;
      const a = Math.atan2(z, x);
      const k = 1 + Math.sin(a * 7) * 0.02 + Math.cos(a * 11) * 0.015;
      if (y > 0.05) y += n; else if (y > -0.05) { x *= 1 + n * 0.5; z *= 1 + n * 0.5; }
      p.setXYZ(i, x * k, y, z * k);
      const t = clamp(0.35 + n * 7 + (y > 0 ? 0.15 : -0.05), 0, 1);
      c.set(0x2a0f0b).lerp(new THREE.Color(0x7c3320), t);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, phys(0xffffff, 0.7, { vertexColors: true, map: pattyMap, bumpMap: pattyBump, bumpScale: 5, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x8a3a24) })));
  }
  // 2 · melted cheese, sagging over the edge
  {
    const g = layer("Melted cheese", 0.88);
    const geo = new THREE.PlaneGeometry(3.0, 3.0, 40, 40);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d = Math.max(0, Math.hypot(x, z) - 1.12);
      p.setY(i, p.getY(i) - d * d * 0.95 + Math.sin(x * 7) * Math.sin(z * 6) * 0.01);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, phys(0xe39b32, 0.28, { side: THREE.DoubleSide, clearcoat: 0.7, clearcoatRoughness: 0.25 }));
    m.rotation.y = 0.5;
    g.add(m);
  }
  // 3 · lettuce: big ruffled leaves with pale edges
  {
    const g = layer("Crisp lettuce", 1.0, 0);
    [[1.92, 0], [1.62, 1.7]].forEach(([R, ph], k) => {
      const lg = new THREE.RingGeometry(0.01, R, 128, 12), lp = lg.attributes.position;
      for (let i = 0; i < lp.count; i++) {
        const x = lp.getX(i), y = lp.getY(i), s = Math.hypot(x, y) / R, a = Math.atan2(y, x);
        lp.setZ(i, Math.sin(a * 13 + ph + s * 2) * 0.17 * s ** 3 + Math.sin(a * 5 + ph) * 0.07 * s + Math.sin(a * 29 + s * 9) * 0.03 * s - s * s * 0.12);
      }
      lg.computeVertexNormals();
      paint(lg, (c, x, y) => lerpHex(c, 0x2a6417, 0x66a834, Math.hypot(x, y) / R * 1.1 - 0.1));
      const mesh = new THREE.Mesh(lg, phys(0xffffff, 0.35, { vertexColors: true, map: veinTex, bumpMap: veinTex, bumpScale: 1.4, side: THREE.DoubleSide, clearcoat: 0.35, clearcoatRoughness: 0.4 }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = k * 0.06;
      g.add(mesh);
    });
  }
  // 4 · red onion: two overlapping slices
  {
    const g = layer("Red onion", 1.17, 0);
    const ring = (rin, rout) => paint(new THREE.LatheGeometry([V(rin, -0.035), V(rout, -0.035), V(rout + 0.012, 0), V(rout, 0.035), V(rin, 0.035), V(rin - 0.012, 0), V(rin, -0.035)], 72),
      (c, x, y, z) => lerpHex(c, 0x5a1d6b, 0xb978b4, 1 - (Math.hypot(x, z) - rin) / (rout - rin)));
    const om = phys(0xffffff, 0.3, { vertexColors: true, clearcoat: 0.9, clearcoatRoughness: 0.2 });
    [[0.12, 0, -0.08, 0], [-0.1, 0.07, 0.1, 1]].forEach(([x, y, z]) => {
      for (const [a, b] of [[1.22, 0.78], [0.62, 0.34]]) {
        const r = new THREE.Mesh(ring(b, a), om);
        r.position.set(x, y, z); g.add(r);
      }
    });
    droplets(g, 26, 0.035, 0.07, 1.0);
  }
  // 5 · tomato: thick slices, wet
  {
    const g = layer("Ripe tomato", 1.34, 0);
    const skin = phys(0xb82a1c, 0.25, { clearcoat: 1, clearcoatRoughness: 0.12 });
    const tex = tomatoTexture();
    const flesh = phys(0xffffff, 0.22, { map: tex, clearcoat: 1, clearcoatRoughness: 0.1 });
    [[0.1, 0, 0.05], [-0.18, 0.13, -0.05]].forEach(([x, y, z], i) => {
      const s = new THREE.Mesh(lathe([[1.0, -0.065], [1.2, -0.06], [1.23, 0], [1.2, 0.06], [1.0, 0.065]], 64), skin);
      const t = new THREE.Mesh(new THREE.CircleGeometry(1.2, 56), flesh);
      t.rotation.x = -Math.PI / 2; t.position.y = 0.066;
      const b = t.clone(); b.rotation.x = Math.PI / 2; b.position.y = -0.066;
      const grp = new THREE.Group(); grp.add(s, t, b); grp.position.set(x, y, z); grp.rotation.y = i * 1.2;
      if (i === 1) droplets(grp, 36, 0.045, 0.075, 1.0);
      g.add(grp);
    });
  }
  // 6 · brioche crown: puffy, glossy, golden
  {
    const g = layer("Brioche top", 1.58, 0.5);
    const crown = paint(lathe([[1.4, 0], [1.53, 0.1], [1.58, 0.26], [1.52, 0.5], [1.3, 0.76], [0.9, 0.94], [0.45, 1.02], [0.0, 1.04]]),
      (c, x, y) => lerpHex(c, 0xe3a13f, 0xa8561a, Math.pow(y / 1.04, 0.8)));
    const p = crown.attributes.position;
    for (let i = 0; i < p.count; i++) {   // soft dimples and a slightly squarish plan
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const k = 1 + Math.sin(a * 4 + 0.6) * 0.012 + Math.sin(x * 4.5) * Math.cos(z * 3.7) * 0.012 * (y > 0.3 ? 1 : 0);
      p.setXYZ(i, x * k, y + Math.sin(x * 5 + z * 3) * 0.012 * (y > 0.3 ? 1 : 0), z * k);
    }
    crown.computeVertexNormals();
    g.add(new THREE.Mesh(crown, phys(0xffffff, 0.35, { vertexColors: true, clearcoat: 0.9, clearcoatRoughness: 0.28, bumpMap: bunBump, bumpScale: 0.45 })));
    const under = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), phys(0xd9a458, 0.85));
    under.rotation.x = Math.PI / 2;
    g.add(under);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const N = layers.length, GAP = 1.32, MID = 1.3;
  layers.forEach((l, i) => { l.apart = MID + (i - (N - 1) / 2) * GAP; });
  const tilt = new THREE.Group(); tilt.add(root);
  const spinner = new THREE.Group(); spinner.add(tilt); scene.add(spinner);

  let dragging = false, lastX = 0, vel = 0.005;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!dragging) return; vel = (e.clientX - lastX) * 0.012; spinner.rotation.y += vel; lastX = e.clientX; });
  const release = () => { dragging = false; };
  canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);

  const fit = { together: 8, apart: 14 };
  let target = 0, e = 0;   // e: 0 = together, 1 = pulled apart
  function resize() {
    const W = canvas.clientWidth || 300, H = canvas.clientHeight || 300, aspect = W / H;
    renderer.setSize(W, H, false);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    const tan = Math.tan((FOV * Math.PI) / 360);
    // two framings: close up when together, further back when pulled apart (so it fits a phone either way)
    fit.together = Math.max(5.2 / (2 * tan), 4.2 / (2 * tan * aspect));
    fit.apart = Math.max(13.2 / (2 * tan), 6.4 / (2 * tan * aspect));
    camera.position.set(0, 0.5, fit.together + (fit.apart - fit.together) * e); camera.lookAt(0, 0, 0);
  }
  resize();

  const clock = new THREE.Clock();
  spinner.rotation.y = 0.6;
  return {
    resize,
    setExploded(on) { target = on ? 1 : 0; if (reduceMotion) e = target; },
    frame() {
      const t = clock.getElapsedTime();
      e += (target - e) * (reduceMotion ? 1 : 0.07);
      camera.position.z = fit.together + (fit.apart - fit.together) * e;
      layers.forEach((l, i) => {
        const k = smooth(0, 1, clamp(e * 1.25 - i * 0.03, 0, 1));
        l.group.position.y = l.base + (l.apart - l.base) * k;
      });
      root.position.y = -0.8 - 0.95 * e;
      tilt.rotation.x = 0.12 + e * 0.1;
      if (!dragging && !reduceMotion) { vel += (0.005 - vel) * 0.04; spinner.rotation.y += vel; }
      spinner.position.y = reduceMotion ? 0 : Math.sin(t * 1.2) * 0.06 * (1 - e);
      renderer.render(scene, camera);
    },
    dispose() { renderer.dispose(); scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose(); }); }); },
  };
}
