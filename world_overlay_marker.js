/* world_overlay_marker.js — makes organism movement obvious
   Draws a ring that tracks agent.x/agent.y over the bottom (world) canvas.
*/
(() => {
  function findWorldCanvas(){
    const byId = document.getElementById("world") || document.getElementById("worldCanvas");
    if(byId && byId.tagName === "CANVAS") return byId;

    const canvases = Array.from(document.querySelectorAll("canvas"));
    if(canvases.length === 0) return null;
    if(canvases.length === 1) return canvases[0];

    // Choose the bottom-most canvas on screen (highest top value)
    let best = null;
    let bestTop = -1e9;
    for(const c of canvases){
      const r = c.getBoundingClientRect();
      if(r.height < 40 || r.width < 100) continue;
      if(r.top > bestTop){
        bestTop = r.top;
        best = c;
      }
    }
    return best || canvases[canvases.length - 1];
  }

  const ring = document.createElement("div");
  ring.id = "dbAgentRing";
  ring.style.position = "fixed";
  ring.style.zIndex = "999995";
  ring.style.width = "16px";
  ring.style.height = "16px";
  ring.style.borderRadius = "999px";
  ring.style.border = "2px solid rgba(255,255,255,0.75)";
  ring.style.boxShadow = "0 0 14px rgba(255,255,255,0.18)";
  ring.style.pointerEvents = "none";
  ring.style.opacity = "0";
  ring.style.transform = "translate(-9999px,-9999px)";

  let canvas = null;

  function tick(){
    if(!canvas) canvas = findWorldCanvas();
    if(!canvas){
      ring.style.opacity = "0";
      requestAnimationFrame(tick);
      return;
    }

    const a = (typeof agent !== "undefined") ? agent : null;
    const x = a && Number.isFinite(a.x) ? a.x : null;
    const y = a && Number.isFinite(a.y) ? a.y : null;
    if(x === null || y === null){
      ring.style.opacity = "0";
      requestAnimationFrame(tick);
      return;
    }

    const r = canvas.getBoundingClientRect();
    const px = r.left + x * r.width;
    const py = r.top  + y * r.height;

    ring.style.opacity = "0.85";
    ring.style.transform = `translate(${(px-8).toFixed(1)}px, ${(py-8).toFixed(1)}px)`;

    // pulse slightly when moving
    const vx = a && Number.isFinite(a.vx) ? a.vx : 0;
    const vy = a && Number.isFinite(a.vy) ? a.vy : 0;
    const sp = Math.sqrt(vx*vx + vy*vy);
    ring.style.borderColor = sp > 0.003 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)";

    requestAnimationFrame(tick);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    document.body.appendChild(ring);
    requestAnimationFrame(tick);
  });
})();
