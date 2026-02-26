#!/usr/bin/env python3
import re
import sys
import shutil
from pathlib import Path
from datetime import datetime

MAIN = Path("main.js")
if not MAIN.exists():
    print("ERROR: main.js not found in this folder.")
    sys.exit(1)

txt = MAIN.read_text(encoding="utf-8")

# --- Find SCENARIOS object start ---
m = re.search(r"\bconst\s+SCENARIOS\s*=\s*{", txt)
if not m:
    m = re.search(r"\bSCENARIOS\s*=\s*{", txt)
if not m:
    print("ERROR: Couldn't find SCENARIOS object (looked for `const SCENARIOS = {` or `SCENARIOS = {`).")
    sys.exit(1)

start_brace = txt.find("{", m.end() - 1)
if start_brace < 0:
    print("ERROR: Couldn't locate opening `{` for SCENARIOS.")
    sys.exit(1)

# --- Brace matching with string/comment awareness ---
def find_matching_brace(s: str, i0: int) -> int:
    depth = 0
    i = i0
    in_squote = False
    in_dquote = False
    in_btick  = False
    in_line_comment = False
    in_block_comment = False
    escape = False

    while i < len(s):
        ch = s[i]
        nxt = s[i+1] if i+1 < len(s) else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue

        if in_squote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == "'":
                in_squote = False
            i += 1
            continue

        if in_dquote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_dquote = False
            i += 1
            continue

        if in_btick:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == "`":
                in_btick = False
            i += 1
            continue

        # Enter comments
        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

        # Enter strings
        if ch == "'":
            in_squote = True
            i += 1
            continue
        if ch == '"':
            in_dquote = True
            i += 1
            continue
        if ch == "`":
            in_btick = True
            i += 1
            continue

        # Count braces
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i

        i += 1

    return -1

end_brace = find_matching_brace(txt, start_brace)
if end_brace < 0:
    print("ERROR: Couldn't find matching `}` for SCENARIOS object.")
    sys.exit(1)

scenarios_block = txt[start_brace:end_brace+1]

# --- Detect token casing (inside SCENARIOS block only) ---
def detect_side(block: str):
    if re.search(r"side\s*:\s*['\"]Blue['\"]", block):
        return "Blue", "Red"
    if re.search(r"side\s*:\s*['\"]BLUE['\"]", block):
        return "BLUE", "RED"
    return "blue", "red"

SIDE_BLUE, SIDE_RED = detect_side(scenarios_block)

def detect_type(block: str, low: str, up: str):
    if re.search(rf"type\s*:\s*['\"]{re.escape(up)}['\"]", block):
        return up
    if re.search(rf"type\s*:\s*['\"]{re.escape(low)}['\"]", block):
        return low
    return low

T_INF = detect_type(scenarios_block, "inf", "INF")
T_CAV = detect_type(scenarios_block, "cav", "CAV")
T_SKR = detect_type(scenarios_block, "skr", "SKR")
T_ARC = detect_type(scenarios_block, "arc", "ARC")
T_GEN = detect_type(scenarios_block, "gen", "GEN")

def detect_quality(block: str, low: str, cap: str):
    if re.search(rf"quality\s*:\s*['\"]{re.escape(cap)}['\"]", block):
        return cap
    if re.search(rf"quality\s*:\s*['\"]{re.escape(low)}['\"]", block):
        return low
    return low

Q_GREEN   = detect_quality(scenarios_block, "green", "Green")
Q_REG     = detect_quality(scenarios_block, "regular", "Regular")
Q_VET     = detect_quality(scenarios_block, "veteran", "Veteran")

def detect_terrain_val(block: str, low: str, cap: str):
    if re.search(rf"terrain\s*:\s*['\"]{re.escape(cap)}['\"]", block):
        return cap
    if re.search(rf"terrain\s*:\s*['\"]{re.escape(low)}['\"]", block):
        return low
    return low

TR_CLEAR = detect_terrain_val(scenarios_block, "clear", "Clear")
TR_HILLS = detect_terrain_val(scenarios_block, "hills", "Hills")
TR_WOODS = detect_terrain_val(scenarios_block, "woods", "Woods")
TR_ROUGH = detect_terrain_val(scenarios_block, "rough", "Rough")
TR_WATER = detect_terrain_val(scenarios_block, "water", "Water")

