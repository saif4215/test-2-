import * as THREE from "./vendor/three.module.min.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- scroll reveal + stat counters ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("in");
    e.target.querySelectorAll?.("[data-count]").forEach(countUp);
    io.unobserve(e.target);
  }
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

function countUp(el) {
  const target = +el.dataset.count;
  if (reduceMotion) { el.textContent = target; return; }
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min((t - t0) / 1200, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- 3D tilt cards ---------- */
if (!reduceMotion && matchMedia("(hover: hover)").matches) {
  document.querySelectorAll("[data-tilt]").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.transform = `rotateY(${(x - 0.5) * 18}deg) rotateX(${(0.5 - y) * 18}deg) translateZ(10px)`;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
    });
    card.addEventListener("pointerleave", () => (card.style.transform = ""));
  });
}

/* ---------- hero 3D scene ---------- */
const canvas = document.getElementById("scene");
try { initScene(); } catch (err) { console.warn("WebGL unavailable, showing static hero.", err); canvas.remove(); }

function initScene() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.6, 8);

  scene.add(new THREE.HemisphereLight(0xffe2b0, 0x120d08, 0.7));
  const key = new THREE.DirectionalLight(0xffd9a0, 3);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0xd4a24c, 40, 20);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  /* cup group, built from lathe profiles */
  const cup = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf1e8da, roughness: 0.25, metalness: 0.05 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a24c, roughness: 0.3, metalness: 0.9 });
  const coffee = new THREE.MeshStandardMaterial({ color: 0x2a140a, roughness: 0.15, metalness: 0.2 });

  const body = new THREE.LatheGeometry([
    [0, 0], [0.55, 0], [0.8, 0.1], [1.05, 0.7], [1.15, 1.45], [1.12, 1.5], [1.02, 1.45], [0.95, 0.75], [0.7, 0.2], [0, 0.15],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 64);
  cup.add(new THREE.Mesh(body, ceramic));
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(1.085, 0.03, 12, 64), gold);
  rimRing.rotation.x = Math.PI / 2; rimRing.position.y = 1.47;
  cup.add(rimRing);
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), coffee);
  liquid.rotation.x = -Math.PI / 2; liquid.position.y = 1.3;
  cup.add(liquid);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 16, 32, Math.PI * 1.15), ceramic);
  handle.position.set(1.12, 0.85, 0); handle.rotation.z = -Math.PI * 0.58;
  cup.add(handle);
  const saucer = new THREE.Mesh(new THREE.LatheGeometry([
    [0, -0.05], [1.4, -0.05], [2.0, 0.08], [2.1, 0.14], [2.0, 0.12], [1.4, 0.0], [0, 0.0],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 64), ceramic);
  cup.add(saucer);
  cup.position.y = -1.2;
  const rig = new THREE.Group();
  rig.add(cup);
  scene.add(rig);

  /* floating coffee beans */
  const beanGeo = new THREE.SphereGeometry(0.16, 16, 12);
  beanGeo.scale(1, 0.65, 0.7);
  const beanMat = new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.45 });
  const N = 40;
  const beans = new THREE.InstancedMesh(beanGeo, beanMat, N);
  const seeds = Array.from({ length: N }, () => ({
    p: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, -2 - Math.random() * 5),
    r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    s: 0.6 + Math.random() * 1.2, v: 0.3 + Math.random() * 0.7,
  }));
  scene.add(beans);

  /* steam sprites */
  const sc = document.createElement("canvas"); sc.width = sc.height = 64;
  const g = sc.getContext("2d").createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,240,215,.55)"); g.addColorStop(1, "rgba(255,240,215,0)");
  const sctx = sc.getContext("2d"); sctx.fillStyle = g; sctx.fillRect(0, 0, 64, 64);
  const steamTex = new THREE.CanvasTexture(sc);
  const steam = Array.from({ length: 18 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false }));
    s.userData.t = i / 18;
    cup.add(s);
    return s;
  });

  const dummy = new THREE.Object3D();
  const mouse = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; });

  let baseY = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // push the cup right on wide screens, centre it on narrow ones
    const wide = w / h > 1.1;
    rig.position.x = wide ? 2.4 : 0;
    baseY = wide ? 0.6 : 2.6;
    camera.position.z = wide ? 10 : 13;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    const sy = Math.min(scrollY / innerHeight, 1.5);

    smooth.x += (mouse.x - smooth.x) * 0.05;
    smooth.y += (mouse.y - smooth.y) * 0.05;
    rig.rotation.y = t * 0.4 + smooth.x * 1.2 + sy * 2;
    rig.rotation.x = 0.35 + smooth.y * 0.4;
    rig.position.y += (baseY + Math.sin(t) * 0.12 - sy * 1.2 - rig.position.y) * 0.1;
    camera.position.x = smooth.x * 0.8;

    seeds.forEach((s, i) => {
      dummy.position.set(s.p.x + Math.sin(t * s.v + i) * 0.3, s.p.y + Math.cos(t * s.v + i) * 0.4 - sy * s.s, s.p.z);
      dummy.rotation.set(s.r.x + t * s.v, s.r.y + t * s.v * 0.7, s.r.z);
      dummy.scale.setScalar(s.s);
      dummy.updateMatrix();
      beans.setMatrixAt(i, dummy.matrix);
    });
    beans.instanceMatrix.needsUpdate = true;

    steam.forEach((s) => {
      const k = reduceMotion ? s.userData.t : (s.userData.t + t * 0.12) % 1;
      s.position.set(Math.sin(k * 9 + s.userData.t * 20) * 0.25, 1.5 + k * 2.2, Math.cos(k * 7 + s.userData.t * 20) * 0.25);
      s.scale.setScalar(0.35 + k * 0.7);
      s.material.opacity = Math.sin(k * Math.PI) * 0.45;
    });

    renderer.render(scene, camera);
  }
  frame();
}
