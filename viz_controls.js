/* viz_controls.js — rotate + zoom controls for #viz canvas
   - Drag: rotate
   - Scroll / pinch: zoom
   - Hold pointer down: freeze drift (brain stays still unless you drag)
*/
(() => {
  const canvas = document.getElementById("viz") || document.querySelector("canvas#viz") || document.querySelector("canvas");
  if (!canvas) return;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Shared read state for other UI (thinking panel / help)
  window.__dbView = window.__dbView || {};
  if (typeof window.__dbView.zoom !== "number") window.__dbView.zoom = 1;

  // Make pointer gestures reliable
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";

  let down = false;
  let lastX = 0, lastY = 0;
  let moved = false;
  let lockX = null, lockY = null;
  let raf = null;

  const SENS = 0.005; // radians per pixel

  function tickHold() {
    if (!down) { raf = null; return; }

    // While pointer is held down, keep rotation locked unless the user moved
    try {
      if (typeof rotX === "number" && typeof rotY === "number") {
        if (!moved && lockX !== null && lockY !== null) {
          rotX = lockX;
          rotY = lockY;
        } else {
          lockX = rotX;
          lockY = rotY;
          moved = false;
        }
      }
    } catch (e) {}

    raf = requestAnimationFrame(tickHold);
  }

  function startHoldLoop() {
    if (raf) return;
    raf = requestAnimationFrame(tickHold);
  }

  canvas.addEventListener("pointerdown", (e) => {
    down = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;

    try { canvas.setPointerCapture(e.pointerId); } catch {}

    // Initialize lock at current rotation
    try {
      if (typeof rotX === "number") lockX = rotX;
      if (typeof rotY === "number") lockY = rotY;
    } catch (err) {}

    window.__dbView.holding = true;
    canvas.style.cursor = "grabbing";
    startHoldLoop();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!down) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    // Small deadzone to prevent micro-jitter from trackpads
    if (Math.abs(dx) + Math.abs(dy) < 0.6) return;

    moved = true;

    // rotX/rotY are globals in brain.html
    if (typeof rotY === "number") rotY += dx * SENS;
    if (typeof rotX === "number") rotX += dy * SENS;

    // Update lock to the new user-controlled rotation
    lockX = (typeof rotX === "number") ? rotX : lockX;
    lockY = (typeof rotY === "number") ? rotY : lockY;
  });

  const end = (e) => {
    down = false;
    window.__dbView.holding = false;
    canvas.style.cursor = "grab";
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  };

  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  // Wheel zoom (trackpad scroll / some pinch gestures)
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const z0 = (typeof window.__dbView.zoom === "number") ? window.__dbView.zoom : 1;
    const k = Math.exp(-e.deltaY * 0.001);
    window.__dbView.zoom = clamp(z0 * k, 0.35, 3.0);

    // Keep legacy compatibility if anything reads __vizZoom
    window.__vizZoom = window.__dbView.zoom;
  }, { passive: false });

  // Safari gesture events (trackpad pinch/rotate)
  let gStart = null;
  canvas.addEventListener("gesturestart", () => {
    gStart = (typeof window.__dbView.zoom === "number") ? window.__dbView.zoom : 1;
  }, { passive: true });

  canvas.addEventListener("gesturechange", (e) => {
    e.preventDefault();
    if (gStart == null) gStart = (typeof window.__dbView.zoom === "number") ? window.__dbView.zoom : 1;
    window.__dbView.zoom = clamp(gStart * e.scale, 0.35, 3.0);
    window.__vizZoom = window.__dbView.zoom;

    // Optional gentle rotate gesture
    if (typeof rotY === "number" && typeof e.rotation === "number") {
      rotY += (e.rotation * Math.PI / 180) * 0.12;
      lockY = rotY;
    }
  }, { passive: false });

  canvas.addEventListener("gestureend", () => { gStart = null; }, { passive: true });

})();