# --- Board geometry assumptions (Thor default map) ---
ROW_WIDTHS = [12,13,14,15,16,17,16,15,14,13,12]
MAX_R = len(ROW_WIDTHS) - 1

def valid_hex(q: int, r: int) -> bool:
    if r < 0 or r > MAX_R: return False
    w = ROW_WIDTHS[r]
    return 0 <= q < w

def U(q, r, side, typ, qual):
    return {"q": q, "r": r, "side": side, "type": typ, "quality": qual}

def T(q, r, terrain):
    return {"q": q, "r": r, "terrain": terrain}

def mirror_units(blue_units):
    red = []
    for u in blue_units:
        red.append({"q": u["q"], "r": MAX_R - u["r"], "side": SIDE_RED, "type": u["type"], "quality": u["quality"]})
    return blue_units + red

def mirror_terrain(terr):
    out = []
    seen = set()
    for t in terr + [{"q": tt["q"], "r": MAX_R - tt["r"], "terrain": tt["terrain"]} for tt in terr]:
        key = (t["q"], t["r"], t["terrain"])
        if key not in seen:
            seen.add(key)
            out.append(t)
    return out

def assert_no_overlaps(units):
    seen = set()
    for u in units:
        key = (u["q"], u["r"])
        if key in seen:
            raise ValueError(f"Unit overlap at q={u['q']} r={u['r']}")
        seen.add(key)

def assert_all_valid(units, terr):
    for u in units:
        if not valid_hex(u["q"], u["r"]):
            raise ValueError(f"Invalid unit hex q={u['q']} r={u['r']} (off-board for default Thor map)")
    for t in terr:
        if not valid_hex(t["q"], t["r"]):
            raise ValueError(f"Invalid terrain hex q={t['q']} r={t['r']} (off-board for default Thor map)")

# --- Define 6 Grand scenarios (blue only; red is mirrored) ---
def scenario_A_even_lines():
    blue = []
    # Generals
    for q in [3,6,9]:
        blue.append(U(q,1,SIDE_BLUE,T_GEN,Q_GREEN))
    # Archers
    for q in [2,5,8,11]:
        blue.append(U(q,2,SIDE_BLUE,T_ARC,Q_GREEN))
    # Infantry reserves (behind the line)
    for q in [3,6,9,12]:
        blue.append(U(q,2,SIDE_BLUE,T_INF,Q_REG))
    # Infantry main line
    for q in range(2,12):  # 10 INF
        blue.append(U(q,3,SIDE_BLUE,T_INF,Q_REG))
    # Skirmisher screen
    for q in [3,5,7,9,11]:
        blue.append(U(q,4,SIDE_BLUE,T_SKR,Q_REG))
    # Cavalry wings
    for q in [0,1,14,15]:
        blue.append(U(q,4,SIDE_BLUE,T_CAV,Q_REG))

    units = mirror_units(blue)
    terr = []
    assert_no_overlaps(units[:len(blue)])  # blue overlap check
    assert_all_valid(units, terr)
    return terr, units  # 30v30

def scenario_B_center_push():
    blue = []
    terr = [
        # central terrain punctuation (doesn't block, just shapes choices)
        T(7,5,TR_HILLS), T(8,5,TR_HILLS), T(9,5,TR_HILLS),
        T(2,5,TR_ROUGH), T(14,5,TR_ROUGH),
    ]
    for q in [4,7,10]:
        blue.append(U(q,1,SIDE_BLUE,T_GEN,Q_GREEN))
    for q in [4,7,10]:
        blue.append(U(q,2,SIDE_BLUE,T_ARC,Q_GREEN))
    for q in range(2,14): # 12 INF
        blue.append(U(q,3,SIDE_BLUE,T_INF,Q_REG))
    for q in [6,7,8,9]:   # 4 INF vanguard
        blue.append(U(q,4,SIDE_BLUE,T_INF,Q_REG))
    for q in [3,5,11,13]: # 4 SKR
        blue.append(U(q,4,SIDE_BLUE,T_SKR,Q_REG))
    for q in [0,15]:      # 2 CAV
        blue.append(U(q,4,SIDE_BLUE,T_CAV,Q_REG))

    units = mirror_units(blue)
    terr2 = mirror_terrain(terr)
    assert_no_overlaps(units[:len(blue)])
    assert_all_valid(units, terr2)
    return terr2, units  # 28v28

