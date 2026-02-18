
// PAINTER_LOADED_TOAST_V1
(() => {
  try {
    const el = document.createElement("div");
    el.textContent = "PAINTER MODULE LOADED";
    el.style.position = "fixed";
    el.style.left = "16px";
    el.style.top = "16px";
    el.style.padding = "10px 12px";
    el.style.border = "1px solid rgba(255,255,255,0.35)";
    el.style.borderRadius = "12px";
    el.style.background = "rgba(0,0,0,0.70)";
    el.style.color = "rgba(255,255,255,0.95)";
    el.style.font = "13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    el.style.zIndex = "999999";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
    console.log("[painter] module loaded");
  } catch (e) {
    console.log("[painter] load toast failed", e);
  }
})();

/*
  Arnold Memory Painter v1
  - P: toggle paint mode
  - Drag: paint nodes ON
  - Right-click drag: erase nodes
  - [ / ]: brush size
  - X: clear mask
  - K: apply mask to cue (if main app exposes window.__ARNOLD.applyMaskToCue)
*/
function rafWait() {
  const arn = window.__ARNOLD || null;
  if (!arn || !arn.scene || !arn.camera || !arn.renderer || !arn.THREE) {
    requestAnimationFrame(rafWait);
    return;
  }
  initPainter(arn);
}

