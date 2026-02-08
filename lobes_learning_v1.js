(() => {
  "use strict";

  const VERSION = "lobes_learning_v1";
  const KEY_V = "v";      // toggle overlay
  const KEY_L = "l";      // toggle learning
  const MEM_KEY = "DB_MEM_SHAPE_V1";

  let overlayOn = false;
  let learningOn = !!window.DB_LEARNING_ON;

  // --- Utils
  const isNum = (n) => (typeof n === "number" && Number.isFinite(n));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const tempStress = (T) => Math.abs((T ?? 0) - 0.30);

  // distress: higher = worse
  const distress = (v) =>
    (1 - v.E) * 0.9 +
    v.H * 1.0 +
    (1 - v.O) * 1.2 +
    tempStress(v.T) * 0.8 +
    v.I * 1.1;

  const pick = (o, ...names) => {
    if (!o) return null;
    for (const n of names) if (isNum(o[n])) return o[n];
    return null;
  };

  const looksLikeVitals = (o) => {
    if (!o || typeof o !== "object") return false;
    let c = 0;
    if (isNum(o.E) || isNum(o.energy)) c++;
    if (isNum(o.H) || isNum(o.hunger)) c++;
    if (isNum(o.O) || isNum(o.oxygen)) c++;
    if (isNum(o.T) || isNum(o.temp)) c++;
    if (isNum(o.I) || isNum(o.injury)) c++;
    return c >= 3;
  };

  const looksLikeAgent = (o) => {
    if (!o || typeof o !== "object") return false;
    if (!isNum(o.x) || !isNum(o.y)) return false;
    return ("target" in o) || ("tx" in o) || ("targetX" in o);
  };

  const getVitals = (o) => ({
    E: pick(o, "E", "energy") ?? 0.5,
    H: pick(o, "H", "hunger") ?? 0.0,
    O: pick(o, "O", "oxygen") ?? 1.0,
    T: pick(o, "T", "temp") ?? 0.0,
    I: pick(o, "I", "injury") ?? 0.0,
  });

  const getTarget = (agent) => {
    if (!agent) return null;
    if (agent.target && isNum(agent.target.x) && isNum(agent.target.y)) return { x: agent.target.x, y: agent.target.y };
    if (isNum(agent.tx) && isNum(agent.ty)) return { x: agent.tx, y: agent.ty };
    if (isNum(agent.targetX) && isNum(agent.targetY)) return { x: agent.targetX, y: agent.targetY };
    return null;
  };

  const canControlTarget = (agent) => {
    if (!agent) return false;
    if (agent.target && ("x" in agent.target) && ("y" in agent.target)) return true;
    if (("tx" in agent) && ("ty" in agent)) return true;
    if (("targetX" in agent) && ("targetY" in agent)) return true;
    return false;
  };

  const setTarget = (agent, x, y) => {
    if (!agent) return false;
    if (agent.target && ("x" in agent.target) && ("y" in agent.target)) {
      agent.target.x = x; agent.target.y = y; return true;
    }
    if (("tx" in agent) && ("ty" in agent)) { agent.tx = x; agent.ty = y; return true; }
    if (("targetX" in agent) && ("targetY" in agent)) { agent.targetX = x; agent.targetY = y; return true; }
    return false;
  };

  const dist2 = (a, b) => {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  };

  // --- Drive votes (our “lobes” proxy)
  function scoreVotes(v) {
    const oDef = 1 - v.O;
    const eDef = 1 - v.E;
    const tStr = tempStress(v.T);

    const votes = {
      breathe: oDef * 1.6,
      eat: v.H * 1.2,
      regulate: tStr * 1.0,
      heal: v.I * 1.2,
      rest: eDef * 1.0,
      explore: 0.18 + (1 - clamp01(distress(v))) * 0.35,
    };

    let bestK = "explore", best = -1;
    for (const k in votes) {
      if (votes[k] > best) { best = votes[k]; bestK = k; }
    }
    return { drive: bestK, votes };
  }

  // --- Memory shaping (learn which targets reduce distress)
  function loadMem() {
    try {
      const raw = localStorage.getItem(MEM_KEY);
      if (!raw) return { cells: {} };
      const obj = JSON.parse(raw);
      if (!obj || !obj.cells) return { cells: {} };
      return obj;
    } catch {
      return { cells: {} };
    }
  }
  function saveMem() {
    try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch {}
  }
  function clearMem() {
    mem = { cells: {} };
    saveMem();
  }

  function keyOf(x, y) {
    const q = 0.04; // quantize
    const kx = Math.round(x / q) * q;
    const ky = Math.round(y / q) * q;
    return kx.toFixed(2) + "," + ky.toFixed(2);
  }

  function bumpCell(key, delta, drive) {
    const c = mem.cells[key] || { v: 0, n: 0, by: {} };
    c.v = (c.v * c.n + delta) / (c.n + 1);
    c.n = c.n + 1;
    c.by[drive] = (c.by[drive] || 0) + delta;
    mem.cells[key] = c;
  }

  function bestCellFor(drive) {
    let best = null;
    for (const k in mem.cells) {
      const c = mem.cells[k];
      const bias = (c.by && c.by[drive]) ? (c.by[drive] / Math.max(1, c.n)) : 0;
      const score = c.v + bias * 0.35;
      if (!best || score > best.score) best = { k, score, c };
    }
    return best;
  }

  let mem = loadMem();
  let lastTargetKey = null;
  let lastTargetDistress = null;
  let lastTargetDrive = null;
  let lastBiasAt = 0;

  // --- Find sim objects (agent + vitals) by heuristics (no invasive patches)
  let cached = { agent: null, vitals: null };

  function findState() {
    if (cached.agent && cached.vitals) return cached;

    let agent = null, vitals = null;

    // common-ish globals first
    const direct = [window.DB, window.db, window.state, window.sim, window.SIM, window.world];
    for (const v of direct) {
      if (!v || typeof v !== "object") continue;
      if (!agent && looksLikeAgent(v)) agent = v;
      if (!vitals && looksLikeVitals(v)) vitals = v;

      if (v.agent && !agent && looksLikeAgent(v.agent)) agent = v.agent;
      if (v.vitals && !vitals && looksLikeVitals(v.vitals)) vitals = v.vitals;

      if (agent && vitals) break;
    }

    // brute scan window (single pass)
    if (!agent || !vitals) {
      for (const k in window) {
        try {
          const obj = window[k];
          if (!obj || typeof obj !== "object") continue;
          if (!agent && looksLikeAgent(obj)) agent = obj;
          if (!vitals && looksLikeVitals(obj)) vitals = obj;
          if (agent && vitals) break;
        } catch {}
      }
    }

    cached = { agent, vitals };
    return cached;
  }

  // --- UI overlay
  let box = null;
  function ensureBox() {
    if (box) return box;
    box = document.createElement("div");
    box.id = "dbVotesBox";
    box.style.cssText = [
      "position:fixed",
      "right:16px",
      "top:16px",
      "max-width:360px",
      "padding:12px 14px",
      "border:1px solid rgba(255,255,255,.15)",
      "border-radius:10px",
      "background:rgba(0,0,0,.45)",
      "color:rgba(255,255,255,.92)",
      "font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Monaco,monospace",
      "z-index:9999",
      "backdrop-filter:blur(6px)",
      "display:none",
      "white-space:pre"
    ].join(";");
    document.body.appendChild(box);
    return box;
  }

  function fmtVotes(votes) {
    const arr = Object.entries(votes).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return arr.map(([k, val]) => (k.padEnd(8, " ") + " " + val.toFixed(2))).join("\n");
  }

  function updateOverlay() {
    const st = findState();
    const b = ensureBox();

    if (!st.agent || !st.vitals) {
      b.textContent =
        "LOBE VOTES [V]\n\n" +
        "Telemetry not found.\n" +
        "Try reset.html, then reload.\n\n" +
        "Keys: V overlay • L learn • Shift+L wipe";
      return;
    }

    const v = getVitals(st.vitals);
    const sv = scoreVotes(v);
    const agent = st.agent;
    const t = getTarget(agent);

    // memory bookkeeping (reward when reaching target)
    if (t) {
      const k = keyOf(t.x, t.y);
      if (k !== lastTargetKey) {
        lastTargetKey = k;
        lastTargetDistress = distress(v);
        lastTargetDrive = sv.drive;
      } else {
        const aPos = { x: agent.x, y: agent.y };
        if (isNum(aPos.x) && isNum(aPos.y) && dist2(aPos, t) < 0.0025) { // ~0.05 radius
          const nowD = distress(v);
          if (lastTargetDistress != null) {
            const gain = lastTargetDistress - nowD; // positive = relief
            if (Math.abs(gain) > 0.01) {
              bumpCell(k, gain, lastTargetDrive || sv.drive);
              if (Math.random() < 0.15) saveMem(); // occasional persistence
            }
          }
          lastTargetDistress = nowD;
        }
      }
    }

    // exploration bias (only if we can actually set target)
    const control = canControlTarget(agent);
    if (learningOn && control && sv.drive === "explore" && t) {
      const now = performance.now();
      if (now - lastBiasAt > 1200) {
        const best = bestCellFor("explore");
        if (best && best.score > 0.02) {
          const parts = best.k.split(",");
          const bx = parseFloat(parts[0]);
          const by = parseFloat(parts[1]);
          const j = 0.03;
          const nx = clamp01(bx + (Math.random() * 2 - 1) * j);
          const ny = clamp01(by + (Math.random() * 2 - 1) * j);
          if (setTarget(agent, nx, ny)) lastBiasAt = now;
        }
      }
    }

    const cellCount = Object.keys(mem.cells).length;
    const bestNow = bestCellFor("explore");
    const bestLine = bestNow
      ? ("best mem: " + bestNow.k + " score " + bestNow.score.toFixed(2) + " n " + bestNow.c.n)
      : "best mem: (none yet)";

    b.textContent =
      "LOBE VOTES [V]\n" +
      "drive: " + sv.drive + "   learn: " + (learningOn ? "ON" : "off") + "   target ctrl: " + (control ? "yes" : "no") + "\n" +
      "distress: " + distress(v).toFixed(2) + "   mem cells: " + cellCount + "\n\n" +
      "vitals: E " + v.E.toFixed(2) + "  H " + v.H.toFixed(2) + "  O " + v.O.toFixed(2) + "  T " + v.T.toFixed(2) + "  I " + v.I.toFixed(2) + "\n" +
      bestLine + "\n\n" +
      "votes:\n" + fmtVotes(sv.votes) + "\n\n" +
      "Keys: V overlay • L learn • Shift+L wipe";
  }

  window.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    const k = (e.key || "").toLowerCase();
    if (k === KEY_V) {
      overlayOn = !overlayOn;
      ensureBox().style.display = overlayOn ? "block" : "none";
      e.preventDefault();
    } else if (k === KEY_L) {
      if (e.shiftKey) {
        clearMem();
      } else {
        learningOn = !learningOn;
        window.DB_LEARNING_ON = learningOn;
      }
      e.preventDefault();
    }
  }, { capture: true });

  setInterval(() => {
    if (overlayOn) updateOverlay();
    else findState(); // cheap caching pass
  }, 250);

  window.DB_LOBES_LEARNING = {
    version: VERSION,
    get learningOn() { return learningOn; },
    set learningOn(v) { learningOn = !!v; window.DB_LEARNING_ON = learningOn; },
    mem,
    clear: () => clearMem(),
    update: () => updateOverlay()
  };
})();
