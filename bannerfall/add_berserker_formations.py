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

m = re.search(r"\bconst\s+SCENARIOS\s*=\s*{", txt)
if not m:
    m = re.search(r"\bSCENARIOS\s*=\s*{", txt)
if not m:
    print("ERROR: Couldn't find SCENARIOS object.")
    sys.exit(1)

start_brace = txt.find("{", m.end() - 1)
if start_brace < 0:
    print("ERROR: Couldn't locate opening `{` for SCENARIOS.")
    sys.exit(1)

def find_matching_brace(s: str, i0: int) -> int:
    depth = 0
    i = i0
    in_squote = in_dquote = in_btick = False
    in_line_comment = in_block_comment = False
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

        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

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

Q_GREEN = detect_quality(scenarios_block, "green", "Green")
Q_REG   = detect_quality(scenarios_block, "regular", "Regular")
Q_VET   = detect_quality(scenarios_block, "veteran", "Veteran")

# Default board geometry (row widths by r)
ROW_WIDTHS = [12,13,14,15,16,17,16,15,14,13,12]
MAX_R = len(ROW_WIDTHS) - 1

def valid_hex(q: int, r: int) -> bool:
    if r < 0 or r > MAX_R:
        return False
    w = ROW_WIDTHS[r]
    return 0 <= q < w

def U(q, r, side, typ, qual):
    return {"q": q, "r": r, "side": side, "type": typ, "quality": qual}

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
            raise ValueError(f"Invalid unit hex q={u['q']} r={u['r']} (off-board for default map)")
    for t in terr:
        if not valid_hex(t["q"], t["r"]):
            raise ValueError(f"Invalid terrain hex q={t['q']} r={t['r']} (off-board for default map)")

