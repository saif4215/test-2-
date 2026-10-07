import * as THREE from "./vendor/three.module.min.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- menu data (from marufcafe.com) ---------- */
const MENU = {
  Drinks: {
    Coffee: [["Americano","$3.00"],["Cappuccino","$4.00"],["Cortado","$3.75"],["Flat White","$4.00"],["Mocha","$5.25"],["Oat Brown Sugar","$6.50"],["Spanish Latte","$5.50"],["Dirty Chai","$6.00"],["Latte","$4.50"],["Drip","$3.00"],["Espresso","$3.00"],["Biscoff Latte","$6.50"],["Maple Honey Almond Latte","$6.50"],["White Mocha","$5.25"],["Hazelnut Mocha","$5.50"],["Honey Vanilla","$5.00"],["Pistachio Latte","$6.00"],["Pumpkin Spice","$6.50"],["Banana Bread Latte","$6.00"]],
    Refreshers: [["Berry Blast","$3.00 - $4.50"],["Kiwi Lemongrass","$5.50"],["Lemonade","$3.00 - $4.00"],["Mango Dragonfruit","$5.50"],["Mango Passion Fruit","$5.50"],["Strawberry Acai","$5.50"],["Tropical Splash","$3.00 - $4.50"],["Watermelon Cucumber","$5.50"],["White Peach","$3.00 - $4.50"],["Lychee Blackberry","$5.50 - $6.00"]],
    Tea: [["Earl Grey","$3.00"],["Chai Latte","$5.00 - $6.00"],["London Fog","$4.50 - $5.50"],["Matcha","$5.00 - $6.00"],["Yuzu Peach Green Tea","$3.00"],["Peppermint Tea","$3.50"],["Blueberry Hibiscus","$3.50"],["Chamomile Medley","$3.50"]],
    "Smoothies / Others": [["Strawberry Banana Smoothie","$6.50"],["Hot Chocolate","$3.00"]],
  },
  Food: {
    Breakfast: [["Bagel & Cream Cheese","$3.00"],["Egg & Cheese","$3.50"],["Zaatar Avocado Toast","$8.00"],["Breakfast Wrap","$10.00"],["Breakfast Sandwich","$8.00"]],
    Sandwiches: [["Cheesesteak","$14.00"],["Turkey Sandwich","$12.00"],["Chicken Parmesan","$12.00"],["Fried Chicken Sandwich","$8.00"],["Grilled Cheese","$6.00"],["Hot Chicken Sandwich","$10.00"],["Pesto Grilled Chicken","$12.00"],["Buffalo Chicken","$12.00"],["Chipotle Chicken","$12.00"],["Sandwich Meal Combo","$18.00"]],
    Burgers: [["Classic Burger","$10.00"],["ICSI Burger","$14.00"]],
    Bowls: [["Garden Salad","$8.00"],["Chicken Caesar Salad","$10.00"]],
    "Chicken & Wings": [["Chicken Tenders","$6.00 - $15.00"],["Wings","$10.00"],["Chicken Nuggets","$6.00"]],
    "Salads / Others": [["Personal Pizza","$7.00"]],
    Sides: [["Chips","$2.50"],["French Fries","$4.00 - $6.00"],["Mac & Cheese","$6.00"],["Mozzarella Sticks","$8.00"],["Coleslaw","$3.00"],["Hash Brown","$2.00"]],
    Sweets: [["Brownie","$3.00"],["Muffin","$3.00"],["Cookie","$3.00"],["Banana Pudding","$5.00"],["Dubai Chocolate","$6.00 - $16.00"],["Dubai Chocolate Cake","$5.00"]],
  },
};

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
  itemsEl.replaceChildren(...MENU[group][cat].map(([name, price], i) => {
    const card = el("article", { className: "card" },
      el("div", { className: "card-in" }, el("h3", { textContent: name }), el("b", { className: "price", textContent: price })));
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

/* ---------- 3D burger ---------- */
const burgerCanvas = document.getElementById("burger-scene");
try { initBurger(); } catch (err) { console.warn("WebGL unavailable for burger.", err); burgerCanvas.remove(); }

function initBurger() {
  const renderer = new THREE.WebGLRenderer({ canvas: burgerCanvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.6, 9.5);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffe2b0, 0x120d08, 0.8));
  const key = new THREE.DirectionalLight(0xffe0b0, 3.2);
  key.position.set(3, 6, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0xd4a24c, 45, 20);
  rim.position.set(-4, 3, -3);
  scene.add(rim);

  const mat = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const burger = new THREE.Group();
  const V = (x, y) => new THREE.Vector2(x, y);

  // bottom bun: an upside-down dome, flat face up
  const bunMat = mat(0xd9953f, 0.55);
  const heel = new THREE.Mesh(new THREE.SphereGeometry(1.3, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), bunMat);
  heel.scale.y = 0.45; heel.rotation.x = Math.PI; heel.position.y = 0.585;
  burger.add(heel);

  // patty: lathe with a rounded edge
  const patty = new THREE.Mesh(new THREE.LatheGeometry(
    [V(0, 0.58), V(1.3, 0.58), V(1.42, 0.65), V(1.45, 0.74), V(1.42, 0.83), V(1.3, 0.9), V(0, 0.9)], 64),
    mat(0x4a2a18, 0.9));
  burger.add(patty);

  // cheese: a square slice whose corners droop over the patty
  const cheeseGeo = new THREE.PlaneGeometry(2.7, 2.7, 24, 24);
  cheeseGeo.rotateX(-Math.PI / 2);
  const cp = cheeseGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const d = Math.max(0, Math.hypot(cp.getX(i), cp.getZ(i)) - 1.15);
    cp.setY(i, cp.getY(i) - d * d * 0.55);
  }
  cheeseGeo.computeVertexNormals();
  const cheese = new THREE.Mesh(cheeseGeo, mat(0xf5b82e, 0.35, { side: THREE.DoubleSide }));
  cheese.rotation.y = Math.PI / 4; cheese.position.y = 0.95;
  burger.add(cheese);

  // tomato
  const tomatoMat = mat(0xd23a2a, 0.35);
  [[0.22, 0], [-0.25, 0.1]].forEach(([x, z], i) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 40), tomatoMat);
    t.position.set(x, 1.04 + i * 0.1, z);
    burger.add(t);
  });

  // lettuce: a ruffled disc
  const lg = new THREE.RingGeometry(0.01, 1.62, 96, 8);
  const lp = lg.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i), y = lp.getY(i), r = Math.hypot(x, y), a = Math.atan2(y, x);
    lp.setZ(i, Math.sin(a * 9) * 0.09 * (r / 1.62) ** 2 + Math.sin(a * 5 + r * 3) * 0.04 * (r / 1.62));
  }
  lg.computeVertexNormals();
  const lettuce = new THREE.Mesh(lg, mat(0x5fa83a, 0.5, { side: THREE.DoubleSide }));
  lettuce.rotation.x = -Math.PI / 2; lettuce.position.y = 1.24;
  burger.add(lettuce);

  // top bun with sesame seeds
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.4, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), bunMat);
  crown.scale.y = 0.85; crown.position.y = 1.3;
  burger.add(crown);

  const SEEDS = 46;
  const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 10, 8).scale(1, 0.55, 1.9), mat(0xf6e7c1, 0.5), SEEDS);
  const up = new THREE.Vector3(0, 1, 0), o = new THREE.Object3D();
  for (let i = 0; i < SEEDS; i++) {
    const phi = Math.acos(1 - Math.random() * 0.8);       // keep seeds on the upper dome
    const th = Math.random() * Math.PI * 2;
    const n = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
    o.position.set(n.x * 1.4, 1.3 + n.y * 1.4 * 0.85 + 0.01, n.z * 1.4);
    o.quaternion.setFromUnitVectors(up, n).multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.random() * Math.PI));
    o.updateMatrix();
    seeds.setMatrixAt(i, o.matrix);
  }
  burger.add(seeds);

  burger.position.y = -1.15;
  burger.rotation.x = 0.08;
  const spinner = new THREE.Group();
  spinner.add(burger);
  scene.add(spinner);

  // drag to spin; otherwise idle rotation
  let dragging = false, lastX = 0, vel = 0.006;
  burgerCanvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; burgerCanvas.setPointerCapture(e.pointerId); });
  burgerCanvas.addEventListener("pointermove", (e) => { if (!dragging) return; vel = (e.clientX - lastX) * 0.01; spinner.rotation.y += vel; lastX = e.clientX; });
  const release = () => { dragging = false; };
  burgerCanvas.addEventListener("pointerup", release);
  burgerCanvas.addEventListener("pointercancel", release);

  function resize() {
    const w = burgerCanvas.clientWidth, h = burgerCanvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(burgerCanvas);
  const clock = new THREE.Clock();
  (function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    if (!dragging && !reduceMotion) {
      vel += (0.006 - vel) * 0.04;               // ease back to idle speed after a flick
      spinner.rotation.y += vel;
    }
    spinner.position.y = reduceMotion ? 0 : Math.sin(t * 1.2) * 0.12;
    renderer.render(scene, camera);
  })();
}
