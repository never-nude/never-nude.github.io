/* viz_controls.js — rotate + zoom controls for #viz canvas
   - Drag (mouse/trackpad click-drag): rotate
   - Scroll / pinch: zoom
*/
(() => {
  const canvas = document.getElementById("viz") || document.querySelector("canvas#viz");
  if (!canvas) return;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Default zoom (read by renderViz via window.__vizZoom)
  if (typeof window.__vizZoom !== "number") window.__vizZoom = 1;

  // Make pointer gestures reliable
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";

  let dragging = false;
  let lastX = 0, lastY = 0;
  const SENS = 0.005; // radians per pixel

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    // rotX/rotY are globals in brain.html
    if (typeof rotY === "number") rotY += dx * SENS;
    if (typeof rotX === "number") rotX += dy * SENS;
  });

  const endDrag = (e) => {
    dragging = false;
    canvas.style.cursor = "grab";
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  };

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  // Wheel zoom (trackpad scroll / some pinch gestures)
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const z0 = (typeof window.__vizZoom === "number") ? window.__vizZoom : 1;
    const k = Math.exp(-e.deltaY * 0.001);
    window.__vizZoom = clamp(z0 * k, 0.35, 3.0);
  }, { passive: false });

  // Safari pinch/rotate gestures (trackpad)
  let gStart = null;
  canvas.addEventListener("gesturestart", () => {
    gStart = (typeof window.__vizZoom === "number") ? window.__vizZoom : 1;
  }, { passive: true });

  canvas.addEventListener("gesturechange", (e) => {
    e.preventDefault();
    if (gStart == null) gStart = (typeof window.__vizZoom === "number") ? window.__vizZoom : 1;
    window.__vizZoom = clamp(gStart * e.scale, 0.35, 3.0);

    // Optional: 2-finger rotate gesture rotates the brain too
    if (typeof rotY === "number" && typeof e.rotation === "number") {
      rotY += (e.rotation * Math.PI / 180) * 0.15; // gentle
    }
  }, { passive: false });

  canvas.addEventListener("gestureend", () => { gStart = null; }, { passive: true });
})();
