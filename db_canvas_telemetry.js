
(() => {
  const S = (window.DB_TELEMETRY = window.DB_TELEMETRY || {});
  S.source = "canvas_arc";
  let raw = [];
  let mainCanvas = null;
  let patched = false;

  function pickMainCanvas(){
    const canvases = Array.from(document.querySelectorAll("canvas"));
    if (!canvases.length) return null;
    let best = canvases[0], bestA = 0;
    for (const c of canvases){
      const r = c.getBoundingClientRect();
      const a = Math.max(0,r.width)*Math.max(0,r.height);
      if (a > bestA){ bestA = a; best = c; }
    }
    return best;
  }

  function xformPoint(ctx, x, y){
    try{
      if (ctx.getTransform){
        const m = ctx.getTransform();
        return {x: m.a*x + m.c*y + m.e, y: m.b*x + m.d*y + m.f};
      }
    } catch(e) {}
    return {x:x, y:y};
  }

  function patch(){
    if (patched) return;
    patched = true;
    const proto = CanvasRenderingContext2D.prototype;
    const origArc = proto.arc;
    proto.arc = function(x, y, r, sAngle, eAngle, ccw){
      if (!mainCanvas) mainCanvas = pickMainCanvas();
      if (mainCanvas && this.canvas === mainCanvas){
        const p = xformPoint(this, x, y);
        raw.push([p.x, p.y, r]);
      }
      return origArc.call(this, x, y, r, sAngle, eAngle, ccw);
    };
  }

  function tick(){
    requestAnimationFrame(tick);
    if (!mainCanvas) mainCanvas = pickMainCanvas();
    patch();
    if (!mainCanvas) return;

    if (raw.length){
      const max = 1200;
      const step = Math.max(1, Math.floor(raw.length / max));
      const nodes = [];
      for (let i=0;i<raw.length;i+=step){
        const p = raw[i];
        nodes.push({x:p[0], y:p[1], z:0, sx:p[0], sy:p[1], r:p[2]});
      }
      S.nodes = nodes;
      S.t = performance.now();
      S.canvas = {w: mainCanvas.width, h: mainCanvas.height};
    }
    raw.length = 0;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick, {once:true});
  } else {
    tick();
  }
})();
