(function(){
  const $ = (s) => document.querySelector(s);
  const BUILD = window.HEX_TACTICS_BUILD_ID || "UNKNOWN";
  const DIR = new URL(".", window.location.href);

  const SCHEMA_ID = "dbd-scn-0.1";
  const BOARD_ID  = "DBD-157-v1";

  function stamp(){ return new Date().toISOString(); }
  function log(msg){
    const el = $("#log");
    el.textContent = (el.textContent ? el.textContent + "\n" : "") + msg;
  }

  const ROW_COUNTS = [12,13,14,15,16,17,16,15,14,13,12];
  const ROWS = ROW_COUNTS.length;

  const MAX_HP = { Infantry:4, Cavalry:3, Skirmishers:2, Archers:2, General:4 };

  const CODE_TO_TYPE = { INF:"Infantry", CAV:"Cavalry", SKR:"Skirmishers", ARC:"Archers", GEN:"General" };
  const TYPE_TO_CODE = { Infantry:"INF", Cavalry:"CAV", Skirmishers:"SKR", Archers:"ARC", General:"GEN" };

  const CODE_TO_QUAL = { GREEN:"Green", REGULAR:"Regular", VETERAN:"Veteran" };
  const QUAL_TO_CODE = { Green:"GREEN", Regular:"REGULAR", Veteran:"VETERAN" };

  const CODE_TO_SIDE = { BLUE:"Blue", RED:"Red" };
  const SIDE_TO_CODE = { Blue:"BLUE", Red:"RED" };

  const SIZE = 28;
  const SQRT3 = Math.sqrt(3);
  const toPixel = (q, r) => ({ x: SQRT3 * SIZE * (q + r/2), y: 1.5 * SIZE * r });

  const state = {
    build: BUILD,
    feature: "SCENARIOS_V0",
    selectedCell: null,
    selectedUnitId: null,

    cells: [],
    cellMap: new Map(),      // id -> cell
    indexById: new Map(),    // id -> index (0..156)
    viewBox: "0 0 10 10",
    midX: 0,

    units: [],
    nextId: 1,

    scenarioIndex: [],
    loadedScenario: null,

    ui: {
      editMode: true,
      tool: "place",
      side: "Blue",
      type: "Infantry",
      quality: "Regular",
    }
  };
  window.HEX_TACTICS_STATE = state;

  function key(q,r){ return `${q},${r}`; }
  function cellById(id){ return state.cellMap.get(id) || null; }
  function unitAt(q,r){ return state.units.find(u => u.q===q && u.r===r) || null; }
  function unitById(id){ return state.units.find(u => u.id===id) || null; }

  function hexPoints(cx, cy, s){
    const pts = [];
    for (let i=0;i<6;i++){
      const a = (Math.PI/180) * (60*i - 30);
      pts.push(`${(cx + s*Math.cos(a)).toFixed(2)},${(cy + s*Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(" ");
  }

  function buildBoard(){
    const rOffset = Math.floor(ROWS/2);
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;

    const cells = [];
    const map = new Map();
    const indexById = new Map();

    for (let row=0; row<ROWS; row++){
      const r = row - rOffset;
      const count = ROW_COUNTS[row];

      let qMin = -((r + (count - 1)) / 2);
      if (!Number.isInteger(qMin)) qMin = Math.round(qMin);

      for (let i=0;i<count;i++){
        const q = qMin + i;
        const {x,y} = toPixel(q,r);

        minX = Math.min(minX, x - SIZE);
        maxX = Math.max(maxX, x + SIZE);
        minY = Math.min(minY, y - SIZE);
        maxY = Math.max(maxY, y + SIZE);

        const id = key(q,r);
        const idx = cells.length;

        const c = { id, index: idx, q,r,row,col:i, x,y, points: hexPoints(x,y,SIZE) };
        cells.push(c);
        map.set(id, c);
        indexById.set(id, idx);
      }
    }

    state.cells = cells;
    state.cellMap = map;
    state.indexById = indexById;
    state.midX = (minX+maxX)/2;

    const margin = SIZE*1.4;
    const vbX = minX - margin;
    const vbY = minY - margin;
    const vbW = (maxX-minX) + margin*2;
    const vbH = (maxY-minY) + margin*2;
    state.viewBox = `${vbX.toFixed(2)} ${vbY.toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}`;

    log(`[board] built rows=${ROWS} total=${cells.length} build=${BUILD}`);
  }

  function ensureStats(u){
    const mh = MAX_HP[u.type] ?? 3;
    u.maxHp = mh;
    if (u.hp == null) u.hp = mh;
    // clamp
    u.hp = Math.max(1, Math.min(u.hp, u.maxHp));
    return u;
  }

  function typeLetter(t){
    if (t==="Infantry") return "I";
    if (t==="Cavalry") return "C";
    if (t==="Skirmishers") return "S";
    if (t==="Archers") return "A";
    if (t==="General") return "G";
    return "?";
  }

  function starPoints(outerR, innerR){
    const pts = [];
    const spikes = 5;
    for (let i=0;i<spikes*2;i++){
      const r = (i % 2 === 0) ? outerR : innerR;
      const a = (Math.PI/2) + (i * Math.PI / spikes);
      const x = Math.cos(a) * r;
      const y = -Math.sin(a) * r;
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return pts.join(" ");
  }

  function shapeSvg(type, sideCls){
    if (type==="Infantry")    return `<rect class="tokenShape ${sideCls}" x="-15" y="-12" width="30" height="24" rx="6" ry="6"></rect>`;
    if (type==="Cavalry")     return `<polygon class="tokenShape ${sideCls}" points="0,-17 17,0 0,17 -17,0"></polygon>`;
    if (type==="Archers")     return `<polygon class="tokenShape ${sideCls}" points="0,-18 17,14 -17,14"></polygon>`;
    if (type==="Skirmishers") return `<circle class="tokenShape ${sideCls}" r="15"></circle>`;
    if (type==="General")     return `<polygon class="tokenShape ${sideCls}" points="${starPoints(18,8)}"></polygon>`;
    return `<circle class="tokenShape ${sideCls}" r="15"></circle>`;
  }

  function hpPips(u){
    const mh = u.maxHp ?? 3;
    const hp = u.hp ?? mh;
    const spacing = 7;
    const start = -((mh - 1) / 2) * spacing;
    const parts = [];
    for (let i=0;i<mh;i++){
      const cls = (i < hp) ? "hpFull" : "hpEmpty";
      const cx = start + i*spacing;
      parts.push(`<circle class="${cls}" cx="${cx.toFixed(2)}" cy="-26" r="2.3"></circle>`);
    }
    return parts.join("");
  }

  function qualityClass(q){
    if (q==="Green") return "qGreen";
    if (q==="Veteran") return "qVeteran";
    return "qRegular";
  }

  function syncUI(){
    state.ui.editMode = $("#editMode").checked;
    state.ui.tool = document.querySelector('input[name="tool"]:checked')?.value || "place";
    state.ui.side = $("#sideSel").value;
    state.ui.type = $("#typeSel").value;
    state.ui.quality = $("#qualSel").value;
  }

  function placeOrUpdate(q,r){
    const existing = unitAt(q,r);
    if (existing){
      existing.side = state.ui.side;
      existing.type = state.ui.type;
      existing.quality = state.ui.quality;
      ensureStats(existing);
      state.selectedUnitId = existing.id;
      log(`[edit] updated ${existing.id} @ ${q},${r} -> ${existing.side} ${existing.type} ${existing.quality}`);
      return;
    }
    const u = ensureStats({
      id: `u${state.nextId++}`,
      q,r,
      side: state.ui.side,
      type: state.ui.type,
      quality: state.ui.quality,
      hp: null,
      maxHp: null,
    });
    state.units.push(u);
    state.selectedUnitId = u.id;
    log(`[edit] placed ${u.id} @ ${q},${r} -> ${u.side} ${u.type} ${u.quality}`);
  }

  function eraseAt(q,r){
    const before = state.units.length;
    state.units = state.units.filter(u => !(u.q===q && u.r===r));
    if (state.units.length !== before){
      log(`[edit] erased unit @ ${q},${r}`);
      if (state.selectedUnitId && !state.units.some(u => u.id===state.selectedUnitId)){
        state.selectedUnitId = null;
      }
    }
  }

  function setLoadedScenarioLabel(label){
    state.loadedScenario = label || null;
    const el = $("#loadedScenario");
    if (el) el.textContent = label || "none";
  }

  async function loadScenarioIndex(){
    try{
      const url = new URL("scenarios/index.json", DIR);
      url.searchParams.set("ts", String(Date.now()));
      const res = await fetch(url.toString(), { cache: "no-store" });
      const idx = await res.json();
      state.scenarioIndex = Array.isArray(idx) ? idx : [];
      const sel = $("#scenarioSel");
      sel.innerHTML = "";
      for (const s of state.scenarioIndex){
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.label || s.id;
        sel.appendChild(opt);
      }
      $("#status").textContent = `OK • scenarios=${state.scenarioIndex.length} • build ${BUILD}`;
      log(`[scenarios] index loaded count=${state.scenarioIndex.length}`);
    }catch(e){
      $("#status").textContent = "scenario index error";
      log(`[scenarios] ERROR loading index: ${String(e)}`);
    }
  }

  function decodeUnit(u){
    const side = CODE_TO_SIDE[u.side] || "Blue";
    const type = CODE_TO_TYPE[u.type] || "Infantry";
    const quality = CODE_TO_QUAL[u.quality] || "Regular";
    const cell = state.cells[u.hex];
    if (!cell) return null;
    const mh = MAX_HP[type] ?? 3;
    const hp = Math.max(1, Math.min(Number(u.hp || mh), mh));
    return ensureStats({
      id: String(u.id || `u${state.nextId++}`),
      q: cell.q, r: cell.r,
      side, type, quality,
      hp, maxHp: mh,
    });
  }

  async function loadScenarioById(id){
    const entry = state.scenarioIndex.find(s => s.id === id);
    if (!entry){
      $("#status").textContent = "scenario not found";
      return;
    }
    try{
      const url = new URL(`scenarios/${entry.file}`, DIR);
      url.searchParams.set("ts", String(Date.now()));
      const res = await fetch(url.toString(), { cache: "no-store" });
      const scn = await res.json();

      // minimal validation (fast, legible)
      if (scn.schema !== SCHEMA_ID) throw new Error(`schema mismatch: ${scn.schema}`);
      if (scn.board !== BOARD_ID) throw new Error(`board mismatch: ${scn.board}`);
      if (!Array.isArray(scn.units)) throw new Error("units not array");

      const units = [];
      for (const raw of scn.units){
        if (typeof raw !== "object") continue;
        const du = decodeUnit(raw);
        if (du) units.push(du);
      }

      state.units = units;
      state.nextId = units.length + 1;
      state.selectedUnitId = null;
      state.selectedCell = null;

      setLoadedScenarioLabel(entry.label || entry.id);
      $("#status").textContent = `loaded: ${entry.label || entry.id}`;
      log(`[scenarios] loaded ${entry.id} units=${units.length}`);
      render();
    }catch(e){
      $("#status").textContent = "scenario load error";
      log(`[scenarios] ERROR loading ${id}: ${String(e)}`);
    }
  }

  function render(){
    $("#unitCount").textContent = String(state.units.length);

    let selText = state.selectedCell || "none";
    if (state.selectedUnitId){
      const u = unitById(state.selectedUnitId);
      if (u) selText = `${u.side} ${u.type} ${u.quality} | HP ${u.hp}/${u.maxHp} | @ ${u.q},${u.r}`;
    }
    $("#selected").textContent = selText;

    $("#meta").textContent =
      `board: rows=${ROWS} total=${state.cells.length} feature=${state.feature} loaded=${state.loadedScenario || "none"} base=${DIR.pathname}`;

    const svg = $("#board");
    svg.setAttribute("viewBox", state.viewBox);

    const parts = [];
    parts.push('<g id="hexes">');
    for (const c of state.cells){
      const cls = (c.id === state.selectedCell) ? "hex selected" : "hex";
      parts.push(`<polygon class="${cls}" data-cell="${c.id}" points="${c.points}" vector-effect="non-scaling-stroke"></polygon>`);
    }
    parts.push("</g>");

    parts.push('<g id="units">');
    for (const raw of state.units){
      const u = ensureStats(raw);
      const cell = cellById(key(u.q,u.r));
      if (!cell) continue;

      const sideCls = (u.side === "Red") ? "sideRed" : "sideBlue";
      const qcls = qualityClass(u.quality);
      const sel = (u.id === state.selectedUnitId) ? "selected" : "";

      parts.push(
        `<g class="unit ${qcls} ${sel}" data-unit="${u.id}" transform="translate(${cell.x.toFixed(2)} ${cell.y.toFixed(2)})">` +
          hpPips(u) +
          shapeSvg(u.type, sideCls) +
          `<text class="tokenLetter" y="-1">${typeLetter(u.type)}</text>` +
          `<title>${u.side} ${u.type} ${u.quality} | HP ${u.hp}/${u.maxHp} | @ ${u.q},${u.r} | hex=${cell.index}</title>` +
        `</g>`
      );
    }
    parts.push("</g>");

    svg.innerHTML = parts.join("");
  }

  async function loadTruth(){
    try{
      const url = new URL("TRUTH.txt", DIR);
      url.searchParams.set("ts", String(Date.now()));
      const res = await fetch(url.toString(), { cache: "no-store" });
      const txt = await res.text();
      $("#truth").textContent = txt.trim();
      log(`[truth] loaded @ ${stamp()}`);
    }catch(e){
      $("#truth").textContent = "TRUTH fetch failed";
      log(`[truth] ERROR @ ${stamp()}: ${String(e)}`);
    }
  }

  function init(){
    $("#reanchor").addEventListener("click", () => {
      const clean = DIR.href.split("?")[0];
      window.location.href = `${clean}?ts=${Date.now()}`;
    });

    $("#controls").addEventListener("change", () => {
      syncUI();
      render();
    });

    $("#clearUnits").addEventListener("click", () => {
      state.units = [];
      state.selectedUnitId = null;
      setLoadedScenarioLabel(null);
      $("#status").textContent = "cleared units";
      log("[edit] cleared all units");
      render();
    });

    $("#loadScenario").addEventListener("click", () => {
      const id = $("#scenarioSel").value;
      loadScenarioById(id);
    });

    $("#board").addEventListener("click", (e) => {
      const ug = e.target.closest("g[data-unit]");
      if (ug){
        const id = ug.getAttribute("data-unit");
        state.selectedUnitId = id;
        const u = unitById(id);
        if (u) state.selectedCell = key(u.q,u.r);

        syncUI();
        if (state.ui.editMode){
          if (state.ui.tool === "erase" && u){
            eraseAt(u.q,u.r);
            state.selectedUnitId = null;
          } else if (state.ui.tool === "place" && u){
            u.side = state.ui.side;
            u.type = state.ui.type;
            u.quality = state.ui.quality;
            ensureStats(u);
            log(`[edit] updated ${u.id} via click -> ${u.side} ${u.type} ${u.quality}`);
          }
        }

        render();
        return;
      }

      const poly = e.target.closest("polygon[data-cell]");
      if (!poly){
        state.selectedCell = null;
        state.selectedUnitId = null;
        render();
        return;
      }

      const id = poly.getAttribute("data-cell");
      state.selectedCell = id;
      state.selectedUnitId = null;

      const [qs, rs] = id.split(",");
      const q = Number(qs), r = Number(rs);

      syncUI();
      if (state.ui.editMode){
        if (state.ui.tool === "place") placeOrUpdate(q,r);
        if (state.ui.tool === "erase") eraseAt(q,r);
      }

      render();
    });

    syncUI();
    buildBoard();
    render();
    loadTruth();
    loadScenarioIndex();
    log(`[boot] init @ ${stamp()} feature=${state.feature} build=${BUILD}`);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();