function initPainter(arn) {
  const THREE = arn.THREE;
  const scene = arn.scene;
  const camera = arn.camera;
  const renderer = arn.renderer;

  const S = {
    THREE, scene, camera, renderer,
    paintMode: false,
    painting: false,
    erase: false,
    radiusWorld: 18,          // start “obvious”; we can refine later
    mask: null,
    nodeObj: null,
    nodeCount: 0,
    overlay: null,
    overlayColors: null,
    overlayColorAttr: null,
    raycaster: new THREE.Raycaster(),
    hitSphere: null,
    tmpV: new THREE.Vector3(),
    tmpV2: new THREE.Vector3(),
    tmpM: new THREE.Matrix4(),
    ring: null,
    toastEl: null,
    toastUntil: 0,
  };

  // ----- tiny toast (truth probe) -----
  function ensureToast() {
    if (S.toastEl) return S.toastEl;
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.left = "16px";
    el.style.top = "16px";
    el.style.padding = "8px 10px";
    el.style.border = "1px solid rgba(255,255,255,0.25)";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,0.55)";
    el.style.color = "rgba(255,255,255,0.9)";
    el.style.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    el.style.pointerEvents = "none";
    el.style.opacity = "0";
    el.style.transition = "opacity 120ms linear";
    document.body.appendChild(el);
    S.toastEl = el;
    return el;
  }
  function toast(msg, ms = 900) {
    const el = ensureToast();
    el.textContent = msg;
    el.style.opacity = "1";
    S.toastUntil = performance.now() + ms;
  }
  function toastTick() {
    if (!S.toastEl) return;
    if (performance.now() > S.toastUntil) S.toastEl.style.opacity = "0";
  }

  // ----- cursor ring (brush) -----
  function ensureRing() {
    if (S.ring) return S.ring;
    const r = document.createElement("div");
    r.style.position = "fixed";
    r.style.left = "0px";
    r.style.top = "0px";
    r.style.width = "10px";
    r.style.height = "10px";
    r.style.borderRadius = "999px";
    r.style.border = "2px solid rgba(255,255,255,0.55)";
    r.style.boxShadow = "0 0 12px rgba(255,255,255,0.25)";
    r.style.transform = "translate(-50%,-50%)";
    r.style.pointerEvents = "none";
    r.style.opacity = "0";
    r.style.transition = "opacity 120ms linear";
    document.body.appendChild(r);
    S.ring = r;
    return r;
  }
  function ringVisible(v) {
    ensureRing().style.opacity = v ? "1" : "0";
  }
  function setRing(px, py, rpx) {
    const ring = ensureRing();
    ring.style.left = px + "px";
    ring.style.top = py + "px";
    ring.style.width = (2 * rpx) + "px";
    ring.style.height = (2 * rpx) + "px";
  }

  // ----- find the node object in the scene -----
  function findNodeObject() {
    let best = null;
    let bestScore = -1;

    scene.traverse((obj) => {
      if (obj && obj.isPoints && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
        const n = obj.geometry.attributes.position.count;
        // Heuristic: Arnold nodes ~260. Prefer 200–450.
        const score = (n >= 200 && n <= 450) ? (1000 - Math.abs(260 - n)) : 0;
        if (score > bestScore) { bestScore = score; best = obj; }
      } else if (obj && obj.isInstancedMesh) {
        const n = obj.count || 0;
        const score = (n >= 200 && n <= 450) ? (900 - Math.abs(260 - n)) : 0;
        if (score > bestScore) { bestScore = score; best = obj; }
      }
    });

    return best;
  }

  function computeHitSphere() {
    const obj = S.nodeObj;
    if (!obj) return null;

    // Prefer geometry bounding sphere if available.
    if (obj.geometry && obj.geometry.computeBoundingSphere) {
      obj.geometry.computeBoundingSphere();
      const bs = obj.geometry.boundingSphere;
      if (bs) {
        obj.updateMatrixWorld(true);
        const sphere = bs.clone();
        sphere.applyMatrix4(obj.matrixWorld);
        return sphere;
      }
    }
    // Fallback: reasonable sphere
    return new THREE.Sphere(new THREE.Vector3(0,0,0), 160);
  }

  // ----- overlay points: bright “paint mask” -----
  function buildOverlay() {
    const obj = S.nodeObj;
    let positions = null;
    let n = 0;

    if (obj.isPoints) {
      positions = obj.geometry.attributes.position;
      n = positions.count;
    } else if (obj.isInstancedMesh) {
      n = obj.count || 0;
      const arr = new Float32Array(n * 3);
      const p = new THREE.Vector3();
      obj.updateMatrixWorld(true);
      for (let i = 0; i < n; i++) {
        obj.getMatrixAt(i, S.tmpM);
        p.setFromMatrixPosition(S.tmpM);
        p.applyMatrix4(obj.matrixWorld);
        arr[i*3+0] = p.x;
        arr[i*3+1] = p.y;
        arr[i*3+2] = p.z;
      }
      positions = new THREE.BufferAttribute(arr, 3);
    }

    S.nodeCount = n;
    S.mask = new Uint8Array(n);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", positions);

    const colors = new Float32Array(n * 3); // starts 0,0,0 -> invisible under additive blending
    const colorAttr = new THREE.BufferAttribute(colors, 3);
    geo.setAttribute("color", colorAttr);

    const mat = new THREE.PointsMaterial({
      size: 6,                 // intentionally obvious
      sizeAttenuation: false,  // stable pixel size
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const overlay = new THREE.Points(geo, mat);
    overlay.renderOrder = 999; // draw late
    scene.add(overlay);

    S.overlay = overlay;
    S.overlayColors = colors;
    S.overlayColorAttr = colorAttr;
  }

  function nodeWorldPos(i, out) {
    const obj = S.nodeObj;
    if (obj.isPoints) {
      out.fromBufferAttribute(obj.geometry.attributes.position, i);
      obj.localToWorld(out);
      return out;
    }
    // instanced handled by pre-extracted positions in overlay; use overlay positions
    out.fromBufferAttribute(S.overlay.geometry.attributes.position, i);
    return out;
  }

  function updateOverlayColor(i) {
    const on = S.mask[i] ? 1.0 : 0.0;
    const k = i * 3;
    S.overlayColors[k+0] = on;
    S.overlayColors[k+1] = on;
    S.overlayColors[k+2] = on;
  }

  function clearMask() {
    if (!S.mask) return;
    S.mask.fill(0);
    for (let i = 0; i < S.nodeCount; i++) updateOverlayColor(i);
    S.overlayColorAttr.needsUpdate = true;
    toast("PAINT: cleared (X)");
  }

  function applyToCue() {
    if (!S.mask) return;
    if (arn && typeof arn.applyMaskToCue === "function") {
      const res = arn.applyMaskToCue(S.mask, 1.0);
      if (res && res.ok) toast(`PAINT → cue applied (${res.used})`);
      else toast(`PAINT → cue failed (${(res && res.why) ? res.why : "no hook"})`);
    } else {
      toast("PAINT → cue: no hook (missing __ARNOLD.applyMaskToCue)");
    }
  }

  function ptrToHit(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    );
    S.raycaster.setFromCamera(ndc, camera);

    const hit = new THREE.Vector3();
    const ok = S.raycaster.ray.intersectSphere(S.hitSphere, hit);
    return ok ? { hit, rect } : null;
  }

  function worldRadiusToPixels(hit, rect) {
    const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const p2 = S.tmpV2.copy(hit).addScaledVector(right, S.radiusWorld);

    const s1 = S.tmpV.copy(hit).project(camera);
    const s2 = p2.project(camera);

    const x1 = (s1.x * 0.5 + 0.5) * rect.width;
    const y1 = (-s1.y * 0.5 + 0.5) * rect.height;
    const x2 = (s2.x * 0.5 + 0.5) * rect.width;
    const y2 = (-s2.y * 0.5 + 0.5) * rect.height;

    return Math.hypot(x2 - x1, y2 - y1);
  }

  function brushAt(hit, add) {
    const r2 = S.radiusWorld * S.radiusWorld;
    const p = S.tmpV2;

    for (let i = 0; i < S.nodeCount; i++) {
      nodeWorldPos(i, p);
      const d2 = p.distanceToSquared(hit);
      if (d2 <= r2) {
        S.mask[i] = add ? 1 : 0;
        updateOverlayColor(i);
      }
    }
    S.overlayColorAttr.needsUpdate = true;
  }

  function onPointerDown(e) {
    if (!S.paintMode) return;
    if (e.target !== renderer.domElement) return;

    S.painting = true;
    S.erase = (e.button === 2); // right button
    const pack = ptrToHit(e);
    if (!pack) return;

    const rpx = worldRadiusToPixels(pack.hit, pack.rect);
    setRing(e.clientX, e.clientY, rpx);

    brushAt(pack.hit, !S.erase);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!S.paintMode) return;
    if (e.target !== renderer.domElement) return;

    const pack = ptrToHit(e);
    if (!pack) { ringVisible(false); return; }

    const rpx = worldRadiusToPixels(pack.hit, pack.rect);
    setRing(e.clientX, e.clientY, rpx);
    ringVisible(true);

    if (S.painting) brushAt(pack.hit, !S.erase);
    e.preventDefault();
  }

  function onPointerUp() {
    if (!S.paintMode) return;
    S.painting = false;
  }

  function onKeyDown(e) {
    if (e.code === "KeyP") {
      S.paintMode = !S.paintMode;
      ringVisible(S.paintMode);
      toast(S.paintMode ? "PAINT: ON (drag to paint, RMB erase)" : "PAINT: OFF");
      return;
    }
    if (!S.paintMode) return;

    if (e.code === "BracketLeft") {
      S.radiusWorld = Math.max(6, S.radiusWorld - 3);
      toast(`PAINT radius: ${S.radiusWorld}`);
    } else if (e.code === "BracketRight") {
      S.radiusWorld = Math.min(60, S.radiusWorld + 3);
      toast(`PAINT radius: ${S.radiusWorld}`);
    } else if (e.code === "KeyX") {
      clearMask();
    } else if (e.code === "KeyK") {
      applyToCue();
    }
  }

  // block context menu while painting (otherwise RMB is useless)
  document.addEventListener("contextmenu", (e) => {
    if (S.paintMode && e.target === renderer.domElement) e.preventDefault();
  });

  // ----- boot -----
  S.nodeObj = findNodeObject();
  if (!S.nodeObj) {
    toast("PAINT init failed: couldn't find node object");
    return;
  }
  buildOverlay();
  S.hitSphere = computeHitSphere();

  window.addEventListener("keydown", onKeyDown, true);
  renderer.domElement.addEventListener("pointerdown", onPointerDown, { passive: false });
  renderer.domElement.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: true });

  toast("PAINT ready: press P");

  // tiny tick to fade toast
  function tick() { toastTick(); requestAnimationFrame(tick); }
  tick();
}

rafWait();