def scenario_C_double_envelopment():
    blue = []
    terr = []
    for q in [3,6,9]:
        blue.append(U(q,1,SIDE_BLUE,T_GEN,Q_GREEN))
    for q in [5,7,9]:
        blue.append(U(q,2,SIDE_BLUE,T_ARC,Q_GREEN))

    # infantry center (thin-ish)
    for q in range(3,11):     # 8 INF
        blue.append(U(q,3,SIDE_BLUE,T_INF,Q_REG))
    # infantry reserves
    for q in [4,6,8,10]:      # 4 INF
        blue.append(U(q,2,SIDE_BLUE,T_INF,Q_REG))

    # cavalry wings (heavy)
    for q in [0,1,2,13,14,15]:
        blue.append(U(q,4,SIDE_BLUE,T_CAV,Q_REG))
    for q in [1,13]:
        blue.append(U(q,3,SIDE_BLUE,T_CAV,Q_REG))  # 2 cav reserve = 8 total cav

    # skirmishers to pressure the soft center
    for q in [5,7,9,11]:
        blue.append(U(q,4,SIDE_BLUE,T_SKR,Q_REG))

    units = mirror_units(blue)
    terr2 = mirror_terrain(terr)
    assert_no_overlaps(units[:len(blue)])
    assert_all_valid(units, terr2)
    return terr2, units  # 30v30

def scenario_D_massive_screen():
    blue = []
    terr = []
    for q in [4,7,10]:
        blue.append(U(q,1,SIDE_BLUE,T_GEN,Q_GREEN))
    for q in [2,5,8,11]:
        blue.append(U(q,2,SIDE_BLUE,T_ARC,Q_GREEN))
    for q in range(2,12):      # 10 INF
        blue.append(U(q,3,SIDE_BLUE,T_INF,Q_REG))
    for q in [2,4,6,8,10,12,14]: # 7 SKR
        blue.append(U(q,4,SIDE_BLUE,T_SKR,Q_REG))
    for q in [0,15]:           # 2 CAV
        blue.append(U(q,4,SIDE_BLUE,T_CAV,Q_REG))

    units = mirror_units(blue)
    terr2 = mirror_terrain(terr)
    assert_no_overlaps(units[:len(blue)])
    assert_all_valid(units, terr2)
    return terr2, units  # 26v26

def scenario_E_river_fords():
    blue = []
    terr = []
    # river row r=5 (water except 3 fords)
    fords = {4,8,12}
    for q in range(0,17):  # row 5 width is 17
        if q not in fords:
            terr.append(T(q,5,TR_WATER))
    # wooded banks near fords
    for q in [4,8,12]:
        terr.append(T(q,4,TR_WOODS))

    for q in [4,7,10]:
        blue.append(U(q,1,SIDE_BLUE,T_GEN,Q_GREEN))
    for q in [4,7,10]:
        blue.append(U(q,2,SIDE_BLUE,T_ARC,Q_GREEN))
    for q in range(2,14):  # 12 INF
        blue.append(U(q,3,SIDE_BLUE,T_INF,Q_REG))
    for q in [0,1,14,15]:  # 4 CAV
        blue.append(U(q,4,SIDE_BLUE,T_CAV,Q_REG))
    for q in [4,12]:       # 2 SKR aligned with fords
        blue.append(U(q,4,SIDE_BLUE,T_SKR,Q_REG))

    units = mirror_units(blue)
    terr2 = mirror_terrain(terr)
    assert_no_overlaps(units[:len(blue)])
    assert_all_valid(units, terr2)
    return terr2, units  # 24v24

def scenario_F_corridor_pass():
    blue = []
    terr = []
    # corridor: rows 2..8; keep q in [4..9], water everywhere else
    for r in range(2,9):
        w = ROW_WIDTHS[r]
        for q in range(0,w):
            if q < 4 or q > 9:
                terr.append(T(q,r,TR_WATER))

    # 2 generals keep column commanded
    for q in [5,8]:
        blue.append(U(q,1,SIDE_BLUE,T_GEN,Q_GREEN))
    # archers in the back
    for q in [5,8]:
        blue.append(U(q,0,SIDE_BLUE,T_ARC,Q_GREEN))
    # cavalry (limited but scary)
    for q in [4,9]:
        blue.append(U(q,2,SIDE_BLUE,T_CAV,Q_REG))
    # infantry blocks
    for q in [5,6,7,8]:
        blue.append(U(q,2,SIDE_BLUE,T_INF,Q_REG))     # 4
    for q in [4,5,6,7,8,9]:
        blue.append(U(q,3,SIDE_BLUE,T_INF,Q_REG))     # 6 (total 10)
    for q in [5,6,7,8]:
        blue.append(U(q,4,SIDE_BLUE,T_INF,Q_REG))     # 4 (total 14)
    # skirmishers at the front
    for q in [4,9]:
        blue.append(U(q,4,SIDE_BLUE,T_SKR,Q_REG))     # 2

    units = mirror_units(blue)
    terr2 = mirror_terrain(terr)
    assert_no_overlaps(units[:len(blue)])
    assert_all_valid(units, terr2)
    return terr2, units  # 22v22

