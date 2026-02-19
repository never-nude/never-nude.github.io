const $ = (sel) => document.querySelector(sel);

async function fetchText(path) {
  const r = await fetch(path + "?ts=" + Date.now(), { cache: "no-store" });
  return await r.text();
}
async function fetchJSON(path) {
  const r = await fetch(path + "?ts=" + Date.now(), { cache: "no-store" });
  return await r.json();
}

function setupBoard(layout) {
  const canvas = $("#hexCanvas");
  const ctx = canvas.getContext("2d");
  const hoverEl = $("#hoverInfo");

  let drawn = [];   // [{r,c,cx,cy}]
  let hover = null;
  let gLast = null;

  function computeGeometry() {
    const cols = layout.cols;
    const rows = layout.rows;
    const dpr = window.devicePixelRatio || 1;

    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const margin = 18;
    const sqrt3 = Math.sqrt(3);

    const sW = (W - margin * 2) / ((cols + 0.5) * sqrt3);
    const sH = (H - margin * 2) / (1.5 * rows + 0.5);
    const s = Math.max(6, Math.min(30, Math.min(sW, sH)));

    const hexW = sqrt3 * s;
    const vStep = 1.5 * s;

    const boardW = (cols + 0.5) * hexW;
    const boardH = (rows - 1) * vStep + 2 * s;

    const offsetX = Math.max(margin, (W - boardW) / 2);
    const offsetY = Math.max(margin, (H - boardH) / 2);

    return { W, H, s, hexW, vStep, offsetX, offsetY };
  }

  function centerOf(r, c, g) {
    const cx = g.offsetX + (c * g.hexW) + ((r % 2) * g.hexW / 2) + g.hexW / 2;
    const cy = g.offsetY + (r * g.vStep) + g.s;
    return { cx, cy };
  }

  function hexPath(cx, cy, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 30);
      const x = cx + s * Math.cos(ang);
      const y = cy + s * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function render() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const g = computeGeometry();
    gLast = g;

    ctx.clearRect(0, 0, g.W, g.H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, g.W, g.H);

    drawn = layout.hexes.map(({ r, c }) => {
      const { cx, cy } = centerOf(r, c, g);
      return { r, c, cx, cy };
    });

    ctx.lineWidth = 1;
    for (const h of drawn) {
      const isHover = hover && hover.r === h.r && hover.c === h.c;

      hexPath(h.cx, h.cy, g.s);
      ctx.fillStyle = isHover ? "#e6f2ff" : "#f7f7f7";
      ctx.strokeStyle = isHover ? "#2563eb" : "#b0b0b0";
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = "#666";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText(`Bastion: ${layout.live_hexes} live hexes (27×11)`, 12, g.H - 12);
  }

  function pick(mx, my) {
    if (!gLast || drawn.length === 0) return null;

    let best = null;
    let bestD = Infinity;
    for (const h of drawn) {
      const dx = mx - h.cx;
      const dy = my - h.cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = h; }
    }
    const thresh = (gLast.s * 1.08) * (gLast.s * 1.08);
    return (best && bestD <= thresh) ? best : null;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    render();
  }

  canvas.addEventListener("mousemove", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;

    const h = pick(mx, my);
    const changed = (!hover && h) || (hover && !h) || (hover && h && (hover.r !== h.r || hover.c !== h.c));
    if (!changed) return;

    hover = h;
    hoverEl.textContent = hover ? `hover: row ${hover.r}, col ${hover.c}` : "hover: —";
    render();
  });

  canvas.addEventListener("mouseleave", () => {
    hover = null;
    hoverEl.textContent = "hover: —";
    render();
  });

  window.addEventListener("resize", resize);
  hoverEl.textContent = "hover: —";
  resize();
}

async function main() {
  try {
    const truth = (await fetchText("TRUTH.txt")).trim();
    $("#truth").textContent = truth || "(TRUTH empty)";
  } catch {
    $("#truth").textContent = "TRUTH.txt failed to load";
  }

  const layout = await fetchJSON("board_layout.json");
  setupBoard(layout);
}

main();
