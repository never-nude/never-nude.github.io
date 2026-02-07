/* tools_track1.js — build stamp + export/import/reset + key legend + help
   Keys:
     E = Export (also supports B)
     I = Import
     M = Memory toggle (implemented in memory_track2.js)
     T = Thoughts toggle (implemented in thinking_depth.js)
     H = History toggle (implemented in decision_timeline.js)
     C = Color legend (implemented in legend_toggle.js)
     ? = Help
*/
(() => {
  const BUILD_STAMP = "2026-02-07 14:00:14";
  const ENV = (location.hostname === "127.0.0.1" || location.hostname === "localhost") ? "LOCAL" : "LIVE";

  window.__dbTools = window.__dbTools || {};
  window.__dbTools.buildStamp = BUILD_STAMP;

  const box = document.createElement("div");
  box.id = "dbTools";
  box.style.position = "fixed";
  box.style.left = "12px";
  box.style.top = "12px";
  box.style.zIndex = "999999";
  box.style.padding = "10px 12px";
  box.style.borderRadius = "10px";
  box.style.border = "1px solid rgba(255,255,255,0.14)";
  box.style.background = "rgba(0,0,0,0.58)";
  box.style.color = "rgba(255,255,255,0.86)";
  box.style.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  box.style.backdropFilter = "blur(2px)";
  box.style.maxWidth = "460px";

  const mkLine = (txt, op=1) => {
    const d = document.createElement("div");
    d.textContent = txt;
    d.style.margin = "2px 0";
    d.style.opacity = String(op);
    return d;
  };

  const title = mkLine(`DigitalBrain  [${ENV}]`, 1);
  const build = mkLine(`Build: ${BUILD_STAMP}`, 0.95);

  const keys = mkLine(`Keys: [E] Export  [I] Import  [M] Memory  [T] Thoughts  [H] History  [C] Colors  [?] Help`, 0.78);
  const view = mkLine(`View: drag rotate • scroll/pinch zoom • hold = freeze`, 0.70);

  const statusLine = mkLine("", 0.86);
  statusLine.style.marginTop = "6px";
  statusLine.style.whiteSpace = "pre";

  function status(msg) {
    statusLine.textContent = msg;
    window.__dbTools.lastStatus = { msg, t: Date.now() };
    clearTimeout(status._t);
    status._t = setTimeout(()=>{ statusLine.textContent = ""; }, 1400);
  }
  window.__dbTools.status = status;

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "8px";
  row.style.marginTop = "8px";

  const mkBtn = (label, hint) => {
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
  };

  const keyGuess = () => {
    try {
      if (typeof STATE_KEY !== "undefined" && STATE_KEY) return STATE_KEY;
    } catch(e) {}
    try {
      const hits = [];
      for (let i=0;i<localStorage.length;i++) {
        const k = localStorage.key(i);
        if(!k) continue;
        if(k.startsWith("digital_brain_organism") || k.includes("digital_brain")) hits.push(k);
      }
      hits.sort((a,b)=> (b.includes("organism")-a.includes("organism")) || (b.length-a.length));
      return hits[0] || null;
    } catch(e) {
      return null;
    }
  };

  const trySave = () => { try { if (typeof saveState === "function") saveState(); } catch(e) {} };

  const download = (blob, fname) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  };

  function exportState() {
    trySave();
    const k = keyGuess();
    let state = null;
    try {
      const raw = k ? localStorage.getItem(k) : null;
      state = raw ? JSON.parse(raw) : null;
    } catch(e) { state = null; }

    const dump = {};
    try {
      for (let i=0;i<localStorage.length;i++) {
        const kk = localStorage.key(i);
        if(kk && kk.startsWith("digital_brain")) dump[kk] = localStorage.getItem(kk);
      }
    } catch(e) {}

    const payload = {
      kind: "digital_brain_state_export",
      exportedAt: new Date().toISOString(),
      buildStamp: BUILD_STAMP,
      env: ENV,
      origin: location.origin,
      stateKey: k,
      state,
      localStorage: dump
    };

    const json = JSON.stringify(payload, null, 2);
    const fname = `DigitalBrain_state_${BUILD_STAMP.replace(/[: ]/g,"-")}.json`;
    download(new Blob([json], {type:"application/json"}), fname);
    status(`exported → ${fname}`);
  }

  function importPayload(payload) {
    if(!payload) return false;
    let useKey = keyGuess();

    try {
      if(payload.kind === "digital_brain_state_export") {
        if(payload.stateKey) useKey = payload.stateKey;

        if(payload.localStorage && typeof payload.localStorage === "object") {
          for(const [kk,v] of Object.entries(payload.localStorage)) {
            if(!kk.startsWith("digital_brain")) continue;
            if(typeof v === "string") localStorage.setItem(kk, v);
          }
        } else if(payload.state && typeof payload.state === "object" && useKey) {
          localStorage.setItem(useKey, JSON.stringify(payload.state));
        }
      } else if(typeof payload === "object" && useKey) {
        localStorage.setItem(useKey, JSON.stringify(payload));
      }
    } catch(e) {
      return false;
    }

    status("imported → reloading…");
    setTimeout(()=>location.reload(), 220);
    return true;
  }

  function importState() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if(!f) return;
      try {
        const txt = await f.text();
        const payload = JSON.parse(txt);
        if(!importPayload(payload)) status("import failed (bad format)");
      } catch(e) {
        status("import failed (invalid json)");
      }
    };
    inp.click();
  }

  function resetState() {
    const k = keyGuess();
    if(!k) { status("reset failed (no state key)"); return; }
    if(!confirm("Reset saved state (localStorage) and reload?")) return;

    try {
      const rm = [];
      for(let i=0;i<localStorage.length;i++) {
        const kk = localStorage.key(i);
        if(kk && kk.startsWith("digital_brain")) rm.push(kk);
      }
      for(const kk of rm) localStorage.removeItem(kk);
    } catch(e) {}

    status("reset → reloading…");
    setTimeout(()=>location.reload(), 220);
  }

  const exportBtn = mkBtn("EXPORT  [E]", "Export state JSON (E)");
  const importBtn = mkBtn("IMPORT  [I]", "Import state JSON (I)");
  const resetBtn  = mkBtn("RESET", "Reset local state (button)");

  exportBtn.onclick = exportState;
  importBtn.onclick = importState;
  resetBtn.onclick  = resetState;

  row.appendChild(exportBtn);
  row.appendChild(importBtn);
  row.appendChild(resetBtn);

  // Help (toggle with ?)
  const help = document.createElement("div");
  help.style.marginTop = "8px";
  help.style.paddingTop = "8px";
  help.style.borderTop = "1px solid rgba(255,255,255,0.10)";
  help.style.opacity = "0.86";
  help.style.display = "none";
  help.textContent =
`HELP
View: drag rotate • scroll/pinch zoom • hold = freeze drift
Keys: E export • I import • M memory • T thoughts • H history • C colors • ? help
Tip: EXPORT before experiments so you can restore the exact state.`;

  let helpOn = false;
  function toggleHelp() {
    helpOn = !helpOn;
    help.style.display = helpOn ? "block" : "none";
    status(helpOn ? "help on" : "help off");
  }

  document.addEventListener("DOMContentLoaded", () => {
    box.appendChild(title);
    box.appendChild(build);
    box.appendChild(keys);
    box.appendChild(view);
    box.appendChild(statusLine);
    box.appendChild(row);
    box.appendChild(help);
    document.body.appendChild(box);
  });

  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;

    const k = e.key;

    if(k === "e" || k === "E" || k === "b" || k === "B") exportState();
    if(k === "i" || k === "I") importState();
    if(k === "?" || k === "/") toggleHelp();
  });
})();
