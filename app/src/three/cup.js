import * as THREE from "three";
import logoCup from "./logoCup";
import { fbm, grey, pixelTexture, studioEnvironment } from "./kit";

/** The Maruf paper cup: black cup, white base, glossy lid with a sip lip, logo printed on the wall, steam. */
export function createCup(canvas, { reduceMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.9;
  scene.add(new THREE.HemisphereLight(0xffe2b0, 0x120d08, 0.5));
  const key = new THREE.DirectionalLight(0xffd9a0, 2.6);
  key.position.set(4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.PointLight(0xd4a24c, 90, 24); rim.position.set(-4, 2, -3); scene.add(rim);
  const phys = (color, rough, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, ...extra });
  const cup = new THREE.Group();
  let steamAt = { x: 0, y: 1.5, z: 0, rise: 2.2, size: 1 };

  /* logo decal: a patch of the cone-shaped cup wall, textured with the logo. wall = [[y, radius], ...] */
  function addLogoDecal({ wall, y0, y1, arc, src }) {
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 788;
    const g = cv.getContext("2d");
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const img = new Image();
    img.onload = () => {
      const w = 960, h = (w * img.naturalHeight) / img.naturalWidth;
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
      tex.needsUpdate = true;
    };
    img.src = src;
    // outer wall radius at height y: the profile is straight segments
    const radiusAt = (y) => { for (let i = 0; i < wall.length - 1; i++) { const [ya, ra] = wall[i], [yb, rb] = wall[i + 1]; if (y <= yb) return ra + ((y - ya) / (yb - ya)) * (rb - ra); } return wall[wall.length - 1][1]; };
    const NU = 40, NV = 16, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const y = y0 + ((y1 - y0) * j) / NV, ang = (i / NU - 0.5) * arc, r = radiusAt(y) + 0.006;
      pos.push(Math.sin(ang) * r, y, Math.cos(ang) * r); uv.push(i / NU, j / NV);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const p = j * (NU + 1) + i, q = p + NU + 1; idx.push(p, p + 1, q, p + 1, q + 1, q); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    cup.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
  }
  const smoothLathe = (pts, seg = 96) => new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(pts.length * 8), seg);

    /* black paper cup, white base band, glossy black lid with a sip tab */
    const H = 3.1, R0 = 0.68, R1 = 1.0, YB = 0.38;
    const rAt = (y) => R0 + (R1 - R0) * (y / H);
    const grain = fbm(256, { seed: 41, scale: 60, octaves: 2 });
    const grainBump = pixelTexture(256, (i) => grey(grain[i] * 255), false);
    grainBump.wrapS = grainBump.wrapT = THREE.RepeatWrapping; grainBump.repeat.set(4, 4);
    const paperBlack = phys(0x15171a, 0.48, { clearcoat: 0.4, clearcoatRoughness: 0.4, bumpMap: grainBump, bumpScale: 0.22, sheen: 0.5, sheenRoughness: 0.4, sheenColor: new THREE.Color(0x4a5058) });
    const paperWhite = phys(0xeeeadf, 0.85, { bumpMap: grainBump, bumpScale: 0.3 });
    const plastic = phys(0x0e0f10, 0.36, { clearcoat: 0.35, clearcoatRoughness: 0.4 });

    cup.add(new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(rAt(YB), YB), new THREE.Vector2(rAt(H), H)], 96), paperBlack));
    cup.add(new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(R0 - 0.05, 0), new THREE.Vector2(R0 - 0.02, 0.03), new THREE.Vector2(rAt(YB) - 0.012, YB),
    ], 96), paperWhite));
    // lid: skirt over the rim, a rolled bead, and a flat recessed panel (like the real lid)
    const L = H - 0.12, panelY = L + 0.31;
    cup.add(new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve([
      [1.04, L - 0.03], [1.09, L - 0.015], [1.1, L + 0.03], [1.16, L + 0.05], [1.17, L + 0.1], [1.215, L + 0.125], [1.225, L + 0.175],   // stepped rings under the bead
      [1.2, L + 0.215], [1.14, L + 0.23], [1.08, L + 0.215], [1.04, L + 0.235], [0.995, L + 0.27], [0.955, L + 0.3], [0.9, L + 0.308], [0.6, L + 0.31], [0, L + 0.314],
    ].map(([x, y]) => new THREE.Vector2(x, y))).getPoints(200), 128), plastic));
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.011, 8, 96), plastic);   // edge of the recessed panel
    seam.rotation.x = Math.PI / 2; seam.position.y = panelY - 0.004; cup.add(seam);
    // the drinking lip: a low hood that slopes down toward the rim, with the slot just beyond it
    const ta = 2.5, tx = Math.sin(ta), tz = Math.cos(ta), lidTop = L + 0.31;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.3, 0.14, 0.32), plastic);
    hood.rotation.z = -0.22; hood.position.y = -0.02;
    const hoodG = new THREE.Group(); hoodG.add(hood);
    hoodG.position.set(tx * 0.4, lidTop, tz * 0.4); hoodG.rotation.y = ta - Math.PI / 2; cup.add(hoodG);
    const slot = new THREE.Mesh(new THREE.CircleGeometry(1, 28).scale(0.055, 0.15, 1), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    slot.rotation.x = -Math.PI / 2;
    const slotG = new THREE.Group(); slotG.add(slot);
    slotG.position.set(tx * 0.84, lidTop + 0.004, tz * 0.84); slotG.rotation.y = ta - Math.PI / 2; cup.add(slotG);
    // embossed lettering around the panel, as on the real lid
    const emb = document.createElement("canvas"); emb.width = emb.height = 512;
    const eg = emb.getContext("2d");
    eg.fillStyle = "#000"; eg.fillRect(0, 0, 512, 512);
    eg.translate(256, 256); eg.fillStyle = "#fff"; eg.textAlign = "center"; eg.textBaseline = "middle";
    eg.font = "600 26px Inter, Arial, sans-serif";
    const ring = "MARUF CAFE  \u2022  CAUTION CONTENTS HOT  \u2022  ";
    for (let i = 0; i < ring.length; i++) { eg.save(); eg.rotate(((i + 0.5) / ring.length) * Math.PI * 2); eg.translate(0, -190); eg.fillText(ring[i], 0, 0); eg.restore(); }
    eg.font = "700 58px Inter, Arial, sans-serif"; eg.fillText("MARUF", 0, 80);
    const embTex = new THREE.CanvasTexture(emb); embTex.anisotropy = 8;
    const panel = new THREE.Mesh(new THREE.CircleGeometry(0.93, 96), phys(0x0e0f10, 0.36, { clearcoat: 0.35, clearcoatRoughness: 0.4, bumpMap: embTex, bumpScale: 2.2, polygonOffset: true, polygonOffsetFactor: -1 }));
    panel.rotation.x = -Math.PI / 2; panel.position.y = lidTop + 0.002; panel.rotation.z = Math.PI; cup.add(panel);
    const vent = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    vent.rotation.x = -Math.PI / 2; vent.position.set(-tx * 0.45, lidTop + 0.004, -tz * 0.45); cup.add(vent);
    // the logo as printed on the cup
    addLogoDecal({ wall: [[0, R0], [H, R1]], y0: 1.2, y1: 2.68, arc: 2.1, src: logoCup });
    steamAt = { x: tx * 0.84, y: lidTop + 0.1, z: tz * 0.84, rise: 2.5, size: 1.5 };
    cup.scale.setScalar(0.86);
  cup.position.y = -1.55;
  /* a dark glossy tabletop that fades into the page, so the cup has something to stand on */
  const fade = pixelTexture(256, (i, u, v) => { const d = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2); const k = Math.pow(1 - d, 1.6) * 255; return [k, k, k]; }, false);
  const table = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x1d1610, roughness: 0.3, alphaMap: fade, transparent: true }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.055;
  cup.add(table);
  cup.traverse((o) => { if (o.isMesh) { o.castShadow = o !== table; o.receiveShadow = true; } });
  const rig = new THREE.Group();
  rig.add(cup);
  cup.traverse((o) => { if (o.isMesh) { o.castShadow = o !== table; o.receiveShadow = true; } });
  const spinner = new THREE.Group(); spinner.add(cup); scene.add(spinner);
  spinner.rotation.x = 0.18;

  /* steam sprites */
  const wisp = fbm(128, { seed: 7, scale: 3, octaves: 4 });
  const steamTex = pixelTexture(128, (i, u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2, fall = Math.max(0, 1 - d);
    const a = Math.min(1, Math.max(0, (wisp[i] - 0.38) * 2.4)) * fall * fall * 150;
    return [255, 244, 228, a];
  }, false);
  const steam = Array.from({ length: 18 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, rotation: i * 1.7 }));
    s.userData.t = i / 18;
    cup.add(s);
    return s;
  });



  let dragging = false, lastX = 0, vel = 0.006;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!dragging) return; vel = (e.clientX - lastX) * 0.012; spinner.rotation.y += vel; lastX = e.clientX; });
  const release = () => { dragging = false; };
  canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);

  function resize() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 0.9, Math.max(11, 11 * (0.85 / camera.aspect)));
    camera.lookAt(0, 0.9, 0);
    camera.updateProjectionMatrix();
  }
  resize();

  const clock = new THREE.Clock();
  spinner.rotation.y = 0.5;
  return {
    resize,
    frame() {
      const t = reduceMotion ? 0 : clock.getElapsedTime();
      if (!dragging && !reduceMotion) { vel += (0.006 - vel) * 0.04; spinner.rotation.y += vel; }
      steam.forEach((s) => {
        const k = reduceMotion ? s.userData.t : (s.userData.t + t * 0.12) % 1;
        s.position.set(steamAt.x + Math.sin(k * 9 + s.userData.t * 20) * 0.25 * steamAt.size, steamAt.y + k * steamAt.rise, steamAt.z + Math.cos(k * 7 + s.userData.t * 20) * 0.25 * steamAt.size);
        s.scale.setScalar((0.35 + k * 0.7) * steamAt.size);
        s.material.opacity = Math.sin(k * Math.PI) * 0.45;
      });
      renderer.render(scene, camera);
    },
    dispose() { renderer.dispose(); scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose(); }); }); },
  };
}
