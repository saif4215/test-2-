import * as THREE from "./vendor/three.module.min.js";
import { initCheckout } from "./checkout.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- menu data (menu.json is shared with the checkout server) ---------- */
const money = (c) => `$${(c / 100).toFixed(2)}`;
const MENU = (await fetch("menu.json").then((r) => r.json())).groups;
const ORDER_URL = "https://www.marufcafe.com/s/order";
const orderable = new Map();   // items with one fixed price can go in the cart; size-based prices are ordered on Square Online
for (const cats of Object.values(MENU)) for (const items of Object.values(cats)) for (const it of items) if (it.cents != null) orderable.set(it.id, it);
const checkout = await initCheckout(orderable);

const count = (g) => Object.values(MENU[g]).reduce((n, items) => n + items.length, 0);
const STATS = { drinks: count("Drinks"), food: count("Food") };
STATS.items = STATS.drinks + STATS.food;

const tabsEl = document.querySelector(".tabs");
const chipsEl = document.querySelector(".chips");
const itemsEl = document.getElementById("items");
let group = "Drinks", cat = "Coffee";

function el(tag, props = {}, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}

function renderMenu() {
  tabsEl.replaceChildren(...Object.keys(MENU).map((g) => {
    const b = el("button", { type: "button", role: "tab", textContent: g });
    b.setAttribute("aria-selected", g === group);
    b.onclick = () => { group = g; cat = Object.keys(MENU[g])[0]; renderMenu(); };
    return b;
  }));
  chipsEl.replaceChildren(...Object.keys(MENU[group]).map((c) => {
    const b = el("button", { type: "button", role: "tab", textContent: c });
    b.setAttribute("aria-selected", c === cat);
    b.onclick = () => { cat = c; renderMenu(); };
    return b;
  }));
  itemsEl.replaceChildren(...MENU[group][cat].map((it, i) => {
    const fixed = it.cents != null;
    const action = fixed
      ? el("button", { type: "button", className: "add", textContent: "Add", ariaLabel: `Add ${it.name} to your order` })
      : el("a", { className: "add alt", href: ORDER_URL, textContent: "Choose size", ariaLabel: `Choose a size for ${it.name} on Square Online` });
    if (fixed) action.onclick = () => checkout.add(it.id);
    const card = el("article", { className: "card" },
      el("div", { className: "card-in" }, el("h3", { textContent: it.name }),
        el("div", { className: "foot" }, el("b", { className: "price", textContent: fixed ? money(it.cents) : `${money(it.min)} - ${money(it.max)}` }), action)));
    card.style.setProperty("--i", i);
    bindTilt(card);
    return card;
  }));
}

function bindTilt(card) {
  if (reduceMotion || !matchMedia("(hover: hover)").matches) return;
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.transform = `rotateY(${(x - 0.5) * 18}deg) rotateX(${(0.5 - y) * 18}deg) translateZ(10px)`;
    card.style.setProperty("--mx", `${x * 100}%`);
    card.style.setProperty("--my", `${y * 100}%`);
  });
  card.addEventListener("pointerleave", () => (card.style.transform = ""));
}

/* buttons like "See the burgers" jump to a menu category */
document.querySelectorAll("[data-goto]").forEach((a) => a.addEventListener("click", () => {
  const target = a.dataset.goto;
  for (const g of Object.keys(MENU)) if (target in MENU[g]) { group = g; cat = target; }
  renderMenu();
}));
renderMenu();

