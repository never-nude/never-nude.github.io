(function(){
  const $ = (sel) => document.querySelector(sel);
  const build = window.AD_ARMA_BUILD_ID || "UNKNOWN";
  const feature = window.AD_ARMA_FEATURE || "SCENARIO_TOOLS_V0_TYPE5_LOCKED";

  const UNIT_TYPES = ["Cavalry","Infantry","Slingers","Archers","General"];
  const QUALITIES  = ["Green","Regular","Veteran"];
  const SIDES      = ["Blue","Red"];

  const ROW_COUNTS = [12,13,14,15,16,17,16,15,14,13,12];
  const ROWS = ROW_COUNTS.length;

  const SIZE = 28;
  const SQRT3 = Math.sqrt(3);
  const toPixel = (q, r) => ({ x: SQRT3 * SIZE * (q + r/2), y: 1.5 * SIZE * r });

  const state = {
    meta: { build, feature },
    board: { cells: [], viewBox: "0 0 10 10", selectedCellId: null, selectedUnitId: null, midX: 0 },
    scenarios: { index: [], loadedLabel: "none" },
    units: [],
    nextUnitId: 1,
    ui: { editMode: true, tool: "place", side: "Blue", type: "Infantry", quality: "Regular", pings: 0 }
  };
  window.AD_ARMA_STATE = state;

  function stamp(){ return new Date().toISOString(); }
  function log(msg){
    const el = $("#log");
    el.textContent = (el.textContent ? el.textContent + "\n" : "") + msg;
  }

  function scriptSanityCheck(){
    const allow = new Set(["build.js","main.js"]);
    const loaded = [...document.scripts]
      .map(s => s.getAttribute("src"))
      .filter(Boolean)
      .map(src => src.split("?")[0].split("#")[0].split("/").pop());

    const unexpected = loaded.filter(name => name.endsWith(".js") && !allow.has(name));
    if (unexpected.length){
      log(`[sanity] WARNING unexpected scripts: ${unexpected.join(", ")}`);
      console.warn("[Ad Arma v2] unexpected scripts:", unexpected);
    }else{
      log("[sanity] scripts OK (build.js + main.js only)");
    }
  }

  function hexPoints(cx, cy, s){
    const pts = [];
    for (let i=0;i<6;i++){
      const angle = (Math.PI/180) * (60*i - 30);
      pts.push(`${(cx + s*Math.cos(angle)).toFixed(2)},${(cy + s*Math.sin(angle)).toFixed(2)}`);
    }
    return pts.join(" ");
  }

  function buildBoard(){
    const cells = [];
    const rOffset = Math.floor(ROWS/2);
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;

    for (let row=0; row<ROWS; row++){
      const r = row - rOffset;
      const count = ROW_COUNTS[row];
      let qMin = -((r + (count - 1)) / 2);
      if (!Number.isInteger(qMin)) qMin = Math.round(qMin);

      for (let i=0;i<count;i++){
        const q = qMin + i;
        const {x,y} = toPixel(q,r);
        minX = Math.min(minX, x - SIZE); maxX = Math.max(maxX, x + SIZE);
        minY = Math.min(minY, y - SIZE); maxY = Math.max(maxY, y + SIZE);
        cells.push({ id: `${q},${r}`, q, r, x, y, points: hexPoints(x,y,SIZE) });
      }
    }

    state.board.midX = (minX + maxX)/2;
    const margin = SIZE * 1.4;
    state.board.viewBox = `${(minX-margin).toFixed(2)} ${(minY-margin).toFixed(2)} ${((maxX-minX)+margin*2).toFixed(2)} ${((maxY-minY)+margin*2).toFixed(2)}`;
    state.board.cells = cells;

    log(`[board] built rows=${ROWS} total=${cells.length} rowCounts=[${ROW_COUNTS.join(",")}]`);
  }

  function cellById(id){
    const [qs, rs] = String(id).split(",");
    const q = Number(qs), r = Number(rs);
    return state.board.cells.find(c => c.q === q && c.r === r) || null;
  }

  function unitAt(q,r){ return state.units.find(u => u.q === q && u.r === r) || null; }

  function typeLetter(type){
    if (type === "Cavalry") return "C";
    if (type === "Infantry") return "I";
    if (type === "Slingers") return "S";
    if (type === "Archers") return "A";
    if (type === "General") return "G";
    // accept older synonyms
    if (type === "Missiles") return "S";
    return String(type||"?").slice(0,1).toUpperCase() || "?";
  }
  function qualLetter(q){
    if (q === "Green") return "G";
    if (q === "Regular") return "R";
    if (q === "Veteran") return "V";
    return "?";
  }

  function unitTypeClass(t){
    if (t === "General") return "unitGeneral";
    if (t === "Archers") return "unitArchers";
    if (t === "Slingers") return "unitSlingers";
    return "";
  }

  function normalizeUnit(u){
    const q = Number(u.q), r = Number(u.r);
    const side = SIDES.includes(u.side) ? u.side : "Blue";
    const type = UNIT_TYPES.includes(u.type) ? u.type : (u.type==="Missiles" ? "Slingers" : "Infantry");
    const quality = QUALITIES.includes(u.quality) ? u.quality : "Regular";
    if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
    return { q, r, side, type, quality };
  }

  function placeOrUpdateUnit(q,r){
    const existing = unitAt(q,r);
    if (existing){
      existing.side = state.ui.side;
      existing.type = state.ui.type;
      existing.quality = state.ui.quality;
      state.board.selectedUnitId = existing.id;
      log(`[edit] updated ${existing.id} @ ${q},${r} -> ${existing.side} ${existing.type} ${existing.quality}`);
      return;
    }
    const u = { id:`u${state.nextUnitId++}`, q, r, side: state.ui.side, type: state.ui.type, quality: state.ui.quality };
    state.units.push(u);
    state.board.selectedUnitId = u.id;
    log(`[edit] placed ${u.id} @ ${q},${r} -> ${u.side} ${u.type} ${u.quality}`);
  }

  function eraseUnit(q,r){
    const before = state.units.length;
    state.units = state.units.filter(u => !(u.q===q && u.r===r));
    if (state.units.length !== before) log(`[edit] erased unit @ ${q},${r}`);
  }

  function renderBoard(){
    const svg = $("#board");
    svg.setAttribute("viewBox", state.board.viewBox);

    const selCell = state.board.selectedCellId;
    const selUnit = state.board.selectedUnitId;

    const parts = [];
    parts.push('<g id="hexes">');
    for (const c of state.board.cells){
      const cls = (c.id === selCell) ? "hex selected" : "hex";
      parts.push(`<polygon class="${cls}" data-cell-id="${c.id}" points="${c.points}" vector-effect="non-scaling-stroke"></polygon>`);
    }
    parts.push("</g>");

    parts.push('<g id="units">');
    for (const u of state.units){
      const cell = cellById(`${u.q},${u.r}`);
      if (!cell) continue;

      const isSel = (u.id === selUnit);
      const clsSide = (u.side === "Red") ? "unitRed" : "unitBlue";
      const cls = [isSel ? "unitSelected" : "", unitTypeClass(u.type)].filter(Boolean).join(" ");
      const rTok = 14;

      parts.push(
        `<g data-unit-id="${u.id}" transform="translate(${cell.x.toFixed(2)} ${cell.y.toFixed(2)})" class="${cls}">` +
          `<circle class="unitCircle ${clsSide}" r="${rTok}"></circle>` +
          `<text class="unitTextMain" y="-2">${typeLetter(u.type)}</text>` +
          `<text class="unitTextQual" y="11">${qualLetter(u.quality)}</text>` +
        `</g>`
      );
    }
    parts.push("</g>");

    svg.innerHTML = parts.join("");

    $("#unitCount").textContent = String(state.units.length);
    $("#selected").textContent = selCell || "none";
    $("#loadedScenario").textContent = state.scenarios.loadedLabel || "none";
    $("#boardMeta").textContent = `board: rows=${ROWS} total=${state.board.cells.length} (expected 157) units=${state.units.length} scenario=${state.scenarios.loadedLabel}`;
  }

  async function loadTruth(){
    try{
      const res = await fetch(`TRUTH.txt?ts=${Date.now()}`, { cache:"no-store" });
      $("#truth").textContent = (await res.text()).trim();
      log(`[truth] loaded @ ${stamp()}`);
    }catch(e){
      $("#truth").textContent = "TRUTH fetch failed";
      log(`[truth] ERROR: ${String(e)}`);
    }
  }

  async function loadScenarioIndex(){
    const sel = $("#scenarioSel");
    try{
      const res = await fetch(`scenarios/index.json?ts=${Date.now()}`, { cache:"no-store" });
      const list = await res.json();
      if (!Array.isArray(list)) throw new Error("index.json is not an array");
      state.scenarios.index = list;

      sel.innerHTML = "";
      for (const s of list){
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.label;
        sel.appendChild(opt);
      }
      if (list.some(s => s.id === "demo_lines")) sel.value = "demo_lines";
      state.scenarios.loadedLabel = "none";
      log(`[scenario] index loaded (${list.length})`);
    }catch(e){
      sel.innerHTML = `<option value="">(no scenarios)</option>`;
      log(`[scenario] ERROR loading index: ${String(e)}`);
    }
  }

  async function loadScenarioById(id){
    const hit = state.scenarios.index.find(s => s.id === id);
    if (!hit){ log(`[scenario] not found: ${id}`); return; }
    try{
      const res = await fetch(`scenarios/${hit.file}?ts=${Date.now()}`, { cache:"no-store" });
      const data = await res.json();
      const unitsRaw = Array.isArray(data.units) ? data.units : [];
      const units = [];
      for (const u of unitsRaw){
        const nu = normalizeUnit(u);
        if (nu) units.push(nu);
      }
      state.units = units.map((u,i)=>({ id:`u${i+1}`, ...u }));
      state.nextUnitId = state.units.length + 1;
      state.board.selectedCellId = null;
      state.board.selectedUnitId = null;
      state.scenarios.loadedLabel = hit.label;
      renderBoard();
      log(`[scenario] loaded ${hit.label} units=${state.units.length}`);
    }catch(e){
      log(`[scenario] ERROR loading ${id}: ${String(e)}`);
    }
  }

  function exportScenario(){
    const ts = new Date().toISOString().replace(/[:.]/g,"-");
    const payload = {
      version: 1,
      schema: "AD_ARMA_V2_SCENARIO_V1",
      exportedAt: ts,
      units: state.units.map(u => ({ q:u.q, r:u.r, side:u.side, type:u.type, quality:u.quality })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ad-arma-scenario_${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    log(`[export] downloaded scenario JSON (${payload.units.length} units)`);
  }

  async function importScenarioFile(file){
    try{
      const txt = await file.text();
      const data = JSON.parse(txt);
      const unitsRaw = Array.isArray(data.units) ? data.units : [];
      const units = [];
      for (const u of unitsRaw){
        const nu = normalizeUnit(u);
        if (nu) units.push(nu);
      }
      state.units = units.map((u,i)=>({ id:`u${i+1}`, ...u }));
      state.nextUnitId = state.units.length + 1;
      state.board.selectedCellId = null;
      state.board.selectedUnitId = null;
      state.scenarios.loadedLabel = `Imported: ${file.name}`;
      renderBoard();
      log(`[import] loaded ${file.name} units=${state.units.length}`);
    }catch(e){
      log(`[import] ERROR: ${String(e)}`);
    }
  }

  function syncUI(){
    state.ui.editMode = $("#editMode").checked;
    state.ui.tool = document.querySelector('input[name="tool"]:checked')?.value || "place";
    state.ui.side = $("#sideSel").value;
    state.ui.type = $("#typeSel").value;
    state.ui.quality = $("#qualSel").value;
  }

  function init(){
    $("#build").textContent = `Ad Arma v2 — BUILD ${build} — ${window.location.pathname}`;
    $("#tagline").textContent = "Instrument for thinking in formations.";

    const truthEl = $("#truth");
    truthEl.classList.remove("open");
    $("#truthToggle").addEventListener("click", () => {
      const open = truthEl.classList.toggle("open");
      $("#truthToggle").textContent = open ? "Truth ▾" : "Truth ▸";
      $("#truthToggle").setAttribute("aria-expanded", open ? "true" : "false");
    });

    buildBoard();
    syncUI();
    renderBoard();

    $("#controls").addEventListener("change", () => { syncUI(); });

    $("#board").addEventListener("click", (e) => {
      syncUI();

      const unitG = e.target.closest("g[data-unit-id]");
      if (unitG){
        const uid = unitG.getAttribute("data-unit-id");
        const u = state.units.find(x => x.id === uid);
        if (!u) return;
        state.board.selectedUnitId = uid;
        state.board.selectedCellId = `${u.q},${u.r}`;
        if (state.ui.editMode){
          if (state.ui.tool === "erase") eraseUnit(u.q,u.r);
          if (state.ui.tool === "place") placeOrUpdateUnit(u.q,u.r);
        }
        renderBoard();
        return;
      }

      const poly = e.target.closest("polygon[data-cell-id]");
      if (!poly) return;
      const id = poly.getAttribute("data-cell-id");
      state.board.selectedCellId = id;

      const [qs, rs] = id.split(",");
      const q = Number(qs), r = Number(rs);

      if (state.ui.editMode){
        if (state.ui.tool === "place") placeOrUpdateUnit(q,r);
        if (state.ui.tool === "erase") eraseUnit(q,r);
      }
      renderBoard();
    });

    $("#scenarioLoad").addEventListener("click", ()=> {
      const id = $("#scenarioSel").value;
      if (id) loadScenarioById(id);
    });

    $("#scenarioExport").addEventListener("click", exportScenario);

    const fileInput = $("#scenarioFile");
    $("#scenarioImport").addEventListener("click", ()=> fileInput.click());
    fileInput.addEventListener("change", async ()=> {
      const f = fileInput.files && fileInput.files[0];
      if (f) await importScenarioFile(f);
      fileInput.value = "";
    });

    $("#ping").addEventListener("click", ()=> {
      state.ui.pings += 1;
      $("#pings").textContent = String(state.ui.pings);
      log(`[ping] #${state.ui.pings} @ ${stamp()} build=${build}`);
    });

    scriptSanityCheck();
    loadTruth();
    loadScenarioIndex();
    log(`[boot] init @ ${stamp()} build=${build} feature=${feature}`);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();