def js_quote(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"

def js_obj(d: dict) -> str:
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

# ----- 4 Formation scenarios -----

def berserker_A_wedge_vs_wall():
    blue=[]
    red=[]
    terr=[]

    # Blue: wedge
    for q in [4,6,8]: blue.append(U(q,1,SIDE_BLUE,T_GEN,Q_GREEN))
    for q in [3,5,7,9]: blue.append(U(q,0,SIDE_BLUE,T_ARC,Q_GREEN))
    for q in [4,5,6,7,8,9]: blue.append(U(q,2,SIDE_BLUE,T_INF,Q_REG))
    for q in [5,6,7]: blue.append(U(q,3,SIDE_BLUE,T_INF,Q_REG))
    blue.append(U(6,4,SIDE_BLUE,T_INF,Q_REG))
    for q in [3,5,7,9,11]: blue.append(U(q,4,SIDE_BLUE,T_SKR,Q_REG))
    for q,r in [(0,3),(1,2),(13,2),(14,3)]: blue.append(U(q,r,SIDE_BLUE,T_CAV,Q_REG))

    # Red: shieldwall
    for q in [4,6,8]: red.append(U(q,9,SIDE_RED,T_GEN,Q_GREEN))
    for q in [3,5,7,9]: red.append(U(q,10,SIDE_RED,T_ARC,Q_GREEN))
    for q in range(2,12): red.append(U(q,7,SIDE_RED,T_INF,Q_REG))
    for q in [3,5,7,9,11]: red.append(U(q,6,SIDE_RED,T_SKR,Q_REG))
    for q,r in [(0,8),(1,8),(12,8),(13,8)]: red.append(U(q,r,SIDE_RED,T_CAV,Q_REG))

    units = blue + red
    assert_no_overlaps(units)
    assert_all_valid(units, terr)
    return terr, units

def berserker_B_crescent_vs_columns():
    blue=[]
    red=[]
    terr=[]

    # Blue: crescent (concave)
    for q in [4,6,8]: blue.append(U(q,1,SIDE_BLUE,T_GEN,Q_GREEN))
    for q in [3,5,7,9]: blue.append(U(q,0,SIDE_BLUE,T_ARC,Q_GREEN))
    for q in [2,3,12,13]: blue.append(U(q,4,SIDE_BLUE,T_INF,Q_REG))
    for q in [4,5,9,10]: blue.append(U(q,3,SIDE_BLUE,T_INF,Q_REG))
    for q in [6,8]: blue.append(U(q,2,SIDE_BLUE,T_INF,Q_REG))
    for q,r in [(0,3),(0,2),(1,2),(14,3),(12,2),(13,2)]: blue.append(U(q,r,SIDE_BLUE,T_CAV,Q_REG))
    for q in [5,7,9,11,14]: blue.append(U(q,4,SIDE_BLUE,T_SKR,Q_REG))

    # Red: two columns (deep)
    for q in [4,6,8]: red.append(U(q,9,SIDE_RED,T_GEN,Q_GREEN))
    for q in [2,4,6,8]: red.append(U(q,10,SIDE_RED,T_ARC,Q_GREEN))
    for q,r in [(5,9),(5,8),(5,7),(7,9),(7,8),(7,7),(5,6),(6,6),(7,6),(8,6)]: red.append(U(q,r,SIDE_RED,T_INF,Q_REG))
    for q,r in [(0,8),(1,8),(12,8),(13,8),(5,10),(7,10)]: red.append(U(q,r,SIDE_RED,T_CAV,Q_REG))
    for q in [4,9,10,12,14]: red.append(U(q,6,SIDE_RED,T_SKR,Q_REG))

    units = blue + red
    assert_no_overlaps(units)
    assert_all_valid(units, terr)
    return terr, units

def berserker_C_checkerboard_vs_line():
    blue=[]
    red=[]
    terr=[]

    # Blue: checkerboard infantry
    for q in [4,6,8]: blue.append(U(q,1,SIDE_BLUE,T_GEN,Q_GREEN))
    for q in [2,5,8,11]: blue.append(U(q,0,SIDE_BLUE,T_ARC,Q_GREEN))
    for q in [2,4,6,8,10]: blue.append(U(q,2,SIDE_BLUE,T_INF,Q_REG))
    for q in [3,5,7,9,11]: blue.append(U(q,3,SIDE_BLUE,T_INF,Q_REG))
    for q in [2,5,8,11,14]: blue.append(U(q,4,SIDE_BLUE,T_SKR,Q_REG))
    for q,r in [(0,3),(14,3),(0,2),(13,2)]: blue.append(U(q,r,SIDE_BLUE,T_CAV,Q_REG))

    # Red: solid line
    for q in [4,6,8]: red.append(U(q,9,SIDE_RED,T_GEN,Q_GREEN))
    for q in [2,5,8,11]: red.append(U(q,10,SIDE_RED,T_ARC,Q_GREEN))
    for q in range(2,12): red.append(U(q,7,SIDE_RED,T_INF,Q_REG))
    for q in [2,5,8,11,14]: red.append(U(q,6,SIDE_RED,T_SKR,Q_REG))
    for q,r in [(0,8),(1,8),(12,8),(13,8)]: red.append(U(q,r,SIDE_RED,T_CAV,Q_REG))

    units = blue + red
    assert_no_overlaps(units)
    assert_all_valid(units, terr)
    return terr, units

def berserker_D_refused_flank_vs_wide_wings():
    blue=[]
    red=[]
    terr=[]

    # Blue: refused left flank, strong right
    for q in [4,6,8]: blue.append(U(q,1,SIDE_BLUE,T_GEN,Q_GREEN))
    for q in [3,5,7,9]: blue.append(U(q,0,SIDE_BLUE,T_ARC,Q_GREEN))
    for q in [9,10,11,12]: blue.append(U(q,4,SIDE_BLUE,T_INF,Q_REG))
    for q in [6,7,8,9]: blue.append(U(q,3,SIDE_BLUE,T_INF,Q_REG))
    for q in [2,3,4,5]: blue.append(U(q,2,SIDE_BLUE,T_INF,Q_REG))
    for q,r in [(13,3),(14,3),(12,2),(13,2),(0,2),(1,2)]: blue.append(U(q,r,SIDE_BLUE,T_CAV,Q_REG))
    for q in [4,6,8]: blue.append(U(q,4,SIDE_BLUE,T_SKR,Q_REG))

    # Red: wide line + big wings
    for q in [4,6,8]: red.append(U(q,9,SIDE_RED,T_GEN,Q_GREEN))
    for q in [3,5,7,9]: red.append(U(q,10,SIDE_RED,T_ARC,Q_GREEN))
    for q in range(1,13): red.append(U(q,7,SIDE_RED,T_INF,Q_REG))
    for q,r in [(0,8),(1,8),(2,8),(11,8),(12,8),(13,8)]: red.append(U(q,r,SIDE_RED,T_CAV,Q_REG))
    for q in [4,6,8]: red.append(U(q,6,SIDE_RED,T_SKR,Q_REG))

    units = blue + red
    assert_no_overlaps(units)
    assert_all_valid(units, terr)
    return terr, units

BERSERKER_SCENARIOS = [
    ("Berserker A — Wedge vs Shieldwall (26v26)", berserker_A_wedge_vs_wall),
    ("Berserker B — Crescent vs Columns (28v28)", berserker_B_crescent_vs_columns),
    ("Berserker C — Checkerboard vs Line (26v26)", berserker_C_checkerboard_vs_line),
    ("Berserker D — Refused Flank vs Wide Wings (28v28)", berserker_D_refused_flank_vs_wide_wings),
]

entries=[]
for name, fn in BERSERKER_SCENARIOS:
    terr, units = fn()
    b = sum(1 for u in units if u["side"] == SIDE_BLUE)
    r = sum(1 for u in units if u["side"] == SIDE_RED)
    print(f"{name}: {b} {SIDE_BLUE} / {r} {SIDE_RED}")

    terr_js = ",\n        ".join(js_obj(t) for t in terr) or ""
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

START_MARK = "  // === BERSERKER FORMATIONS (Berserker) ==="
END_MARK   = "  // === END BERSERKER FORMATIONS ==="

block = "\n" + START_MARK + "\n" + "\n\n".join(entries) + "\n" + END_MARK + "\n"

if START_MARK in scenarios_block and END_MARK in scenarios_block:
    pattern = re.compile(re.escape(START_MARK) + r".*?" + re.escape(END_MARK), re.S)
    new_scenarios_block = pattern.sub(block.strip("\n"), scenarios_block)
else:
    insert_at = len(scenarios_block) - 1
    before = scenarios_block[:insert_at]
    after  = scenarios_block[insert_at:]

    mlast = re.search(r"[^\s](?=\s*$)", before)
    lastc = mlast.group(0) if mlast else "{"
    if lastc not in "{,":
        before = before.rstrip() + ",\n"

    new_scenarios_block = before + block + after

new_txt = txt[:start_brace] + new_scenarios_block + txt[end_brace+1:]

ts = datetime.now().strftime("%Y%m%d-%H%M%S")
bak = MAIN.with_suffix(f".js.bak_{ts}")
shutil.copy2(MAIN, bak)
MAIN.write_text(new_txt, encoding="utf-8")

print("✅ Berserker formations inserted/updated.")
print(f"Backup file: {bak.name}")
print("Detected tokens:")
print(f"  sides: {SIDE_BLUE}/{SIDE_RED}")
print(f"  types: {T_INF},{T_CAV},{T_SKR},{T_ARC},{T_GEN}")
print(f"  quality: {Q_GREEN},{Q_REG},{Q_VET}")
