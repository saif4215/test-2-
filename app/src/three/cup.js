import * as THREE from "three";
import logoCup from "./logoCup";
import { fbm, grey, pixelTexture, studioEnvironment } from "./kit";

/** The Maruf paper cup: open black cup, white base, coffee inside with MARUF poured on top, logo on the wall, steam. */
export function createCup(canvas, { reduceMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 1.15;
  scene.add(new THREE.HemisphereLight(0xffe2b0, 0x1a130c, 0.6));
  const key = new THREE.DirectionalLight(0xffd9a0, 2.6);
  key.position.set(4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd6e4ff, 0.9); fill.position.set(-6, 3, 4); scene.add(fill);
  const rim = new THREE.PointLight(0xd4a24c, 45, 24); rim.position.set(-3, 3, -4); scene.add(rim);
  const phys = (color, rough, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, ...extra });
  const cup = new THREE.Group();

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

  /* black paper cup with a white base band */
  const H = 3.1, R0 = 0.68, R1 = 1.0, YB = 0.38;
  const rAt = (y) => R0 + (R1 - R0) * (y / H);
  const grain = fbm(256, { seed: 41, scale: 60, octaves: 2 });
  const grainBump = pixelTexture(256, (i) => grey(grain[i] * 255), false);
  grainBump.wrapS = grainBump.wrapT = THREE.RepeatWrapping; grainBump.repeat.set(4, 4);
  const paperBlack = phys(0x1c1f23, 0.46, { clearcoat: 0.45, clearcoatRoughness: 0.35, bumpMap: grainBump, bumpScale: 0.12, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color(0x59616b) });
  const paperWhite = phys(0xeeeadf, 0.85, { bumpMap: grainBump, bumpScale: 0.15 });

  cup.add(new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(rAt(YB), YB), new THREE.Vector2(rAt(H), H)], 96), paperBlack));
  cup.add(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(R0 - 0.05, 0), new THREE.Vector2(R0 - 0.02, 0.03), new THREE.Vector2(rAt(YB) - 0.012, YB),
  ], 96), paperWhite));

  /* no lid: an open cup. A rolled paper rim, a pale inside wall that darkens toward the coffee, and coffee near the top */
  const CY = H - 0.22;
  const inner = new THREE.LatheGeometry([CY - 0.2, CY, CY + 0.06, CY + 0.2, H].map((y) => new THREE.Vector2(rAt(y) - 0.035, y)), 96);
  {
    const light = new THREE.Color(0xf1eadb), dark = new THREE.Color(0x7d7465), stain = new THREE.Color(0x8f6a45), c = new THREE.Color();
    const p = inner.attributes.position, colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), t = THREE.MathUtils.clamp((y - CY) / (H - CY), 0, 1);
      c.copy(dark).lerp(light, Math.pow(t, 0.55)).lerp(stain, THREE.MathUtils.clamp(1 - (y - CY) / 0.12, 0, 1) * 0.75);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    inner.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }
  cup.add(new THREE.Mesh(inner, phys(0xffffff, 0.85, { side: THREE.BackSide, vertexColors: true, bumpMap: grainBump, bumpScale: 0.05 })));
  const paperRim = new THREE.Mesh(new THREE.TorusGeometry(rAt(H) - 0.012, 0.04, 12, 96), paperBlack);
  paperRim.rotation.x = Math.PI / 2; paperRim.position.y = H; cup.add(paperRim);

  /* the coffee seen from above: dark roast with a lighter crema edge, and MARUF poured in cream foam */
  const cv = document.createElement("canvas"); cv.width = cv.height = 512;
  const cg = cv.getContext("2d"), grad = cg.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, "#3a1d0d"); grad.addColorStop(0.72, "#5a3115"); grad.addColorStop(0.94, "#8a5a30"); grad.addColorStop(1, "#b98a55");
  cg.fillStyle = grad; cg.fillRect(0, 0, 512, 512);
  cg.textAlign = "center"; cg.textBaseline = "middle";
  cg.font = "800 98px Arial, Helvetica, sans-serif";
  if ("letterSpacing" in cg) cg.letterSpacing = "6px";
  cg.shadowColor = "rgba(30,14,4,0.55)"; cg.shadowBlur = 8; cg.shadowOffsetY = 3;
  cg.filter = "blur(1.2px)"; cg.fillStyle = "#f3e5ca"; cg.fillText("MARUF", 256, 206);
  cg.shadowColor = "transparent"; cg.filter = "none"; cg.strokeStyle = "rgba(243,229,202,0.6)"; cg.lineWidth = 7; cg.lineCap = "round";
  cg.beginPath(); cg.moveTo(172, 280); cg.quadraticCurveTo(256, 304, 340, 280); cg.stroke();   // a small foam swoosh under the name
  const coffeeTex = new THREE.CanvasTexture(cv); coffeeTex.colorSpace = THREE.SRGBColorSpace; coffeeTex.anisotropy = 8;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(rAt(CY) - 0.034, 64), phys(0xffffff, 0.3, { map: coffeeTex, clearcoat: 0.5, clearcoatRoughness: 0.18, envMapIntensity: 0.3 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = CY; cup.add(coffee);
  const steamAt = { x: 0, y: CY + 0.05, z: 0, rise: 1.25, size: 1.3 };

  // the logo as printed on the cup
  addLogoDecal({ wall: [[0, R0], [H, R1]], y0: 1.25, y1: 2.3, arc: 1.62, src: logoCup });

  /* the cup is centred on the origin so tilting it keeps it in the middle of the frame */
  const SCALE = 0.86;
  cup.scale.setScalar(SCALE);
  cup.position.y = -(H * SCALE) / 2;
  /* a dark tabletop that fades into the page, so the cup has something to stand on */
  const fade = pixelTexture(256, (i, u, v) => { const d = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2); const k = Math.pow(1 - d, 1.6) * 255; return [k, k, k]; }, false);
  const table = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x17110c, roughness: 0.6, alphaMap: fade, transparent: true }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.055;
  cup.add(table);
  // a soft dark patch under the base, so the cup sits on the table instead of floating
  const contact = pixelTexture(128, (i, u, v) => { const d = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2); const k = Math.pow(1 - d, 2) * 215; return [k, k, k]; }, false);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: contact, transparent: true, depthWrite: false }));
  patch.rotation.x = -Math.PI / 2; patch.position.y = -0.03; cup.add(patch);
  cup.traverse((o) => { if (o.isMesh) { o.castShadow = o !== table && o !== patch; o.receiveShadow = o !== patch; } });
  const spinner = new THREE.Group(); spinner.add(cup); scene.add(spinner);
  spinner.rotation.x = 0.46;

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

  /* The cup sways gently so the logo and MARUF stay readable. Drag to turn it all the way round; it settles back when let go. */
  let dragging = false, lastX = 0, offset = 0;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!dragging) return; offset += (e.clientX - lastX) * 0.012; lastX = e.clientX; });
  const release = () => { if (dragging) offset = Math.atan2(Math.sin(offset), Math.cos(offset)); dragging = false; };
  canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);

  function resize() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // fit the cup and its steam: tall enough for the height, wide enough for the cup on a narrow screen
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(4.1 / (2 * half), 2.7 / (2 * half * camera.aspect));
    camera.position.set(0, 0.5 + dist * 0.04, dist);
    camera.lookAt(0, 0.4, 0);
    camera.updateProjectionMatrix();
  }
  resize();

  const clock = new THREE.Clock();
  return {
    resize,
    frame() {
      const t = reduceMotion ? 0 : clock.getElapsedTime();
      if (!dragging) offset *= 0.965;
      spinner.rotation.y = (reduceMotion ? 0.12 : Math.sin(t * 0.55) * 0.32) + offset;
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
