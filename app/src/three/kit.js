// Procedural textures and studio lighting shared by the 3D models. Loaded only on the web build.
import * as THREE from "three";

export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function makeNoise(seed) {
  const r = rng(seed), P = new Float32Array(65536);
  for (let i = 0; i < P.length; i++) P[i] = r();
  const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}
/** fractal noise, values 0..1, size x size */
export function fbm(size, { seed = 1, scale = 8, octaves = 5, gain = 0.5 } = {}) {
  const n = makeNoise(seed), out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, a = 1, f = scale, s = 0;
    for (let o = 0; o < octaves; o++) { v += a * n((x / size) * f, (y / size) * f); s += a; a *= gain; f *= 2; }
    out[y * size + x] = v / s;
  }
  return out;
}
/** texture from a per-pixel function (i, u, v) -> [r, g, b, a] */
export function pixelTexture(size, pixel, srgb = true) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const g = cv.getContext("2d"), img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const [r, gr, b, a = 255] = pixel(i, (i % size) / size, Math.floor(i / size) / size);
    img.data[i * 4] = r; img.data[i * 4 + 1] = gr; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export const grey = (v) => [v, v, v];


/** Frees every GPU resource a scene used (geometries, materials, all their textures), then the renderer and its WebGL context. */
export function disposeScene(scene, renderer) {
  const seen = new Set();
  scene.traverse((o) => {
    o.geometry?.dispose?.();
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      for (const v of Object.values(m)) if (v?.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); }
      m.dispose();
    }
  });
  scene.environment?.dispose?.();
  renderer.dispose();
  renderer.forceContextLoss();
}

export function studioEnvironment(renderer) {
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
  return new THREE.PMREMGenerator(renderer).fromScene(env, 0.02).texture;
}
