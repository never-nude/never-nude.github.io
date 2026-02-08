/* pause_time_freeze.js — real pause + real hold-freeze
   P toggles pause. Holding the brain canvas also freezes time.
   Goal: sim time stops, but rendering continues, so you can rotate/zoom while frozen.
*/
(() => {
  if (window.__dbTimeFreezeInstalled) return;
  window.__dbTimeFreezeInstalled = true;

  window.__dbPaused = !!window.__dbPaused;
  window.__dbHoldFreeze = false;

  const origDateNow = Date.now.bind(Date);
  const origPerfNow = (performance && performance.now) ? performance.now.bind(performance) : () => origDateNow();

  let frozenDate = null;
  let frozenPerf = null;
  let frozenRAF  = null;

  function shouldFreeze(){
    return !!(window.__dbPaused || window.__dbHoldFreeze);
  }

  function perfNow(){
    if (!shouldFreeze()){
      frozenPerf = null;
      return origPerfNow();
    }
    if (frozenPerf === null) frozenPerf = origPerfNow();
    return frozenPerf;
  }

  // Freeze Date.now epoch too (separately)
  Date.now = () => {
    if (!shouldFreeze()){
      frozenDate = null;
      return origDateNow();
    }
    if (frozenDate === null) frozenDate = origDateNow();
    return frozenDate;
  };

  try { performance.now = perfNow; } catch(e){}

  const origRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => origRAF((ts) => {
    if (shouldFreeze()){
      if (frozenRAF === null) frozenRAF = ts;
      cb(frozenRAF);
    } else {
      frozenRAF = null;
      cb(ts);
    }
  });

  // Small HUD (non-obtrusive)
  let hud = null;
  function mountHud(){
    if (hud) return;
    hud = document.createElement("div");
    hud.id = "dbPauseHud";
    hud.style.position = "fixed";
    hud.style.right = "12px";
    hud.style.bottom = "12px";
    hud.style.zIndex = "999999";
    hud.style.padding = "6px 8px";
    hud.style.borderRadius = "10px";
    hud.style.border = "1px solid rgba(255,255,255,0.14)";
    hud.style.background = "rgba(0,0,0,0.35)";
    hud.style.color = "rgba(255,255,255,0.75)";
    hud.style.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
    hud.style.pointerEvents = "none";
    hud.style.display = "none";
    document.body.appendChild(hud);
  }

  function updateHud(){
    if (!hud) return;
    const paused = window.__dbPaused;
    const holding = window.__dbHoldFreeze && !paused;
    if (paused){
      hud.textContent = "PAUSED  [P]";
      hud.style.display = "block";
      return;
    }
    if (holding){
      hud.textContent = "HOLD FREEZE";
      hud.style.display = "block";
      return;
    }
    hud.style.display = "none";
  }

  function pickBrainCanvas(){
    const canvases = Array.from(document.querySelectorAll("canvas"));
    let best = null, bestTop = 1e9;
    for (const c of canvases){
      const r = c.getBoundingClientRect();
      if (r.width < 260 || r.height < 160) continue;
      if (r.top < bestTop){ bestTop = r.top; best = c; }
    }
    return best;
  }

  function attachHold(){
    const c = pickBrainCanvas();
    if (!c){ setTimeout(attachHold, 250); return; }
    if (c.__dbHoldHooked) return;
    c.__dbHoldHooked = true;

    const on = () => { window.__dbHoldFreeze = true; updateHud(); };
    const off = () => { window.__dbHoldFreeze = false; updateHud(); };

    c.addEventListener("pointerdown", on, {passive:true});
    window.addEventListener("pointerup", off, {passive:true});
    window.addEventListener("pointercancel", off, {passive:true});
  }

  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "p" || e.key === "P"){
      window.__dbPaused = !window.__dbPaused;
      updateHud();
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    mountHud();
    updateHud();
    attachHold();
  });
})();
