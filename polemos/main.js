(function () {
  'use strict';

  const GAME_NAME = 'Polemos';
  const BUILD_ID = window.POLEMOS_BUILD_ID || window.HEX_ANCIENTS_BUILD_ID || 'UNKNOWN';
  const PORT = 9225;

  // Canvas (odd-r offset)
  const CANVAS = { qMin: -6, qMax: 20, rMin: 0, rMax: 10 }; // inclusive
  const CANVAS_W = (CANVAS.qMax - CANVAS.qMin + 1);
  const CANVAS_H = (CANVAS.rMax - CANVAS.rMin + 1);

  // Default island + one extra far-left hex in middle row (r=5)
  const DEFAULT_SHAPE_NAME = 'AEGEAN-FIELD-SYM-MIDLEFT1';
  const DEFAULT_ROWS = [
    { qStart:  2, len: 12 }, // r=0
    { qStart:  1, len: 13 }, // r=1
    { qStart:  1, len: 14 }, // r=2
    { qStart:  0, len: 15 }, // r=3
    { qStart:  0, len: 16 }, // r=4
    { qStart: -1, len: 17 }, // r=5
    { qStart:  0, len: 16 }, // r=6
    { qStart:  0, len: 15 }, // r=7
    { qStart:  1, len: 14 }, // r=8
    { qStart:  1, len: 13 }, // r=9
    { qStart:  2, len: 12 }, // r=10
  ];

  // Terrain
  const TERRAIN_DEFS = [
    { id: 'clear', label: 'Clear' },
    { id: 'hills', label: 'Hills' },
    { id: 'woods', label: 'Woods' },
    { id: 'rough', label: 'Rough' },
    { id: 'water', label: 'Water' },
  ];
  const TERRAIN_BY_ID = new Map(TERRAIN_DEFS.map(t => [t.id, t]));
  const TERRAIN_CLASSES = TERRAIN_DEFS.map(t => 'terrain-' + t.id);

  // Units
  const UNIT_DEFS = [
    { id: 'inf', label: 'Infantry', abbrev: 'INF', glyph: 'rect' },
    { id: 'cav', label: 'Cavalry',  abbrev: 'CAV', glyph: 'diamond' },
    { id: 'skr', label: 'Skirm',    abbrev: 'SKR', glyph: 'circle' },
    { id: 'arc', label: 'Archers',  abbrev: 'ARC', glyph: 'hex' },
  ];
  const UNIT_BY_ID = new Map(UNIT_DEFS.map(u => [u.id, u]));

  // Turn / Movement
  const ACTIVATION_LIMIT = 3;
  const MOVE_POINTS = { inf: 1, cav: 2, skr: 2, arc: 1 };

  // Combat
  const HP_BY_TYPE = { inf: 3, cav: 2, skr: 2, arc: 2 };
  const MELEE_DICE = { inf: 2, cav: 3, skr: 2, arc: 1 };

  // Win condition (Standards)
  const DEFAULT_STANDARD_TARGET = 6;

  // Odd-r neighbors (adjacency)
  const NEIGH_EVEN = [[+1, 0], [0, -1], [-1, -1], [-1, 0], [-1, +1], [0, +1]];
  const NEIGH_ODD  = [[+1, 0], [+1, -1], [0, -1], [-1, 0], [0, +1], [+1, +1]];

  // Axial directions (retreat)
  const AX_DIRS = [
    { dq: +1, dr:  0 },
    { dq: +1, dr: -1 },
    { dq:  0, dr: -1 },
    { dq: -1, dr:  0 },
    { dq: -1, dr: +1 },
    { dq:  0, dr: +1 },
  ];

  // DOM
  const elBuild = document.getElementById('buildId');
  const elTruth = document.getElementById('truthProbe');

  const elLastAction = document.getElementById('lastAction');
  const elHudLastAction = document.getElementById('hudLastAction');

  const elScoreBlue = document.getElementById('scoreBlue');
  const elScoreRed = document.getElementById('scoreRed');
  const elScoreTarget = document.getElementById('scoreTarget');
  const elForceBlue = document.getElementById('forceBlue');
  const elForceRed = document.getElementById('forceRed');
  const elGameOverBanner = document.getElementById('gameOverBanner');

  const elSelected = document.getElementById('selected');
  const elHover = document.getElementById('hover');
  const elSelectedUnit = document.getElementById('selectedUnit');
  const elLog = document.getElementById('log');
  const elUA = document.getElementById('ua');

  const elModeLabel = document.getElementById('modeLabel');
  const elModeToggle = document.getElementById('modeToggle');

  const elToolLabel = document.getElementById('toolLabel');
  const elToolShapeBtn = document.getElementById('toolShapeBtn');
  const elToolTerrainBtn = document.getElementById('toolTerrainBtn');
  const elToolUnitsBtn = document.getElementById('toolUnitsBtn');

  const elActiveCount = document.getElementById('activeCount');
  const elPaintedCount = document.getElementById('paintedCount');
  const elUnitsCount = document.getElementById('unitsCount');

  const elPresetSelect = document.getElementById('presetSelect');
  const elLoadPresetBtn = document.getElementById('loadPresetBtn');
  const elResetDefaultBtn = document.getElementById('resetDefaultBtn');
  const elClearShapeBtn = document.getElementById('clearShapeBtn');

  const elBrushLabel = document.getElementById('brushLabel');
  const elResetTerrainBtn = document.getElementById('resetTerrainBtn');
  const elTerrainPalette = document.getElementById('terrainPalette');

  const elSideBlueBtn = document.getElementById('sideBlueBtn');
  const elSideRedBtn = document.getElementById('sideRedBtn');
  const elUInfBtn = document.getElementById('uInfBtn');
  const elUCavBtn = document.getElementById('uCavBtn');
  const elUSkrBtn = document.getElementById('uSkrBtn');
  const elUArcBtn = document.getElementById('uArcBtn');
  const elUEraseBtn = document.getElementById('uEraseBtn');
  const elDemoUnitsBtn = document.getElementById('demoUnitsBtn');
  const elClearUnitsBtn = document.getElementById('clearUnitsBtn');

  const elExportBtn = document.getElementById('exportBtn');
  const elCopyBtn = document.getElementById('copyBtn');
  const elImportBtn = document.getElementById('importBtn');
  const elClearJsonBtn = document.getElementById('clearJsonBtn');
  const elJson = document.getElementById('mapJson');

  const elTurnNumber = document.getElementById('turnNumber');
  const elTurnSide = document.getElementById('turnSide');
  const elActCount = document.getElementById('actCount');
  const elEndTurnBtn = document.getElementById('endTurnBtn');

  document.title = GAME_NAME + ' • ' + BUILD_ID;
  if (elBuild) elBuild.textContent = BUILD_ID;
  if (elUA) elUA.textContent = navigator.userAgent;

  // Helpers
  function keyOf(q, r) { return q + ',' + r; }
  function parseKey(k) { const p = k.split(','); return { q: Number(p[0]), r: Number(p[1]) }; }
  function withinCanvas(q, r) { return q >= CANVAS.qMin && q <= CANVAS.qMax && r >= CANVAS.rMin && r <= CANVAS.rMax; }
  function clampMin1(n) { return n < 1 ? 1 : n; }
  function terrainLabel(id) { return (TERRAIN_BY_ID.get(id) || { label: id }).label; }
  function unitAbbrev(id) { return (UNIT_BY_ID.get(id) || { abbrev: id }).abbrev; }

  // odd-r offset <-> axial
  function offsetToAxial(q, r) {
    const aq = q - ((r - (r & 1)) / 2);
    const ar = r;
    return { aq, ar };
  }
  function axialToOffset(aq, ar) {
    const q = aq + ((ar - (ar & 1)) / 2);
    const r = ar;
    return { q, r };
  }

  // Cube distance via axial conversion
  function hexDistanceKeys(k1, k2) {
    const a = parseKey(k1);
    const b = parseKey(k2);

    const ax = a.q - ((a.r - (a.r & 1)) / 2);
    const az = a.r;
    const ay = -ax - az;

    const bx = b.q - ((b.r - (b.r & 1)) / 2);
    const bz = b.r;
    const by = -bx - bz;

    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    const dz = Math.abs(az - bz);
    return (dx + dy + dz) / 2;
  }

  function activeSetFromRows(rows) {
    const s = new Set();
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let q = row.qStart; q < row.qStart + row.len; q++) {
        if (withinCanvas(q, r)) s.add(keyOf(q, r));
      }
    }
    return s;
  }

  function buildCanvasKeys() {
    const keys = [];
    for (let r = CANVAS.rMin; r <= CANVAS.rMax; r++) for (let q = CANVAS.qMin; q <= CANVAS.qMax; q++) keys.push(keyOf(q, r));
    return keys;
  }

  const CANVAS_KEYS = buildCanvasKeys();
  const DEFAULT_ACTIVE = activeSetFromRows(DEFAULT_ROWS);

  // State
  const state = {
    milestone: 'M8',
    feature: 'STANDARDS_WIN_HUD',
    mode: 'play',
    tool: 'shape',
    brush: 'clear',

    active: new Set(DEFAULT_ACTIVE),
    terrain: new Map(), // key -> terrainId (store only non-clear)

    units: new Map(),   // key -> unit {id,type,side,q,r,hp}
    nextUnitId: 1,

    unitSide: 'blue',
    unitType: 'inf',

    turn: {
      side: 'blue',
      turnNumber: 1,
      activationLimit: ACTIVATION_LIMIT,
      activationsUsed: 0,
      movedUnitIds: new Set(), // activated ids
    },

    score: {
      blue: 0,
      red: 0,
      target: DEFAULT_STANDARD_TARGET,
      gameOver: false,
      winner: null, // 'blue' | 'red'
    },

    lastAction: '—',

    selectedKey: null,
    selectedEl: null,
    selectedUnitKey: null,

    actionFromKey: null,
    moveTargets: new Map(),   // key -> cost
    attackTargets: new Set(), // keys with enemy units

    log: [],
  };

  function sideName(side) { return side === 'red' ? 'Red' : 'Blue'; }
  function currentSideName() { return sideName(state.turn.side); }

  function setLastAction(msg) {
    state.lastAction = msg || '—';
    if (elLastAction) elLastAction.textContent = state.lastAction;
    if (elHudLastAction) elHudLastAction.textContent = state.lastAction;
  }

  // Logging
  function addLog(msg) {
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    state.log.unshift(hh + ':' + mm + ':' + ss + ' — ' + msg);
    if (state.log.length > 80) state.log.pop();
    renderLog();
  }

  function renderLog() {
    if (!elLog) return;
    elLog.innerHTML = '';
    for (const line of state.log) {
      const div = document.createElement('div');
      div.className = 'logEntry';
      div.textContent = line;
      elLog.appendChild(div);
    }
  }

  // Terrain
  function terrainAtKey(k) { return state.terrain.get(k) || 'clear'; }
  function paintedCountActive() {
    let n = 0;
    for (const [k, t] of state.terrain.entries()) if (t !== 'clear' && state.active.has(k)) n++;
    return n;
  }

  // Units
  function unitAtKey(k) { return state.units.get(k) || null; }
  function unitsCountActive() {
    let n = 0;
    for (const k of state.units.keys()) if (state.active.has(k)) n++;
    return n;
  }
  function defaultHpFor(type) { return HP_BY_TYPE[type] ?? 2; }

  function computeForces() {
    const out = {
      blue: { units: 0, hp: 0 },
      red:  { units: 0, hp: 0 },
    };
    for (const [k, u0] of state.units.entries()) {
      if (!state.active.has(k) || !u0) continue;
      const u = u0;
      const hp = Number.isFinite(u.hp) ? u.hp : defaultHpFor(u.type);
      if (u.side === 'red') { out.red.units++; out.red.hp += hp; }
      else { out.blue.units++; out.blue.hp += hp; }
    }
    return out;
  }

  function fmtCell(k) {
    const p = parseKey(k);
    const a = state.active.has(k) ? 'active' : 'inactive';
    const t = terrainLabel(terrainAtKey(k));
    return 'q=' + p.q + ', r=' + p.r + ' (' + a + ', ' + t + ')';
  }
  function fmtUnit(u) {
    if (!u) return 'none';
    return sideName(u.side) + ' ' + unitAbbrev(u.type) + ' #' + u.id + ' (HP ' + u.hp + ') @ q=' + u.q + ', r=' + u.r;
  }

  function setHoverKey(k) {
    if (!elHover) return;
    elHover.textContent = k ? fmtCell(k) : '—';
  }

  function clearSelection() {
    if (state.selectedEl) state.selectedEl.classList.remove('selected');
    state.selectedEl = null;
    state.selectedKey = null;
    if (elSelected) elSelected.textContent = 'none';
  }

  function selectCell(k, el) {
    if (state.selectedEl) state.selectedEl.classList.remove('selected');
    state.selectedEl = el;
    state.selectedKey = k;
    if (el) el.classList.add('selected');
    if (elSelected) elSelected.textContent = fmtCell(k);
  }

  function clearUnitSelection() {
    state.selectedUnitKey = null;
    if (elSelectedUnit) elSelectedUnit.textContent = 'none';
  }

  function selectUnitAtKey(k) {
    const u = unitAtKey(k);
    if (!u) { clearUnitSelection(); return; }
    state.selectedUnitKey = k;
    if (elSelectedUnit) elSelectedUnit.textContent = fmtUnit(u);
  }

  function applyModeClasses() {
    document.body.classList.toggle('mode-play', state.mode === 'play');
    document.body.classList.toggle('mode-edit', state.mode === 'edit');
  }

  // ---------- SVG Board ----------
  const boardHost = document.getElementById('board');
  if (!boardHost) return;

  const cfg = { size: 34, margin: 14 };
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'boardSvg');
  svg.setAttribute('xmlns', svgNS);

  boardHost.innerHTML = '';
  boardHost.appendChild(svg);

  const gHex = document.createElementNS(svgNS, 'g');
  const gUnits = document.createElementNS(svgNS, 'g');
  svg.appendChild(gHex);
  svg.appendChild(gUnits);

  const SQRT3 = Math.sqrt(3);

  function gridToPixel(q, r, size) {
    const x = size * (SQRT3 * (q + 0.5 * (r & 1)));
    const y = size * (3 / 2 * r);
    return { x, y };
  }

  function hexCorner(cx, cy, size, i) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return { x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) };
  }

  function hexPoints(cx, cy, size) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const c = hexCorner(cx, cy, size, i);
      pts.push(c.x + ',' + c.y);
    }
    return pts.join(' ');
  }

  const polyByKey = new Map();
  const boundsByKey = new Map();
  const centerByKey = new Map();

  function computeBoundsFor(q, r) {
    const p = gridToPixel(q, r, cfg.size);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < 6; i++) {
      const c = hexCorner(p.x, p.y, cfg.size, i);
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    return { p, minX, minY, maxX, maxY };
  }

  function setPolyActiveClass(poly, isActive) {
    poly.classList.toggle('active', isActive);
    poly.classList.toggle('inactive', !isActive);
  }

  function applyTerrainClass(poly, terrainId) {
    for (const c of TERRAIN_CLASSES) poly.classList.remove(c);
    const id = TERRAIN_BY_ID.has(terrainId) ? terrainId : 'clear';
    poly.classList.add('terrain-' + id);
  }

  function updateViewBox() {
    let keys = (state.mode === 'edit') ? CANVAS_KEYS : Array.from(state.active);
    if (!keys.length) keys = CANVAS_KEYS;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const k of keys) {
      const b = boundsByKey.get(k);
      if (!b) continue;
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }

    const vbX = minX - cfg.margin;
    const vbY = minY - cfg.margin;
    const vbW = (maxX - minX) + cfg.margin * 2;
    const vbH = (maxY - minY) + cfg.margin * 2;
    svg.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  function clearSvgChildren(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function unitGlyphPoints(cx, cy, size) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i);
      const x = cx + size * Math.cos(angle);
      const y = cy + size * Math.sin(angle);
      pts.push(x + ',' + y);
    }
    return pts.join(' ');
  }

  function rebuildUnitsLayer() {
    clearSvgChildren(gUnits);

    for (const [k, u0] of state.units.entries()) {
      if (!state.active.has(k)) continue;

      const c = centerByKey.get(k);
      if (!c) continue;

      const def = UNIT_BY_ID.get(u0.type);
      if (!def) continue;

      const u = u0;
      if (!Number.isFinite(u.hp)) u.hp = defaultHpFor(u.type);

      const exhausted = state.turn.movedUnitIds.has(u.id) && u.side === state.turn.side && state.mode === 'play';

      const group = document.createElementNS(svgNS, 'g');
      group.setAttribute('class',
        'unit-token side-' + u.side
        + (state.selectedUnitKey === k ? ' selectedUnit' : '')
        + (exhausted ? ' exhausted' : '')
      );
      group.setAttribute('transform', 'translate(' + c.x + ',' + c.y + ')');

      if (def.glyph === 'rect') {
        const r = document.createElementNS(svgNS, 'rect');
        r.setAttribute('class', 'u-bg');
        r.setAttribute('x', '-12');
        r.setAttribute('y', '-8');
        r.setAttribute('width', '24');
        r.setAttribute('height', '16');
        r.setAttribute('rx', '3');
        group.appendChild(r);
      } else if (def.glyph === 'diamond') {
        const p = document.createElementNS(svgNS, 'polygon');
        p.setAttribute('class', 'u-bg');
        p.setAttribute('points', '0,-10 12,0 0,10 -12,0');
        group.appendChild(p);
      } else if (def.glyph === 'circle') {
        const c0 = document.createElementNS(svgNS, 'circle');
        c0.setAttribute('class', 'u-bg');
        c0.setAttribute('cx', '0');
        c0.setAttribute('cy', '0');
        c0.setAttribute('r', '10');
        group.appendChild(c0);
      } else {
        const p = document.createElementNS(svgNS, 'polygon');
        p.setAttribute('class', 'u-bg');
        p.setAttribute('points', unitGlyphPoints(0, 0, 10));
        group.appendChild(p);
      }

      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('class', 'u-text');
      t.setAttribute('x', '0');
      t.setAttribute('y', '0');
      t.textContent = def.abbrev;
      group.appendChild(t);

      const hp = document.createElementNS(svgNS, 'text');
      hp.setAttribute('class', 'u-hp');
      hp.setAttribute('x', '11');
      hp.setAttribute('y', '-6');
      hp.textContent = String(u.hp);
      group.appendChild(hp);

      gUnits.appendChild(group);
    }
  }

  // ---------- Targets ----------
  function clearMoveTargets() {
    for (const k of state.moveTargets.keys()) {
      const poly = polyByKey.get(k);
      if (poly) poly.classList.remove('moveTarget');
    }
    state.moveTargets = new Map();
  }

  function clearAttackTargets() {
    for (const k of state.attackTargets.values()) {
      const poly = polyByKey.get(k);
      if (poly) poly.classList.remove('attackTarget');
    }
    state.attackTargets = new Set();
  }

  function clearActionTargets() {
    state.actionFromKey = null;
    clearMoveTargets();
    clearAttackTargets();
  }

  function setMoveTargets(targetsMap) {
    clearMoveTargets();
    state.moveTargets = targetsMap;
    for (const k of targetsMap.keys()) {
      const poly = polyByKey.get(k);
      if (poly) poly.classList.add('moveTarget');
    }
  }

  function setAttackTargets(targetSet) {
    clearAttackTargets();
    state.attackTargets = targetSet;
    for (const k of targetSet.values()) {
      const poly = polyByKey.get(k);
      if (poly) poly.classList.add('attackTarget');
    }
  }

  // ---------- Neighbors / ZoC ----------
  function neighborKeysOf(k) {
    const p = parseKey(k);
    const dirs = (p.r & 1) ? NEIGH_ODD : NEIGH_EVEN;
    const out = [];
    for (const d of dirs) out.push(keyOf(p.q + d[0], p.r + d[1]));
    return out;
  }

  function isEngagedKey(unitKey, unitSide) {
    for (const nk of neighborKeysOf(unitKey)) {
      const du = unitAtKey(nk);
      if (du && du.side !== unitSide) return true;
    }
    return false;
  }

  function movePointsFor(unitType) { return MOVE_POINTS[unitType] ?? 1; }

  function terrainMoveCost(unitType, terrainId) {
    if (terrainId === 'water') return Infinity;
    if (terrainId === 'clear') return 1;
    if (terrainId === 'hills') return 2;
    if (terrainId === 'woods') return 2;
    if (terrainId === 'rough') return (unitType === 'skr') ? 1 : 2;
    return 1;
  }

  function computeMoveTargets(fromKey, unit) {
    let mp = movePointsFor(unit.type);

    const engaged = isEngagedKey(fromKey, unit.side);
    if (engaged && unit.type !== 'skr') return new Map();
    if (engaged && unit.type === 'skr') mp = Math.max(1, mp - 1);

    const dist = new Map();
    dist.set(fromKey, 0);

    const frontier = [[0, fromKey]];
    while (frontier.length) {
      frontier.sort((a, b) => a[0] - b[0]);
      const [d, k] = frontier.shift();

      const best = dist.get(k);
      if (best === undefined || d !== best) continue;

      for (const nk of neighborKeysOf(k)) {
        if (!state.active.has(nk)) continue;
        if (state.units.has(nk)) continue;

        const terr = terrainAtKey(nk);
        const c = terrainMoveCost(unit.type, terr);
        if (!isFinite(c)) continue;

        const nd = d + c;
        if (nd > mp) continue;

        const prev = dist.get(nk);
        if (prev === undefined || nd < prev) {
          dist.set(nk, nd);
          frontier.push([nd, nk]);
        }
      }
    }

    dist.delete(fromKey);
    return dist;
  }

  // ---------- Combat ----------
  function meleeDiceCount(attacker, defenderKey) {
    let n = MELEE_DICE[attacker.type] ?? 2;
    const terr = terrainAtKey(defenderKey);
    if (terr === 'woods' || terr === 'rough') n -= 1;
    if (terr === 'hills' && attacker.type === 'cav') n -= 1;
    return clampMin1(n);
  }

  function rollDice(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(1 + Math.floor(Math.random() * 6));
    return out;
  }

  function hasFriendlySupport(defKey, defSide, attackerKey) {
    for (const nk of neighborKeysOf(defKey)) {
      if (nk === attackerKey) continue;
      const u = unitAtKey(nk);
      if (u && u.side === defSide) return true;
    }
    return false;
  }

  function findAxialDir(attKey, defKey) {
    const a0 = parseKey(attKey);
    const d0 = parseKey(defKey);
    const a = offsetToAxial(a0.q, a0.r);
    const d = offsetToAxial(d0.q, d0.r);
    const diff = { dq: d.aq - a.aq, dr: d.ar - a.ar };
    for (const dir of AX_DIRS) {
      if (dir.dq === diff.dq && dir.dr === diff.dr) return dir;
    }
    return null;
  }

  function tryRetreatStep(attKey, defKey, dir) {
    const def0 = parseKey(defKey);
    const defAx = offsetToAxial(def0.q, def0.r);
    const nextAx = { aq: defAx.aq + dir.dq, ar: defAx.ar + dir.dr };
    const nextOff = axialToOffset(nextAx.aq, nextAx.ar);
    const nk = keyOf(nextOff.q, nextOff.r);

    if (!withinCanvas(nextOff.q, nextOff.r)) return { ok: false, key: nk, reason: 'off-canvas' };
    if (!state.active.has(nk)) return { ok: false, key: nk, reason: 'inactive' };
    if (state.units.has(nk)) return { ok: false, key: nk, reason: 'occupied' };
    if (terrainAtKey(nk) === 'water') return { ok: false, key: nk, reason: 'water' };

    const u = unitAtKey(defKey);
    if (!u) return { ok: false, key: nk, reason: 'missing-unit' };

    state.units.delete(defKey);
    u.q = nextOff.q; u.r = nextOff.r;
    state.units.set(nk, u);
    return { ok: true, key: nk, reason: '' };
  }

  function applyDamage(defKey, hits) {
    const u = unitAtKey(defKey);
    if (!u) return { removed: false, hp: 0 };
    u.hp = (Number.isFinite(u.hp) ? u.hp : defaultHpFor(u.type)) - hits;
    if (u.hp <= 0) {
      state.units.delete(defKey);
      return { removed: true, hp: 0, unit: u };
    }
    return { removed: false, hp: u.hp, unit: u };
  }

  function awardStandard(side, why) {
    if (state.score.gameOver) return;
    if (side !== 'blue' && side !== 'red') return;

    state.score[side] += 1;

    const msg = sideName(side) + ' gains 1 Standard' + (why ? (' (' + why + ')') : '');
    addLog(msg);
    setLastAction(msg);

    if (state.score[side] >= state.score.target) {
      state.score.gameOver = true;
      state.score.winner = side;
      const winMsg = 'GAME OVER: ' + sideName(side) + ' wins (' + state.score[side] + '/' + state.score.target + ')';
      addLog(winMsg);
      setLastAction(winMsg);
    }

    updateStatusText();
  }

  function attack(defKey) {
    if (!state.actionFromKey) return;
    const attKey = state.actionFromKey;

    const attacker = unitAtKey(attKey);
    const defender = unitAtKey(defKey);

    if (!attacker || !defender) return;
    if (state.score.gameOver) { addLog('Game over. Reset or load a preset to play again.'); return; }
    if (attacker.side !== state.turn.side) { addLog('Not your unit.'); return; }
    if (defender.side === attacker.side) return;

    if (state.turn.activationsUsed >= state.turn.activationLimit) { addLog('No activations left. End Turn.'); return; }
    if (state.turn.movedUnitIds.has(attacker.id)) { addLog('Unit already activated this turn.'); return; }

    const dist = hexDistanceKeys(attKey, defKey);
    const melee = (dist === 1);

    let isRanged = false;
    let diceN = 0;

    if (melee) {
      diceN = meleeDiceCount(attacker, defKey);
    } else {
      // Ranged attack
      const engaged = isEngagedKey(attKey, attacker.side);
      if (engaged) { addLog('Engaged: cannot make ranged attacks.'); return; }

      const range = (attacker.type === 'arc') ? 3 : (attacker.type === 'skr') ? 2 : 0;
      if (range === 0) { addLog('This unit has no ranged attack.'); return; }
      if (dist < 2 || dist > range) { addLog('Target out of ranged range.'); return; }
      if (attacker.type === 'skr' && dist !== 2) { addLog('Skirmishers range is 2 only.'); return; }

      isRanged = true;

      // Dice by type + distance
      if (attacker.type === 'arc') diceN = (dist === 2) ? 2 : 1;
      else diceN = 1;

      // Cover reduces ranged dice
      const terr = terrainAtKey(defKey);
      if (terr === 'woods' || terr === 'rough') diceN = clampMin1(diceN - 1);
    }

    const dice = rollDice(diceN);

    let hits = 0, retreats = 0;
    for (const d of dice) {
      if (d >= 5) hits++;
      else if (d === 4) retreats++;
    }

    // Defender support cancels 1 retreat
    if (retreats > 0 && hasFriendlySupport(defKey, defender.side, attKey)) {
      retreats -= 1;
      addLog('Support: defender cancels 1 retreat');
    }

    // Ranged: convert retreats into hits (suppression)
    if (isRanged && retreats > 0) {
      hits += retreats;
      addLog('Ranged suppression: converting ' + retreats + ' retreat(s) to hit(s)');
      retreats = 0;
    }

    const atkTag = sideName(attacker.side) + ' ' + unitAbbrev(attacker.type) + '#' + attacker.id;
    const defTag = sideName(defender.side) + ' ' + unitAbbrev(defender.type) + '#' + defender.id;

    const modeTag = melee ? 'MELEE' : ('RANGED d=' + dist);
    const summary = atkTag + ' ' + modeTag + ' → ' + defTag + ' | dice=' + diceN + ' [' + dice.join(',') + '] hits=' + hits + ' ret=' + retreats;
    addLog(summary);
    setLastAction(summary);

    let defKeyLive = defKey;

    // Apply hits first
    if (hits > 0) {
      const res = applyDamage(defKeyLive, hits);
      if (res.removed) {
        addLog('Defender destroyed.');
        awardStandard(attacker.side, 'destroyed ' + defTag);

        // spend activation
        state.turn.movedUnitIds.add(attacker.id);
        state.turn.activationsUsed = state.turn.movedUnitIds.size;

        clearActionTargets();
        rebuildUnitsLayer();
        updateStatusText();
        return;
      } else {
        addLog('Defender HP now ' + res.hp);
      }
    }

    // Melee retreats only (ranged already converted)
    if (melee && retreats > 0) {
      const dir = findAxialDir(attKey, defKeyLive);
      if (dir) {
        for (let i = 0; i < retreats; i++) {
          const step = tryRetreatStep(attKey, defKeyLive, dir);
          if (step.ok) {
            defKeyLive = step.key;
            addLog('Defender retreats to ' + fmtCell(defKeyLive));
          } else {
            addLog('Retreat blocked (' + step.reason + ') → 1 hit');
            const res2 = applyDamage(defKeyLive, 1);
            if (res2.removed) {
              addLog('Defender destroyed (blocked retreat casualty).');
              awardStandard(attacker.side, 'blocked retreat destroyed ' + defTag);
              break;
            } else {
              addLog('Defender HP now ' + res2.hp);
            }
          }
        }
      } else {
        addLog('Retreat direction error; no retreat applied.');
      }
    }

    // Spend activation
    state.turn.movedUnitIds.add(attacker.id);
    state.turn.activationsUsed = state.turn.movedUnitIds.size;

    clearActionTargets();
    rebuildUnitsLayer();
    updateStatusText();

    if (state.turn.activationsUsed >= state.turn.activationLimit) addLog('No activations left. End Turn.');
  }

  // ---------- Movement / Turn ----------
  function moveTo(destKey) {
    if (!state.actionFromKey) return;
    const fromKey = state.actionFromKey;

    const u = unitAtKey(fromKey);
    if (!u) { clearActionTargets(); return; }

    if (state.score.gameOver) { addLog('Game over. Reset or load a preset to play again.'); return; }

    if (u.side !== state.turn.side) { addLog('Not your unit.'); clearActionTargets(); return; }
    if (state.turn.activationsUsed >= state.turn.activationLimit) { addLog('No activations left. End Turn.'); clearActionTargets(); return; }
    if (state.turn.movedUnitIds.has(u.id)) { addLog('Unit already activated this turn.'); clearActionTargets(); return; }

    const engaged = isEngagedKey(fromKey, u.side);
    if (engaged && u.type !== 'skr') { addLog('Engaged: cannot move (melee only).'); clearActionTargets(); rebuildUnitsLayer(); updateStatusText(); return; }

    const cost = state.moveTargets.get(destKey);
    if (cost === undefined) return;

    state.units.delete(fromKey);
    const p = parseKey(destKey);
    u.q = p.q; u.r = p.r;
    state.units.set(destKey, u);

    state.turn.movedUnitIds.add(u.id);
    state.turn.activationsUsed = state.turn.movedUnitIds.size;

    state.selectedUnitKey = destKey;
    if (elSelectedUnit) elSelectedUnit.textContent = fmtUnit(u);

    const msg = sideName(u.side) + ' moved ' + unitAbbrev(u.type) + '#' + u.id + ' to q=' + p.q + ',r=' + p.r + ' (cost ' + cost + ')';
    addLog(msg);
    setLastAction(msg);

    clearActionTargets();
    rebuildUnitsLayer();
    updateStatusText();

    if (state.turn.activationsUsed >= state.turn.activationLimit) addLog('No activations left. End Turn.');
  }

  function endTurn() {
    if (state.score.gameOver) { addLog('Game over. Reset or load a preset to play again.'); return; }

    clearActionTargets();
    clearSelection();
    clearUnitSelection();

    state.turn.side = (state.turn.side === 'blue') ? 'red' : 'blue';
    state.turn.turnNumber += 1;
    state.turn.movedUnitIds.clear();
    state.turn.activationsUsed = 0;

    rebuildUnitsLayer();
    updateStatusText();

    const msg = 'Turn ' + state.turn.turnNumber + ': ' + currentSideName() + ' to act';
    addLog(msg);
    setLastAction(msg);
  }

  function prepareActionsFromUnit(unitKey) {
    const u = unitAtKey(unitKey);
    if (!u) return;

    if (state.score.gameOver) {
      addLog('Game over. Reset or load a preset to play again.');
      clearActionTargets();
      rebuildUnitsLayer();
      updateStatusText();
      return;
    }

    if (state.mode !== 'play') { addLog('Not in Play mode'); return; }
    if (u.side !== state.turn.side) { addLog('Not your unit'); return; }
    if (state.turn.activationsUsed >= state.turn.activationLimit) { addLog('No activations left (End Turn)'); return; }
    if (state.turn.movedUnitIds.has(u.id)) { addLog('Unit already activated this turn'); return; }

    state.actionFromKey = unitKey;

    const moves = computeMoveTargets(unitKey, u);
    setMoveTargets(moves);

    const attacks = new Set();

    // Melee adjacency targets
    for (const nk of neighborKeysOf(unitKey)) {
      const du = unitAtKey(nk);
      if (du && du.side !== u.side) attacks.add(nk);
    }

    // Ranged targets (no LOS yet). Disabled while engaged.
    if (!isEngagedKey(unitKey, u.side)) {
      const range = (u.type === 'arc') ? 3 : (u.type === 'skr') ? 2 : 0;
      if (range > 0) {
        for (const [ek, eu] of state.units.entries()) {
          if (!eu || eu.side === u.side) continue;
          const d = hexDistanceKeys(unitKey, ek);
          if (d < 2 || d > range) continue;
          if (u.type === 'skr' && d !== 2) continue;
          attacks.add(ek);
        }
      }
    }

    setAttackTargets(attacks);

    rebuildUnitsLayer();
    updateStatusText();

    addLog('Action ready: ' + fmtUnit(u) + ' | moves=' + moves.size + ' | attacks=' + attacks.size);
  }

  // ---------- Editing ----------
  function resetScore(opts) {
    state.score.blue = 0;
    state.score.red = 0;
    state.score.target = DEFAULT_STANDARD_TARGET;
    state.score.gameOver = false;
    state.score.winner = null;
    if (!opts || opts.log !== false) {
      addLog('Score reset (Standards 0–0 / ' + state.score.target + ')');
      setLastAction('Score reset (Standards 0–0 / ' + state.score.target + ')');
    }
    updateStatusText();
  }

  function resetTerrain(opts) {
    state.terrain.clear();
    for (const [, poly] of polyByKey.entries()) applyTerrainClass(poly, 'clear');
    if (!opts || opts.log !== false) addLog('Terrain reset (all Clear)');
  }

  function setTerrainAtKey(k, terrainId, opts) {
    const poly = polyByKey.get(k);
    if (!poly) return false;
    if (!TERRAIN_BY_ID.has(terrainId)) terrainId = 'clear';

    if (terrainId === 'water' && state.units.has(k)) {
      if (!opts || opts.log !== false) addLog('Blocked: cannot paint Water under a unit. Remove unit first.');
      return false;
    }

    if (terrainId === 'clear') state.terrain.delete(k);
    else state.terrain.set(k, terrainId);

    applyTerrainClass(poly, terrainId);
    if (!opts || opts.log !== false) addLog('Painted ' + terrainLabel(terrainId) + ' at ' + fmtCell(k));
    return true;
  }

  function clearUnits(opts) {
    state.units.clear();
    state.nextUnitId = 1;
    state.selectedUnitKey = null;
    rebuildUnitsLayer();
    if (!opts || opts.log !== false) addLog('Units cleared');
  }

  function removeUnitAtKey(k, opts) {
    const had = state.units.delete(k);
    if (had) {
      if (state.selectedUnitKey === k) clearUnitSelection();
      rebuildUnitsLayer();
      if (!opts || opts.log !== false) addLog('Removed unit at ' + fmtCell(k));
    }
  }

  function placeUnitAtKey(k, opts) {
    if (!state.active.has(k)) { addLog('Cannot place unit on inactive hex: ' + fmtCell(k)); return; }
    if (terrainAtKey(k) === 'water') { addLog('Cannot place unit on Water: ' + fmtCell(k)); return; }

    if (state.unitType === 'erase') { removeUnitAtKey(k, opts); return; }

    const def = UNIT_BY_ID.get(state.unitType);
    if (!def) return;

    const p = parseKey(k);
    const unit = { id: state.nextUnitId++, type: state.unitType, side: state.unitSide, q: p.q, r: p.r, hp: defaultHpFor(state.unitType) };
    state.units.set(k, unit);
    rebuildUnitsLayer();
    if (!opts || opts.log !== false) addLog('Placed ' + fmtUnit(unit));
  }

  function demoSetupUnits() {
    clearUnits({ log: false });
    resetScore({ log: false });

    // EVEN LINES: Red INF at r=4, Blue INF at r=6 (one empty row between at r=5).
    // Total 24 units: 14 INF (7/side), 4 CAV (2/side), 6 ARC (3/side).
    const placements = [];

    // Infantry lines
    for (let q = 4; q <= 10; q++) placements.push({ side: 'red',  type: 'inf', q, r: 4 });
    for (let q = 4; q <= 10; q++) placements.push({ side: 'blue', type: 'inf', q, r: 6 });

    // Cavalry wings
    placements.push({ side: 'red',  type: 'cav', q: 3,  r: 4 });
    placements.push({ side: 'red',  type: 'cav', q: 11, r: 4 });
    placements.push({ side: 'blue', type: 'cav', q: 3,  r: 6 });
    placements.push({ side: 'blue', type: 'cav', q: 11, r: 6 });

    // Archers behind lines
    for (let q = 6; q <= 8; q++) placements.push({ side: 'red',  type: 'arc', q, r: 3 });
    for (let q = 6; q <= 8; q++) placements.push({ side: 'blue', type: 'arc', q, r: 7 });

    let maxId = 0;
    let placed = 0;

    for (const it of placements) {
      const k = keyOf(it.q, it.r);
      if (!state.active.has(k)) continue;
      if (!UNIT_BY_ID.has(it.type)) continue;
      if (terrainAtKey(k) === 'water') continue;

      const unit = { id: ++maxId, type: it.type, side: it.side, q: it.q, r: it.r, hp: defaultHpFor(it.type) };
      state.units.set(k, unit);
      placed++;
    }
    state.nextUnitId = maxId + 1;

    clearActionTargets();
    state.turn.side = 'blue';
    state.turn.turnNumber = 1;
    state.turn.movedUnitIds.clear();
    state.turn.activationsUsed = 0;

    rebuildUnitsLayer();
    updateStatusText();

    const msg = 'Demo setup: even lines (Red r=4, Blue r=6). Units=' + placed + '. Standards 0–0.';
    addLog(msg);
    setLastAction(msg);
  }

  // ---------- Shape / Presets ----------
  function toggleActive(k) {
    const poly = polyByKey.get(k);
    if (!poly) return;

    if (state.active.has(k)) {
      state.active.delete(k);
      setPolyActiveClass(poly, false);

      if (state.terrain.has(k)) state.terrain.delete(k);
      applyTerrainClass(poly, 'clear');

      if (state.units.has(k)) state.units.delete(k);

      addLog('Deactivated ' + fmtCell(k) + ' (cleared terrain/unit)');
    } else {
      state.active.add(k);
      setPolyActiveClass(poly, true);
      addLog('Activated ' + fmtCell(k));
    }

    clearActionTargets();
    rebuildUnitsLayer();
    updateStatusText();
    if (state.mode === 'play') updateViewBox();
  }

  function applyActiveSet(newSet, label) {
    state.active = newSet;

    for (const k of CANVAS_KEYS) {
      const poly = polyByKey.get(k);
      if (!poly) continue;
      setPolyActiveClass(poly, state.active.has(k));
      if (!state.active.has(k)) applyTerrainClass(poly, 'clear');
    }

    for (const k of Array.from(state.terrain.keys())) if (!state.active.has(k)) state.terrain.delete(k);
    for (const k of Array.from(state.units.keys())) if (!state.active.has(k)) state.units.delete(k);

    clearActionTargets();
    rebuildUnitsLayer();
    updateStatusText();
    addLog(label);

    if (state.mode === 'play') updateViewBox();
  }

  function presetDefault() {
    resetTerrain({ log: false });
    clearUnits({ log: false });
    resetScore({ log: false });

    state.turn.side = 'blue';
    state.turn.turnNumber = 1;
    state.turn.movedUnitIds.clear();
    state.turn.activationsUsed = 0;

    applyActiveSet(new Set(DEFAULT_ACTIVE), 'Loaded preset: Default (Island) • ' + DEFAULT_SHAPE_NAME);
    setMode('play');
    setLastAction('Loaded preset: Default (Island)');
  }

  function presetCorridor() {
    resetTerrain({ log: false });
    clearUnits({ log: false });
    resetScore({ log: false });

    state.turn.side = 'blue';
    state.turn.turnNumber = 1;
    state.turn.movedUnitIds.clear();
    state.turn.activationsUsed = 0;

    const s = new Set();
    const rows = [4, 5, 6, 7]; // wider
    for (const r of rows) for (let q = CANVAS.qMin; q <= CANVAS.qMax; q++) s.add(keyOf(q, r));

    applyActiveSet(s, 'Loaded preset: Corridor (wider)');
    setMode('play');
    setLastAction('Loaded preset: Corridor (wider)');
  }

  function presetPass() {
    resetTerrain({ log: false });
    clearUnits({ log: false });
    resetScore({ log: false });

    state.turn.side = 'blue';
    state.turn.turnNumber = 1;
    state.turn.movedUnitIds.clear();
    state.turn.activationsUsed = 0;

    const s = new Set();
    for (let r = CANVAS.rMin; r <= CANVAS.rMax; r++) {
      const wide = (r <= 2 || r >= 8);
      const cols = wide ? [6, 7, 8, 9] : [7, 8];
      for (const q of cols) if (withinCanvas(q, r)) s.add(keyOf(q, r));
    }

    applyActiveSet(s, 'Loaded preset: Pass (wide ends, narrow middle)');
    setMode('play');
    setLastAction('Loaded preset: Pass (wide ends)');
  }

  // ---------- JSON ----------
  function exportJson(copyToClipboard) {
    const active = Array.from(state.active).map(parseKey).sort((a, b) => (a.r - b.r) || (a.q - b.q));

    const terrain = {};
    for (const [k, t] of state.terrain.entries()) if (t !== 'clear' && state.active.has(k)) terrain[k] = t;

    const units = [];
    for (const [k, u] of state.units.entries()) {
      if (!state.active.has(k)) continue;
      units.push({ id: u.id, type: u.type, side: u.side, q: u.q, r: u.r, hp: u.hp });
    }
    units.sort((a, b) => (a.r - b.r) || (a.q - b.q) || (a.id - b.id));

    const movedIds = Array.from(state.turn.movedUnitIds.values()).sort((a, b) => a - b);

    const data = {
      game: GAME_NAME,
      version: 8,
      milestone: state.milestone,
      feature: state.feature,
      build: BUILD_ID,
      canvas: CANVAS,
      defaultShape: DEFAULT_SHAPE_NAME,
      score: { ...state.score },
      active,
      terrain,
      units,
      turn: {
        side: state.turn.side,
        turnNumber: state.turn.turnNumber,
        activationLimit: state.turn.activationLimit,
        activationsUsed: state.turn.activationsUsed,
        movedUnitIds: movedIds,
      },
    };

    const json = JSON.stringify(data, null, 2);
    if (elJson) elJson.value = json;
    addLog('Exported JSON (units=' + units.length + ', standards=' + state.score.blue + '-' + state.score.red + ')');

    if (copyToClipboard && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json)
        .then(() => addLog('Copied JSON to clipboard'))
        .catch(() => addLog('Copy failed (clipboard permission). JSON is in the textbox.'));
    } else if (copyToClipboard) {
      addLog('Copy not available. JSON is in the textbox.');
    }
  }

  function importJson() {
    if (!elJson) return;
    const raw = (elJson.value || '').trim();
    if (!raw) { addLog('Import blocked: JSON box empty'); return; }

    let obj;
    try { obj = JSON.parse(raw); }
    catch { addLog('Import failed: invalid JSON'); return; }

    const list = Array.isArray(obj.active) ? obj.active : [];
    const s = new Set();
    for (const it of list) {
      const q = Number(it && it.q);
      const r = Number(it && it.r);
      if (!Number.isFinite(q) || !Number.isFinite(r) || !withinCanvas(q, r)) continue;
      s.add(keyOf(q, r));
    }
    applyActiveSet(s, 'Imported JSON (active=' + s.size + ')');

    resetTerrain({ log: false });
    const terr = (obj && typeof obj.terrain === 'object' && obj.terrain) ? obj.terrain : {};
    for (const k of Object.keys(terr)) {
      const t = String(terr[k] || '');
      if (!state.active.has(k)) continue;
      if (!TERRAIN_BY_ID.has(t)) continue;
      setTerrainAtKey(k, t, { log: false });
    }

    clearUnits({ log: false });
    const ulist = Array.isArray(obj.units) ? obj.units : [];
    let maxId = 0;

    for (const it of ulist) {
      const q = Number(it && it.q);
      const r = Number(it && it.r);
      const type = String(it && it.type || '');
      const side = (String(it && it.side || 'blue') === 'red') ? 'red' : 'blue';
      const id = Number(it && it.id);
      const hp = Number(it && it.hp);

      if (!Number.isFinite(q) || !Number.isFinite(r) || !withinCanvas(q, r)) continue;
      const k = keyOf(q, r);
      if (!state.active.has(k)) continue;
      if (!UNIT_BY_ID.has(type)) continue;
      if (terrainAtKey(k) === 'water') continue;

      const uid = Number.isFinite(id) ? id : (maxId + 1);
      const uhp = Number.isFinite(hp) ? hp : defaultHpFor(type);

      state.units.set(k, { id: uid, type, side, q, r, hp: uhp });
      if (uid > maxId) maxId = uid;
    }
    state.nextUnitId = maxId + 1;

    const t = obj && typeof obj.turn === 'object' && obj.turn ? obj.turn : null;
    state.turn.side = t && (t.side === 'red' || t.side === 'blue') ? t.side : 'blue';
    state.turn.turnNumber = t && Number.isFinite(Number(t.turnNumber)) ? Number(t.turnNumber) : 1;
    state.turn.activationLimit = t && Number.isFinite(Number(t.activationLimit)) ? Number(t.activationLimit) : ACTIVATION_LIMIT;

    const movedList = t && Array.isArray(t.movedUnitIds) ? t.movedUnitIds : [];
    const moved = new Set();
    for (const id0 of movedList) { const n = Number(id0); if (Number.isFinite(n)) moved.add(n); }
    state.turn.movedUnitIds = moved;
    state.turn.activationsUsed = state.turn.movedUnitIds.size;

    // score
    const sc = obj && typeof obj.score === 'object' && obj.score ? obj.score : null;
    state.score.blue = sc && Number.isFinite(Number(sc.blue)) ? Number(sc.blue) : 0;
    state.score.red = sc && Number.isFinite(Number(sc.red)) ? Number(sc.red) : 0;
    state.score.target = sc && Number.isFinite(Number(sc.target)) ? Number(sc.target) : DEFAULT_STANDARD_TARGET;
    state.score.gameOver = sc && !!sc.gameOver;
    state.score.winner = sc && (sc.winner === 'blue' || sc.winner === 'red') ? sc.winner : null;

    clearActionTargets();
    rebuildUnitsLayer();
    updateStatusText();
    addLog('Imported JSON. Turn ' + state.turn.turnNumber + ': ' + currentSideName());
    setMode('play');

    if (state.score.gameOver && state.score.winner) {
      const msg = 'GAME OVER: ' + sideName(state.score.winner) + ' wins';
      setLastAction(msg);
      addLog(msg);
    }
  }

  // ---------- UI update ----------
  function updateTruthProbe() {
    const modeStr = (state.mode === 'edit')
      ? ('EDIT_' + (state.tool === 'terrain' ? 'TERRAIN' : (state.tool === 'units' ? 'UNITS' : 'SHAPE')))
      : 'PLAY';

    const activeCount = state.active.size;
    const painted = paintedCountActive();
    const units = unitsCountActive();
    const act = state.turn.activationsUsed + '/' + state.turn.activationLimit;
    const std = 'STD=B' + state.score.blue + '-R' + state.score.red + '/' + state.score.target;

    const mark = GAME_NAME.toUpperCase() + ' ' + state.milestone
      + ' • ' + state.feature
      + ' • ' + std
      + ' • MODE=' + modeStr
      + ' • TURN=' + currentSideName().toUpperCase()
      + ' • ACT=' + act
      + ' • ACTIVE=' + activeCount
      + ' • PAINTED=' + painted
      + ' • UNITS=' + units
      + ' • CANVAS=' + CANVAS_W + 'x' + CANVAS_H
      + ' • PORT=' + PORT;

    if (elTruth) elTruth.textContent = mark + ' • ' + BUILD_ID;
  }

  function updateStatusText() {
    if (elModeLabel) elModeLabel.textContent = (state.mode === 'edit') ? 'Edit' : 'Play';
    if (elModeToggle) elModeToggle.textContent = (state.mode === 'edit') ? 'To Play' : 'To Edit';

    const toolLabel = (state.tool === 'terrain') ? 'Terrain' : (state.tool === 'units' ? 'Units' : 'Shape');
    if (elToolLabel) elToolLabel.textContent = toolLabel;

    if (elToolShapeBtn) elToolShapeBtn.classList.toggle('active', state.tool === 'shape');
    if (elToolTerrainBtn) elToolTerrainBtn.classList.toggle('active', state.tool === 'terrain');
    if (elToolUnitsBtn) elToolUnitsBtn.classList.toggle('active', state.tool === 'units');

    if (elBrushLabel) elBrushLabel.textContent = terrainLabel(state.brush);
    if (elActiveCount) elActiveCount.textContent = String(state.active.size);
    if (elPaintedCount) elPaintedCount.textContent = String(paintedCountActive());
    if (elUnitsCount) elUnitsCount.textContent = String(unitsCountActive());

    if (elSideBlueBtn) elSideBlueBtn.classList.toggle('active', state.unitSide === 'blue');
    if (elSideRedBtn) elSideRedBtn.classList.toggle('active', state.unitSide === 'red');

    const isType = (t) => state.unitType === t;
    if (elUInfBtn) elUInfBtn.classList.toggle('active', isType('inf'));
    if (elUCavBtn) elUCavBtn.classList.toggle('active', isType('cav'));
    if (elUSkrBtn) elUSkrBtn.classList.toggle('active', isType('skr'));
    if (elUArcBtn) elUArcBtn.classList.toggle('active', isType('arc'));
    if (elUEraseBtn) elUEraseBtn.classList.toggle('active', isType('erase'));

    if (elTurnNumber) elTurnNumber.textContent = String(state.turn.turnNumber);
    if (elTurnSide) elTurnSide.textContent = currentSideName();
    if (elActCount) elActCount.textContent = String(state.turn.activationsUsed) + '/' + String(state.turn.activationLimit);
    if (elEndTurnBtn) elEndTurnBtn.disabled = (state.mode !== 'play') || state.score.gameOver;

    if (elScoreBlue) elScoreBlue.textContent = String(state.score.blue);
    if (elScoreRed) elScoreRed.textContent = String(state.score.red);
    if (elScoreTarget) elScoreTarget.textContent = String(state.score.target);

    const forces = computeForces();
    if (elForceBlue) elForceBlue.textContent = forces.blue.units + 'u/' + forces.blue.hp + 'hp';
    if (elForceRed) elForceRed.textContent = forces.red.units + 'u/' + forces.red.hp + 'hp';

    if (elGameOverBanner) {
      if (state.score.gameOver && state.score.winner) {
        elGameOverBanner.style.display = 'block';
        elGameOverBanner.textContent = 'GAME OVER — ' + sideName(state.score.winner) + ' wins (' +
          state.score[state.score.winner] + '/' + state.score.target + ')';
      } else {
        elGameOverBanner.style.display = 'none';
        elGameOverBanner.textContent = '';
      }
    }

    setLastAction(state.lastAction);
    updateTruthProbe();
  }

  function renderTerrainPalette() {
    if (!elTerrainPalette) return;
    elTerrainPalette.innerHTML = '';

    for (const t of TERRAIN_DEFS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palBtn' + (t.id === state.brush ? ' active' : '');

      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = 'var(--terrain-' + t.id + ')';

      const label = document.createElement('span');
      label.textContent = t.label;

      btn.appendChild(sw);
      btn.appendChild(label);
      btn.addEventListener('click', function () {
        state.brush = t.id;
        renderTerrainPalette();
        updateStatusText();
        addLog('Brush set to ' + terrainLabel(t.id));
        setLastAction('Brush: ' + terrainLabel(t.id));
      });

      elTerrainPalette.appendChild(btn);
    }
  }

  function setMode(newMode) {
    state.mode = newMode;
    applyModeClasses();
    clearActionTargets();
    updateViewBox();
    rebuildUnitsLayer();
    updateStatusText();
    const msg = 'Mode set to ' + (state.mode === 'edit' ? 'Edit' : 'Play');
    addLog(msg);
    setLastAction(msg);
  }

  function setTool(newTool) {
    state.tool = newTool;
    updateStatusText();
    const msg = 'Tool set to ' + (state.tool === 'terrain' ? 'Terrain' : (state.tool === 'units' ? 'Units' : 'Shape'));
    addLog(msg);
    setLastAction(msg);
  }

  function setUnitSide(side) {
    state.unitSide = (side === 'red') ? 'red' : 'blue';
    updateStatusText();
    const msg = 'Unit side = ' + sideName(state.unitSide);
    addLog(msg);
    setLastAction(msg);
  }

  function setUnitType(type) {
    state.unitType = type;
    updateStatusText();
    const msg = 'Unit type = ' + (type === 'erase' ? 'Erase' : (UNIT_BY_ID.get(type)?.label || type));
    addLog(msg);
    setLastAction(msg);
  }

  // Build polygons
  for (const k of CANVAS_KEYS) {
    const { q, r } = parseKey(k);
    const b = computeBoundsFor(q, r);
    boundsByKey.set(k, { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY });
    centerByKey.set(k, { x: b.p.x, y: b.p.y });

    const poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', hexPoints(b.p.x, b.p.y, cfg.size));
    poly.setAttribute('class', 'hex');
    poly.dataset.key = k;

    setPolyActiveClass(poly, state.active.has(k));
    applyTerrainClass(poly, 'clear');

    poly.addEventListener('click', function () {
      const key = poly.dataset.key;
      if (state.mode === 'play' && !state.active.has(key)) return;

      // Move target click
      if (state.mode === 'play' && state.moveTargets.has(key)) {
        moveTo(key);
        return;
      }

      // Attack target click
      if (state.mode === 'play' && state.attackTargets.has(key)) {
        attack(key);
        return;
      }

      selectCell(key, poly);

      if (state.mode === 'edit') {
        if (state.tool === 'shape') {
          toggleActive(key);
        } else if (state.tool === 'terrain') {
          if (!state.active.has(key)) { addLog('Cannot paint inactive hex: ' + fmtCell(key)); return; }
          setTerrainAtKey(key, state.brush);
        } else {
          if (!state.active.has(key)) { addLog('Cannot place unit on inactive hex: ' + fmtCell(key)); return; }
          placeUnitAtKey(key);
        }
      } else {
        const u = unitAtKey(key);
        if (u) {
          selectUnitAtKey(key);
          if (u.side === state.turn.side) {
            prepareActionsFromUnit(key);
          } else {
            clearActionTargets();
            addLog('Enemy selected: ' + fmtUnit(u));
            setLastAction('Enemy selected: ' + sideName(u.side) + ' ' + unitAbbrev(u.type) + '#' + u.id + ' (HP ' + u.hp + ')');
          }
        } else {
          clearUnitSelection();
          clearActionTargets();
          addLog('Selected ' + fmtCell(key));
          setLastAction('Selected ' + fmtCell(key));
        }
      }

      updateStatusText();
    });

    poly.addEventListener('mouseenter', function () { setHoverKey(poly.dataset.key); });
    poly.addEventListener('mouseleave', function () { setHoverKey(null); });

    gHex.appendChild(poly);
    polyByKey.set(k, poly);
  }

  // Wire UI
  if (elModeToggle) elModeToggle.addEventListener('click', function () { setMode(state.mode === 'play' ? 'edit' : 'play'); });
  if (elToolShapeBtn) elToolShapeBtn.addEventListener('click', function () { setTool('shape'); });
  if (elToolTerrainBtn) elToolTerrainBtn.addEventListener('click', function () { setTool('terrain'); });
  if (elToolUnitsBtn) elToolUnitsBtn.addEventListener('click', function () { setTool('units'); });

  if (elLoadPresetBtn) elLoadPresetBtn.addEventListener('click', function () {
    const v = elPresetSelect ? elPresetSelect.value : 'default';
    if (v === 'corridor') presetCorridor();
    else if (v === 'pass') presetPass();
    else presetDefault();
  });

  if (elResetDefaultBtn) elResetDefaultBtn.addEventListener('click', presetDefault);

  if (elClearShapeBtn) elClearShapeBtn.addEventListener('click', function () {
    resetTerrain({ log: false });
    clearUnits({ log: false });
    resetScore({ log: false });

    state.turn.side = 'blue';
    state.turn.turnNumber = 1;
    state.turn.movedUnitIds.clear();
    state.turn.activationsUsed = 0;

    applyActiveSet(new Set(), 'Cleared shape (0 active)');
    clearSelection();
    clearUnitSelection();
    clearActionTargets();
    setMode('edit');
    setTool('shape');
    setLastAction('Cleared shape');
  });

  if (elResetTerrainBtn) elResetTerrainBtn.addEventListener('click', function () { resetTerrain(); updateStatusText(); setLastAction('Terrain reset'); });

  if (elSideBlueBtn) elSideBlueBtn.addEventListener('click', function () { setUnitSide('blue'); });
  if (elSideRedBtn) elSideRedBtn.addEventListener('click', function () { setUnitSide('red'); });

  if (elUInfBtn) elUInfBtn.addEventListener('click', function () { setUnitType('inf'); });
  if (elUCavBtn) elUCavBtn.addEventListener('click', function () { setUnitType('cav'); });
  if (elUSkrBtn) elUSkrBtn.addEventListener('click', function () { setUnitType('skr'); });
  if (elUArcBtn) elUArcBtn.addEventListener('click', function () { setUnitType('arc'); });
  if (elUEraseBtn) elUEraseBtn.addEventListener('click', function () { setUnitType('erase'); });

  if (elDemoUnitsBtn) elDemoUnitsBtn.addEventListener('click', function () {
    demoSetupUnits();
    if (state.mode !== 'play') setMode('play');
  });

  if (elClearUnitsBtn) elClearUnitsBtn.addEventListener('click', function () {
    clearUnits();
    clearActionTargets();
    updateStatusText();
    setLastAction('Units cleared');
  });

  if (elExportBtn) elExportBtn.addEventListener('click', function () { exportJson(false); });
  if (elCopyBtn) elCopyBtn.addEventListener('click', function () { exportJson(true); });
  if (elImportBtn) elImportBtn.addEventListener('click', importJson);
  if (elClearJsonBtn) elClearJsonBtn.addEventListener('click', function () { if (elJson) elJson.value = ''; addLog('Cleared JSON box'); setLastAction('Cleared JSON'); });

  if (elEndTurnBtn) elEndTurnBtn.addEventListener('click', endTurn);

  // Init
  applyModeClasses();
  renderTerrainPalette();
  updateViewBox();
  rebuildUnitsLayer();
  updateStatusText();

  const msg = GAME_NAME + ' loaded (M8 Standards + HUD). Turn 1: Blue.';
  addLog(msg);
  setLastAction(msg);
  console.log(GAME_NAME + ' loaded. Build:', BUILD_ID);
})();
