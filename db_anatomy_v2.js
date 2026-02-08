(() => {
  const STATE = (window.DB_ANATOMY = window.DB_ANATOMY || {});
  STATE.enabled = STATE.enabled ?? true; // toggle with B
  STATE.status = "init";

  function onReady(fn){
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once:true });
    } else fn();
  }

  function pickMainCanvas(){
    const canvases = Array.from(document.querySelectorAll("canvas"));
    if (!canvases.length) return null;
    let best = canvases[0];
    let bestArea = 0;
    for (const c of canvases) {
      const r = c.getBoundingClientRect();
      const a = Math.max(0, r.width) * Math.max(0, r.height);
      if (a > bestArea) { bestArea = a; best = c; }
    }
    return best;
  }

  function getPaused(){
    // Use whatever exists; fallback false.
    if (typeof window.DB_PAUSED === "boolean") return window.DB_PAUSED;
    if (window.DB && typeof window.DB.paused === "boolean") return window.DB.paused;
    return false;
  }

  function hideHistoryAndLegacyBoxes(){
    // Hide obvious history containers by id/class first:
    const ids = ["history", "historyBox", "hud_history", "db_history"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    }
    const classes = [".history", ".historyBox", ".hud-history", ".db-history"];
    for (const sel of classes) {
      for (const el of document.querySelectorAll(sel)) el.style.display = "none";
    }

    // Hide the legacy “BRAIN PARTS (toy anatomy)” box if it exists.
    // (We replace it with a working one.)
    const divs = Array.from(document.querySelectorAll("div"));
    for (const el of divs) {
      const t = (el.textContent || "").trim();
      if (t.includes("BRAIN PARTS") && t.includes("toy anatomy")) {
        el.style.display = "none";
      }
    }
  }

  function findNodesByHeuristic(){
    // Preferred: if something already exposed “telemetry”
    const t = window.DB_TELEMETRY;
    if (t && Array.isArray(t.nodes) && t.nodes.length > 20) return t.nodes;

    // Common-ish globals
    const common = [
      "nodes","NODES","brainNodes","BRAIN_NODES","DB_NODES","db_nodes",
      "points","POINTS","particles","PARTICLES"
    ];
    for (const k of common) {
      const v = window[k];
      if (Array.isArray(v) && v.length > 20) return v;
    }

    // Scan window for “array of objects with x/y” shape.
    let best = null;
    let bestScore = -1;

    for (const k of Object.keys(window)) {
      // skip a bunch of noisy stuff
      if (k.startsWith("webkit") || k.startsWith("Apple") || k.startsWith("chrome")) continue;

      const v = window[k];
      if (!Array.isArray(v) || v.length < 30) continue;
      const e = v[0];
      if (!e || typeof e !== "object") continue;

      let score = 0;
      const hasXY = (typeof e.x === "number" && typeof e.y === "number");
      const hasZ  = (typeof e.z === "number");
      const hasSX = (typeof e.sx === "number" && typeof e.sy === "number");
      const hasPosArr = (Array.isArray(e.pos) && e.pos.length >= 2 && typeof e.pos[0] === "number");

      if (hasXY) score += 10;
      if (hasZ)  score += 3;
      if (hasSX) score += 6;
      if (hasPosArr) score += 8;

      if (score > bestScore) { bestScore = score; best = v; }
    }

    return best;
  }

  function getModelXYZ(n){
    if (!n) return null;
    if (typeof n.x === "number" && typeof n.y === "number") {
      return { x:n.x, y:n.y, z:(typeof n.z === "number" ? n.z : 0) };
    }
    if (Array.isArray(n.pos) && n.pos.length >= 2) {
      return { x:+n.pos[0], y:+n.pos[1], z:+(n.pos[2] ?? 0) };
    }
    return null;
  }

  function getScreenXY(n){
    // Many renderers store projected coords as sx/sy; use those if present.
    if (n && typeof n.sx === "number" && typeof n.sy === "number") return { sx:n.sx, sy:n.sy };
    if (n && typeof n.screenX === "number" && typeof n.screenY === "number") return { sx:n.screenX, sy:n.screenY };
    if (n && typeof n.px === "number" && typeof n.py === "number") return { sx:n.px, sy:n.py };
    if (n && Array.isArray(n.p2) && n.p2.length >= 2) return { sx:+n.p2[0], sy:+n.p2[1] };
    return null;
  }

  function computeBounds(nodes){
    let minX= Infinity, minY= Infinity, minZ= Infinity;
    let maxX=-Infinity, maxY=-Infinity, maxZ=-Infinity;
    let count = 0;
    for (const n of nodes) {
      const p = getModelXYZ(n);
      if (!p) continue;
      count++;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }
    if (!count) return null;
    const cx = (minX+maxX)/2, cy=(minY+maxY)/2, cz=(minZ+maxZ)/2;
    const rx = Math.max(1e-6, (maxX-minX)/2);
    const ry = Math.max(1e-6, (maxY-minY)/2);
    const rz = Math.max(1e-6, (maxZ-minZ)/2);
    return { minX,minY,minZ,maxX,maxY,maxZ,cx,cy,cz,rx,ry,rz };
  }

  const PARTS = [
    { id:"hippocampus", label:"HIPPOCAMPUS", role:"memory indexing", color:"rgba(90, 220, 215, 0.95)" },
    { id:"amygdala",    label:"AMYGDALA",    role:"threat / valence tagging", color:"rgba(255, 95, 95, 0.95)" },
    { id:"prefrontal",  label:"PREFRONTAL",  role:"plan / inhibit", color:"rgba(160, 255, 160, 0.85)" },
    { id:"thalamus",    label:"THALAMUS",    role:"route signals", color:"rgba(235, 235, 235, 0.75)" },
    { id:"brainstem",   label:"BRAINSTEM",   role:"autonomic drive", color:"rgba(160, 190, 255, 0.75)" },
    { id:"cerebellum",  label:"CEREBELLUM",  role:"smooth / coordinate", color:"rgba(255, 210, 140, 0.75)" },
  ];

  // Seeds in normalized model space (rough “toy anatomy” Voronoi partition).
  const SEEDS = {
    hippocampus: [-0.45, -0.35,  0.00],
    amygdala:    [ 0.45, -0.35,  0.00],
    prefrontal:  [ 0.00,  0.65,  0.00],
    thalamus:    [ 0.00,  0.05,  0.00],
    brainstem:   [ 0.00, -0.70,  0.35],
    cerebellum:  [ 0.00, -0.60, -0.35],
  };

  function assignParts(nodes, bounds){
    for (const n of nodes) {
      const p = getModelXYZ(n);
      if (!p) continue;
      const nx = (p.x - bounds.cx) / bounds.rx;
      const ny = (p.y - bounds.cy) / bounds.ry;
      const nz = (p.z - bounds.cz) / bounds.rz;

      let bestId = "thalamus";
      let bestD = Infinity;
      for (const part of PARTS) {
        const s = SEEDS[part.id] || SEEDS.thalamus;
        const dx = nx - s[0], dy = ny - s[1], dz = nz - s[2];
        const d = dx*dx + dy*dy + dz*dz;
        if (d < bestD) { bestD = d; bestId = part.id; }
      }
      n.__db_part = bestId;
    }
  }

  function ensureStyles(){
    if (document.getElementById("db_anatomy_style")) return;
    const st = document.createElement("style");
    st.id = "db_anatomy_style";
    st.textContent = `
      .dbAnatomyTip {
        position: fixed;
        z-index: 99999;
        pointer-events: none;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(0,0,0,0.72);
        color: rgba(255,255,255,0.92);
        font: 12px/1.25 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        max-width: 320px;
        transform: translate(12px, 12px);
        display: none;
      }
      .dbAnatomyLabel {
        position: fixed;
        z-index: 99998;
        pointer-events: auto;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(0,0,0,0.55);
        color: rgba(255,255,255,0.92);
        font: 12px/1.1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        backdrop-filter: blur(6px);
        user-select: none;
        white-space: nowrap;
        display: none;
      }
      .dbAnatomyLabel strong { font-weight: 700; letter-spacing: 0.02em; }
      .dbAnatomyHint {
        position: fixed;
        z-index: 99997;
        pointer-events: none;
        left: 16px;
        bottom: 14px;
        color: rgba(255,255,255,0.55);
        font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        display: none;
      }
    `;
    document.head.appendChild(st);
  }

  onReady(() => {
    ensureStyles();
    hideHistoryAndLegacyBoxes();

    const canvas = pickMainCanvas();
    if (!canvas) {
      STATE.status = "no canvas";
      console.warn("[db_anatomy_v2] No canvas found.");
      return;
    }

    // Overlay canvas for highlights
    const overlay = document.createElement("canvas");
    overlay.id = "db_anatomy_overlay";
    overlay.style.position = "fixed";
    overlay.style.left = "0px";
    overlay.style.top = "0px";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "99990";
    overlay.style.display = "none";
    document.body.appendChild(overlay);

    // Tooltip
    const tip = document.createElement("div");
    tip.className = "dbAnatomyTip";
    document.body.appendChild(tip);

    // Two key labels (hippocampus/amygdala), only show when paused
    const labelHip = document.createElement("div");
    labelHip.className = "dbAnatomyLabel";
    labelHip.dataset.part = "hippocampus";
    labelHip.innerHTML = `<strong>HIPPOCAMPUS</strong> · memory`;
    document.body.appendChild(labelHip);

    const labelAmy = document.createElement("div");
    labelAmy.className = "dbAnatomyLabel";
    labelAmy.dataset.part = "amygdala";
    labelAmy.innerHTML = `<strong>AMYGDALA</strong> · threat`;
    document.body.appendChild(labelAmy);

    const hint = document.createElement("div");
    hint.className = "dbAnatomyHint";
    hint.textContent = "Anatomy: B toggle • hover highlights • P pause recommended";
    document.body.appendChild(hint);

    let nodes = null;
    let bounds = null;
    let nodesSignature = "";
    let hoverPart = null;
    let hoverXY = null;

    function partById(id){ return PARTS.find(p => p.id === id) || PARTS[0]; }

    function refreshNodesIfNeeded(){
      const found = findNodesByHeuristic();
      if (!found) return false;

      // Signature: identity + length
      const sig = `${found.length}:${String(found[0] && found[0].x)}:${String(found[0] && found[0].sx)}`;
      if (found === nodes && sig === nodesSignature) return true;

      nodes = found;
      nodesSignature = sig;
      bounds = computeBounds(nodes);
      if (bounds) assignParts(nodes, bounds);
      STATE.status = bounds ? `nodes:${nodes.length}` : "nodes:no bounds";
      return !!bounds;
    }

    function canvasToClient(sx, sy, rect){
      // sx/sy are in canvas pixel coords (canvas.width/height). Convert to client px.
      return {
        x: rect.left + (sx / canvas.width) * rect.width,
        y: rect.top  + (sy / canvas.height) * rect.height
      };
    }

    function clientToCanvas(clientX, clientY, rect){
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top)  * (canvas.height / rect.height)
      };
    }

    function nearestPartAt(canvasX, canvasY){
      if (!nodes || !bounds) return null;

      // Scan a sample for speed.
      const N = nodes.length;
      const step = Math.max(1, Math.floor(N / 800)); // ~800 checks max
      let bestD2 = Infinity;
      let bestPart = null;
      let bestPt = null;

      for (let i = 0; i < N; i += step) {
        const n = nodes[i];
        const sxy = getScreenXY(n);
        if (!sxy) continue;
        const dx = sxy.sx - canvasX;
        const dy = sxy.sy - canvasY;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestPart = n.__db_part || null;
          bestPt = sxy;
        }
      }

      // Threshold: if you're not near anything, treat as “no hover”.
      const thresh = 18 * 18;
      if (bestD2 > thresh) return null;
      return { partId: bestPart, sx: bestPt.sx, sy: bestPt.sy };
    }

    function drawHighlight(ctx, rect){
      ctx.clearRect(0,0,overlay.width, overlay.height);
      if (!STATE.enabled) return;
      if (!hoverPart) return;

      const part = partById(hoverPart);
      // Draw a halo on a sample of nodes in this part.
      const N = nodes.length;
      const step = Math.max(1, Math.floor(N / 280)); // ~280 nodes drawn max
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 2;
      ctx.strokeStyle = part.color;
      ctx.fillStyle = part.color.replace("0.95", "0.18").replace("0.85","0.18").replace("0.75","0.18");

      let drawn = 0;
      for (let i = 0; i < N; i += step) {
        const n = nodes[i];
        if ((n.__db_part || "thalamus") !== hoverPart) continue;
        const sxy = getScreenXY(n);
        if (!sxy) continue;
        const r = 6;
        ctx.beginPath();
        ctx.arc(sxy.sx, sxy.sy, r, 0, Math.PI*2);
        ctx.stroke();
        drawn++;
        if (drawn > 200) break;
      }

      // small centroid halo
      if (hoverXY) {
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(hoverXY.sx, hoverXY.sy, 26, 0, Math.PI*2);
        ctx.fill();
      }

      ctx.restore();
    }

    function placeLabels(rect){
      const paused = getPaused();
      if (!STATE.enabled || !paused || !nodes || !bounds) {
        labelHip.style.display = "none";
        labelAmy.style.display = "none";
        return;
      }

      // compute centroid for each part in screen coords from a sample
      function centroid(partId){
        let sx=0, sy=0, c=0;
        const N = nodes.length;
        const step = Math.max(1, Math.floor(N / 600));
        for (let i=0;i<N;i+=step){
          const n = nodes[i];
          if ((n.__db_part||"") !== partId) continue;
          const sxy = getScreenXY(n);
          if (!sxy) continue;
          sx += sxy.sx; sy += sxy.sy; c++;
          if (c > 120) break;
        }
        if (!c) return null;
        return { sx: sx/c, sy: sy/c };
      }

      const hip = centroid("hippocampus");
      const amy = centroid("amygdala");
      if (hip) {
        const p = canvasToClient(hip.sx, hip.sy, rect);
        labelHip.style.left = `${Math.round(p.x)}px`;
        labelHip.style.top  = `${Math.round(p.y)}px`;
        labelHip.style.transform = "translate(-50%, -170%)";
        labelHip.style.display = "block";
        labelHip.style.borderColor = "rgba(90,220,215,0.30)";
      } else labelHip.style.display = "none";

      if (amy) {
        const p = canvasToClient(amy.sx, amy.sy, rect);
        labelAmy.style.left = `${Math.round(p.x)}px`;
        labelAmy.style.top  = `${Math.round(p.y)}px`;
        labelAmy.style.transform = "translate(-50%, -170%)";
        labelAmy.style.display = "block";
        labelAmy.style.borderColor = "rgba(255,95,95,0.30)";
      } else labelAmy.style.display = "none";
    }

    function setTip(text, clientX, clientY, show){
      if (!show) { tip.style.display = "none"; return; }
      tip.textContent = text;
      tip.style.left = `${Math.round(clientX)}px`;
      tip.style.top  = `${Math.round(clientY)}px`;
      tip.style.display = "block";
    }

    // Hover tracking
    let lastClient = null;

    function onMove(ev){
      lastClient = { x: ev.clientX, y: ev.clientY };
      if (!STATE.enabled) return;

      const rect = canvas.getBoundingClientRect();
      const cxy = clientToCanvas(ev.clientX, ev.clientY, rect);
      const hit = nearestPartAt(cxy.x, cxy.y);

      if (!hit) {
        hoverPart = null;
        hoverXY = null;
        setTip("", ev.clientX, ev.clientY, false);
        return;
      }

      hoverPart = hit.partId;
      hoverXY = { sx: hit.sx, sy: hit.sy };
      const part = partById(hoverPart);
      setTip(`${part.label} — ${part.role}`, ev.clientX, ev.clientY, true);
    }

    canvas.addEventListener("mousemove", onMove, { passive:true });
    canvas.addEventListener("mouseleave", () => {
      hoverPart = null;
      hoverXY = null;
      setTip("", 0, 0, false);
    }, { passive:true });

    // Also allow hovering over labels themselves to force-highlight
    function attachLabelHover(el){
      el.addEventListener("mouseenter", () => {
        hoverPart = el.dataset.part || null;
      });
      el.addEventListener("mouseleave", () => {
        hoverPart = null;
      });
    }
    attachLabelHover(labelHip);
    attachLabelHover(labelAmy);

    // Key: B toggles anatomy overlay
    window.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "b" || e.key === "B") {
        STATE.enabled = !STATE.enabled;
        hint.style.display = STATE.enabled ? "block" : "none";
        overlay.style.display = STATE.enabled ? "block" : "none";
        if (!STATE.enabled) {
          setTip("", 0, 0, false);
          hoverPart = null;
          hoverXY = null;
          labelHip.style.display = "none";
          labelAmy.style.display = "none";
        }
        e.preventDefault();
        e.stopPropagation();
      }
    }, { capture:true });

    function tick(){
      requestAnimationFrame(tick);

      if (!refreshNodesIfNeeded()) {
        hint.style.display = STATE.enabled ? "block" : "none";
        return;
      }

      const rect = canvas.getBoundingClientRect();

      // Sync overlay geometry to canvas each frame (robust against layout changes)
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      overlay.style.left = `${Math.round(rect.left)}px`;
      overlay.style.top  = `${Math.round(rect.top)}px`;
      overlay.style.width = `${Math.round(rect.width)}px`;
      overlay.style.height = `${Math.round(rect.height)}px`;
      overlay.style.display = STATE.enabled ? "block" : "none";
      hint.style.display = STATE.enabled ? "block" : "none";

      // Draw highlight
      const ctx = overlay.getContext("2d");
      drawHighlight(ctx, rect);

      // Place labels (only when paused)
      placeLabels(rect);

      // If enabled but no recent mousemove, keep tip hidden
      if (!lastClient) setTip("", 0, 0, false);
    }

    STATE.status = "running";
    tick();
  });
})();
