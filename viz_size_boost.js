/* viz_size_boost.js — make nodes/lines larger by default (safe)
   - bumps default zoom
   - optionally thickens strokes + enlarges arcs IF no other canvas patch is already present
*/
(() => {
  if (window.__dbSizeBoostInstalled) return;
  window.__dbSizeBoostInstalled = true;

  const CFG = {
    zoomMin: 1.45,     // <-- main knob (makes everything larger)
    nodeScale: 1.28,   // arc radius multiplier (nodes)
    lineScale: 1.18    // stroke width multiplier (connections)
  };

  // If another patch system exists, avoid double-scaling; just bump zoom.
  const P = CanvasRenderingContext2D.prototype;
  const otherPatched = !!(P.__dbVizPatched || P.__dbPatched || P.__dbSizeBoostPatched);

  let brainCanvas = null;
  function pickBrainCanvas(){
    const canvases = Array.from(document.querySelectorAll("canvas"));
    let best = null, bestTop = 1e9;
    for (const c of canvases){
      const r = c.getBoundingClientRect();
      if (r.width < 260 || r.height < 160) continue;
      if (r.top < bestTop){
        bestTop = r.top;
        best = c;
      }
    }
    return best;
  }

  function isBrain(ctx){
    if (!ctx || !ctx.canvas) return false;
    if (!brainCanvas) brainCanvas = pickBrainCanvas();
    return !!brainCanvas && ctx.canvas === brainCanvas;
  }

  if (!otherPatched){
    P.__dbSizeBoostPatched = true;

    const _arc = P.arc;
    P.arc = function(x,y,r,a,b,c){
      try{ if(isBrain(this)) r *= CFG.nodeScale; }catch(e){}
      return _arc.call(this, x,y,r,a,b,c);
    };

    const _stroke = P.stroke;
    P.stroke = function(...args){
      try{
        if(isBrain(this)){
          const lw = this.lineWidth;
          this.lineWidth = lw * CFG.lineScale;
          const out = _stroke.apply(this, args);
          this.lineWidth = lw;
          return out;
        }
      }catch(e){}
      return _stroke.apply(this, args);
    };
  }

  function boostZoom(){
    try{
      if (window.view && typeof view.zoom === "number"){
        view.zoom = Math.max(view.zoom, CFG.zoomMin);
        return;
      }
    }catch(e){}
    setTimeout(boostZoom, 120);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    boostZoom();
    // pick brain canvas after layout stabilizes
    setTimeout(()=>{ brainCanvas = pickBrainCanvas(); }, 350);
  });
})();
