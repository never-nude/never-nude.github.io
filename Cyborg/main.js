(() => {
  'use strict';

  // ===== Bannerfall (D-Day baseline -> RB01 rules engine alignment) =====
  // This build intentionally keeps the Bannerfall UI calm/legible while
  // tightening the mechanics to the rules spec you provided.

  const GAME_NAME = 'Bannerfall';
  const BUILD_ID = (window.POLEMO_BUILD_ID || window.POLEMO_BUILD || 'DEV');

  // --- Board shape (157-hex "island")
  // Rows are r=0..10, each row is a contiguous run of q.
  const DEFAULT_ROWS = [
    { qStart: 2, len: 12 }, // r=0
    { qStart: 1, len: 13 }, // r=1
    { qStart: 1, len: 14 }, // r=2
    { qStart: 0, len: 15 }, // r=3
    { qStart: 0, len: 16 }, // r=4
    { qStart: -1, len: 17 }, // r=5
    { qStart: 0, len: 16 }, // r=6
    { qStart: 0, len: 15 }, // r=7
    { qStart: 1, len: 14 }, // r=8
    { qStart: 1, len: 13 }, // r=9
    { qStart: 2, len: 12 }, // r=10
  ];

  // --- Terrain
  const TERRAIN_DEFS = [
    { id: 'clear', label: 'Clear' },
    { id: 'hills', label: 'Hills' },
    { id: 'woods', label: 'Woods' },
    { id: 'rough', label: 'Rough' },
    { id: 'water', label: 'Water' },
  ];
  const TERRAIN_IDS = new Set(TERRAIN_DEFS.map(t => t.id));

  const SCENARIO_FILTER_OPTIONS = {
    group: [
      { id: 'all', label: 'All Groups' },
      { id: 'demo', label: 'Demo' },
      { id: 'grand', label: 'Grand Battle' },
      { id: 'terrain', label: 'Terrain Pack' },
      { id: 'berserker', label: 'Berserker' },
      { id: 'other', label: 'Other' },
    ],
    lesson: [
      { id: 'all', label: 'All Lessons' },
      { id: 'lines', label: 'Line Discipline' },
      { id: 'center', label: 'Center Pressure' },
      { id: 'screen', label: 'Screen/Skirmish' },
      { id: 'envelopment', label: 'Envelopment/Flank' },
      { id: 'corridor', label: 'Corridor/Congestion' },
      { id: 'river', label: 'River/Fords' },
      { id: 'terrain', label: 'Terrain Tactics' },
      { id: 'general', label: 'General Practice' },
    ],
    size: [
      { id: 'all', label: 'Any Size' },
      { id: 'small', label: 'Small (<=20 units)' },
      { id: 'medium', label: 'Medium (21-50 units)' },
      { id: 'large', label: 'Large (51+ units)' },
    ],
    terrain: [
      { id: 'all', label: 'Any Map' },
      { id: 'open', label: 'Open Field' },
      { id: 'hills', label: 'Hills' },
      { id: 'woods', label: 'Woods' },
      { id: 'rough', label: 'Rough' },
      { id: 'water', label: 'Water' },
      { id: 'mixed', label: 'Mixed Terrain' },
    ],
  };
  const SCENARIO_FILTER_IDS = Object.fromEntries(
    Object.entries(SCENARIO_FILTER_OPTIONS).map(([k, opts]) => [k, new Set(opts.map(o => o.id))])
  );

  // --- Core rules constants
  const ACT_LIMIT = 3; // activations per turn
  const COMMAND_RADIUS_BY_QUALITY = { green: 3, regular: 4, veteran: 5 };
  const RUNNER_COMMAND_RADIUS = 1;
  const DEFAULT_COMMAND_RADIUS = COMMAND_RADIUS_BY_QUALITY.green;
  // Angle bonuses are disabled until we tune pivot/brace and counters further.
  const ENABLE_CAV_ANGLE_BONUS = false;
  const CAV_FLANK_BONUS = 1;
  const CAV_REAR_BONUS = 2;
  // AI pace intentionally slowed so piece-by-piece actions are easier to follow.
  const AI_STEP_DELAY_MS = 400; // ~60% slower than the previous 240ms pace
  const AI_START_DELAY_MS = 300;

  // Dice faces: 5–6 = Hit, 4 = Retreat.
  const DIE_HIT = new Set([5, 6]);
  const DIE_RETREAT = 4;

  // --- Units (Bannerfall quality-aware stats)
  // HP and UP vary by quality (green / regular / veteran).
  const UNIT_DEFS = [
    // id, label, abbrev, symbol, MP, quality stats, combat profile
    {
      id: 'inf', label: 'Infantry', abbrev: 'INF', symbol: 'INF', move: 1,
      hpByQuality: { green: 3, regular: 4, veteran: 5 },
      upByQuality: { green: 3, regular: 5, veteran: 7 },
      meleeDice: 2, ranged: null,
    },
    {
      id: 'cav', label: 'Cavalry', abbrev: 'CAV', symbol: 'CAV', move: 2,
      hpByQuality: { green: 2, regular: 3, veteran: 4 },
      upByQuality: { green: 6, regular: 8, veteran: 10 },
      meleeDice: 3, ranged: null,
    },
    {
      id: 'skr', label: 'Skirmishers', abbrev: 'SKR', symbol: 'SKR', move: 2,
      hpByQuality: { green: 1, regular: 2, veteran: 3 },
      upByQuality: { green: 2, regular: 3, veteran: 4 },
      meleeDice: 2, ranged: { 2: 1 }, // fixed range 2
    },
    {
      id: 'arc', label: 'Archers', abbrev: 'ARC', symbol: '➶', move: 1,
      hpByQuality: { green: 1, regular: 2, veteran: 3 },
      upByQuality: { green: 2, regular: 4, veteran: 6 },
      meleeDice: 1, ranged: { 2: 2, 3: 1 }, // range 2–3 only
    },
    {
      id: 'gen', label: 'General', abbrev: 'GEN', symbol: '★', move: 2,
      hpByQuality: { green: 2, regular: 3, veteran: 4 },
      upByQuality: { green: 8, regular: 10, veteran: 12 },
      meleeDice: 1, ranged: null,
    },
    {
      id: 'run', label: 'Runner', abbrev: 'RUN', symbol: '☿', move: 4,
      hpByQuality: { green: 2, regular: 2, veteran: 2 },
      upByQuality: { green: 1, regular: 2, veteran: 3 },
      meleeDice: 0, ranged: null,
    },
  ];

  const UNIT_BY_ID = new Map(UNIT_DEFS.map(u => [u.id, u]));

  function qualityStatValue(table, quality, fallback = 0) {
    if (!table || typeof table !== 'object') return fallback;
    if (quality && Object.prototype.hasOwnProperty.call(table, quality)) return table[quality];
    if (Object.prototype.hasOwnProperty.call(table, 'green')) return table.green;
    return fallback;
  }

  function unitMaxHp(type, quality) {
    const def = UNIT_BY_ID.get(type);
    return qualityStatValue(def?.hpByQuality, quality, 1);
  }

  function unitUpValue(type, quality) {
    const def = UNIT_BY_ID.get(type);
    return qualityStatValue(def?.upByQuality, quality, 0);
  }

  function normalizeForwardAxis(axis) {
    return axis === 'horizontal' ? 'horizontal' : 'vertical';
  }

  function sideForwardDelta(side, axis = state.forwardAxis) {
    const a = normalizeForwardAxis(axis);
    if (a === 'horizontal') {
      return (side === 'blue') ? { dq: +1, dr: 0 } : { dq: -1, dr: 0 };
    }
    return (side === 'blue') ? { dq: 0, dr: +1 } : { dq: 0, dr: -1 };
  }

  function sideForwardArrow(side, axis = state.forwardAxis) {
    const a = normalizeForwardAxis(axis);
    if (a === 'horizontal') return (side === 'blue') ? '→' : '←';
    return (side === 'blue') ? '↓' : '↑';
  }

  function sideForwardWord(side, axis = state.forwardAxis) {
    const a = normalizeForwardAxis(axis);
    if (a === 'horizontal') return (side === 'blue') ? 'right' : 'left';
    return (side === 'blue') ? 'down' : 'up';
  }

  function generalCommandRadius(generalUnit) {
    if (!generalUnit || generalUnit.type !== 'gen') return DEFAULT_COMMAND_RADIUS;
    return qualityStatValue(COMMAND_RADIUS_BY_QUALITY, generalUnit.quality, DEFAULT_COMMAND_RADIUS);
  }

  function commandRadiusForUnit(unit) {
    if (!unit) return 0;
    if (unit.type === 'gen') return generalCommandRadius(unit);
    if (unit.type === 'run') return RUNNER_COMMAND_RADIUS;
    return 0;
  }

  function isCommandSourceUnit(unit) {
    return !!unit && (unit.type === 'gen' || unit.type === 'run');
  }

  // === UNIT ICONS (Berserker) ===
  // White-on-transparent PNGs rendered over blue/red token fills.
  // Cache-busted with BUILD_ID so Safari/GitHub Pages doesn’t haunt you.
  const UNIT_ICON_SOURCES = {
    arc: 'assets/icon_arc.png', // Archer  -> arrow
    inf: 'assets/icon_inf.png', // Infantry -> sword
    skr: 'assets/icon_skr.png', // Skirmisher -> sling
    cav: 'assets/icon_cav.png', // Cavalry -> horse
  };

  const UNIT_ICONS = {};
  let UNIT_ICONS_READY = false;

  function loadUnitIcons() {
    const entries = Object.entries(UNIT_ICON_SOURCES);
    let remaining = entries.length;
    UNIT_ICONS_READY = false;

    for (const [type, src] of entries) {
      const img = new Image();
      img.onload = () => {
        remaining -= 1;
        if (remaining <= 0) {
          UNIT_ICONS_READY = true;
          // Force a redraw once icons are in memory.
          try { draw(); } catch (_) {}
        }
      };
      img.onerror = () => {
        remaining -= 1;
        if (remaining <= 0) {
          // Even if some fail, we can still draw (fallback to text).
          try { draw(); } catch (_) {}
        }
      };
      img.src = `${src}?v=${encodeURIComponent(BUILD_ID)}`;
      UNIT_ICONS[type] = img;
    }
  }

  function unitIconReady(type) {
    const img = UNIT_ICONS[type];
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  // Per-type tuning so icons feel proportional inside the token disc.
  const UNIT_ICON_TUNE = {
    arc: { scale: 1.12, y: -0.08 }, // a touch bigger + slightly up
    inf: { scale: 0.95, y:  0.00, rot: -0.616 },
    skr: { scale: 0.95, y:  0.00 },
    cav: { scale: 0.95, y:  0.00 },
  };

  loadUnitIcons();
  // === END UNIT ICONS ===


  const QUALITY_ORDER = ['green', 'regular', 'veteran'];

  // Odd-r offset neighbors (pointy-top).
  const NEIGH_EVEN = [[+1, 0], [0, -1], [-1, -1], [-1, 0], [-1, +1], [0, +1]];
  const NEIGH_ODD = [[+1, 0], [+1, -1], [0, -1], [-1, 0], [0, +1], [+1, +1]];

  // --- DOM
  const elCanvas = document.getElementById('c');
  const ctx = elCanvas.getContext('2d');

  const elHudTitle = document.getElementById('hudTitle');
  const elHudMeta = document.getElementById('hudMeta');
  const elHudLast = document.getElementById('hudLast');

  const elModeBtn = document.getElementById('modeBtn');
  const elGameModeSel = document.getElementById('gameModeSel');
  const elForwardAxisSel = document.getElementById('forwardAxisSel');
  const elToolUnits = document.getElementById('toolUnits');
  const elToolTerrain = document.getElementById('toolTerrain');

  const elSideBlue = document.getElementById('sideBlue');
  const elSideRed = document.getElementById('sideRed');

  const elTypeBtns = document.getElementById('typeBtns');
  const elEraseBtn = document.getElementById('eraseBtn');

  const elQualityGreen = document.getElementById('qGreen');
  const elQualityRegular = document.getElementById('qRegular');
  const elQualityVeteran = document.getElementById('qVeteran');

  const elTerrainBtns = document.getElementById('terrainBtns');

  const elScenarioSel = document.getElementById('scenarioSel');
  const elScenarioGroupSel = document.getElementById('scenarioGroupSel');
  const elScenarioLessonSel = document.getElementById('scenarioLessonSel');
  const elScenarioSizeSel = document.getElementById('scenarioSizeSel');
  const elScenarioTerrainSel = document.getElementById('scenarioTerrainSel');
  const elLoadScenarioBtn = document.getElementById('loadScenarioBtn');
  const elClearUnitsBtn = document.getElementById('clearUnitsBtn');
  const elExportStateBtn = document.getElementById('exportStateBtn');
  const elImportStateBtn = document.getElementById('importStateBtn');
  const elStateFileInput = document.getElementById('stateFileInput');
  const elDiceSummary = document.getElementById('diceSummary');
  const elDiceTray = document.getElementById('diceTray');
  const elInspectorTitle = document.getElementById('inspectorTitle');
  const elInspectorMeta = document.getElementById('inspectorMeta');
  const elInspectorSide = document.getElementById('inspectorSide');
  const elInspectorType = document.getElementById('inspectorType');
  const elInspectorQuality = document.getElementById('inspectorQuality');
  const elInspectorHex = document.getElementById('inspectorHex');
  const elInspectorHp = document.getElementById('inspectorHp');
  const elInspectorUp = document.getElementById('inspectorUp');
  const elInspectorCommand = document.getElementById('inspectorCommand');
  const elInspectorRadius = document.getElementById('inspectorRadius');
  let diceRenderNonce = 0;

  const elVictorySel = document.getElementById('victorySel');
  const elEndTurnBtn = document.getElementById('endTurnBtn');
  const elLineAdvanceBtn = document.getElementById('lineAdvanceBtn');
  const elOnlineHostBtn = document.getElementById('onlineHostBtn');
  const elOnlineJoinBtn = document.getElementById('onlineJoinBtn');
  const elOnlineLeaveBtn = document.getElementById('onlineLeaveBtn');
  const elOnlineMyCode = document.getElementById('onlineMyCode');
  const elOnlineJoinCode = document.getElementById('onlineJoinCode');
  const elOnlineRoleHint = document.getElementById('onlineRoleHint');
  const elOnlineStatus = document.getElementById('onlineStatus');
  const elRulesBtn = document.getElementById('rulesBtn');
  const elRulesDrawer = document.getElementById('rulesDrawer');
  const elRulesBackdrop = document.getElementById('rulesBackdrop');
  const elRulesCloseBtn = document.getElementById('rulesCloseBtn');

  // --- State
  const state = {
    mode: 'edit', // 'edit' | 'play'
    tool: 'units', // 'units' | 'terrain'

    editSide: 'blue',
    editType: 'inf',
    editQuality: 'green',
    editErase: false,
    editTerrain: 'clear',

    // Play
    gameMode: 'hvh', // 'hvh' | 'hvai'
    forwardAxis: 'vertical', // 'vertical' | 'horizontal'
    turn: 1,
    side: 'blue',
    actsUsed: 0,
    actedUnitIds: new Set(),

    // Visual toggles
    showCommand: true,
    terrainTheme: 'battlefield',
    rulesOpen: false,

    selectedKey: null,

    // Current activation context (only while a unit is selected in Play)
    // { unitId, committed, moved, attacked, inCommandStart, moveSpent, postAttackWithdrawOnly }
    act: null,

    victoryMode: 'clear',
    initialUP: { blue: 0, red: 0 },
    capturedUP: { blue: 0, red: 0 },

    gameOver: false,
    winner: null,

    // Minimal "event trace" (future UI can display this without changing rules)
    events: [],

    lastImport: null, // { source, at }
    aiBusy: false,
    aiTimer: null,

    last: 'Booting…',
  };

  const net = {
    peer: null,
    conn: null,
    isHost: false,
    connected: false,
    myCode: '',
    remoteCode: '',
    status: 'Online: idle.',
    applyingRemoteSnapshot: false,
  };

  const ONLINE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const ONLINE_CODE_LENGTH = 4;
  const ONLINE_PEER_PREFIX = 'cyb-';

  // --- Board model
  function key(q, r) { return `${q},${r}`; }

  function buildBoardFromRows(rows) {
    const active = [];
    const activeSet = new Set();
    let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let q = row.qStart; q < row.qStart + row.len; q++) {
        const k = key(q, r);
        active.push({ q, r, k, terrain: 'clear', cx: 0, cy: 0, neigh: [] });
        activeSet.add(k);
        minQ = Math.min(minQ, q);
        maxQ = Math.max(maxQ, q);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
      }
    }

    const byKey = new Map(active.map(h => [h.k, h]));

    // Precompute ACTIVE neighbors (movement & adjacency checks)
    for (const h of active) {
      const deltas = (h.r & 1) ? NEIGH_ODD : NEIGH_EVEN;
      h.neigh = [];
      for (const [dq, dr] of deltas) {
        const nk = key(h.q + dq, h.r + dr);
        if (activeSet.has(nk)) h.neigh.push(nk);
      }
    }

    return { active, activeSet, byKey, minQ, maxQ, minR, maxR };
  }

  const board = buildBoardFromRows(DEFAULT_ROWS);

  // Units live in a Map keyed by hex key.
  const unitsByHex = new Map();
  let nextUnitId = 1;

  // --- Scenarios (tiny demos)
  // We keep the existing demos as placeholders; we can retune them into
  // "Even Lines / Encirclement / Corridor" once RB01 feels solid.
  const SCENARIOS = {
    'Empty (Island)': {
      terrain: [],
      units: [],
    },
    'Demo A — Line Clash': {
      terrain: [],
      units: [
        // Blue
        { q: 2, r: 5, side: 'blue', type: 'gen', quality: 'green' },
        { q: 3, r: 4, side: 'blue', type: 'inf', quality: 'green' },
        { q: 3, r: 6, side: 'blue', type: 'inf', quality: 'green' },
        { q: 4, r: 5, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 2, r: 4, side: 'blue', type: 'arc', quality: 'green' },
        { q: 2, r: 6, side: 'blue', type: 'skr', quality: 'green' },

        // Red
        { q: 13, r: 5, side: 'red', type: 'gen', quality: 'green' },
        { q: 12, r: 4, side: 'red', type: 'inf', quality: 'green' },
        { q: 12, r: 6, side: 'red', type: 'inf', quality: 'green' },
        { q: 11, r: 5, side: 'red', type: 'cav', quality: 'regular' },
        { q: 13, r: 4, side: 'red', type: 'arc', quality: 'green' },
        { q: 13, r: 6, side: 'red', type: 'skr', quality: 'green' },
      ],
    },
    'Demo B — Center Push': {
      terrain: [],
      units: [
        { q: 4, r: 4, side: 'blue', type: 'gen', quality: 'green' },
        { q: 4, r: 5, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 6, side: 'blue', type: 'cav', quality: 'green' },
        { q: 3, r: 6, side: 'blue', type: 'arc', quality: 'green' },

        { q: 11, r: 6, side: 'red', type: 'gen', quality: 'green' },
        { q: 10, r: 5, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 4, side: 'red', type: 'cav', quality: 'green' },
        { q: 12, r: 4, side: 'red', type: 'arc', quality: 'green' },
      ],
    },
    'Demo C — Skirmisher Screen': {
      terrain: [],
      units: [
        { q: 2, r: 5, side: 'blue', type: 'gen', quality: 'green' },
        { q: 3, r: 5, side: 'blue', type: 'inf', quality: 'green' },
        { q: 4, r: 5, side: 'blue', type: 'cav', quality: 'green' },
        { q: 3, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 3, r: 6, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 1, r: 5, side: 'blue', type: 'arc', quality: 'green' },

        { q: 13, r: 5, side: 'red', type: 'gen', quality: 'green' },
        { q: 12, r: 5, side: 'red', type: 'inf', quality: 'green' },
        { q: 11, r: 5, side: 'red', type: 'cav', quality: 'green' },
        { q: 12, r: 4, side: 'red', type: 'skr', quality: 'regular' },
        { q: 12, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 14, r: 5, side: 'red', type: 'arc', quality: 'green' },
      ],
    },
  
  // === GRAND BATTLE SCENARIOS (Thor) ===
  'Grand A — Even Lines (30v30, mirrored)': {
    terrain: [
        
    ],
    units: [
        { q: 3, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 6, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 9, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 2, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 5, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 8, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 11, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 3, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 12, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 2, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 3, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 10, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 11, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 3, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 5, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 7, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 9, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 11, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 0, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 1, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 14, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 15, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 3, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 6, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 9, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 2, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 5, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 8, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 11, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 3, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 12, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 2, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 10, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 11, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 5, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 7, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 9, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 11, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 0, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 1, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 14, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 15, r: 6, side: 'red', type: 'cav', quality: 'regular' }
    ]
  },

  'Grand B — Center Push (28v28, mirrored)': {
    terrain: [
        { q: 7, r: 5, terrain: 'hills' },
        { q: 8, r: 5, terrain: 'hills' },
        { q: 9, r: 5, terrain: 'hills' },
        { q: 2, r: 5, terrain: 'rough' },
        { q: 14, r: 5, terrain: 'rough' }
    ],
    units: [
        { q: 4, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 7, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 10, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 4, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 7, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 10, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 2, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 3, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 10, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 11, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 12, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 13, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 3, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 5, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 11, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 13, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 0, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 15, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 4, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 7, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 10, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 4, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 7, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 10, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 2, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 10, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 11, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 12, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 13, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 5, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 11, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 13, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 0, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 15, r: 6, side: 'red', type: 'cav', quality: 'regular' }
    ]
  },

  'Grand C — Double Envelopment (30v30, mirrored)': {
    terrain: [
        
    ],
    units: [
        { q: 3, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 6, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 9, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 5, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 7, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 9, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 3, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 10, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 10, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 0, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 1, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 2, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 13, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 14, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 15, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 1, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 13, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 5, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 7, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 9, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 11, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 3, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 6, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 9, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 5, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 7, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 9, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 3, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 10, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 10, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 0, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 1, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 2, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 13, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 14, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 15, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 1, r: 7, side: 'red', type: 'cav', quality: 'regular' },
        { q: 13, r: 7, side: 'red', type: 'cav', quality: 'regular' },
        { q: 5, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 7, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 9, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 11, r: 6, side: 'red', type: 'skr', quality: 'regular' }
    ]
  },

  'Grand D — Massive Screen (26v26, mirrored)': {
    terrain: [
        
    ],
    units: [
        { q: 4, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 7, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 10, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 2, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 5, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 8, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 11, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 2, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 3, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 10, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 11, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 2, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 4, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 6, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 8, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 10, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 12, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 14, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 0, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 15, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 4, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 7, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 10, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 2, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 5, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 8, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 11, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 2, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 10, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 11, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 2, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 4, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 6, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 8, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 10, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 12, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 14, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 0, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 15, r: 6, side: 'red', type: 'cav', quality: 'regular' }
    ]
  },

  'Grand E — River Fords (24v24, mirrored)': {
    terrain: [
        { q: 0, r: 5, terrain: 'water' },
        { q: 1, r: 5, terrain: 'water' },
        { q: 2, r: 5, terrain: 'water' },
        { q: 3, r: 5, terrain: 'water' },
        { q: 5, r: 5, terrain: 'water' },
        { q: 6, r: 5, terrain: 'water' },
        { q: 7, r: 5, terrain: 'water' },
        { q: 9, r: 5, terrain: 'water' },
        { q: 10, r: 5, terrain: 'water' },
        { q: 11, r: 5, terrain: 'water' },
        { q: 13, r: 5, terrain: 'water' },
        { q: 14, r: 5, terrain: 'water' },
        { q: 15, r: 5, terrain: 'water' },
        { q: -1, r: 5, terrain: 'water' },
        { q: 4, r: 4, terrain: 'woods' },
        { q: 8, r: 4, terrain: 'woods' },
        { q: 12, r: 4, terrain: 'woods' },
        { q: 4, r: 6, terrain: 'woods' },
        { q: 8, r: 6, terrain: 'woods' },
        { q: 12, r: 6, terrain: 'woods' }
    ],
    units: [
        { q: 4, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 7, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 10, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 4, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 7, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 10, r: 2, side: 'blue', type: 'arc', quality: 'green' },
        { q: 2, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 3, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 10, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 11, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 12, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 13, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 0, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 1, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 14, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 15, r: 4, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 4, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 12, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 4, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 7, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 10, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 4, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 7, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 10, r: 8, side: 'red', type: 'arc', quality: 'green' },
        { q: 2, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 10, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 11, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 12, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 13, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 0, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 1, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 14, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 15, r: 6, side: 'red', type: 'cav', quality: 'regular' },
        { q: 4, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 12, r: 6, side: 'red', type: 'skr', quality: 'regular' }
    ]
  },

  'Grand F — Corridor Pass (22v22, mirrored)': {
    terrain: [
        { q: 14, r: 2, terrain: 'water' },
        { q: 1, r: 2, terrain: 'water' },
        { q: 2, r: 2, terrain: 'water' },
        { q: 3, r: 2, terrain: 'water' },
        { q: 10, r: 2, terrain: 'water' },
        { q: 11, r: 2, terrain: 'water' },
        { q: 12, r: 2, terrain: 'water' },
        { q: 13, r: 2, terrain: 'water' },
        { q: 0, r: 3, terrain: 'water' },
        { q: 1, r: 3, terrain: 'water' },
        { q: 2, r: 3, terrain: 'water' },
        { q: 3, r: 3, terrain: 'water' },
        { q: 10, r: 3, terrain: 'water' },
        { q: 11, r: 3, terrain: 'water' },
        { q: 12, r: 3, terrain: 'water' },
        { q: 13, r: 3, terrain: 'water' },
        { q: 14, r: 3, terrain: 'water' },
        { q: 0, r: 4, terrain: 'water' },
        { q: 1, r: 4, terrain: 'water' },
        { q: 2, r: 4, terrain: 'water' },
        { q: 3, r: 4, terrain: 'water' },
        { q: 10, r: 4, terrain: 'water' },
        { q: 11, r: 4, terrain: 'water' },
        { q: 12, r: 4, terrain: 'water' },
        { q: 13, r: 4, terrain: 'water' },
        { q: 14, r: 4, terrain: 'water' },
        { q: 15, r: 4, terrain: 'water' },
        { q: 0, r: 5, terrain: 'water' },
        { q: 1, r: 5, terrain: 'water' },
        { q: 2, r: 5, terrain: 'water' },
        { q: 3, r: 5, terrain: 'water' },
        { q: 10, r: 5, terrain: 'water' },
        { q: 11, r: 5, terrain: 'water' },
        { q: 12, r: 5, terrain: 'water' },
        { q: 13, r: 5, terrain: 'water' },
        { q: 14, r: 5, terrain: 'water' },
        { q: 15, r: 5, terrain: 'water' },
        { q: -1, r: 5, terrain: 'water' },
        { q: 0, r: 6, terrain: 'water' },
        { q: 1, r: 6, terrain: 'water' },
        { q: 2, r: 6, terrain: 'water' },
        { q: 3, r: 6, terrain: 'water' },
        { q: 10, r: 6, terrain: 'water' },
        { q: 11, r: 6, terrain: 'water' },
        { q: 12, r: 6, terrain: 'water' },
        { q: 13, r: 6, terrain: 'water' },
        { q: 14, r: 6, terrain: 'water' },
        { q: 15, r: 6, terrain: 'water' },
        { q: 0, r: 7, terrain: 'water' },
        { q: 1, r: 7, terrain: 'water' },
        { q: 2, r: 7, terrain: 'water' },
        { q: 3, r: 7, terrain: 'water' },
        { q: 10, r: 7, terrain: 'water' },
        { q: 11, r: 7, terrain: 'water' },
        { q: 12, r: 7, terrain: 'water' },
        { q: 13, r: 7, terrain: 'water' },
        { q: 14, r: 7, terrain: 'water' },
        { q: 14, r: 8, terrain: 'water' },
        { q: 1, r: 8, terrain: 'water' },
        { q: 2, r: 8, terrain: 'water' },
        { q: 3, r: 8, terrain: 'water' },
        { q: 10, r: 8, terrain: 'water' },
        { q: 11, r: 8, terrain: 'water' },
        { q: 12, r: 8, terrain: 'water' },
        { q: 13, r: 8, terrain: 'water' }
    ],
    units: [
        { q: 5, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 8, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 5, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 8, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 4, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 9, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 5, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 9, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 5, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 8, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 5, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 8, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 4, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 9, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 5, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 9, r: 6, side: 'red', type: 'skr', quality: 'regular' }
    ]
  },
  // === END GRAND BATTLE SCENARIOS ===,

  // === BERSERKER FORMATIONS (Berserker) ===
  'Berserker A — Wedge vs Shieldwall (26v26)': {
    terrain: [
        
    ],
    units: [
        { q: 4, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 6, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 8, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 3, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 5, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 7, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 9, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 4, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 3, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 5, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 7, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 9, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 11, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 0, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 1, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 13, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 14, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 4, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 6, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 8, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 3, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 5, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 7, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 9, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 2, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 10, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 11, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 5, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 7, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 9, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 11, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 2, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 1, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 12, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 13, r: 8, side: 'red', type: 'cav', quality: 'regular' }
    ]
  },

  'Berserker B — Crescent vs Columns (28v28)': {
    terrain: [
        
    ],
    units: [
        { q: 4, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 6, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 8, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 3, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 5, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 7, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 9, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 2, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 3, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 12, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 13, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 10, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 0, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 2, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 1, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 14, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 12, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 13, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 5, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 7, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 9, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 11, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 14, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 4, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 6, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 8, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 2, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 4, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 6, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 8, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 5, r: 9, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 9, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 8, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 6, side: 'red', type: 'inf', quality: 'regular' },
        { q: 2, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 1, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 12, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 13, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 5, r: 10, side: 'red', type: 'cav', quality: 'regular' },
        { q: 7, r: 10, side: 'red', type: 'cav', quality: 'regular' },
        { q: 4, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 9, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 10, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 12, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 14, r: 6, side: 'red', type: 'skr', quality: 'regular' }
    ]
  },

  'Berserker C — Checkerboard vs Line (26v26)': {
    terrain: [
        
    ],
    units: [
        { q: 4, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 6, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 8, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 2, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 5, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 8, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 11, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 2, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 10, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 3, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 11, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 2, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 5, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 8, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 11, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 14, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 0, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 14, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 1, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 13, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 4, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 6, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 8, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 2, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 5, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 8, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 11, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 2, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 10, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 11, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 2, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 5, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 8, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 11, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 14, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 2, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 1, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 12, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 13, r: 8, side: 'red', type: 'cav', quality: 'regular' }
    ]
  },

  'Berserker D — Refused Flank vs Wide Wings (28v28)': {
    terrain: [
        
    ],
    units: [
        { q: 4, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 6, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 8, r: 1, side: 'blue', type: 'gen', quality: 'green' },
        { q: 3, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 5, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 7, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 9, r: 0, side: 'blue', type: 'arc', quality: 'green' },
        { q: 9, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 10, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 11, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 12, r: 4, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 6, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 7, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 8, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 9, r: 3, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 2, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 3, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 4, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 5, r: 2, side: 'blue', type: 'inf', quality: 'regular' },
        { q: 13, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 14, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 12, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 13, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 0, r: 3, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 1, r: 2, side: 'blue', type: 'cav', quality: 'regular' },
        { q: 4, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 6, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 8, r: 4, side: 'blue', type: 'skr', quality: 'regular' },
        { q: 4, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 6, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 8, r: 9, side: 'red', type: 'gen', quality: 'green' },
        { q: 3, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 5, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 7, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 9, r: 10, side: 'red', type: 'arc', quality: 'green' },
        { q: 1, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 2, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 4, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 5, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 6, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 7, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 8, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 9, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 10, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 11, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 12, r: 7, side: 'red', type: 'inf', quality: 'regular' },
        { q: 3, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 1, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 2, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 11, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 12, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 13, r: 8, side: 'red', type: 'cav', quality: 'regular' },
        { q: 4, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 6, r: 6, side: 'red', type: 'skr', quality: 'regular' },
        { q: 8, r: 6, side: 'red', type: 'skr', quality: 'regular' }
    ]
  },
  // === END BERSERKER FORMATIONS ===
};

// === Terrain Pack (Berserker) ===
// Adds terrain-focused variants of the existing Grand scenarios.
// Board-aware: these generators only emit coordinates on active board hexes.
(function addTerrainPack(){
  const add = (name, baseName, terrainMaker) => {
    const base = SCENARIOS[baseName];
    if (!base) {
      console.warn('[TerrainPack] Missing base scenario:', baseName);
      return;
    }
    if (SCENARIOS[name]) return;
    SCENARIOS[name] = {
      terrain: terrainMaker(),
      units: base.units || [],
    };
  };

  const rows = new Map();
  for (const h of board.active) {
    if (!rows.has(h.r)) rows.set(h.r, []);
    rows.get(h.r).push(h);
  }
  for (const list of rows.values()) {
    list.sort((a, b) => a.q - b.q);
  }

  const centerR = Math.floor((board.minR + board.maxR) / 2);
  const centerRow = rows.get(centerR) || [];
  const centerQ = centerRow.length ? centerRow[Math.floor(centerRow.length / 2)].q : 0;

  function row(r) {
    return rows.get(r) || [];
  }

  function buildTerrain(builder) {
    const t = [];
    const seen = new Set();

    const addHex = (q, r, terrain) => {
      const hk = key(q, r);
      if (!board.activeSet.has(hk)) return;
      const tk = `${hk}:${terrain}`;
      if (seen.has(tk)) return;
      seen.add(tk);
      t.push({ q, r, terrain });
    };

    builder({ addHex, row, all: board.active, centerQ, centerR });
    return t;
  }

  // A: central ridge with two passes
  add('Terrain A — Ridge Line (30v30, mirrored)', 'Grand A — Even Lines (30v30, mirrored)', () =>
    buildTerrain(({ addHex, row, centerQ, centerR }) => {
      const passes = new Set([centerQ - 3, centerQ + 3]);
      for (const h of row(centerR)) {
        if (passes.has(h.q)) continue;
        addHex(h.q, h.r, 'hills');
      }
      for (const flankR of [centerR - 1, centerR + 1]) {
        for (const h of row(flankR)) {
          if ((h.q - centerQ) % 3 === 0) addHex(h.q, h.r, 'hills');
        }
      }
    })
  );

  // B: wide woods belt with a clear road
  add('Terrain B — Woods Belt (28v28, mirrored)', 'Grand B — Center Push (28v28, mirrored)', () =>
    buildTerrain(({ addHex, row, centerQ, centerR }) => {
      const roadQ = centerQ;
      for (const beltR of [centerR - 1, centerR, centerR + 1]) {
        for (const h of row(beltR)) {
          if (h.q === roadQ) continue;
          addHex(h.q, h.r, 'woods');
        }
      }
      for (const h of row(centerR - 2)) {
        if (h.q <= centerQ - 4) addHex(h.q, h.r, 'woods');
      }
      for (const h of row(centerR + 2)) {
        if (h.q >= centerQ + 4) addHex(h.q, h.r, 'woods');
      }
    })
  );

  // C: rough patches that punish cavalry lanes
  add('Terrain C — Broken Ground (30v30, mirrored)', 'Grand C — Double Envelopment (30v30, mirrored)', () =>
    buildTerrain(({ addHex, all, centerQ, centerR }) => {
      for (const h of all) {
        const dr = Math.abs(h.r - centerR);
        const dq = Math.abs(h.q - centerQ);
        if (dr <= 2 && dq >= 3 && ((h.q + h.r) & 1) === 0) addHex(h.q, h.r, 'rough');
      }
      for (const q of [centerQ - 4, centerQ, centerQ + 4]) {
        addHex(q, centerR, 'rough');
      }
    })
  );

  // D: marshy edge (water) that anchors flanks
  add('Terrain D — Marsh Edge (26v26, mirrored)', 'Grand D — Massive Screen (26v26, mirrored)', () =>
    buildTerrain(({ addHex, row, all, centerQ, centerR }) => {
      for (const edgeR of [board.minR, board.maxR]) {
        for (const h of row(edgeR)) {
          if (((h.q + h.r) & 1) === 1) addHex(h.q, h.r, 'water');
        }
      }
      for (const nearEdgeR of [board.minR + 1, board.maxR - 1]) {
        for (const h of row(nearEdgeR)) {
          if (((h.q + h.r) & 1) === 0) addHex(h.q, h.r, 'rough');
        }
      }
      for (const h of all) {
        const dr = Math.abs(h.r - centerR);
        const dq = Math.abs(h.q - centerQ);
        if (dr <= 1 && dq >= 7) addHex(h.q, h.r, 'water');
      }
    })
  );

  // E: mirrored river with three fords
  add('Terrain E — River Fords (24v24, mirrored)', 'Grand E — River Fords (24v24, mirrored)', () =>
    buildTerrain(({ addHex, row, centerQ, centerR }) => {
      const fords = new Set([centerQ - 4, centerQ, centerQ + 4]);
      for (const h of row(centerR)) {
        if (!fords.has(h.q)) addHex(h.q, h.r, 'water');
      }
      for (const bankR of [centerR - 1, centerR + 1]) {
        for (const h of row(bankR)) {
          if (Math.abs(h.q - centerQ) % 3 === 1) addHex(h.q, h.r, 'rough');
        }
      }
    })
  );

  // F: a corridor of clear with rough walls
  add('Terrain F — Corridor Pass (22v22, mirrored)', 'Grand F — Corridor Pass (22v22, mirrored)', () =>
    buildTerrain(({ addHex, all, centerQ, centerR }) => {
      for (const h of all) {
        const dr = Math.abs(h.r - centerR);
        const dq = Math.abs(h.q - centerQ);
        const inCorridor = dq <= 1;
        if (dr <= 2 && dq <= 6 && !inCorridor && ((h.q + h.r) & 1) === 0) {
          addHex(h.q, h.r, 'rough');
        }
      }
      for (const q of [centerQ - 2, centerQ + 2]) {
        addHex(q, centerR - 1, 'hills');
        addHex(q, centerR + 1, 'hills');
      }
      for (const q of [centerQ - 5, centerQ + 5]) {
        addHex(q, centerR, 'hills');
      }
    })
  );
})();



  // --- Geometry helpers
  function toAxial(q, r) {
    // Convert odd-r offset (q=col, r=row) to axial (x,z) where z=r.
    const x = q - ((r - (r & 1)) / 2);
    const z = r;
    return { x, z };
  }

  function axialDistance(aq, ar, bq, br) {
    const a = toAxial(aq, ar);
    const b = toAxial(bq, br);
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    const dy = (-a.x - a.z) - (-b.x - b.z);
    return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
  }

  // --- Canvas layout
  let R = 28; // will be recalculated
  let HEX_W = 0;
  let HEX_H = 0;
  let STEP_Y = 0;
  let ORIGIN_X = 0;
  let ORIGIN_Y = 0;

  function resize() {
    // Canvas fills left pane.
    const wrap = document.getElementById('canvasWrap');
    const rect = wrap.getBoundingClientRect();
    elCanvas.width = Math.floor(rect.width * devicePixelRatio);
    elCanvas.height = Math.floor(rect.height * devicePixelRatio);
    elCanvas.style.width = `${Math.floor(rect.width)}px`;
    elCanvas.style.height = `${Math.floor(rect.height)}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    // Fit board.
    const cols = (board.maxQ - board.minQ + 1);
    const rows = (board.maxR - board.minR + 1);
    const availW = rect.width;
    const availH = rect.height;

    // For pointy-top hexes with odd-r offset:
    // width ≈ sqrt(3)*R*(cols + 0.5)
    // height ≈ R*((rows-1)*1.5 + 2)
    const rByW = availW / (Math.sqrt(3) * (cols + 0.5));
    const rByH = availH / (((rows - 1) * 1.5) + 2);
    R = Math.max(18, Math.min(42, Math.floor(Math.min(rByW, rByH))));

    HEX_W = Math.sqrt(3) * R;
    HEX_H = 2 * R;
    STEP_Y = 1.5 * R;

    const boardW = HEX_W * (cols + 0.5);
    const boardH = R * (((rows - 1) * 1.5) + 2);

    ORIGIN_X = (availW - boardW) / 2 + HEX_W / 2;
    ORIGIN_Y = (availH - boardH) / 2 + R;

    for (const h of board.active) {
      const x = ORIGIN_X + (h.q - board.minQ) * HEX_W + ((h.r & 1) ? (HEX_W / 2) : 0);
      const y = ORIGIN_Y + (h.r - board.minR) * STEP_Y;
      h.cx = x;
      h.cy = y;
    }

    draw();
  }

  function hexPath(cx, cy) {
    const p = new Path2D();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 30); // pointy top
      const x = cx + R * Math.cos(ang);
      const y = cy + R * Math.sin(ang);
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.closePath();
    return p;
  }

  function hexCorners(cx, cy) {
    // Corner order matches hexPath (i=0..5, angle = 60*i - 30)
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 30);
      pts.push({
        x: cx + R * Math.cos(ang),
        y: cy + R * Math.sin(ang),
      });
    }
    return pts;
  }

  function edgeCornerIdx(dir) {
    // Neighbor order is [E, NE, NW, W, SW, SE]
    switch (dir) {
      case 0: return [0, 1]; // E
      case 1: return [5, 0]; // NE
      case 2: return [4, 5]; // NW
      case 3: return [3, 4]; // W
      case 4: return [2, 3]; // SW
      case 5: return [1, 2]; // SE
      default: return [0, 1];
    }
  }

  function commandOutlinePath(sourceKey) {
    const sourceHex = board.byKey.get(sourceKey);
    const sourceUnit = unitsByHex.get(sourceKey);
    if (!sourceHex) return null;
    if (!isCommandSourceUnit(sourceUnit)) return null;

    const radius = commandRadiusForUnit(sourceUnit);
    if (radius <= 0) return null;

    // Command area = all active hexes within this source unit's command radius.
    const inside = new Set();
    for (const h of board.active) {
      if (axialDistance(h.q, h.r, sourceHex.q, sourceHex.r) <= radius) inside.add(h.k);
    }

    const path = new Path2D();

    for (const h of board.active) {
      if (!inside.has(h.k)) continue;

      const corners = hexCorners(h.cx, h.cy);
      const deltas = (h.r & 1) ? NEIGH_ODD : NEIGH_EVEN;

      for (let dir = 0; dir < 6; dir++) {
        const [dq, dr] = deltas[dir];
        const nk = key(h.q + dq, h.r + dr);

        // Only draw boundary edges: inside → outside.
        if (inside.has(nk)) continue;

        const [a, b] = edgeCornerIdx(dir);
        path.moveTo(corners[a].x, corners[a].y);
        path.lineTo(corners[b].x, corners[b].y);
      }
    }

    return path;
  }

  function pickHex(px, py) {
    let best = null;
    let bestD2 = Infinity;
    for (const h of board.active) {
      const dx = px - h.cx;
      const dy = py - h.cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = h;
      }
    }
    if (!best) return null;
    if (bestD2 > (R * R * 0.95)) return null;
    return best;
  }

  // --- Rendering
  // Terrain is intentionally a *tint* over a shared base, not a repaint.
  // That keeps the board calm while still making woods/hills/rough/water read instantly.
  const TERRAIN_THEMES = {
  battlefield: {
    base: '#c7c2a6',
    grid: 'rgba(0,0,0,0.28)',
    tint: {
      hills: 'rgba(176, 120, 40, 0.24)',
      woods: 'rgba(40, 120, 60, 0.22)',
      rough: 'rgba(110, 85, 70, 0.20)',
      water: 'rgba(30, 90, 170, 0.30)',
    },
  },
    // Classic tabletop parchment: subtle but readable.
    classic: {
      base: '#f4f2ea',
      grid: 'rgba(0,0,0,0.35)',
      tint: {
        hills: 'rgba(183, 131, 43, 0.18)',  // warm ochre
        woods: 'rgba(36, 122, 63, 0.20)',   // deep green
        rough: 'rgba(107, 84, 70, 0.16)',   // brown-grey
        water: 'rgba(30, 90, 170, 0.20)',   // river blue
      },
    },
    // Vivid Dusk: more saturation without turning the map into a neon quilt.
    vivid: {
      base: '#f4f2ea',
      grid: 'rgba(0,0,0,0.35)',
      tint: {
        hills: 'rgba(183, 131, 43, 0.26)',
        woods: 'rgba(36, 122, 63, 0.28)',
        rough: 'rgba(107, 84, 70, 0.22)',
        water: 'rgba(30, 90, 170, 0.28)',
      },
    },
    // Dark UI chrome option (kept because some people love it).
    dusk: {
      base: '#2f2d28',
      grid: 'rgba(255,255,255,0.14)',
      tint: {
        hills: 'rgba(183, 131, 43, 0.14)',
        woods: 'rgba(36, 122, 63, 0.16)',
        rough: 'rgba(107, 84, 70, 0.13)',
        water: 'rgba(30, 90, 170, 0.16)',
      },
    },
  };

  const TERRAIN_THEME_ORDER = ['vivid', 'classic', 'dusk'];

  function terrainTheme() {
    const theme = state.terrainTheme || 'vivid';
    return TERRAIN_THEMES[theme] || TERRAIN_THEMES.vivid;
  }

  function terrainBaseFill() {
    return terrainTheme().base || '#f4f2ea';
  }

  function terrainTint(t) {
    if (!t || t === 'clear') return null;
    const pal = terrainTheme();
    return (pal.tint && pal.tint[t]) ? pal.tint[t] : null;
  }

  function gridStroke() {
    return terrainTheme().grid || '#111';
  }
function unitColors(side) {
    return side === 'blue'
      ? { fill: '#0b3d91', stroke: '#8fb4ff', text: '#eaf2ff' }
      : { fill: '#7a1111', stroke: '#ff9a9a', text: '#ffecec' };
  }

  function qualityStroke(q) {
    switch (q) {
      case 'veteran': return '#d7b84b';
      case 'regular': return '#d0d0d0';
      default: return '#57d26a';
    }
  }

  function drawAdvanceArrow(fromHex, toHex, color = 'rgba(90, 220, 130, 0.9)', dashed = false) {
    if (!fromHex || !toHex) return;
    const dx = toHex.cx - fromHex.cx;
    const dy = toHex.cy - fromHex.cy;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const ux = dx / len;
    const uy = dy / len;
    const startPad = R * 0.36;
    const endPad = R * 0.50;
    const sx = fromHex.cx + ux * startPad;
    const sy = fromHex.cy + uy * startPad;
    const ex = toHex.cx - ux * endPad;
    const ey = toHex.cy - uy * endPad;
    const head = Math.max(7, R * 0.18);
    const wing = head * 0.65;
    const px = -uy;
    const py = ux;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    if (dashed) ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (dashed) ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - ux * head + px * wing, ey - uy * head + py * wing);
    ctx.lineTo(ex - ux * head - px * wing, ey - uy * head - py * wing);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBlockedMarker(hex, color = 'rgba(255, 163, 70, 0.95)') {
    if (!hex) return;
    const r = R * 0.22;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hex.cx - r, hex.cy - r);
    ctx.lineTo(hex.cx + r, hex.cy + r);
    ctx.moveTo(hex.cx + r, hex.cy - r);
    ctx.lineTo(hex.cx - r, hex.cy + r);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, elCanvas.width, elCanvas.height);
    const linePreview = lineAdvancePreviewFromSelection();

    // Background
    ctx.fillStyle = '#0b0b0d';
    ctx.fillRect(0, 0, elCanvas.width, elCanvas.height);

    // Hexes
    for (const h of board.active) {
      const p = hexPath(h.cx, h.cy);
      ctx.fillStyle = terrainBaseFill();
      ctx.fill(p);

      const tint = terrainTint(h.terrain);
      if (tint) {
        ctx.fillStyle = tint;
        ctx.fill(p);
      }

      // Outline
      ctx.strokeStyle = gridStroke();
      ctx.lineWidth = 2;
      ctx.stroke(p);

      // Overlays
      const k = h.k;
      if (state.mode === 'play' && state.selectedKey) {
        if (state._moveTargets?.has(k)) {
          ctx.strokeStyle = '#4aa3ff';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 6]);
          ctx.stroke(p);
          ctx.setLineDash([]);
        }
        if (state._attackTargets?.has(k)) {
          ctx.strokeStyle = '#ff5050';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 6]);
          ctx.stroke(p);
          ctx.setLineDash([]);
        }
      }
      if (linePreview && linePreview.formationSet.has(k)) {
        ctx.strokeStyle = (linePreview.anchorKey === k) ? '#ffe287' : '#ffd45a';
        ctx.lineWidth = (linePreview.anchorKey === k) ? 4 : 2.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke(p);
        ctx.setLineDash([]);
      }
      if (linePreview && linePreview.moveTargetSet.has(k)) {
        ctx.strokeStyle = '#5ee38d';
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 5]);
        ctx.stroke(p);
        ctx.setLineDash([]);
      }
      if (linePreview && linePreview.blockedFromSet.has(k)) {
        ctx.strokeStyle = 'rgba(255, 165, 70, 0.95)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([2, 4]);
        ctx.stroke(p);
        ctx.setLineDash([]);
      }

      // Hover
      if (state._hoverKey === k) {
        ctx.strokeStyle = '#ffffff55';
        ctx.lineWidth = 3;
        ctx.stroke(p);
      }
    }

    if (linePreview) {
      for (const m of linePreview.plan.moves) {
        const fromHex = board.byKey.get(m.fromKey);
        const toHex = board.byKey.get(m.toKey);
        drawAdvanceArrow(fromHex, toHex, 'rgba(90, 220, 130, 0.95)', false);
      }
      for (const b of linePreview.plan.blocked) {
        const fromHex = board.byKey.get(b.fromKey);
        const toHex = b.toKey ? board.byKey.get(b.toKey) : null;
        if (fromHex && toHex) {
          drawAdvanceArrow(fromHex, toHex, 'rgba(255, 165, 70, 0.85)', true);
          drawBlockedMarker(toHex, 'rgba(255, 165, 70, 0.95)');
        }
      }
    }

    // Command radius outlines (truthy, but calm): dotted perimeter.
    if (state.mode === 'play' && state.showCommand) {
      for (const [hk, u] of unitsByHex) {
        if (!isCommandSourceUnit(u)) continue;

        const p = commandOutlinePath(hk);
        if (!p) continue;

        const isSel = (state.selectedKey === hk);
        const isTurnSide = (u.side === state.side);
        const alpha = isSel ? 0.95 : (isTurnSide ? 0.80 : 0.30);
        // Thicker + slightly darker so the command perimeter reads clearly.
        const lw = (isSel ? 3 : (isTurnSide ? 2.25 : 1.75)) * 2;

        ctx.save();
        const strokeRgb = (u.type === 'run') ? '65, 169, 255' : '210, 118, 0';
        ctx.strokeStyle = `rgba(${strokeRgb}, ${alpha})`;
        ctx.lineWidth = lw;
        ctx.setLineDash(u.type === 'run' ? [2, 6] : [4, 6]);
        ctx.lineCap = 'round';
        ctx.stroke(p);
        ctx.restore();
      }
    }

    // Units
    for (const [hk, u] of unitsByHex) {
      const h = board.byKey.get(hk);
      if (!h) continue;

      const isPlay = (state.mode === 'play') && !state.gameOver;
      const isTurnSide = isPlay && (u.side === state.side);
      const isSpent = isTurnSide && state.actedUnitIds.has(u.id);
      const isCmdLocked = isTurnSide && !isSpent && (state.actsUsed < ACT_LIMIT) &&
        (!unitIgnoresCommand(u)) && (u.quality === 'green') && (!inCommandAt(hk, u.side));

      // Visual friction: spent units and unorderable greens read as "not available".
      // - spent: dim
      // - green out-of-command: dim + dashed orange ring
      const alpha = isSpent ? 0.38 : (isCmdLocked ? 0.48 : 1.0);

      const c = unitColors(u.side);

      ctx.save();
      ctx.globalAlpha = alpha;

      // Token disc
      ctx.beginPath();
      ctx.arc(h.cx, h.cy, R * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = c.fill;
      ctx.fill();

      // Token ring (quality)
      ctx.lineWidth = Math.max(2, Math.floor(R * 0.12));
      ctx.strokeStyle = qualityStroke(u.quality);
      ctx.stroke();

      // Selection ring
      if (state.selectedKey === hk) {
        ctx.beginPath();
        ctx.arc(h.cx, h.cy, R * 0.70, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
      // Unit mark (ICON preferred, text fallback)
      const def = UNIT_BY_ID.get(u.type);

      const img = UNIT_ICONS && UNIT_ICONS[u.type];
      const canIcon = (u.type !== 'gen') && unitIconReady && unitIconReady(u.type);

      if (canIcon) {
        const base = R * 0.95;
        const tune = (UNIT_ICON_TUNE && UNIT_ICON_TUNE[u.type]) ? UNIT_ICON_TUNE[u.type] : { scale: 0.95, y: 0 };
        const s = Math.floor(base * (tune.scale || 0.95));
        const yOff = Math.floor(R * (tune.y || 0));

        const rot = (typeof tune.rot === 'number') ? tune.rot : 0;

        ctx.imageSmoothingEnabled = true;
        if (rot) {
          ctx.save();
          ctx.translate(Math.floor(h.cx), Math.floor(h.cy + yOff));
          ctx.rotate(rot);
          ctx.drawImage(img, Math.floor(-s / 2), Math.floor(-s / 2), s, s);
          ctx.restore();
        } else {
          ctx.drawImage(img, Math.floor(h.cx - s / 2), Math.floor(h.cy - s / 2 + yOff), s, s);
        }
} else {
        // Original text symbols (kept as a fallback)
        const textScale = (u.type === 'inf' || u.type === 'cav' || u.type === 'skr') ? 0.83 : 1.0;
        const fontPx = Math.floor(R * 0.55 * textScale);
        ctx.font = `700 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = c.text;
        ctx.fillText(def.symbol, h.cx, h.cy + 1);
      }
      // HP pips (tiny)
      const maxHp = unitMaxHp(u.type, u.quality);
      const pipR = Math.max(2, Math.floor(R * 0.07));
      const startX = h.cx - (pipR * 2) * (maxHp - 1) * 0.5;
      const y = h.cy + R * 0.78;
      for (let i = 0; i < maxHp; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * (pipR * 2), y, pipR, 0, Math.PI * 2);
        ctx.fillStyle = (i < u.hp) ? '#fff' : '#ffffff33';
        ctx.fill();
      }

      ctx.restore();

      // Extra indicator: green out-of-command can't be activated (dashed orange ring).
      if (isCmdLocked) {
        ctx.beginPath();
        ctx.arc(h.cx, h.cy, R * 0.64, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 157, 0, 0.9)';
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // --- UI helpers
  function setActive(btn, isActive) {
    if (!btn) return;
    btn.classList.toggle('active', isActive);
  }

  function setRulesValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(value);
  }

  function rangedDice(type, dist) {
    const def = UNIT_BY_ID.get(type);
    if (!def || !def.ranged) return 0;
    const v = def.ranged[dist];
    return Number.isFinite(v) ? v : 0;
  }

  function populateRulesReference() {
    setRulesValue('rulesActLimit', ACT_LIMIT);
    setRulesValue('rulesCmdGreen', COMMAND_RADIUS_BY_QUALITY.green);
    setRulesValue('rulesCmdRegular', COMMAND_RADIUS_BY_QUALITY.regular);
    setRulesValue('rulesCmdVeteran', COMMAND_RADIUS_BY_QUALITY.veteran);

    const runDef = UNIT_BY_ID.get('run');
    setRulesValue('rulesRunMove', runDef ? runDef.move : '-');
    setRulesValue('rulesRunCmd', RUNNER_COMMAND_RADIUS);
    setRulesValue('rulesRunHp', unitMaxHp('run', 'green'));
    setRulesValue('rulesRunUp', unitUpValue('run', 'green'));

    setRulesValue('rulesInfMelee', UNIT_BY_ID.get('inf')?.meleeDice ?? '-');
    setRulesValue('rulesCavMelee', UNIT_BY_ID.get('cav')?.meleeDice ?? '-');
    setRulesValue('rulesSkrMelee', UNIT_BY_ID.get('skr')?.meleeDice ?? '-');
    setRulesValue('rulesArcMelee', UNIT_BY_ID.get('arc')?.meleeDice ?? '-');
    setRulesValue('rulesGenMelee', UNIT_BY_ID.get('gen')?.meleeDice ?? '-');
    setRulesValue('rulesArcRange2', rangedDice('arc', 2));
    setRulesValue('rulesArcRange3', rangedDice('arc', 3));
    setRulesValue('rulesSkrRange2', rangedDice('skr', 2));
  }

  function setRulesDrawerOpen(nextOpen) {
    const open = !!nextOpen;
    state.rulesOpen = open;
    if (!elRulesDrawer) return;
    elRulesDrawer.classList.toggle('open', open);
    elRulesDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function onlineModeActive() {
    return state.gameMode === 'online';
  }

  function onlineLibReady() {
    return typeof window.Peer === 'function';
  }

  function normalizeOnlineCode(raw) {
    const source = String(raw || '').toUpperCase();
    let out = '';
    for (const ch of source) {
      if (ONLINE_CODE_ALPHABET.includes(ch)) out += ch;
      if (out.length >= ONLINE_CODE_LENGTH) break;
    }
    return out;
  }

  function randomOnlineCode() {
    let out = '';
    for (let i = 0; i < ONLINE_CODE_LENGTH; i++) {
      const idx = Math.floor(Math.random() * ONLINE_CODE_ALPHABET.length);
      out += ONLINE_CODE_ALPHABET[idx];
    }
    return out;
  }

  function onlinePeerIdForCode(code) {
    return `${ONLINE_PEER_PREFIX}${normalizeOnlineCode(code)}`;
  }

  function onlineCodeFromPeerId(peerId) {
    const s = String(peerId || '');
    if (s.startsWith(ONLINE_PEER_PREFIX)) {
      return normalizeOnlineCode(s.slice(ONLINE_PEER_PREFIX.length));
    }
    return normalizeOnlineCode(s);
  }

  function setOnlineStatus(msg) {
    net.status = String(msg || 'Online: idle.');
    if (elOnlineStatus) elOnlineStatus.textContent = net.status;
  }

  function onlineRoleHintText() {
    if (!onlineModeActive()) {
      return 'Switch Game to Online, then create or join a room.';
    }
    if (net.connected && net.isHost) {
      return 'You are Host (Blue). You set scenario, rules, and when play starts.';
    }
    if (net.connected && !net.isHost) {
      return 'You are Guest (Red). Host controls setup/rules and starts play.';
    }
    if (net.peer && net.isHost) {
      return 'Room created. Share the 4-character room code with your friend.';
    }
    if (net.peer && !net.isHost) {
      return `Connecting to room ${net.remoteCode || '----'}...`;
    }
    return 'Host creates a room. Friend enters the 4-character code to connect.';
  }

  function ensureOnlineMode() {
    if (state.gameMode === 'online') return;
    state.gameMode = 'online';
    if (elGameModeSel) elGameModeSel.value = 'online';
  }

  function onlineSendPacket(packet) {
    if (!net.conn || !net.connected) return false;
    try {
      net.conn.send(packet);
      return true;
    } catch (err) {
      setOnlineStatus(`Online send failed: ${err && err.message ? err.message : String(err)}`);
      return false;
    }
  }

  function onlineBroadcastSnapshot(reason = 'sync') {
    if (!onlineModeActive()) return;
    if (!net.isHost || !net.connected) return;
    const snapshot = buildStateSnapshot();
    snapshot.state.gameMode = 'online';
    onlineSendPacket({ kind: 'snapshot', reason, snapshot });
  }

  function onlineCloseConnection() {
    if (net.conn) {
      try { net.conn.close(); } catch (_) {}
    }
    net.conn = null;
    net.connected = false;
    net.remoteCode = '';
  }

  function onlineDestroyPeer() {
    onlineCloseConnection();
    if (net.peer) {
      try { net.peer.destroy(); } catch (_) {}
    }
    net.peer = null;
    net.myCode = '';
    net.isHost = false;
  }

  function onlineLeaveSession(statusText = 'Online: idle.') {
    onlineDestroyPeer();
    setOnlineStatus(statusText);
    updateHud();
  }

  function onlineExpectedLocalSide() {
    return net.isHost ? 'blue' : 'red';
  }

  function executeOnlineActionLocal(action) {
    if (!action || typeof action !== 'object') return false;
    switch (action.type) {
      case 'click': {
        if (typeof action.hexKey !== 'string') return false;
        if (!board.activeSet.has(action.hexKey)) return false;
        clickPlay(action.hexKey);
        return true;
      }
      case 'pass':
        passSelected();
        return true;
      case 'line_advance':
        lineAdvanceFromSelection();
        return true;
      case 'end_turn':
        endTurn();
        return true;
      default:
        return false;
    }
  }

  function forwardOnlineAction(action) {
    if (!onlineModeActive() || !net.connected) return false;

    const localSide = onlineExpectedLocalSide();
    if (state.mode !== 'play' || state.gameOver) {
      log('Online: enter Play mode to act.');
      updateHud();
      return true;
    }
    if (state.side !== localSide) {
      log(`Online: waiting for ${state.side.toUpperCase()} player.`);
      updateHud();
      return true;
    }

    if (net.isHost) {
      executeOnlineActionLocal(action);
    } else {
      const ok = onlineSendPacket({ kind: 'action', action });
      if (!ok) {
        log('Online: failed to send action to host.');
        updateHud();
      }
    }
    return true;
  }

  function onOnlinePacket(packet) {
    if (!packet || typeof packet !== 'object') return;

    if (packet.kind === 'hello') {
      if (net.isHost) onlineBroadcastSnapshot('hello');
      return;
    }

    if (packet.kind === 'snapshot') {
      if (net.isHost) return;
      net.applyingRemoteSnapshot = true;
      applyImportedState(packet.snapshot, 'online sync', { silent: true });
      net.applyingRemoteSnapshot = false;
      return;
    }

    if (packet.kind === 'action') {
      if (!net.isHost || !onlineModeActive() || !net.connected) return;
      if (state.mode !== 'play' || state.gameOver) return;
      if (state.side !== 'red') {
        onlineBroadcastSnapshot('turn-mismatch');
        return;
      }
      executeOnlineActionLocal(packet.action);
      return;
    }
  }

  function bindOnlineConnection(conn) {
    if (!conn) return;
    onlineCloseConnection();
    net.conn = conn;
    if (typeof conn.peer === 'string') net.remoteCode = onlineCodeFromPeerId(conn.peer);

    conn.on('open', () => {
      net.connected = true;
      if (typeof conn.peer === 'string') net.remoteCode = onlineCodeFromPeerId(conn.peer);
      if (net.isHost) {
        setOnlineStatus(`Connected. Room ${net.myCode || '----'} is live.`);
      } else {
        setOnlineStatus(`Connected to room ${net.remoteCode || '----'}.`);
      }
      if (net.isHost) onlineBroadcastSnapshot('peer-open');
      else onlineSendPacket({ kind: 'hello' });
      updateHud();
    });
    conn.on('data', onOnlinePacket);
    conn.on('close', () => {
      if (net.conn !== conn) return;
      onlineCloseConnection();
      setOnlineStatus('Online: connection closed.');
      updateHud();
    });
    conn.on('error', (err) => {
      setOnlineStatus(`Online connection error: ${err && err.message ? err.message : String(err)}`);
      updateHud();
    });
  }

  function startOnlineHost() {
    ensureOnlineMode();
    if (!onlineLibReady()) {
      setOnlineStatus('Online unavailable: PeerJS failed to load.');
      updateHud();
      return;
    }

    onlineDestroyPeer();
    net.isHost = true;
    net.myCode = randomOnlineCode();

    function openHostPeer(triesLeft) {
      const roomCode = net.myCode || randomOnlineCode();
      const peerId = onlinePeerIdForCode(roomCode);
      let opened = false;
      const peer = new window.Peer(peerId);
      net.peer = peer;
      setOnlineStatus(`Creating room ${roomCode}...`);

      peer.on('open', (id) => {
        if (net.peer !== peer) return;
        opened = true;
        net.myCode = onlineCodeFromPeerId(id) || roomCode;
        setOnlineStatus(`Room ${net.myCode} ready. Share this code. You are BLUE.`);
        updateHud();
      });
      peer.on('connection', (conn) => {
        if (net.peer !== peer || !net.isHost) {
          try { conn.close(); } catch (_) {}
          return;
        }
        if (net.conn && net.connected) {
          try { conn.close(); } catch (_) {}
          return;
        }
        bindOnlineConnection(conn);
      });
      peer.on('error', (err) => {
        if (net.peer !== peer) return;
        const errText = String(err?.type || err?.message || err || '').toLowerCase();
        if (!opened && triesLeft > 0 && (errText.includes('unavailable') || errText.includes('taken') || errText.includes('id'))) {
          try { peer.destroy(); } catch (_) {}
          net.peer = null;
          net.myCode = randomOnlineCode();
          openHostPeer(triesLeft - 1);
          return;
        }
        setOnlineStatus(`Online host error: ${err && err.message ? err.message : String(err)}`);
        updateHud();
      });
      peer.on('close', () => {
        if (net.peer !== peer) return;
        onlineDestroyPeer();
        setOnlineStatus('Online: room closed.');
        updateHud();
      });
    }

    openHostPeer(8);

    updateHud();
  }

  function startOnlineJoin() {
    ensureOnlineMode();
    if (!onlineLibReady()) {
      setOnlineStatus('Online unavailable: PeerJS failed to load.');
      updateHud();
      return;
    }

    const hostCode = normalizeOnlineCode(elOnlineJoinCode?.value || '');
    if (elOnlineJoinCode) elOnlineJoinCode.value = hostCode;
    if (hostCode.length !== ONLINE_CODE_LENGTH) {
      setOnlineStatus(`Enter a ${ONLINE_CODE_LENGTH}-character room code.`);
      updateHud();
      return;
    }

    onlineDestroyPeer();
    net.isHost = false;
    net.remoteCode = hostCode;
    setOnlineStatus(`Connecting to room ${hostCode}...`);

    const peer = new window.Peer();
    net.peer = peer;

    peer.on('open', () => {
      if (net.peer !== peer) return;
      net.myCode = '';
      const conn = peer.connect(onlinePeerIdForCode(hostCode), { reliable: true });
      bindOnlineConnection(conn);
      updateHud();
    });
    peer.on('error', (err) => {
      if (net.peer !== peer) return;
      const errType = String(err?.type || '').toLowerCase();
      if (errType.includes('peer-unavailable')) {
        setOnlineStatus(`Room ${hostCode} not found. Check the code and try again.`);
      } else {
        setOnlineStatus(`Online join error: ${err && err.message ? err.message : String(err)}`);
      }
      updateHud();
    });
    peer.on('close', () => {
      if (net.peer !== peer) return;
      onlineDestroyPeer();
      setOnlineStatus('Online: join closed.');
      updateHud();
    });

    updateHud();
  }

  function compactLabel(text, maxLen = 22) {
    const s = String(text || '');
    if (s.length <= maxLen) return s;
    return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
  }

  function formatClock(ts) {
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '--:--';
    try {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }

  function humanizeQuality(q) {
    if (!q) return 'Green';
    return String(q).charAt(0).toUpperCase() + String(q).slice(1);
  }

  function setInspectorValue(el, value) {
    if (!el) return;
    el.textContent = String(value);
  }

  function resetInspector(message = 'Select a friendly unit in Play mode.') {
    setInspectorValue(elInspectorTitle, 'No unit selected.');
    setInspectorValue(elInspectorMeta, message);
    setInspectorValue(elInspectorSide, '-');
    setInspectorValue(elInspectorType, '-');
    setInspectorValue(elInspectorQuality, '-');
    setInspectorValue(elInspectorHex, '-');
    setInspectorValue(elInspectorHp, '-');
    setInspectorValue(elInspectorUp, '-');
    setInspectorValue(elInspectorCommand, '-');
    setInspectorValue(elInspectorRadius, '-');
  }

  function updateInspector() {
    if (!elInspectorTitle) return;

    const selectedKey = state.selectedKey;
    const u = selectedKey ? unitsByHex.get(selectedKey) : null;
    if (!u) {
      resetInspector();
      return;
    }

    const def = UNIT_BY_ID.get(u.type);
    if (!def) {
      resetInspector('Selected unit data is unavailable.');
      return;
    }

    const qualityText = humanizeQuality(u.quality);
    const maxHp = unitMaxHp(u.type, u.quality);
    const up = unitUpValue(u.type, u.quality);
    const inCmd = inCommandAt(selectedKey, u.side);

    let commandText = inCmd ? 'IN' : 'OUT';
    if (u.type === 'gen') commandText = 'IN (command source)';
    else if (u.type === 'run') commandText = 'IN (relay source)';
    else if (unitIgnoresCommand(u)) commandText += ' (independent)';

    let radiusText = '-';
    if (u.type === 'gen') radiusText = String(generalCommandRadius(u));
    else if (u.type === 'run') radiusText = String(RUNNER_COMMAND_RADIUS);
    const activationState = state.actedUnitIds.has(u.id) ? 'spent this turn' : 'ready';
    const metaText = (state.mode === 'play')
      ? `Play mode: ${activationState}.`
      : 'Edit mode preview values.';

    setInspectorValue(elInspectorTitle, `${u.side.toUpperCase()} ${def.abbrev} (${qualityText})`);
    setInspectorValue(elInspectorMeta, metaText);
    setInspectorValue(elInspectorSide, u.side.toUpperCase());
    setInspectorValue(elInspectorType, def.label);
    setInspectorValue(elInspectorQuality, qualityText);
    setInspectorValue(elInspectorHex, selectedKey);
    setInspectorValue(elInspectorHp, `${u.hp}/${maxHp}`);
    setInspectorValue(elInspectorUp, up);
    setInspectorValue(elInspectorCommand, commandText);
    setInspectorValue(elInspectorRadius, radiusText);
  }

  function diePipIndexes(value) {
    switch (value) {
      case 1: return [4];
      case 2: return [0, 8];
      case 3: return [0, 4, 8];
      case 4: return [0, 2, 6, 8];
      case 5: return [0, 2, 4, 6, 8];
      case 6: return [0, 2, 3, 5, 6, 8];
      default: return [];
    }
  }

  function applyDieFace(face, value) {
    const on = new Set(diePipIndexes(value));
    const pips = face.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].className = on.has(i) ? 'pip on' : 'pip';
    }
  }

  function makeDieFace(value) {
    const face = document.createElement('div');
    face.className = 'dieFace';
    for (let i = 0; i < 9; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip';
      face.appendChild(pip);
    }
    applyDieFace(face, value);
    return face;
  }

  function clearDiceDisplay() {
    diceRenderNonce += 1;
    if (elDiceSummary) elDiceSummary.textContent = 'No rolls yet.';
    if (elDiceTray) elDiceTray.innerHTML = '';
  }

  function renderDiceDisplay(rolls, info) {
    if (!elDiceSummary || !elDiceTray) return;

    diceRenderNonce += 1;
    const renderNonce = diceRenderNonce;

    const posText = (info.impactPosition && info.impactPosition !== 'none') ? `, ${info.impactPosition}` : '';
    const pivotText = info.pivoted ? ', pivot' : '';
    const flankText = info.flankBonus ? `, flank +${info.flankBonus}` : '';
    const rearText = info.rearBonus ? `, rear +${info.rearBonus}` : '';
    const woodsText = info.woodsPenalty ? `, woods -${info.woodsPenalty}` : '';
    const finalSummary =
      `${info.attacker} ${info.kind.toUpperCase()} r${info.dist} vs ${info.defender} · ` +
      `rolled ${info.dice} dice (base ${info.baseDice}${posText}${pivotText}${flankText}${rearText}${woodsText}) · ` +
      `H ${info.hits} / R ${info.retreats} / M ${info.misses}`;
    elDiceSummary.textContent = `Rolling ${info.dice} dice…`;

    elDiceTray.innerHTML = '';
    for (let i = 0; i < rolls.length; i++) {
      const roll = rolls[i];
      const die = document.createElement('div');
      die.className = 'die rolling';

      const face = makeDieFace(1 + Math.floor(Math.random() * 6));
      die.appendChild(face);

      const mark = document.createElement('span');
      mark.className = 'dieBadge';
      mark.textContent = '?';
      die.appendChild(mark);

      die.title = 'Rolling…';
      elDiceTray.appendChild(die);

      const settleDelay = 180 + (i * 80);
      setTimeout(() => {
        if (renderNonce !== diceRenderNonce) return;

        let outcome = 'miss';
        let badge = 'M';
        if (DIE_HIT.has(roll)) {
          outcome = 'hit';
          badge = 'H';
        } else if (roll === DIE_RETREAT) {
          outcome = 'retreat';
          badge = 'R';
        }

        applyDieFace(face, roll);
        die.className = `die ${outcome}`;
        mark.textContent = badge;
        die.title = `Roll ${roll} (${badge})`;
      }, settleDelay);
    }

    const summaryDelay = 220 + (Math.max(0, rolls.length - 1) * 80);
    setTimeout(() => {
      if (renderNonce !== diceRenderNonce) return;
      elDiceSummary.textContent = finalSummary;
    }, summaryDelay);
  }

  function log(msg) {
    state.last = msg;
    elHudLast.textContent = msg;

    state.events.push({ t: Date.now(), msg });
    if (state.events.length > 50) state.events.shift();
  }

  function totals(side) {
    let up = 0;
    let hp = 0;
    let gens = 0;
    let units = 0;

    for (const u of unitsByHex.values()) {
      if (u.side !== side) continue;
      up += unitUpValue(u.type, u.quality);
      hp += u.hp;
      units += 1;
      if (u.type === 'gen') gens += 1;
    }

    return { up, hp, gens, units };
  }

  function updateHud() {
    const blue = totals('blue');
    const red = totals('red');

    elHudTitle.textContent = `${GAME_NAME}  BUILD ${BUILD_ID}`;

    const mode = state.mode.toUpperCase();
    const meta = [
      `MODE=${mode}`,
      `GAME=${state.gameMode.toUpperCase()}`,
      `ADV=${state.forwardAxis.toUpperCase()}`,
      `TERRAIN=${(state.terrainTheme || 'vivid').toUpperCase()}`,
      `TURN=${state.side.toUpperCase()}#${state.turn}`,
      `ACT=${state.actsUsed}/${ACT_LIMIT}`,
      `ACTIVE=${board.active.length}`,
      `UNITS=${unitsByHex.size}`,
      `FORCES: B ${blue.up}u/${blue.hp}hp • R ${red.up}u/${red.hp}hp`,
      `CAP: B ${state.capturedUP.blue}u • R ${state.capturedUP.red}u`,
      `VICTORY=${state.victoryMode.toUpperCase()}`,
    ];
    if (state.lastImport && state.lastImport.source) {
      meta.push(`IMPORT=${compactLabel(state.lastImport.source)}@${formatClock(state.lastImport.at)}`);
    }
    if (state.aiBusy) {
      meta.push('AI=THINKING');
    }
    elHudMeta.textContent = meta.join('  ·  ');

    elModeBtn.textContent = state.mode === 'edit' ? 'To Play' : 'To Edit';
    if (elGameModeSel) {
      elGameModeSel.value = state.gameMode;
      elGameModeSel.disabled = (state.mode === 'play' && state.aiBusy) || (onlineModeActive() && net.connected);
    }
    const onlineMode = onlineModeActive();
    const guestOnlineLock = onlineMode && net.connected && !net.isHost;
    const shownCode = normalizeOnlineCode(net.isHost ? net.myCode : net.remoteCode);
    elModeBtn.disabled = guestOnlineLock;
    if (elOnlineMyCode) {
      elOnlineMyCode.textContent = shownCode || '----';
      elOnlineMyCode.classList.toggle('empty', !shownCode);
    }
    if (elOnlineRoleHint) elOnlineRoleHint.textContent = onlineRoleHintText();
    if (elOnlineStatus) elOnlineStatus.textContent = net.status;
    setActive(elOnlineHostBtn, onlineMode && !!net.peer && net.isHost);
    setActive(elOnlineJoinBtn, onlineMode && !!net.peer && !net.isHost);
    if (elOnlineHostBtn) {
      elOnlineHostBtn.disabled = (net.connected && net.isHost) || (net.peer && !net.isHost);
    }
    if (elOnlineJoinBtn) {
      elOnlineJoinBtn.disabled = (net.connected && !net.isHost) || (net.peer && net.isHost);
    }
    if (elOnlineLeaveBtn) {
      elOnlineLeaveBtn.disabled = (!net.peer && !net.connected);
    }
    if (elOnlineJoinCode) {
      elOnlineJoinCode.disabled = (net.connected && !net.isHost) || (net.peer && net.isHost);
    }
    if (elForwardAxisSel) {
      elForwardAxisSel.value = (state.forwardAxis === 'horizontal') ? 'horizontal' : 'vertical';
      elForwardAxisSel.disabled = (state.mode === 'play' && state.aiBusy) || (onlineMode && net.connected);
    }
    setActive(elRulesBtn, state.rulesOpen);
    setActive(elToolUnits, state.tool === 'units');
    setActive(elToolTerrain, state.tool === 'terrain');
    if (elToolUnits) elToolUnits.disabled = guestOnlineLock;
    if (elToolTerrain) elToolTerrain.disabled = guestOnlineLock;

    setActive(elSideBlue, state.editSide === 'blue');
    setActive(elSideRed, state.editSide === 'red');
    if (elSideBlue) elSideBlue.disabled = guestOnlineLock;
    if (elSideRed) elSideRed.disabled = guestOnlineLock;

    // Type buttons
    for (const b of elTypeBtns.querySelectorAll('button[data-type]')) {
      setActive(b, state.editType === b.dataset.type);
      b.disabled = guestOnlineLock;
    }
    setActive(elEraseBtn, state.editErase);
    if (elEraseBtn) elEraseBtn.disabled = guestOnlineLock;

    // Quality buttons
    const effectiveEditQuality = (state.editType === 'run') ? 'green' : state.editQuality;
    setActive(elQualityGreen, effectiveEditQuality === 'green');
    setActive(elQualityRegular, effectiveEditQuality === 'regular');
    setActive(elQualityVeteran, effectiveEditQuality === 'veteran');
    const runnerQualityLocked = (state.editType === 'run');
    elQualityGreen.disabled = guestOnlineLock;
    elQualityRegular.disabled = guestOnlineLock || runnerQualityLocked;
    elQualityVeteran.disabled = guestOnlineLock || runnerQualityLocked;

    // Terrain buttons
    for (const b of elTerrainBtns.querySelectorAll('button[data-terrain]')) {
      setActive(b, state.editTerrain === b.dataset.terrain);
      b.disabled = guestOnlineLock;
    }

    elEndTurnBtn.disabled = (state.mode !== 'play') || state.gameOver || isAiTurnActive();
    if (elLineAdvanceBtn) {
      const fArrow = sideForwardArrow(state.side, state.forwardAxis);
      const fWord = sideForwardWord(state.side, state.forwardAxis);
      elLineAdvanceBtn.textContent = `Line Advance ${fArrow}`;
      elLineAdvanceBtn.title = `Advance infantry one hex forward (${fWord}).`;
      elLineAdvanceBtn.disabled = !canIssueLineAdvance();
    }
    if (guestOnlineLock) {
      if (elScenarioSel) elScenarioSel.disabled = true;
      if (elScenarioGroupSel) elScenarioGroupSel.disabled = true;
      if (elScenarioLessonSel) elScenarioLessonSel.disabled = true;
      if (elScenarioSizeSel) elScenarioSizeSel.disabled = true;
      if (elScenarioTerrainSel) elScenarioTerrainSel.disabled = true;
      if (elLoadScenarioBtn) elLoadScenarioBtn.disabled = true;
      if (elClearUnitsBtn) elClearUnitsBtn.disabled = true;
      if (elExportStateBtn) elExportStateBtn.disabled = true;
      if (elImportStateBtn) elImportStateBtn.disabled = true;
    }

    updateInspector();
    draw();

    if (onlineMode && net.isHost && net.connected && !net.applyingRemoteSnapshot) {
      onlineBroadcastSnapshot('hud-sync');
    }
  }

  function isAiControlledSide(side) {
    return state.gameMode === 'hvai' && side === 'red';
  }

  function isAiTurnActive() {
    return state.mode === 'play' && !state.gameOver && isAiControlledSide(state.side);
  }

  function stopAiLoop() {
    if (state.aiTimer) {
      clearTimeout(state.aiTimer);
      state.aiTimer = null;
    }
    state.aiBusy = false;
  }

  function scheduleAiStep(delayMs = AI_STEP_DELAY_MS) {
    if (state.aiTimer) clearTimeout(state.aiTimer);
    state.aiTimer = setTimeout(() => {
      state.aiTimer = null;
      runAiTurnStep();
    }, delayMs);
  }

  function nearestEnemyDistance(fromKey, side) {
    const from = board.byKey.get(fromKey);
    if (!from) return Infinity;

    let best = Infinity;
    for (const [hk, u] of unitsByHex) {
      if (u.side === side) continue;
      const h = board.byKey.get(hk);
      if (!h) continue;
      const d = axialDistance(from.q, from.r, h.q, h.r);
      if (d < best) best = d;
    }
    return best;
  }

  function aiAttackScore(attackerKey, targetKey, attackerUnit) {
    const prof = attackDiceFor(attackerKey, targetKey, attackerUnit);
    if (!prof) return -Infinity;

    const target = unitsByHex.get(targetKey);
    if (!target) return -Infinity;

    let score = 0;
    score += prof.dice * 6;
    if (prof.kind === 'melee') score += 2;
    if (target.type === 'gen') score += 20;
    score += unitUpValue(target.type, target.quality);
    score += Math.max(0, 3 - target.hp) * 2;
    if (!retreatPick(attackerKey, targetKey)) score += 2;
    return score;
  }

  function bestAiAttackFrom(attackerKey, attackerUnit) {
    let bestTargetKey = null;
    let bestScore = -Infinity;
    const targets = computeAttackTargets(attackerKey, attackerUnit);
    for (const targetKey of targets) {
      const score = aiAttackScore(attackerKey, targetKey, attackerUnit);
      if (score > bestScore) {
        bestScore = score;
        bestTargetKey = targetKey;
      }
    }
    if (!bestTargetKey) return null;
    return { targetKey: bestTargetKey, score: bestScore };
  }

  function aiMoveScore(fromKey, destKey, unit, actCtx) {
    let score = 0;

    const fromDist = nearestEnemyDistance(fromKey, unit.side);
    const toDist = nearestEnemyDistance(destKey, unit.side);
    if (Number.isFinite(fromDist) && Number.isFinite(toDist)) {
      score += (fromDist - toDist) * 5;
      score += Math.max(0, 8 - toDist) * 0.5;
    }

    const follow = bestAiAttackFrom(destKey, unit);
    if (follow) score += 4 + follow.score * 0.2;

    if (isEngaged(destKey, unit.side)) score += 2;

    if (!unitIgnoresCommand(unit)) {
      const inCmd = inCommandAt(destKey, unit.side);
      if (!inCmd) {
        // Prefer not drifting command-dependent units away from command links.
        score -= 3;
      } else if (actCtx.inCommandStart) {
        score += 0.5;
      }
    }

    const h = board.byKey.get(destKey);
    if (h) {
      if (h.terrain === 'hills') score += 0.5;
      if (h.terrain === 'woods' && unit.type !== 'cav') score += 0.5;
      if (h.terrain === 'rough' && unit.type === 'cav') score -= 0.75;
    }

    return score;
  }

  function chooseAiPassPlan() {
    for (const [fromKey, u] of unitsByHex) {
      if (!unitCanActivate(u, fromKey)) continue;
      return { type: 'pass', fromKey };
    }
    return null;
  }

  function chooseAiActionPlan() {
    let bestAttack = null;
    let bestAttackScore = -Infinity;

    let bestMove = null;
    let bestMoveScore = -Infinity;

    let passPlan = null;

    for (const [fromKey, u] of unitsByHex) {
      if (!unitCanActivate(u, fromKey)) continue;

      if (!passPlan) passPlan = { type: 'pass', fromKey };

      const attack = bestAiAttackFrom(fromKey, u);
      if (attack && attack.score > bestAttackScore) {
        bestAttackScore = attack.score;
        bestAttack = {
          type: 'attack',
          fromKey,
          targetKey: attack.targetKey,
          score: attack.score,
        };
      }

      const actCtx = {
        inCommandStart: unitIgnoresCommand(u) ? true : inCommandAt(fromKey, u.side),
      };
      const moveTargets = computeMoveTargets(fromKey, u, actCtx);
      for (const destKey of moveTargets) {
        const score = aiMoveScore(fromKey, destKey, u, actCtx);
        if (score > bestMoveScore) {
          bestMoveScore = score;
          bestMove = {
            type: 'move',
            fromKey,
            destKey,
            score,
          };
        }
      }
    }

    if (bestAttack) return bestAttack;
    if (bestMove) return bestMove;
    return passPlan;
  }

  function executeAiActionPlan(plan) {
    if (!plan) return false;
    const actsBefore = state.actsUsed;

    selectUnit(plan.fromKey);
    if (state.selectedKey !== plan.fromKey) return false;

    if (plan.type === 'attack') {
      if (!state._attackTargets || !state._attackTargets.has(plan.targetKey)) {
        clearSelection();
        updateHud();
        return false;
      }
      attackFromSelection(plan.targetKey);
      return state.actsUsed > actsBefore || state.gameOver;
    }

    if (plan.type === 'move') {
      if (!state._moveTargets || !state._moveTargets.has(plan.destKey)) {
        clearSelection();
        updateHud();
        return false;
      }
      moveSelectedTo(plan.destKey);

      // Optional post-move attack: choose best available, else forfeit.
      if (state.selectedKey === plan.destKey && state._attackTargets && state._attackTargets.size > 0) {
        const movedUnit = unitsByHex.get(plan.destKey);
        let bestTargetKey = null;
        let bestScore = -Infinity;
        if (movedUnit) {
          for (const targetKey of state._attackTargets) {
            const score = aiAttackScore(plan.destKey, targetKey, movedUnit);
            if (score > bestScore) {
              bestScore = score;
              bestTargetKey = targetKey;
            }
          }
        }
        if (bestTargetKey && state._attackTargets.has(bestTargetKey)) {
          attackFromSelection(bestTargetKey);
        } else {
          clearSelection();
          updateHud();
        }
      } else {
        clearSelection();
        updateHud();
      }
      return state.actsUsed > actsBefore || state.gameOver;
    }

    if (plan.type === 'pass') {
      passSelected();
      return state.actsUsed > actsBefore || state.gameOver;
    }

    clearSelection();
    updateHud();
    return false;
  }

  function runAiTurnStep() {
    if (!isAiTurnActive()) {
      stopAiLoop();
      updateHud();
      return;
    }

    if (state.actsUsed >= ACT_LIMIT) {
      stopAiLoop();
      endTurn();
      return;
    }

    const plan = chooseAiActionPlan();
    if (!plan) {
      stopAiLoop();
      endTurn();
      return;
    }

    const acted = executeAiActionPlan(plan);
    if (!isAiTurnActive()) {
      stopAiLoop();
      updateHud();
      return;
    }

    if (!acted) {
      // Fallback once: try a pass from any legal unit, then give up turn.
      const passPlan = chooseAiPassPlan();
      if (!passPlan || !executeAiActionPlan(passPlan)) {
        stopAiLoop();
        endTurn();
        return;
      }
    }

    if (state.actsUsed >= ACT_LIMIT) {
      stopAiLoop();
      endTurn();
      return;
    }

    scheduleAiStep();
  }

  function maybeStartAiTurn() {
    if (!isAiTurnActive()) {
      stopAiLoop();
      return;
    }
    if (state.aiBusy) return;

    state.aiBusy = true;
    clearSelection();
    log(`AI turn: ${state.side.toUpperCase()} is acting...`);
    updateHud();
    scheduleAiStep(AI_START_DELAY_MS);
  }

  // --- Rules helpers
  function isOccupied(hk) {
    return unitsByHex.has(hk);
  }

  function terrainMoveCost(unitType, terrainId) {
    if (terrainId === 'water') return Infinity;
    if (terrainId === 'clear') return 1;

    // hills/woods/rough
    return (unitType === 'cav') ? 3 : 2;
  }

  function isEngaged(hexKey, side) {
    const h = board.byKey.get(hexKey);
    if (!h) return false;

    for (const nk of h.neigh) {
      const u = unitsByHex.get(nk);
      if (u && u.side !== side) return true;
    }

    return false;
  }

  function friendlyCommandSourceKeys(side) {
    const out = [];
    for (const [hk, u] of unitsByHex) {
      if (u.side === side && isCommandSourceUnit(u)) out.push(hk);
    }
    return out;
  }

  function inCommandAt(hexKey, side) {
    const sources = friendlyCommandSourceKeys(side);
    if (sources.length === 0) return false;

    const h = board.byKey.get(hexKey);
    if (!h) return false;

    for (const sourceKey of sources) {
      const sh = board.byKey.get(sourceKey);
      const su = unitsByHex.get(sourceKey);
      if (!sh || !su) continue;

      const radius = commandRadiusForUnit(su);
      if (radius <= 0) continue;

      const d = axialDistance(h.q, h.r, sh.q, sh.r);
      if (d <= radius) return true;
    }
    return false;
  }

  function unitIgnoresCommand(u) {
    if (u.type === 'gen') return true;
    if (u.type === 'run') return true;
    if (u.type === 'cav') return true;
    if (u.quality === 'veteran') return true;
    return false;
  }

  function unitCanActivate(u, hexKey) {
    if (state.mode !== 'play') return false;
    if (state.gameOver) return false;
    if (u.side !== state.side) return false;
    if (state.actsUsed >= ACT_LIMIT) return false;
    if (state.actedUnitIds.has(u.id)) return false;

    // Green command-dependent units out-of-command cannot be activated.
    if (!unitIgnoresCommand(u) && u.quality === 'green') {
      const cmd = inCommandAt(hexKey, u.side);
      if (!cmd) return false;
    }

    return true;
  }

  function activationBlockReason(u, hexKey) {
    if (state.mode !== 'play') return 'Not in Play mode.';
    if (state.gameOver) return 'Game over.';
    if (u.side !== state.side) return null; // stay calm; don’t narrate enemy clicks
    if (state.actsUsed >= ACT_LIMIT) return 'No activations left — End Turn.';
    if (state.actedUnitIds.has(u.id)) return 'Already acted this turn.';

    if (!unitIgnoresCommand(u) && u.quality === 'green') {
      const cmd = inCommandAt(hexKey, u.side);
      if (!cmd) return 'Out of command: Green units need GEN or RUN in range.';
    }

    return null;
  }

  function canWithdrawFromEngagement(u) {
    return u.type === 'skr' || u.type === 'run' || u.quality === 'veteran';
  }

  function disengageTargets(fromKey, u) {
    const out = new Set();
    const h = board.byKey.get(fromKey);
    if (!h) return out;

    const def = UNIT_BY_ID.get(u.type);
    const mp = def ? def.move : 0;

    for (const nk of h.neigh) {
      if (isOccupied(nk)) continue;
      const nh = board.byKey.get(nk);
      if (!nh) continue;

      const cost = terrainMoveCost(u.type, nh.terrain);
      if (!Number.isFinite(cost) || cost > mp) continue;

      // Withdrawal must end NOT adjacent to any enemy.
      if (isEngaged(nk, u.side)) continue;

      out.add(nk);
    }

    return out;
  }

  function unitCanMoveThisActivation(u, actCtx, startKey) {
    // Engagement makes the line sticky.
    const engaged = isEngaged(startKey, u.side);

    // Skirmishers and veterans may withdraw 1 hex if they can break contact.
    if (engaged) {
      return canWithdrawFromEngagement(u);
    }

    // Command dependence
    if (unitIgnoresCommand(u)) return true;

    // Regular INF/ARC/SKR require command to move.
    if (u.quality === 'regular') return !!actCtx.inCommandStart;

    // Green INF/ARC/SKR require command to move (but if green, activation gating already enforced).
    return !!actCtx.inCommandStart;
  }

  // --- Movement (MP + terrain costs)
  function computeMoveTargets(fromKey, u, actCtx) {
    const def = UNIT_BY_ID.get(u.type);
    const mp = def.move;

    // If movement isn't allowed, return empty set.
    if (!unitCanMoveThisActivation(u, actCtx, fromKey)) return new Set();

    const engaged = isEngaged(fromKey, u.side);

    // Engaged withdrawal: SKR and veterans may disengage 1 hex.
    if (engaged && canWithdrawFromEngagement(u)) {
      return disengageTargets(fromKey, u);
    }

    // Normal movement: least-cost reachability within MP budget.
    const out = new Set();
    const best = new Map();

    // Tiny board → a simple priority queue is fine.
    const pq = [{ k: fromKey, c: 0 }];
    best.set(fromKey, 0);

    while (pq.length) {
      // pop min cost
      pq.sort((a, b) => a.c - b.c);
      const cur = pq.shift();
      if (!cur) break;

      const h = board.byKey.get(cur.k);
      if (!h) continue;

      for (const nk of h.neigh) {
        if (isOccupied(nk)) continue;
        const nh = board.byKey.get(nk);
        if (!nh) continue;

        const stepCost = terrainMoveCost(u.type, nh.terrain);
        if (!Number.isFinite(stepCost)) continue; // water/impassable

        const nc = cur.c + stepCost;
        if (nc > mp) continue;

        const prevBest = best.get(nk);
        if (prevBest !== undefined && nc >= prevBest) continue;

        best.set(nk, nc);
        out.add(nk);
        pq.push({ k: nk, c: nc });
      }
    }

    return out;
  }

  function movementPathCost(fromKey, toKey, unitType) {
    if (fromKey === toKey) return 0;
    const def = UNIT_BY_ID.get(unitType);
    const mp = def ? def.move : 0;
    if (!def || mp <= 0) return null;

    const best = new Map();
    const pq = [{ k: fromKey, c: 0 }];
    best.set(fromKey, 0);

    while (pq.length) {
      pq.sort((a, b) => a.c - b.c);
      const cur = pq.shift();
      if (!cur) break;
      if (cur.k === toKey) return cur.c;

      const h = board.byKey.get(cur.k);
      if (!h) continue;

      for (const nk of h.neigh) {
        if (isOccupied(nk) && nk !== toKey) continue;
        const nh = board.byKey.get(nk);
        if (!nh) continue;

        const stepCost = terrainMoveCost(unitType, nh.terrain);
        if (!Number.isFinite(stepCost)) continue;

        const nc = cur.c + stepCost;
        if (nc > mp) continue;

        const prevBest = best.get(nk);
        if (prevBest !== undefined && nc >= prevBest) continue;

        best.set(nk, nc);
        pq.push({ k: nk, c: nc });
      }
    }

    return null;
  }

  function forwardStepKey(fromKey, side) {
    const h = board.byKey.get(fromKey);
    if (!h) return null;

    const f = sideForwardDelta(side);
    const nk = key(h.q + f.dq, h.r + f.dr);
    if (!board.activeSet.has(nk)) return null;

    // Guard against malformed geometry; forward step must be adjacent.
    if (!h.neigh.includes(nk)) return null;
    return nk;
  }

  function canLineAdvanceInfAt(hexKey, u) {
    if (!u || u.type !== 'inf') return false;
    if (u.side !== state.side) return false;
    if (!unitCanActivate(u, hexKey)) return false;
    if (isEngaged(hexKey, u.side)) return false;

    const inCmd = unitIgnoresCommand(u) ? true : inCommandAt(hexKey, u.side);
    return unitCanMoveThisActivation(u, { inCommandStart: inCmd }, hexKey);
  }

  function lineAdvancePreviewFromAnchor(anchorKey) {
    const anchorUnit = unitsByHex.get(anchorKey);
    if (!anchorUnit || anchorUnit.type !== 'inf' || anchorUnit.side !== state.side) return null;
    if (!canLineAdvanceInfAt(anchorKey, anchorUnit)) return null;

    const formation = collectLineAdvanceFormation(anchorKey);
    if (formation.length === 0) return null;

    const plan = lineAdvanceMovePlan(formation);
    const formationSet = new Set(formation);
    const moveTargetSet = new Set(plan.moves.map(m => m.toKey));
    const blockedFromSet = new Set(plan.blocked.map(b => b.fromKey));

    return {
      anchorKey,
      axis: normalizeForwardAxis(state.forwardAxis),
      side: anchorUnit.side,
      formation,
      formationSet,
      plan,
      moveTargetSet,
      blockedFromSet,
    };
  }

  function lineAdvancePreviewFromSelection() {
    if (state.mode !== 'play') return null;
    if (!state.selectedKey) return null;
    return lineAdvancePreviewFromAnchor(state.selectedKey);
  }

  function collectLineAdvanceFormation(anchorKey) {
    const anchorUnit = unitsByHex.get(anchorKey);
    const anchorHex = board.byKey.get(anchorKey);
    if (!anchorUnit || !anchorHex) return [];
    if (!canLineAdvanceInfAt(anchorKey, anchorUnit)) return [];

    const axis = normalizeForwardAxis(state.forwardAxis);
    const before = [];
    const after = [];

    if (axis === 'horizontal') {
      const file = anchorHex.q;

      for (let r = anchorHex.r - 1; ; r -= 1) {
        const hk = key(file, r);
        if (!board.activeSet.has(hk)) break;
        const u = unitsByHex.get(hk);
        if (!canLineAdvanceInfAt(hk, u)) break;
        before.push(hk);
      }

      for (let r = anchorHex.r + 1; ; r += 1) {
        const hk = key(file, r);
        if (!board.activeSet.has(hk)) break;
        const u = unitsByHex.get(hk);
        if (!canLineAdvanceInfAt(hk, u)) break;
        after.push(hk);
      }
    } else {
      const row = anchorHex.r;

      for (let q = anchorHex.q - 1; ; q -= 1) {
        const hk = key(q, row);
        if (!board.activeSet.has(hk)) break;
        const u = unitsByHex.get(hk);
        if (!canLineAdvanceInfAt(hk, u)) break;
        before.push(hk);
      }

      for (let q = anchorHex.q + 1; ; q += 1) {
        const hk = key(q, row);
        if (!board.activeSet.has(hk)) break;
        const u = unitsByHex.get(hk);
        if (!canLineAdvanceInfAt(hk, u)) break;
        after.push(hk);
      }
    }

    before.reverse();
    return [...before, anchorKey, ...after];
  }

  function lineAdvanceMovePlan(formation) {
    const formationSet = new Set(formation);
    const moves = [];
    const blocked = [];
    const infMove = UNIT_BY_ID.get('inf')?.move ?? 1;

    for (const fromKey of formation) {
      const u = unitsByHex.get(fromKey);
      if (!u) continue;

      const toKey = forwardStepKey(fromKey, u.side);
      if (!toKey) {
        blocked.push({ fromKey, toKey: null, reason: 'off-board' });
        continue;
      }
      if (!board.activeSet.has(toKey)) {
        blocked.push({ fromKey, toKey: null, reason: 'off-board' });
        continue;
      }

      if (unitsByHex.has(toKey) && !formationSet.has(toKey)) {
        blocked.push({ fromKey, toKey, reason: 'occupied' });
        continue;
      }

      const toHex = board.byKey.get(toKey);
      if (!toHex) {
        blocked.push({ fromKey, toKey: null, reason: 'off-board' });
        continue;
      }

      const cost = terrainMoveCost('inf', toHex.terrain);
      if (!Number.isFinite(cost) || cost > infMove) {
        blocked.push({ fromKey, toKey, reason: 'terrain' });
        continue;
      }

      moves.push({ fromKey, toKey, unit: u });
    }

    return { moves, blocked };
  }

  function canIssueLineAdvance() {
    if (state.mode !== 'play' || state.gameOver) return false;
    if (isAiTurnActive()) return false;
    if (state.actsUsed >= ACT_LIMIT) return false;
    const preview = lineAdvancePreviewFromSelection();
    if (!preview) return false;
    return preview.plan.moves.length > 0;
  }

  function lineAdvanceFromSelection() {
    if (state.mode !== 'play') return;
    if (state.gameOver) return;
    if (isAiTurnActive()) return;
    if (state.actsUsed >= ACT_LIMIT) {
      log('No activations left — End Turn.');
      updateHud();
      return;
    }
    if (!state.selectedKey) {
      log('Line Advance: select a friendly INF first.');
      updateHud();
      return;
    }

    const anchorKey = state.selectedKey;
    const anchor = unitsByHex.get(anchorKey);
    if (!anchor || anchor.side !== state.side || anchor.type !== 'inf') {
      log('Line Advance requires a selected friendly INF.');
      updateHud();
      return;
    }

    const preview = lineAdvancePreviewFromSelection();
    if (!preview) {
      log('Line Advance unavailable: selected INF cannot form an eligible line.');
      updateHud();
      return;
    }

    const formation = preview.formation;
    const plan = preview.plan;
    const moves = plan.moves;
    const blocked = plan.blocked;
    const directionArrow = sideForwardArrow(anchor.side, preview.axis);
    const directionWord = sideForwardWord(anchor.side, preview.axis);

    if (moves.length === 0) {
      log(`Line Advance blocked: no INF in the line can step forward ${directionArrow} (${directionWord}).`);
      updateHud();
      return;
    }

    // Formation order consumes one activation and marks every participant as spent.
    state.actsUsed = Math.min(ACT_LIMIT, state.actsUsed + 1);
    for (const hk of formation) {
      const u = unitsByHex.get(hk);
      if (u) state.actedUnitIds.add(u.id);
    }

    for (const m of moves) unitsByHex.delete(m.fromKey);
    for (const m of moves) unitsByHex.set(m.toKey, m.unit);

    clearSelection();

    const byReason = { offBoard: 0, occupied: 0, terrain: 0 };
    for (const b of blocked) {
      if (b.reason === 'off-board') byReason.offBoard += 1;
      else if (b.reason === 'occupied') byReason.occupied += 1;
      else if (b.reason === 'terrain') byReason.terrain += 1;
    }

    const blockParts = [];
    if (byReason.offBoard) blockParts.push(`off-board ${byReason.offBoard}`);
    if (byReason.occupied) blockParts.push(`occupied ${byReason.occupied}`);
    if (byReason.terrain) blockParts.push(`terrain ${byReason.terrain}`);
    const blockText = blockParts.length ? ` blocked(${blockParts.join(', ')})` : '';

    log(`Line Advance ${directionArrow}: ${moves.length}/${formation.length} INF advanced.${blockText}`);
    updateHud();
  }

  function veteranCavPostAttackWithdrawTargets(fromKey, u, actCtx) {
    const out = new Set();
    if (!u || u.type !== 'cav' || u.quality !== 'veteran') return out;
    if (!isEngaged(fromKey, u.side)) return out;

    const moveDef = UNIT_BY_ID.get(u.type);
    const maxMp = moveDef ? moveDef.move : 0;
    const remainingMp = Math.max(0, maxMp - (actCtx?.moveSpent || 0));
    if (remainingMp <= 0) return out;

    const h = board.byKey.get(fromKey);
    if (!h) return out;

    for (const nk of h.neigh) {
      if (isOccupied(nk)) continue;
      const nh = board.byKey.get(nk);
      if (!nh) continue;

      const cost = terrainMoveCost(u.type, nh.terrain);
      if (!Number.isFinite(cost) || cost > remainingMp) continue;
      if (isEngaged(nk, u.side)) continue;

      out.add(nk);
    }
    return out;
  }

  function attackApproachPosition(attackerKey, defenderKey, defenderSide) {
    const dHex = board.byKey.get(defenderKey);
    if (!dHex) return 'unknown';

    const fwd = sideForwardDelta(defenderSide);
    const frontKey = key(dHex.q + fwd.dq, dHex.r + fwd.dr);
    const rearKey = key(dHex.q - fwd.dq, dHex.r - fwd.dr);

    if (attackerKey === frontKey) return 'front';
    if (attackerKey === rearKey) return 'rear';
    return 'flank';
  }

  function infantryCanPivotOnDefense(defenderKey, defenderUnit) {
    if (!defenderUnit || defenderUnit.type !== 'inf') return false;
    if (defenderUnit.quality === 'veteran') return true;
    return inCommandAt(defenderKey, defenderUnit.side);
  }

  function cavalryAngleBonuses(attackerUnit, defenderUnit, kind, position) {
    if (!ENABLE_CAV_ANGLE_BONUS) return { flankBonus: 0, rearBonus: 0, totalBonus: 0 };
    if (kind !== 'melee') return { flankBonus: 0, rearBonus: 0, totalBonus: 0 };
    if (!attackerUnit || !defenderUnit) return { flankBonus: 0, rearBonus: 0, totalBonus: 0 };
    if (attackerUnit.type !== 'cav' || defenderUnit.type !== 'inf') {
      return { flankBonus: 0, rearBonus: 0, totalBonus: 0 };
    }
    if (position === 'rear') {
      return { flankBonus: 0, rearBonus: CAV_REAR_BONUS, totalBonus: CAV_REAR_BONUS };
    }
    if (position === 'flank') {
      return { flankBonus: CAV_FLANK_BONUS, rearBonus: 0, totalBonus: CAV_FLANK_BONUS };
    }
    return { flankBonus: 0, rearBonus: 0, totalBonus: 0 };
  }

  // --- Attacks (melee + ranged)
  function attackDiceFor(attackerKey, defenderKey, attackerUnit) {
    const atkHex = board.byKey.get(attackerKey);
    const defHex = board.byKey.get(defenderKey);
    if (!atkHex || !defHex) return null;

    const dist = axialDistance(atkHex.q, atkHex.r, defHex.q, defHex.r);
    if (dist < 1) return null;

    const engaged = isEngaged(attackerKey, attackerUnit.side);
    const atkDef = UNIT_BY_ID.get(attackerUnit.type);

    // Melee at range 1 is always possible.
    if (dist === 1) {
      const baseDice = atkDef.meleeDice;
      if (!Number.isFinite(baseDice) || baseDice <= 0) return null;
      return {
        kind: 'melee',
        dist,
        baseDice,
        dice: baseDice,
        flankBonus: 0,
        rearBonus: 0,
        impactPosition: 'none',
      };
    }

    // Beyond range 1 requires ranged capability and NOT being engaged.
    if (engaged) return null;
    if (!atkDef.ranged) return null;

    const dice = atkDef.ranged[dist];
    if (!dice) return null;

    return { kind: 'ranged', dist, baseDice: dice, dice, flankBonus: 0, rearBonus: 0, impactPosition: 'none' };
  }

  function computeAttackTargets(attackerKey, u) {
    const targets = new Set();

    for (const [hk, enemy] of unitsByHex) {
      if (enemy.side === u.side) continue;
      const prof = attackDiceFor(attackerKey, hk, u);
      if (prof) targets.add(hk);
    }

    return targets;
  }

  // --- Combat resolution
  function rollD6() {
    return 1 + Math.floor(Math.random() * 6);
  }

  function retreatPick(attackerKey, defenderKey) {
    // Choose retreat direction purely by geometry (maximizes distance), then
    // if the chosen hex is invalid (off-board/water/occupied), retreat converts to a hit.

    const aHex = board.byKey.get(attackerKey);
    const dHex = board.byKey.get(defenderKey);
    if (!aHex || !dHex) return null;

    const curDist = axialDistance(aHex.q, aHex.r, dHex.q, dHex.r);

    const deltas = (dHex.r & 1) ? NEIGH_ODD : NEIGH_EVEN;

    let bestKey = null;
    let bestDist = curDist;

    for (const [dq, dr] of deltas) {
      const nq = dHex.q + dq;
      const nr = dHex.r + dr;
      const nd = axialDistance(aHex.q, aHex.r, nq, nr);
      if (nd > bestDist) {
        bestDist = nd;
        bestKey = key(nq, nr);
      }
    }

    if (!bestKey) return null;

    // Validate the chosen retreat hex.
    if (!board.activeSet.has(bestKey)) return null;

    const bh = board.byKey.get(bestKey);
    if (!bh) return null;

    if (bh.terrain === 'water') return null;
    if (isOccupied(bestKey)) return null;

    return bestKey;
  }

  function consumeActivation(unitId) {
    state.actsUsed = Math.min(ACT_LIMIT, state.actsUsed + 1);
    state.actedUnitIds.add(unitId);
  }

  function destroyUnit(defenderKey, defenderUnit, attackerSide) {
    const defDef = UNIT_BY_ID.get(defenderUnit.type);
    const destroyedUp = unitUpValue(defenderUnit.type, defenderUnit.quality);

    unitsByHex.delete(defenderKey);

    state.capturedUP[attackerSide] += destroyedUp;

    log(`☠️ ${defenderUnit.side.toUpperCase()} ${defDef.abbrev} destroyed (+${destroyedUp}u).`);
  }

  function resolveAttack(attackerKey, defenderKey) {
    const atk = unitsByHex.get(attackerKey);
    const defU = unitsByHex.get(defenderKey);
    if (!atk || !defU) return;
    if (state.gameOver) return;

    const prof = attackDiceFor(attackerKey, defenderKey, atk);
    if (!prof) {
      log('Illegal attack.');
      return;
    }

    let impactPosition = 'none';
    let pivoted = false;
    let pivotFrom = 'none';

    if (prof.kind === 'melee') {
      const rawPos = attackApproachPosition(attackerKey, defenderKey, defU.side);
      impactPosition = rawPos;
      if (rawPos !== 'front' && infantryCanPivotOnDefense(defenderKey, defU)) {
        pivoted = true;
        pivotFrom = rawPos;
        impactPosition = 'front';
      }
    }

    // Terrain defensive modifier: defender in woods => -1 die (min 1)
    const defHex = board.byKey.get(defenderKey);
    const woodsPenalty = (defHex && defHex.terrain === 'woods') ? 1 : 0;
    const impact = cavalryAngleBonuses(atk, defU, prof.kind, impactPosition);
    const baseDice = prof.baseDice ?? prof.dice;
    const flankBonus = impact.flankBonus;
    const rearBonus = impact.rearBonus;
    const preTerrainDice = baseDice + impact.totalBonus;
    const dice = woodsPenalty ? Math.max(1, preTerrainDice - 1) : preTerrainDice;

    const rolls = [];
    for (let i = 0; i < dice; i++) rolls.push(rollD6());

    const atkDef = UNIT_BY_ID.get(atk.type);
    const defDef = UNIT_BY_ID.get(defU.type);

    const hits = rolls.filter(v => DIE_HIT.has(v)).length;
    const retreats = rolls.filter(v => v === DIE_RETREAT).length;
    const misses = Math.max(0, dice - hits - retreats);

    const tag = `${atk.side.toUpperCase()} ${atkDef.abbrev}`;
    const vs = `${defU.side.toUpperCase()} ${defDef.abbrev}`;
    if (pivoted) {
      log(`${vs} pivots to face the ${pivotFrom} attack.`);
    }
    const rollTokens = rolls.map((v) => {
      if (DIE_HIT.has(v)) return `${v}H`;
      if (v === DIE_RETREAT) return `${v}R`;
      return `${v}M`;
    });
    const modParts = [`base ${baseDice}`];
    if (flankBonus) modParts.push(`flank +${flankBonus}`);
    if (rearBonus) modParts.push(`rear +${rearBonus}`);
    if (woodsPenalty) modParts.push('woods -1');
    const modText = ` (${modParts.join(', ')})`;
    renderDiceDisplay(rolls, {
      attacker: tag,
      defender: vs,
      kind: prof.kind,
      dist: prof.dist,
      dice,
      baseDice,
      flankBonus,
      rearBonus,
      impactPosition,
      pivoted,
      woodsPenalty,
      hits,
      retreats,
      misses,
    });
    log(`${tag} ${prof.kind.toUpperCase()}→${vs} r${prof.dist} · dice=${dice}${modText}`);
    log(`Rolls: [${rollTokens.join(' ')}] => hits=${hits}, retreats=${retreats}, misses=${misses}.`);

    // Pass 1: apply hits
    if (hits > 0) {
      defU.hp -= hits;
      log(`Hits: ${hits} → ${vs} HP=${Math.max(0, defU.hp)}.`);
    }

    if (defU.hp <= 0) {
      destroyUnit(defenderKey, defU, atk.side);
      checkVictory();
      updateHud();
      return;
    }

    // Pass 2: resolve retreats one at a time
    for (let i = 0; i < retreats; i++) {
      const curDef = unitsByHex.get(defenderKey);
      if (!curDef) break;

      const step = retreatPick(attackerKey, defenderKey);
      if (!step) {
        curDef.hp -= 1;
        log(`Retreat blocked → 1 hit. ${vs} HP=${Math.max(0, curDef.hp)}.`);
        if (curDef.hp <= 0) {
          destroyUnit(defenderKey, curDef, atk.side);
          break;
        }
      } else {
        unitsByHex.delete(defenderKey);
        unitsByHex.set(step, curDef);
        defenderKey = step;
        log(`Retreat → ${step}`);
      }
    }

    checkVictory();
    updateHud();
  }

  // --- Victory
  function checkVictory() {
    if (state.mode !== 'play') return;

    const b = totals('blue');
    const r = totals('red');

    let blueWins = false;
    let redWins = false;

    if (state.victoryMode === 'annihilation') {
      blueWins = r.units === 0;
      redWins = b.units === 0;
    } else if (state.victoryMode === 'decapitation') {
      blueWins = r.gens === 0;
      redWins = b.gens === 0;
    } else {
      // Clear victory: capture at least half of opponent starting UP, rounded up.
      const needBlue = Math.ceil(state.initialUP.red / 2);
      const needRed = Math.ceil(state.initialUP.blue / 2);

      blueWins = state.capturedUP.blue >= needBlue;
      redWins = state.capturedUP.red >= needRed;
    }

    if (blueWins && redWins) {
      // If multiple victory conditions ever trigger simultaneously, the acting player wins.
      state.gameOver = true;
      state.winner = state.side;
      log(`Game over: ${state.side.toUpperCase()} wins (simultaneous victory).`);
    } else if (blueWins) {
      state.gameOver = true;
      state.winner = 'blue';
      log('Game over: BLUE wins.');
    } else if (redWins) {
      state.gameOver = true;
      state.winner = 'red';
      log('Game over: RED wins.');
    }
  }

  // --- Mode transitions
  function clearSelection() {
    state.selectedKey = null;
    state.act = null;
    state._moveTargets = null;
    state._attackTargets = null;
  }

  function enterEdit() {
    stopAiLoop();
    state.mode = 'edit';
    state.tool = 'units';

    state.gameOver = false;
    state.winner = null;

    clearSelection();

    log('Edit: place units / paint terrain.');
    updateHud();
  }

  function enterPlay() {
    stopAiLoop();
    state.mode = 'play';
    state.turn = 1;
    state.side = 'blue';
    state.actsUsed = 0;
    state.actedUnitIds = new Set();

    state.gameOver = false;
    state.winner = null;

    // Lock initial UP for Clear Victory.
    state.initialUP.blue = totals('blue').up;
    state.initialUP.red = totals('red').up;

    // Reset capture tally.
    state.capturedUP.blue = 0;
    state.capturedUP.red = 0;

    clearSelection();
    clearDiceDisplay();

    log('Play: click a friendly unit. Blue goes first.');
    updateHud();
    maybeStartAiTurn();
  }

  // --- Editing actions
  function normalizeQuality(type, quality) {
    // Keep legacy signature; quality now applies to all unit types, including GEN.
    if (type === 'run') return 'green';
    if (!QUALITY_ORDER.includes(quality)) return 'green';
    return quality;
  }

  function placeOrReplaceUnit(hexKey) {
    const h = board.byKey.get(hexKey);
    if (!h) return;

    if (state.editErase) {
      if (unitsByHex.delete(hexKey)) log(`Erased unit at ${hexKey}`);
      updateHud();
      return;
    }

    const type = state.editType;
    const def = UNIT_BY_ID.get(type);
    if (!def) return;

    const quality = normalizeQuality(type, state.editQuality);

    const existing = unitsByHex.get(hexKey);
    if (existing) {
      existing.side = state.editSide;
      existing.type = type;
      existing.quality = quality;
      existing.hp = unitMaxHp(type, quality);
      log(`Replaced at ${hexKey} → ${state.editSide} ${def.abbrev}`);
    } else {
      unitsByHex.set(hexKey, {
        id: nextUnitId++,
        side: state.editSide,
        type,
        quality,
        hp: unitMaxHp(type, quality),
      });
      log(`Placed ${state.editSide} ${def.abbrev} at ${hexKey}`);
    }

    updateHud();
  }

  function paintTerrain(hexKey) {
    const h = board.byKey.get(hexKey);
    if (!h) return;
    h.terrain = state.editTerrain;
    log(`Terrain ${state.editTerrain} at ${hexKey}`);
    updateHud();
  }

  function clearUnits() {
    unitsByHex.clear();
    nextUnitId = 1;
    log('Cleared all units.');
    updateHud();
  }

  function resetTerrain() {
    for (const h of board.active) h.terrain = 'clear';
  }

  function loadScenario(name) {
    const sc = SCENARIOS[name];
    if (!sc) return;

    const stats = {
      terrainPlaced: 0,
      terrainSkippedOffBoard: 0,
      terrainSkippedInvalidType: 0,
      terrainDuplicates: 0,
      unitsPlaced: 0,
      unitsSkippedOffBoard: 0,
      unitsSkippedBadType: 0,
      unitsSkippedBadSide: 0,
      unitsDuplicates: 0,
    };

    enterEdit();
    clearUnits();
    resetTerrain();
    clearDiceDisplay();

    // Terrain paint
    const seenTerrainHexes = new Set();
    for (const t of (sc.terrain || [])) {
      const k = key(t.q, t.r);
      if (!board.activeSet.has(k)) {
        stats.terrainSkippedOffBoard += 1;
        continue;
      }
      if (!TERRAIN_IDS.has(t.terrain)) {
        stats.terrainSkippedInvalidType += 1;
        continue;
      }
      if (seenTerrainHexes.has(k)) stats.terrainDuplicates += 1;
      seenTerrainHexes.add(k);

      const h = board.byKey.get(k);
      if (!h) {
        stats.terrainSkippedOffBoard += 1;
        continue;
      }
      h.terrain = t.terrain;
      stats.terrainPlaced += 1;
    }

    // Units
    const seenUnitHexes = new Set();
    for (const u of (sc.units || [])) {
      const k = key(u.q, u.r);
      if (!board.activeSet.has(k)) {
        stats.unitsSkippedOffBoard += 1;
        continue;
      }
      if (seenUnitHexes.has(k)) stats.unitsDuplicates += 1;
      seenUnitHexes.add(k);

      const def = UNIT_BY_ID.get(u.type);
      if (!def) {
        stats.unitsSkippedBadType += 1;
        continue;
      }
      if (u.side !== 'blue' && u.side !== 'red') {
        stats.unitsSkippedBadSide += 1;
        continue;
      }

      const quality = normalizeQuality(u.type, u.quality || 'green');
      unitsByHex.set(k, {
        id: nextUnitId++,
        side: u.side,
        type: u.type,
        quality,
        hp: unitMaxHp(u.type, quality),
      });
      stats.unitsPlaced += 1;
    }

    log(`Loaded scenario: ${name} (units=${stats.unitsPlaced}, terrain=${stats.terrainPlaced}).`);

    const skippedTotal =
      stats.terrainSkippedOffBoard +
      stats.terrainSkippedInvalidType +
      stats.unitsSkippedOffBoard +
      stats.unitsSkippedBadType +
      stats.unitsSkippedBadSide;
    const duplicateTotal = stats.terrainDuplicates + stats.unitsDuplicates;

    if (skippedTotal > 0 || duplicateTotal > 0) {
      log(
        `Scenario warnings: skipped=${skippedTotal} ` +
        `(terrain offboard ${stats.terrainSkippedOffBoard}, terrain invalid ${stats.terrainSkippedInvalidType}, ` +
        `units offboard ${stats.unitsSkippedOffBoard}, units bad type ${stats.unitsSkippedBadType}, ` +
        `units bad side ${stats.unitsSkippedBadSide}) · duplicates=${duplicateTotal} ` +
        `(terrain ${stats.terrainDuplicates}, units ${stats.unitsDuplicates}).`
      );
    }

    updateHud();
  }

  function clampInt(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(n)));
  }

  function nonNegNumber(v, fallback = 0) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
  }

  function buildStateSnapshot() {
    const terrain = [];
    for (const h of board.active) {
      if (h.terrain && h.terrain !== 'clear') {
        terrain.push({ q: h.q, r: h.r, terrain: h.terrain });
      }
    }

    const units = [];
    for (const [hk, u] of unitsByHex) {
      const h = board.byKey.get(hk);
      if (!h) continue;
      units.push({
        id: u.id,
        q: h.q,
        r: h.r,
        side: u.side,
        type: u.type,
        quality: u.quality,
        hp: u.hp,
      });
    }
    units.sort((a, b) => (a.r - b.r) || (a.q - b.q) || (a.id - b.id));

    return {
      format: 'bannerfall-state-v1',
      game: GAME_NAME,
      build: BUILD_ID,
      exportedAt: new Date().toISOString(),
      state: {
        mode: state.mode,
        gameMode: state.gameMode,
        forwardAxis: state.forwardAxis,
        tool: state.tool,
        turn: state.turn,
        side: state.side,
        actsUsed: state.actsUsed,
        actedUnitIds: [...state.actedUnitIds],
        victoryMode: state.victoryMode,
        initialUP: { ...state.initialUP },
        capturedUP: { ...state.capturedUP },
        gameOver: state.gameOver,
        winner: state.winner,
        showCommand: state.showCommand,
        terrainTheme: state.terrainTheme,
        terrain,
        units,
      },
    };
  }

  function exportStateToFile() {
    try {
      const snap = buildStateSnapshot();
      const text = JSON.stringify(snap, null, 2);
      const stamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
      const fileName = `bannerfall-state-${stamp}.json`;

      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      log(`Exported state: ${fileName} (units=${snap.state.units.length}, terrain=${snap.state.terrain.length}).`);
      updateHud();
    } catch (err) {
      log(`Export failed: ${err && err.message ? err.message : String(err)}`);
      updateHud();
    }
  }

  function resolveImportPayload(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: 'Import failed: expected a JSON object.' };
    }

    if (Object.prototype.hasOwnProperty.call(raw, 'format')) {
      if (raw.format !== 'bannerfall-state-v1') {
        return { ok: false, error: `Import failed: unsupported format "${String(raw.format)}".` };
      }
      if (!raw.state || typeof raw.state !== 'object' || Array.isArray(raw.state)) {
        return { ok: false, error: 'Import failed: bannerfall-state-v1 requires a "state" object.' };
      }
      return { ok: true, payload: raw.state };
    }

    if (Object.prototype.hasOwnProperty.call(raw, 'state')) {
      if (!raw.state || typeof raw.state !== 'object' || Array.isArray(raw.state)) {
        return { ok: false, error: 'Import failed: "state" must be a JSON object.' };
      }
      return { ok: true, payload: raw.state };
    }

    const looksLikeState =
      Array.isArray(raw.units) ||
      Array.isArray(raw.terrain) ||
      Object.prototype.hasOwnProperty.call(raw, 'turn') ||
      Object.prototype.hasOwnProperty.call(raw, 'side') ||
      Object.prototype.hasOwnProperty.call(raw, 'mode') ||
      Object.prototype.hasOwnProperty.call(raw, 'victoryMode');

    if (!looksLikeState) {
      return { ok: false, error: 'Import failed: this JSON does not look like a Bannerfall state file.' };
    }

    return { ok: true, payload: raw };
  }

  function applyImportedState(raw, sourceLabel = 'import', options = null) {
    const opts = (options && typeof options === 'object') ? options : {};
    const silent = !!opts.silent;
    stopAiLoop();

    const resolved = resolveImportPayload(raw);
    if (!resolved.ok) {
      if (!silent) log(resolved.error);
      updateHud();
      return;
    }
    const payload = resolved.payload;

    const report = {
      terrainApplied: 0,
      terrainSkippedOffBoard: 0,
      terrainSkippedInvalidType: 0,
      terrainDuplicates: 0,
      unitsPlaced: 0,
      unitsSkippedOffBoard: 0,
      unitsSkippedBadType: 0,
      unitsSkippedBadSide: 0,
      unitsDuplicates: 0,
      unitsHpAdjusted: 0,
      unitsIdRemapped: 0,
    };

    // Reset board without "load scenario" side effects.
    unitsByHex.clear();
    nextUnitId = 1;
    resetTerrain();
    clearSelection();

    // Terrain
    const seenTerrainHexes = new Set();
    const terrainArr = Array.isArray(payload.terrain) ? payload.terrain : [];
    for (const t of terrainArr) {
      if (!t || typeof t !== 'object') continue;
      const q = Math.trunc(Number(t.q));
      const r = Math.trunc(Number(t.r));
      const k = key(q, r);

      if (!board.activeSet.has(k)) {
        report.terrainSkippedOffBoard += 1;
        continue;
      }
      if (!TERRAIN_IDS.has(t.terrain)) {
        report.terrainSkippedInvalidType += 1;
        continue;
      }
      if (seenTerrainHexes.has(k)) report.terrainDuplicates += 1;
      seenTerrainHexes.add(k);

      const h = board.byKey.get(k);
      if (!h) {
        report.terrainSkippedOffBoard += 1;
        continue;
      }
      h.terrain = t.terrain;
      report.terrainApplied += 1;
    }

    // Units
    const seenUnitHexes = new Set();
    const usedIds = new Set();
    let maxAssignedId = 0;
    let nextAutoId = 1;

    function claimUnitId(rawId) {
      const n = Number(rawId);
      if (Number.isInteger(n) && n > 0 && !usedIds.has(n)) {
        usedIds.add(n);
        maxAssignedId = Math.max(maxAssignedId, n);
        return n;
      }
      report.unitsIdRemapped += 1;
      while (usedIds.has(nextAutoId)) nextAutoId += 1;
      const id = nextAutoId++;
      usedIds.add(id);
      maxAssignedId = Math.max(maxAssignedId, id);
      return id;
    }

    const unitArr = Array.isArray(payload.units) ? payload.units : [];
    for (const u of unitArr) {
      if (!u || typeof u !== 'object') continue;
      const q = Math.trunc(Number(u.q));
      const r = Math.trunc(Number(u.r));
      const k = key(q, r);

      if (!board.activeSet.has(k)) {
        report.unitsSkippedOffBoard += 1;
        continue;
      }
      if (seenUnitHexes.has(k)) report.unitsDuplicates += 1;
      seenUnitHexes.add(k);

      const def = UNIT_BY_ID.get(u.type);
      if (!def) {
        report.unitsSkippedBadType += 1;
        continue;
      }
      if (u.side !== 'blue' && u.side !== 'red') {
        report.unitsSkippedBadSide += 1;
        continue;
      }

      const quality = normalizeQuality(u.type, u.quality || 'green');
      const maxHp = unitMaxHp(u.type, quality);
      const rawHp = Number(u.hp);
      let hp = maxHp;
      if (Number.isFinite(rawHp)) {
        hp = Math.max(1, Math.min(maxHp, Math.trunc(rawHp)));
        if (hp !== rawHp) report.unitsHpAdjusted += 1;
      } else {
        report.unitsHpAdjusted += 1;
      }

      unitsByHex.set(k, {
        id: claimUnitId(u.id),
        side: u.side,
        type: u.type,
        quality,
        hp,
      });
      report.unitsPlaced += 1;
    }
    nextUnitId = Math.max(1, maxAssignedId + 1);

    // Restore state fields
    const restoreMode = (payload.mode === 'play') ? 'play' : 'edit';
    state.gameMode = (payload.gameMode === 'hvai' || payload.gameMode === 'online') ? payload.gameMode : 'hvh';
    state.forwardAxis = normalizeForwardAxis(payload.forwardAxis);
    state.mode = restoreMode;
    state.tool = (payload.tool === 'terrain') ? 'terrain' : 'units';

    state.turn = Math.max(1, clampInt(payload.turn, 1, 999999, 1));
    state.side = (payload.side === 'red') ? 'red' : 'blue';
    state.actsUsed = clampInt(payload.actsUsed, 0, ACT_LIMIT, 0);

    state.actedUnitIds = new Set();
    const actedIds = Array.isArray(payload.actedUnitIds) ? payload.actedUnitIds : [];
    for (const id of actedIds) {
      const n = Number(id);
      if (Number.isInteger(n) && usedIds.has(n)) state.actedUnitIds.add(n);
    }

    const victoryModes = new Set(['clear', 'decapitation', 'annihilation']);
    state.victoryMode = victoryModes.has(payload.victoryMode) ? payload.victoryMode : 'clear';
    elVictorySel.value = state.victoryMode;

    const nowBlue = totals('blue').up;
    const nowRed = totals('red').up;
    state.initialUP = {
      blue: nonNegNumber(payload?.initialUP?.blue, nowBlue),
      red: nonNegNumber(payload?.initialUP?.red, nowRed),
    };
    state.capturedUP = {
      blue: nonNegNumber(payload?.capturedUP?.blue, 0),
      red: nonNegNumber(payload?.capturedUP?.red, 0),
    };

    state.gameOver = !!payload.gameOver;
    state.winner = (payload.winner === 'blue' || payload.winner === 'red') ? payload.winner : null;
    if (!state.gameOver) state.winner = null;

    state.showCommand = (typeof payload.showCommand === 'boolean') ? payload.showCommand : true;
    if (typeof payload.terrainTheme === 'string' && TERRAIN_THEMES[payload.terrainTheme]) {
      state.terrainTheme = payload.terrainTheme;
    }

    if (state.mode === 'edit') {
      // Keep Edit mode deterministic and uncluttered after import.
      state.actsUsed = 0;
      state.actedUnitIds = new Set();
      state.gameOver = false;
      state.winner = null;
      clearSelection();
    }

    if (!silent) {
      state.lastImport = {
        source: String(sourceLabel || 'import'),
        at: Date.now(),
      };

      log(
        `Imported state: ${sourceLabel} ` +
        `(units=${report.unitsPlaced}, terrain=${report.terrainApplied}, mode=${state.mode.toUpperCase()}, ` +
        `turn=${state.turn}, side=${state.side.toUpperCase()}).`
      );
    }

    const skippedTotal =
      report.terrainSkippedOffBoard +
      report.terrainSkippedInvalidType +
      report.unitsSkippedOffBoard +
      report.unitsSkippedBadType +
      report.unitsSkippedBadSide;
    const duplicateTotal = report.terrainDuplicates + report.unitsDuplicates;
    const adjustedTotal = report.unitsHpAdjusted + report.unitsIdRemapped;

    if (!silent && (skippedTotal > 0 || duplicateTotal > 0 || adjustedTotal > 0)) {
      log(
        `Import warnings: skipped=${skippedTotal} ` +
        `(terrain offboard ${report.terrainSkippedOffBoard}, terrain invalid ${report.terrainSkippedInvalidType}, ` +
        `units offboard ${report.unitsSkippedOffBoard}, units bad type ${report.unitsSkippedBadType}, ` +
        `units bad side ${report.unitsSkippedBadSide}) · duplicates=${duplicateTotal} ` +
        `(terrain ${report.terrainDuplicates}, units ${report.unitsDuplicates}) · adjusted=${adjustedTotal} ` +
        `(hp ${report.unitsHpAdjusted}, ids ${report.unitsIdRemapped}).`
      );
    }

    updateHud();
    maybeStartAiTurn();
  }

  function importStateFromText(text, sourceLabel = 'import') {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      log(`Import failed: invalid JSON (${err && err.message ? err.message : String(err)}).`);
      updateHud();
      return;
    }
    applyImportedState(parsed, sourceLabel);
  }

  function importStateFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      importStateFromText(String(reader.result || ''), file.name || 'import');
    };
    reader.onerror = () => {
      log('Import failed: could not read file.');
      updateHud();
    };
    reader.readAsText(file);
  }

  // --- Turn handling
  function endTurn() {
    if (state.mode !== 'play') return;
    if (state.gameOver) return;

    stopAiLoop();

    state.side = (state.side === 'blue') ? 'red' : 'blue';
    if (state.side === 'blue') state.turn += 1;

    state.actsUsed = 0;
    state.actedUnitIds = new Set();

    clearSelection();

    log(`Turn ${state.turn}: ${state.side.toUpperCase()}.`);
    updateHud();
    maybeStartAiTurn();
  }

  // --- Play interaction
  function selectUnit(hexKey) {
    const u = unitsByHex.get(hexKey);
    if (!u) return;

    if (!unitCanActivate(u, hexKey)) return;

    const inCmd = unitIgnoresCommand(u) ? true : inCommandAt(hexKey, u.side);

    state.selectedKey = hexKey;
    state.act = {
      unitId: u.id,
      committed: false,
      moved: false,
      attacked: false,
      inCommandStart: inCmd,
      moveSpent: 0,
      postAttackWithdrawOnly: false,
    };

    // Precompute targets
    state._moveTargets = computeMoveTargets(hexKey, u, state.act);
    state._attackTargets = computeAttackTargets(hexKey, u);

    const def = UNIT_BY_ID.get(u.type);
    const engaged = isEngaged(hexKey, u.side);
    const notes = [];

    if (engaged) {
      if (u.type === 'skr') notes.push('Engaged: SKR may disengage 1 hex.');
      else if (u.type === 'run') notes.push('Engaged: RUN may disengage 1 hex.');
      else if (u.quality === 'veteran') notes.push('Engaged: Veteran may withdraw 1 hex.');
      else notes.push('Engaged: cannot move.');
    } else if (!unitIgnoresCommand(u) && u.quality === 'regular' && !inCmd) {
      notes.push('Out of command: cannot move (can attack).');
    }

    log(`Selected ${u.side.toUpperCase()} ${def.abbrev}.${notes.length ? ' ' + notes.join(' ') : ''}`);
    updateHud();
  }

  function moveSelectedTo(destKey) {
    const fromKey = state.selectedKey;
    if (!fromKey || !state.act) return;

    const u = unitsByHex.get(fromKey);
    if (!u) return;

    const isPostAttackWithdraw = !!state.act.postAttackWithdrawOnly;

    if (!isPostAttackWithdraw && (state.act.moved || state.act.attacked)) {
      log('Illegal move (already acted).');
      return;
    }

    if (!state._moveTargets || !state._moveTargets.has(destKey)) {
      log('Illegal move.');
      return;
    }

    // Commit activation on the FIRST real action.
    if (!state.act.committed) {
      consumeActivation(u.id);
      state.act.committed = true;
    }

    const stepCost = movementPathCost(fromKey, destKey, u.type);
    if (Number.isFinite(stepCost) && stepCost > 0) {
      state.act.moveSpent = (state.act.moveSpent || 0) + stepCost;
    }

    unitsByHex.delete(fromKey);
    unitsByHex.set(destKey, u);
    state.selectedKey = destKey;
    state.act.moved = true;

    if (isPostAttackWithdraw) {
      log(`Veteran CAV disengaged to ${destKey}.`);
      clearSelection();
      updateHud();
      return;
    }

    log(`Moved to ${destKey}.`);

    // After moving, you may make at most ONE attack (same activation).
    state._moveTargets = null;
    state._attackTargets = computeAttackTargets(destKey, u);

    updateHud();
  }

  function attackFromSelection(targetKey) {
    const attackerKey = state.selectedKey;
    if (!attackerKey || !state.act) return;

    const atk = unitsByHex.get(attackerKey);
    if (!atk) return;

    if (state.act.attacked) {
      log('Illegal attack (already attacked).');
      return;
    }

    // Validate target exists and is enemy.
    const enemy = unitsByHex.get(targetKey);
    if (!enemy || enemy.side === atk.side) {
      log('Illegal attack target.');
      return;
    }

    if (!state._attackTargets || !state._attackTargets.has(targetKey)) {
      log('Illegal attack.');
      return;
    }

    // Commit activation on the FIRST real action.
    if (!state.act.committed) {
      consumeActivation(atk.id);
      state.act.committed = true;
    }

    resolveAttack(attackerKey, targetKey);

    state.act.attacked = true;

    const afterAtk = unitsByHex.get(attackerKey);
    if (afterAtk) {
      const withdrawTargets = veteranCavPostAttackWithdrawTargets(attackerKey, afterAtk, state.act);
      if (withdrawTargets.size > 0) {
        state.act.postAttackWithdrawOnly = true;
        state._moveTargets = withdrawTargets;
        state._attackTargets = new Set();
        log('Veteran CAV may disengage: choose a withdrawal hex or click selected unit to end activation.');
        updateHud();
        return;
      }
    }

    // End activation after attack.
    clearSelection();
    updateHud();
  }

  function passSelected() {
    if (state.mode !== 'play') return;
    if (!state.selectedKey || !state.act) return;

    const u = unitsByHex.get(state.selectedKey);
    if (!u) return;

    if (state.act.committed) {
      log('Pass not available (already committed).');
      return;
    }

    consumeActivation(u.id);
    state.act.committed = true;
    log(`Pass: ${u.side.toUpperCase()} ${UNIT_BY_ID.get(u.type).abbrev}.`);

    clearSelection();
    updateHud();
  }

  function clickPlay(hexKey) {
    const clickedUnit = unitsByHex.get(hexKey);

    // If nothing selected: try to select.
    if (!state.selectedKey) {
      if (clickedUnit) {
        const reason = activationBlockReason(clickedUnit, hexKey);
        if (reason) {
          log(reason);
          updateHud();
          return;
        }
        if (unitCanActivate(clickedUnit, hexKey)) selectUnit(hexKey);
      }
      return;
    }

    const selKey = state.selectedKey;
    const selUnit = unitsByHex.get(selKey);
    if (!selUnit) {
      clearSelection();
      updateHud();
      return;
    }

    // Clicking the selected hex toggles deselect.
    if (hexKey === selKey) {
      clearSelection();
      log('Deselected.');
      updateHud();
      return;
    }

    // Attack
    if (clickedUnit && clickedUnit.side !== selUnit.side && state._attackTargets?.has(hexKey)) {
      attackFromSelection(hexKey);
      return;
    }

    // Move
    if (!clickedUnit && state._moveTargets?.has(hexKey)) {
      moveSelectedTo(hexKey);
      return;
    }

    // Switch selection to another friendly (forfeits any optional post-move attack)
    if (clickedUnit && clickedUnit.side === state.side) {
      clearSelection();
      const reason = activationBlockReason(clickedUnit, hexKey);
      if (reason) {
        log(reason);
        updateHud();
        return;
      }
      if (unitCanActivate(clickedUnit, hexKey)) selectUnit(hexKey);
      return;
    }
  }

  // --- Events
  elCanvas.addEventListener('mousemove', (e) => {
    const rect = elCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const h = pickHex(x, y);
    state._hoverKey = h ? h.k : null;
    draw();
  });

  elCanvas.addEventListener('mouseleave', () => {
    state._hoverKey = null;
    draw();
  });

  elCanvas.addEventListener('click', (e) => {
    const rect = elCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const h = pickHex(x, y);
    if (!h) return;

    if (state.mode === 'edit') {
      if (onlineModeActive() && net.connected && !net.isHost) {
        log('Online: host controls setup and mode.');
        updateHud();
        return;
      }
      if (state.tool === 'terrain') paintTerrain(h.k);
      else placeOrReplaceUnit(h.k);
    } else {
      if (onlineModeActive()) {
        if (forwardOnlineAction({ type: 'click', hexKey: h.k })) return;
      }
      if (isAiTurnActive()) return;
      clickPlay(h.k);
    }
  });

  // Keyboard: P = pass, L = line advance (with selected INF)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.rulesOpen) {
      e.preventDefault();
      setRulesDrawerOpen(false);
      updateHud();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      if (state.mode === 'play' && state.selectedKey && !isAiTurnActive()) {
        e.preventDefault();
        if (onlineModeActive() && forwardOnlineAction({ type: 'pass' })) return;
        passSelected();
      }
    }

    if (e.key === 'l' || e.key === 'L') {
      if (state.mode === 'play' && !isAiTurnActive()) {
        e.preventDefault();
        if (onlineModeActive() && forwardOnlineAction({ type: 'line_advance' })) return;
        lineAdvanceFromSelection();
      }
    }

    // Toggle command radius overlay
    if (e.key === 'c' || e.key === 'C') {
      if (state.mode === 'play') {
        state.showCommand = !state.showCommand;
        log(`Command radius: ${state.showCommand ? 'ON' : 'OFF'}.`);
        updateHud();
      }
    }
    // Toggle terrain palette (visual only)
    if (e.key === 't' || e.key === 'T') {
      const cur = state.terrainTheme || 'vivid';
      const i = TERRAIN_THEME_ORDER.indexOf(cur);
      state.terrainTheme = TERRAIN_THEME_ORDER[(i + 1) % TERRAIN_THEME_ORDER.length];
      log(`Terrain palette: ${state.terrainTheme.toUpperCase()}.`);
      updateHud();
    }
  });

  window.addEventListener('resize', resize);

  elModeBtn.addEventListener('click', () => {
    if (onlineModeActive() && net.connected && !net.isHost) {
      log('Online: host controls setup and mode.');
      updateHud();
      return;
    }
    if (state.mode === 'edit') enterPlay();
    else enterEdit();
  });

  if (elRulesBtn) {
    elRulesBtn.addEventListener('click', () => {
      setRulesDrawerOpen(!state.rulesOpen);
      updateHud();
    });
  }
  if (elRulesCloseBtn) {
    elRulesCloseBtn.addEventListener('click', () => {
      setRulesDrawerOpen(false);
      updateHud();
    });
  }
  if (elRulesBackdrop) {
    elRulesBackdrop.addEventListener('click', () => {
      setRulesDrawerOpen(false);
      updateHud();
    });
  }

  if (elOnlineHostBtn) {
    elOnlineHostBtn.addEventListener('click', startOnlineHost);
  }
  if (elOnlineJoinBtn) {
    elOnlineJoinBtn.addEventListener('click', startOnlineJoin);
  }
  if (elOnlineLeaveBtn) {
    elOnlineLeaveBtn.addEventListener('click', () => {
      onlineLeaveSession('Online: left session.');
    });
  }
  if (elOnlineJoinCode) {
    elOnlineJoinCode.addEventListener('input', () => {
      const normalized = normalizeOnlineCode(elOnlineJoinCode.value);
      if (elOnlineJoinCode.value !== normalized) {
        elOnlineJoinCode.value = normalized;
      }
      updateHud();
    });
    elOnlineJoinCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        startOnlineJoin();
      }
    });
  }

  if (elGameModeSel) {
    elGameModeSel.addEventListener('change', () => {
      const rawMode = elGameModeSel.value;
      const nextMode = (rawMode === 'hvai' || rawMode === 'online') ? rawMode : 'hvh';
      if (nextMode === state.gameMode) return;

      if (state.gameMode === 'online' && nextMode !== 'online') {
        onlineLeaveSession('Online: idle.');
      }

      state.gameMode = nextMode;
      if (nextMode === 'online') {
        stopAiLoop();
        log('Game mode: Online (Host = Blue, Guest = Red). Use Online panel to connect.');
      } else if (nextMode === 'hvh') {
        stopAiLoop();
        log('Game mode: Human vs Human.');
      } else {
        log('Game mode: Human vs AI (Red AI).');
      }
      updateHud();
      maybeStartAiTurn();
    });
  }

  if (elForwardAxisSel) {
    elForwardAxisSel.addEventListener('change', () => {
      const nextAxis = normalizeForwardAxis(elForwardAxisSel.value);
      if (nextAxis === state.forwardAxis) return;
      state.forwardAxis = nextAxis;
      clearSelection();
      log(`Advance axis: ${nextAxis === 'vertical' ? 'Vertical (Blue down)' : 'Horizontal (Blue right)'}.`);
      updateHud();
    });
  }

  elToolUnits.addEventListener('click', () => { state.tool = 'units'; updateHud(); });
  elToolTerrain.addEventListener('click', () => { state.tool = 'terrain'; updateHud(); });

  elSideBlue.addEventListener('click', () => { state.editSide = 'blue'; updateHud(); });
  elSideRed.addEventListener('click', () => { state.editSide = 'red'; updateHud(); });

  elTypeBtns.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    state.editType = btn.dataset.type;
    if (state.editType === 'run') state.editQuality = 'green';
    state.editErase = false;
    updateHud();
  });

  elEraseBtn.addEventListener('click', () => { state.editErase = !state.editErase; updateHud(); });

  function setEditQualitySafe(nextQuality) {
    if (state.editType === 'run') {
      state.editQuality = 'green';
      updateHud();
      return;
    }
    state.editQuality = nextQuality;
    updateHud();
  }
  elQualityGreen.addEventListener('click', () => { setEditQualitySafe('green'); });
  elQualityRegular.addEventListener('click', () => { setEditQualitySafe('regular'); });
  elQualityVeteran.addEventListener('click', () => { setEditQualitySafe('veteran'); });

  elTerrainBtns.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-terrain]');
    if (!btn) return;
    state.editTerrain = btn.dataset.terrain;
    updateHud();
  });

  elVictorySel.addEventListener('change', () => {
    state.victoryMode = elVictorySel.value;
    updateHud();
  });

  elEndTurnBtn.addEventListener('click', () => {
    if (onlineModeActive() && forwardOnlineAction({ type: 'end_turn' })) return;
    endTurn();
  });
  if (elLineAdvanceBtn) {
    elLineAdvanceBtn.addEventListener('click', () => {
      if (onlineModeActive() && forwardOnlineAction({ type: 'line_advance' })) return;
      lineAdvanceFromSelection();
    });
  }

  elClearUnitsBtn.addEventListener('click', () => { enterEdit(); clearUnits(); });

  elLoadScenarioBtn.addEventListener('click', () => { loadScenario(elScenarioSel.value); });

  if (elExportStateBtn) {
    elExportStateBtn.addEventListener('click', exportStateToFile);
  }

  if (elImportStateBtn && elStateFileInput) {
    elImportStateBtn.addEventListener('click', () => {
      elStateFileInput.value = '';
      elStateFileInput.click();
    });

    elStateFileInput.addEventListener('change', (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      importStateFromFile(file);
      e.target.value = '';
    });
  }

  for (const filterEl of [elScenarioGroupSel, elScenarioLessonSel, elScenarioSizeSel, elScenarioTerrainSel]) {
    if (!filterEl) continue;
    filterEl.addEventListener('change', () => {
      populateScenarioSelect();
      updateHud();
    });
  }

  // --- Populate scenario & victory dropdowns
  function populateFilterSelect(el, options) {
    if (!el) return;
    const prev = el.value;
    el.innerHTML = '';
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.label;
      el.appendChild(opt);
    }
    if (prev && [...el.options].some(o => o.value === prev)) el.value = prev;
    else el.value = 'all';
  }

  function populateScenarioFilters() {
    populateFilterSelect(elScenarioGroupSel, SCENARIO_FILTER_OPTIONS.group);
    populateFilterSelect(elScenarioLessonSel, SCENARIO_FILTER_OPTIONS.lesson);
    populateFilterSelect(elScenarioSizeSel, SCENARIO_FILTER_OPTIONS.size);
    populateFilterSelect(elScenarioTerrainSel, SCENARIO_FILTER_OPTIONS.terrain);
  }

  function readFilterValue(el, key) {
    const v = el?.value || 'all';
    return SCENARIO_FILTER_IDS[key].has(v) ? v : 'all';
  }

  function readScenarioFilters() {
    return {
      group: readFilterValue(elScenarioGroupSel, 'group'),
      lesson: readFilterValue(elScenarioLessonSel, 'lesson'),
      size: readFilterValue(elScenarioSizeSel, 'size'),
      terrain: readFilterValue(elScenarioTerrainSel, 'terrain'),
    };
  }

  function scenarioGroupTag(name) {
    if (name.startsWith('Demo ')) return 'demo';
    if (name.startsWith('Grand ')) return 'grand';
    if (name.startsWith('Terrain ')) return 'terrain';
    if (name.startsWith('Berserker ')) return 'berserker';
    return 'other';
  }

  function scenarioSizeTag(totalUnits) {
    if (totalUnits <= 20) return 'small';
    if (totalUnits <= 50) return 'medium';
    return 'large';
  }

  function scenarioTerrainTag(sc) {
    const tags = new Set();
    for (const t of (sc.terrain || [])) {
      if (TERRAIN_IDS.has(t.terrain) && t.terrain !== 'clear') tags.add(t.terrain);
    }
    if (tags.size === 0) return 'open';
    if (tags.size === 1) return [...tags][0];
    return 'mixed';
  }

  function scenarioLessonTag(name, group, terrainTag) {
    const n = name.toLowerCase();
    if (group === 'terrain' || terrainTag === 'mixed' || (terrainTag !== 'open' && /terrain|marsh|woods|ridge|broken ground/.test(n))) {
      return 'terrain';
    }
    if (/river|ford/.test(n)) return 'river';
    if (/corridor|pass/.test(n)) return 'corridor';
    if (/screen|skirmisher/.test(n)) return 'screen';
    if (/envelopment|encircle|crescent|flank|wedge|wide wings|columns/.test(n)) return 'envelopment';
    if (/center|push/.test(n)) return 'center';
    if (/line|checkerboard/.test(n)) return 'lines';
    return 'general';
  }

  function scenarioMeta(name) {
    const sc = SCENARIOS[name] || { terrain: [], units: [] };
    const totalUnits = Array.isArray(sc.units) ? sc.units.length : 0;
    const group = scenarioGroupTag(name);
    const terrain = scenarioTerrainTag(sc);
    const size = scenarioSizeTag(totalUnits);
    const lesson = scenarioLessonTag(name, group, terrain);
    return { group, lesson, size, terrain, totalUnits };
  }

  function scenarioMatchesFilters(meta, filters) {
    if (filters.group !== 'all' && meta.group !== filters.group) return false;
    if (filters.lesson !== 'all' && meta.lesson !== filters.lesson) return false;
    if (filters.size !== 'all' && meta.size !== filters.size) return false;
    if (filters.terrain !== 'all' && meta.terrain !== filters.terrain) return false;
    return true;
  }

  function populateScenarioSelect() {
    const prev = elScenarioSel.value;
    const filters = readScenarioFilters();
    elScenarioSel.innerHTML = '';

    let shown = 0;
    for (const name of Object.keys(SCENARIOS)) {
      const meta = scenarioMeta(name);
      if (!scenarioMatchesFilters(meta, filters)) continue;

      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      opt.title = `Group=${meta.group} · Lesson=${meta.lesson} · Size=${meta.size} · Map=${meta.terrain}`;
      elScenarioSel.appendChild(opt);
      shown += 1;
    }

    if (shown === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No scenarios match filters';
      opt.disabled = true;
      opt.selected = true;
      elScenarioSel.appendChild(opt);
      elScenarioSel.disabled = true;
      elLoadScenarioBtn.disabled = true;
      return;
    }

    elScenarioSel.disabled = false;
    elLoadScenarioBtn.disabled = false;

    if (prev && [...elScenarioSel.options].some(o => o.value === prev)) {
      elScenarioSel.value = prev;
      return;
    }

    if ([...elScenarioSel.options].some(o => o.value === 'Empty (Island)')) {
      elScenarioSel.value = 'Empty (Island)';
    } else {
      elScenarioSel.value = elScenarioSel.options[0].value;
    }
  }

  function populateVictorySelect() {
    elVictorySel.innerHTML = '';
    const modes = [
      { id: 'clear', label: 'Clear Victory (halve UP)' },
      { id: 'decapitation', label: 'Decapitation (kill all generals)' },
      { id: 'annihilation', label: 'Annihilation (kill all units)' },
    ];
    for (const m of modes) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      elVictorySel.appendChild(opt);
    }
    elVictorySel.value = 'clear';
    state.victoryMode = 'clear';
  }

  function boot() {
    populateScenarioFilters();
    populateScenarioSelect();
    populateVictorySelect();
    populateRulesReference();
    setRulesDrawerOpen(false);
    setOnlineStatus(net.status);

    loadScenario('Empty (Island)');
    enterEdit();

    log(`Booted ${GAME_NAME}. Active hexes=${board.active.length}. Edit: place units. Then To Play.`);
    updateHud();
    resize();
  }

  boot();
})();
