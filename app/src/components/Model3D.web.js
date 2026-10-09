import { useEffect, useRef } from "react";
import { View } from "react-native";
import { colors, radius } from "../theme";

export const supported = typeof document !== "undefined";

/**
 * Draws a 3D model with three.js, only on the web app. It loads three.js the first time the model scrolls into view,
 * draws only while it is on screen, and drag-to-spin leaves vertical scrolling alone. `kind` is "burger" or "cup".
 */
export default function Model3D({ kind, exploded = false, height = 320, label, onFail }) {
  const host = useRef(null), api = useRef(null), explodedRef = useRef(exploded);
  useEffect(() => { explodedRef.current = exploded; api.current?.setExploded?.(exploded); }, [exploded]);
  useEffect(() => {
    const node = host.current;
    if (!node) return undefined;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", label || "3D model. Drag to spin it.");
    canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab;outline:none";
    node.appendChild(canvas);
    let raf = 0, alive = true, visible = false, started = false;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const loop = () => { raf = requestAnimationFrame(loop); if (visible && !document.hidden) api.current?.frame(); };
    async function start() {
      if (started) return; started = true;
      try {
        const mod = kind === "burger" ? await import("../three/burger") : await import("../three/cup");
        if (!alive) return;
        api.current = kind === "burger" ? mod.createBurger(canvas, { reduceMotion: reduce }) : mod.createCup(canvas, { reduceMotion: reduce });
        api.current.setExploded?.(explodedRef.current);
        loop();
      } catch (err) { console.warn("3D is not available here.", err); onFail?.(); }
    }
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); });
    io.observe(node);
    const ro = new ResizeObserver(() => api.current?.resize());
    ro.observe(node);
    return () => { alive = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); api.current?.dispose(); api.current = null; canvas.remove(); };
  }, [kind]);
  return <View ref={host} style={{ height, width: "100%", borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.espresso }} />;
}
