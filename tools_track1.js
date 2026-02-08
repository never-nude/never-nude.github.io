/* tools_track1.js — clarity + pause + injury controls
   Build: 2026-02-07 18:04:46
*/
(() => {
  const BUILD_STAMP = "2026-02-07 18:04:46";
  const ENV = (location.hostname === "127.0.0.1" || location.hostname === "localhost") ? "LOCAL" : "LIVE";

  window.__dbTools = window.__dbTools || {};
  window.__dbTools.buildStamp = BUILD_STAMP;

  const clamp01 = (v)=>Math.max(0, Math.min(1, v));
  const statusHoldMs = 1800;

  const box = document.createElement("div");
  box.id = "dbTools";
  box.style.position = "fixed";
  box.style.left = "12px";
  box.style.top = "12px";
  box.style.zIndex = "999999";
  box.style.padding = "10px 12px";
  box.style.borderRadius = "10px";
  box.style.border = "1px solid rgba(255,255,255,0.14)";
  box.style.background = "rgba(0,0,0,0.56)";
  box.style.color = "rgba(255,255,255,0.86)";
  box.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  box.style.backdropFilter = "blur(2px)";
  box.style.maxWidth = "560px";

  const mkLine = (txt, op=1) => {
    const d = document.createElement("div");
    d.textContent = txt;
    d.style.margin = "2px 0";
    d.style.opacity = String(op);
    return d;
  };

  const title = mkLine(`DigitalBrain  [${ENV}]`, 1);
  const build = mkLine(`Build: ${BUILD_STAMP}`, 0.92);
  const keys  = mkLine(`Keys: [P] Pause  [T] Monologue  [C] Colors  [?] Help`, 0.78);
  const view  = mkLine(`View: drag rotate • scroll/pinch zoom • (pause does NOT block view)`, 0.70);

  const statusLine = mkLine("", 0.88);
  statusLine.style.marginTop = "6px";
  statusLine.style.whiteSpace = "pre-wrap";

  function status(msg) {
    statusLine.textContent = msg;
    clearTimeout(status._t);
    status._t = setTimeout(()=>{ statusLine.textContent = ""; }, statusHoldMs);
  }
  window.__dbTools.status = status;

  function mkBtn(label, hint) {
    const b = document.createElement("button");
    b.textContent = label;
    b.title = hint || "";
    b.style.padding = "6px 10px";
    b.style.borderRadius = "8px";
    b.style.border = "1px solid rgba(255,255,255,0.16)";
    b.style.background = "rgba(255,255,255,0.06)";
    b.style.color = "rgba(255,255,255,0.86)";
    b.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
    b.style.cursor = "pointer";
    return b;
  }

  // --- PAUSE implementation (best-effort; uses existing globals if present)
  window.__dbPause = window.__dbPause || false;

  function applyPause(on) {
    window.__dbPause = !!on;

    // If engine already uses a "holding" style freeze, drive it.
    try {
      if (typeof holding !== "undefined") holding = window.__dbPause;
    } catch(e) {}
    try {
      if (window.view && typeof view === "object" && "holding" in view) view.holding = window.__dbPause;
    } catch(e) {}

    // Kill tiny drift if we can see agent velocity.
    try {
      if (window.__dbPause && window.agent) {
        if ("vx" in agent) agent.vx = 0;
        if ("vy" in agent) agent.vy = 0;
        if ("ax" in agent) agent.ax = 0;
        if ("ay" in agent) agent.ay = 0;
      }
    } catch(e) {}

    status(window.__dbPause ? "PAUSED — sim frozen (view still free)" : "UNPAUSED — sim running");
  }

  // --- Rename / tooltip the built-in UI buttons + labels
  function sweepUI() {
    const btns = Array.from(document.querySelectorAll("button"));
    const rename = (from, to, title) => {
      for (const b of btns) {
        const t = (b.textContent || "").trim();
        if (t === from) {
          b.textContent = to;
          if (title) b.title = title;
        }
      }
    };

    // Touch is a mode, not a mystery button.
    rename("TOUCH", "INTERVENE [Space]", "Manual help. Space also triggers intervene/touch.");

    // Make these clearer without changing meaning.
    rename("CLEAR WORLD", "CLEAR WORLD", "Removes placed items (food/oxygen/hazards).");
    rename("NEW ORGANISM", "NEW CREATURE", "Spawns a new creature with fresh state.");

    // Injury label tooltip (if it’s a DOM label)
    const labels = Array.from(document.querySelectorAll("*"));
    for (const el of labels) {
      const tx = (el.textContent || "").trim().toUpperCase();
      if (tx === "INJURY") {
        el.title = "Injury = damage (0–1). Higher = hurt. Hazards increase it; healing/rest reduce it.";
      }
    }
  }

  // --- Quick injury buttons (for learning/testing)
  function bumpBody(key, delta) {
    try {
      if (!window.body) return status("No body object visible yet.");
      const v = (typeof body[key] === "number") ? body[key] : 0;
      body[key] = clamp01(v + delta);
      status(`${key} → ${body[key].toFixed(2)}`);
    } catch(e) {
      status("Could not modify body (JS state not visible).");
    }
  }

  // --- A simple legend overlay toggle (C)
  let legendEl = null;
  function showLegendBrief() {
    if (!legendEl) {
      legendEl = document.createElement("div");
      legendEl.style.position = "fixed";
      legendEl.style.left = "50%";
      legendEl.style.top = "16px";
      legendEl.style.transform = "translateX(-50%)";
      legendEl.style.zIndex = "999997";
      legendEl.style.padding = "10px 12px";
      legendEl.style.borderRadius = "10px";
      legendEl.style.border = "1px solid rgba(255,255,255,0.14)";
      legendEl.style.background = "rgba(0,0,0,0.55)";
      legendEl.style.color = "rgba(255,255,255,0.86)";
      legendEl.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
      legendEl.style.backdropFilter = "blur(2px)";
      legendEl.style.pointerEvents = "none";
      document.body.appendChild(legendEl);
    }
    legendEl.textContent =
      "COLORS (organism/urgency)
" +
      "GREEN=Energy • ORANGE=Hunger • CYAN=Breath • PURPLE=Temp • RED=Injury
" +
      "Tip: when two needs compete, you may see mixed edges/tones.";
    legendEl.style.opacity = "1";
    clearTimeout(showLegendBrief._t);
    showLegendBrief._t = setTimeout(()=>{ legendEl.style.opacity = "0"; }, 1400);
    status("legend shown (C)");
  }

  // --- Help
  const help = document.createElement("div");
  help.style.marginTop = "8px";
  help.style.paddingTop = "8px";
  help.style.borderTop = "1px solid rgba(255,255,255,0.10)";
  help.style.opacity = "0.86";
  help.style.display = "none";
  help.textContent =
`HELP
- P pauses the SIM (state frozen), but you can still rotate/zoom.
- Space / Intervene = manual help mode (UI + key).
- Injury is damage (0–1). Try Pain +/- to learn how it affects decisions.
- If things go dim + dead: look for a red error banner (we now show it).`;

  let helpOn = false;
  function toggleHelp() {
    helpOn = !helpOn;
    help.style.display = helpOn ? "block" : "none";
    status(helpOn ? "help on" : "help off");
  }

  // --- Error trap (makes invisible failures visible)
  let errBanner = null;
  function showError(msg) {
    if (!errBanner) {
      errBanner = document.createElement("div");
      errBanner.style.position = "fixed";
      errBanner.style.left = "12px";
      errBanner.style.bottom = "12px";
      errBanner.style.zIndex = "999999";
      errBanner.style.padding = "8px 10px";
      errBanner.style.borderRadius = "10px";
      errBanner.style.border = "1px solid rgba(255,110,110,0.35)";
      errBanner.style.background = "rgba(40,0,0,0.55)";
      errBanner.style.color = "rgba(255,200,200,0.95)";
      errBanner.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
      errBanner.style.whiteSpace = "pre-wrap";
      errBanner.style.maxWidth = "70vw";
      errBanner.style.pointerEvents = "none";
      document.body.appendChild(errBanner);
    }
    errBanner.textContent = "JS ERROR\n" + msg;
  }

  window.addEventListener("error", (e)=>{
    try {
      showError(String(e.message || e.error || "unknown error"));
      status("JS error detected (see banner).");
    } catch(_) {}
  });
  window.addEventListener("unhandledrejection", (e)=>{
    try {
      showError(String(e.reason || "unhandled rejection"));
      status("Promise rejection (see banner).");
    } catch(_) {}
  });

  // --- Build UI
  document.addEventListener("DOMContentLoaded", () => {
    box.appendChild(title);
    box.appendChild(build);
    box.appendChild(keys);
    box.appendChild(view);
    box.appendChild(statusLine);

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.flexWrap = "wrap";
    row.style.marginTop = "8px";

    const pauseBtn = mkBtn("PAUSE [P]", "Toggle pause: freezes sim state but keeps view controls.");
    pauseBtn.onclick = () => applyPause(!window.__dbPause);

    const painUp = mkBtn("PAIN +", "Increase injury (test/learn).");
    painUp.onclick = () => bumpBody("injury", +0.10);

    const painDn = mkBtn("PAIN -", "Decrease injury (test/learn).");
    painDn.onclick = () => bumpBody("injury", -0.10);

    const legendBtn = mkBtn("LEGEND [C]", "Show color key briefly.");
    legendBtn.onclick = showLegendBrief;

    row.appendChild(pauseBtn);
    row.appendChild(painDn);
    row.appendChild(painUp);
    row.appendChild(legendBtn);

    box.appendChild(row);
    box.appendChild(help);

    document.body.appendChild(box);

    // Sweep a few times to catch late-created UI
    let n = 0;
    const iv = setInterval(() => {
      sweepUI();
      n += 1;
      if(n >= 18) clearInterval(iv);
    }, 250);
  });

  window.addEventListener("keydown", (e)=>{
    const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;

    if(e.key === "p" || e.key === "P") applyPause(!window.__dbPause);
    if(e.key === "c" || e.key === "C") showLegendBrief();
    if(e.key === "?" || e.key === "/") toggleHelp();
  });
})();
