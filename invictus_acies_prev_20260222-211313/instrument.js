(() => {
  const PROJECT = "POLEMOS 2";
  const EXPECTED = { active: 157, total: 297, canvas: "27×11" };

  function setText(sel, txt) {
    const el = document.querySelector(sel);
    if (el) el.textContent = txt;
    return !!el;
  }

  function ensureProbeEl() {
    let el = document.getElementById("truthProbe");
    if (el) return el;

    el = document.createElement("div");
    el.id = "truthProbe";
    el.style.position = "fixed";
    el.style.top = "8px";
    el.style.right = "8px";
    el.style.zIndex = "9999";
    el.style.background = "rgba(0,0,0,0.72)";
    el.style.border = "1px solid #444";
    el.style.borderRadius = "8px";
    el.style.padding = "6px 8px";
    el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
    el.style.fontSize = "12px";
    el.style.color = "#eee";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    return el;
  }

  async function fetchKV(path) {
    const url = `${path}?ts=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const kv = {};
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
      if (m) kv[m[1]] = m[2];
    }
    return kv;
  }

  function boardCounts() {
    const total = document.querySelectorAll("svg .hex").length;
    const active = document.querySelectorAll("svg .hex.active").length;
    const inactive = document.querySelectorAll("svg .hex.inactive").length;
    return { total, active, inactive };
  }

  function fmtBoardSig(c) {
    const okA = (c.active === EXPECTED.active) ? "OK" : "??";
    const okT = (c.total  === EXPECTED.total)  ? "OK" : "??";
    return `BOARD ${EXPECTED.canvas}  active ${c.active}/${EXPECTED.active}(${okA})  total ${c.total}/${EXPECTED.total}(${okT})`;
  }

  async function main() {
    // Rename-in-UI (non-destructive; only touches visible labels if they exist)
    document.title = PROJECT;
    setText(".title", PROJECT.toUpperCase());
    setText("#projectName", PROJECT);

    let build = "NONE";
    try {
      const kv = await fetchKV("./ANCHOR.txt");
      build = kv.BUILD || kv.BUILD_ID || build;
    } catch (e) {
      build = "NO_ANCHOR";
    }

    // Update header badge if present
    setText("#buildId", build);

    // Wait briefly for SVG to render, then compute board signature
    let counts = { total: 0, active: 0, inactive: 0 };
    for (let i = 0; i < 30; i++) {
      counts = boardCounts();
      if (counts.total > 0) break;
      await new Promise(r => requestAnimationFrame(() => r()));
    }

    const probe = ensureProbeEl();
    probe.textContent = `${PROJECT}  BUILD ${build}  |  ${fmtBoardSig(counts)}`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
  } else {
    main();
  }
})();