/* ---------- scroll reveal + stat counters ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("in");
    e.target.querySelectorAll?.("[data-stat]").forEach(countUp);
    io.unobserve(e.target);
  }
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

function countUp(node) {
  const target = STATS[node.dataset.stat];
  if (reduceMotion) { node.textContent = target; return; }
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min((t - t0) / 1200, 1);
    node.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- open now (cafe is in New York) ---------- */
{
  const HOURS = { 0: [7, 16] };                       // Sunday; every other day is 7 AM to 10 PM
  const hoursFor = (d) => HOURS[d] || [7, 22];
  const fmt = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const [open, close] = hoursFor(day);
  const isOpen = minutes >= open * 60 && minutes < close * 60;
  document.querySelectorAll("#hours li").forEach((li) => { if (li.dataset.days.split(",").map(Number).includes(day)) li.dataset.today = ""; });
  const badge = document.getElementById("open-now");
  badge.dataset.open = isOpen ? "1" : "0";
  badge.textContent = isOpen ? `Open now · until ${fmt(close)}` : minutes < open * 60 ? `Closed · opens ${fmt(open)}` : `Closed · opens ${fmt(hoursFor((day + 1) % 7)[0])} tomorrow`;
  badge.hidden = false;
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

/* ---------- 3D burger that comes apart on scroll ---------- */
const burgerCanvas = document.getElementById("burger-scene");
try { initBurger(); } catch (err) { console.warn("WebGL unavailable for burger.", err); document.getElementById("burger").remove(); }

function initBurger() {
  const track = document.getElementById("burger");
  const stick = document.getElementById("burger-stick");
  const labelsEl = document.getElementById("burger-labels");

  const renderer = new THREE.WebGLRenderer({ canvas: burgerCanvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const FOV = 32;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

  /* studio reflections: a dark room with a few bright softboxes, baked into an environment map */
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x0b0907);
    const box = (w, h, color, k, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      mesh.position.set(x, y, z); mesh.lookAt(0, 0, 0); env.add(mesh);
    };
    box(9, 9, 0xfff1dc, 9, 0, 9, 2);       // overhead softbox
    box(2.5, 11, 0xdfe8ff, 5, -9, 2, 3);   // cool strip, left
    box(2.5, 11, 0xffb55a, 7, 9, 1, -2);   // warm strip, right
    box(10, 3, 0xffe1b0, 3, 0, 2, -9);     // back rim
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.5;
  }

  scene.add(new THREE.HemisphereLight(0xffe8c4, 0x1a120a, 0.35));
  const key = new THREE.DirectionalLight(0xffdcae, 2.0);
  key.position.set(3, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -6, near: 1, far: 30 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.PointLight(0xd4a24c, 50, 30);
  rim.position.set(-4, 4, -4);
  scene.add(rim);

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
    g.add(new THREE.Mesh(side, phys(0xffffff, 0.45, { vertexColors: true, clearcoat: 0.5, clearcoatRoughness: 0.4 })));
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
    g.add(new THREE.Mesh(geo, phys(0xffffff, 0.7, { vertexColors: true, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x8a3a24) })));
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
      const mesh = new THREE.Mesh(lg, phys(0xffffff, 0.35, { vertexColors: true, side: THREE.DoubleSide, clearcoat: 0.35, clearcoatRoughness: 0.4 }));
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
    g.add(new THREE.Mesh(crown, phys(0xffffff, 0.35, { vertexColors: true, clearcoat: 0.9, clearcoatRoughness: 0.28 })));
    const under = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), phys(0xd9a458, 0.85));
    under.rotation.x = Math.PI / 2;
    g.add(under);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const N = layers.length, GAP = 0.92, MID = 1.3;
  layers.forEach((l, i) => { l.apart = MID + (i - (N - 1) / 2) * GAP; });

  const tilt = new THREE.Group();
  tilt.add(root);
  const spinner = new THREE.Group();
  spinner.add(tilt);
  scene.add(spinner);

  const labels = layers.map((l, i) => {
    const d = document.createElement("div");
    d.className = "lbl";
    d.innerHTML = `<i></i><b>${String(i + 1).padStart(2, "0")}</b><span></span>`;
    d.querySelector("span").textContent = l.name;
    labelsEl.append(d);
    return d;
  });

  /* drag to spin; otherwise idle rotation */
  let dragging = false, lastX = 0, vel = 0.004;
  burgerCanvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; burgerCanvas.setPointerCapture(e.pointerId); });
  burgerCanvas.addEventListener("pointermove", (e) => { if (!dragging) return; vel = (e.clientX - lastX) * 0.01; spinner.rotation.y += vel; lastX = e.clientX; });
  const release = () => { dragging = false; };
  burgerCanvas.addEventListener("pointerup", release);
  burgerCanvas.addEventListener("pointercancel", release);

  let W = 1, H = 1, dist = 14, wide = true, visH = 8;
  function resize() {
    W = burgerCanvas.clientWidth; H = burgerCanvas.clientHeight;
    renderer.setSize(W, H, false);
    const aspect = W / H;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    wide = aspect > 1.1;
    const tan = Math.tan((FOV * Math.PI) / 360);
    dist = Math.max(10.6 / (2 * tan), 7.2 / (2 * tan * aspect));   // fit the exploded stack and (on phones) the labels
    visH = 2 * dist * tan;
    camera.position.set(0, 0.5, dist);
    camera.lookAt(0, 0, 0);
    tilt.position.x = wide ? -visH * aspect * 0.2 : -visH * aspect * 0.2;
  }
  addEventListener("resize", resize);
  resize();

  let visible = false;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting), { rootMargin: "100px" }).observe(track);
  const clock = new THREE.Clock();
  const v = new THREE.Vector3();

  (function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    const r = track.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight), 0, 1);
    const e = smooth(0.06, 0.62, p);
    stick.style.setProperty("--e", e.toFixed(3));

    layers.forEach((l, i) => {
      const k = smooth(0, 1, clamp(e * 1.25 - i * 0.03, 0, 1));
      l.group.position.y = l.base + (l.apart - l.base) * k;
    });
    root.position.y = -1.25 - 0.45 * e;      // keep the (taller) exploded stack centred
    tilt.rotation.x = 0.05 + e * 0.4;

    if (!dragging && !reduceMotion) {
      vel += (0.004 - vel) * 0.04;
      spinner.rotation.y += vel;
    }
    spinner.position.y = reduceMotion ? 0 : Math.sin(t * 1.2) * 0.06 * (1 - e);

    renderer.render(scene, camera);

    const off = (wide ? 1.95 : 1.5) * (H / visH);
    layers.forEach((l, i) => {
      l.anchor.getWorldPosition(v).project(camera);
      const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
      labels[i].style.transform = `translate(${sx + off}px, ${sy}px) translateY(-50%)`;
      labels[i].style.opacity = smooth(0.35 + i * 0.05, 0.6 + i * 0.05, e).toFixed(3);
    });
  })();
}