GRAND_SCENARIOS = [
    ("Grand A — Even Lines (30v30, mirrored)", scenario_A_even_lines),
    ("Grand B — Center Push (28v28, mirrored)", scenario_B_center_push),
    ("Grand C — Double Envelopment (30v30, mirrored)", scenario_C_double_envelopment),
    ("Grand D — Massive Screen (26v26, mirrored)", scenario_D_massive_screen),
    ("Grand E — River Fords (24v24, mirrored)", scenario_E_river_fords),
    ("Grand F — Corridor Pass (22v22, mirrored)", scenario_F_corridor_pass),
]

def js_quote(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"

def js_obj(d: dict) -> str:
    # stable key order for readability
    keys = ["q","r","side","type","quality","terrain"]
    parts = []
    for k in keys:
        if k in d:
            v = d[k]
            if isinstance(v, str):
                parts.append(f"{k}: {js_quote(v)}")
            else:
                parts.append(f"{k}: {v}")
    return "{ " + ", ".join(parts) + " }"

# Build the insertion block as scenario entries inside SCENARIOS object
entries = []
for name, fn in GRAND_SCENARIOS:
    terr, units = fn()
    terr_js = ",\n        ".join(js_obj(t) for t in terr)
    units_js = ",\n        ".join(js_obj(u) for u in units)
    entry = f"""  {js_quote(name)}: {{
    terrain: [
        {terr_js}
    ],
    units: [
        {units_js}
    ]
  }},"""
    entries.append(entry)

START_MARK = "  // === GRAND BATTLE SCENARIOS (Thor) ==="
END_MARK   = "  // === END GRAND BATTLE SCENARIOS ==="

block = "\n" + START_MARK + "\n" + "\n\n".join(entries) + "\n" + END_MARK + "\n"

# Replace if markers exist; otherwise insert before end_brace
new_scenarios_block = scenarios_block
if START_MARK in scenarios_block and END_MARK in scenarios_block:
    # Replace between markers (inclusive)
    pattern = re.compile(re.escape(START_MARK) + r".*?" + re.escape(END_MARK), re.S)
    new_scenarios_block = pattern.sub(block.strip("\n"), scenarios_block)
else:
    # Insert right before the closing "}" of the SCENARIOS object
    insert_at = len(scenarios_block) - 1  # before final }
    before = scenarios_block[:insert_at]
    after  = scenarios_block[insert_at:]

    # Ensure there's a comma before we add new entries if needed
    # Find last non-ws char
    mlast = re.search(r"[^\s](?=\s*$)", before)
    lastc = mlast.group(0) if mlast else "{"
    if lastc not in "{,":
        before = before.rstrip() + ",\n"
    new_scenarios_block = before + block + after

# Write back into full file
new_txt = txt[:start_brace] + new_scenarios_block + txt[end_brace+1:]

# Backup + write
ts = datetime.now().strftime("%Y%m%d-%H%M%S")
bak = MAIN.with_suffix(f".js.bak_{ts}")
shutil.copy2(MAIN, bak)
MAIN.write_text(new_txt, encoding="utf-8")

print("✅ Added Grand Battle scenarios.")
print(f"Backup: {bak.name}")
print("Detected tokens:")
print(f"  sides: {SIDE_BLUE}/{SIDE_RED}")
print(f"  types: {T_INF},{T_CAV},{T_SKR},{T_ARC},{T_GEN}")
print(f"  quality: {Q_GREEN},{Q_REG},{Q_VET}")
print(f"  terrain: {TR_CLEAR},{TR_HILLS},{TR_WOODS},{TR_ROUGH},{TR_WATER}")
