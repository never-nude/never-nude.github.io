#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re, shutil, sys

ROW_WIDTHS = [12,13,14,15,16,17,16,15,14,13,12]
MAX_R = len(ROW_WIDTHS) - 1

def valid_hex(q,r):
    return 0 <= r <= MAX_R and 0 <= q < ROW_WIDTHS[r]

def mirror_r(r): return MAX_R - r
def mirror_q(q,r): return ROW_WIDTHS[r] - 1 - q

def match_brace(s, i0, open_ch="{", close_ch="}"):
    depth = 0
    i = i0
    in_s=in_d=in_b=False
    in_lc=in_bc=False
    esc=False
    while i < len(s):
        ch = s[i]
        nxt = s[i+1] if i+1 < len(s) else ""

        if in_lc:
            if ch == "\n": in_lc = False
            i += 1; continue
        if in_bc:
            if ch == "*" and nxt == "/":
                in_bc = False; i += 2
            else:
                i += 1
            continue
        if in_s:
            if esc: esc=False
            elif ch == "\\": esc=True
            elif ch == "'": in_s=False
            i += 1; continue
        if in_d:
            if esc: esc=False
            elif ch == "\\": esc=True
            elif ch == '"': in_d=False
            i += 1; continue
        if in_b:
            if esc: esc=False
            elif ch == "\\": esc=True
            elif ch == "`": in_b=False
            i += 1; continue

        if ch == "/" and nxt == "/": in_lc=True; i += 2; continue
        if ch == "/" and nxt == "*": in_bc=True; i += 2; continue
        if ch == "'": in_s=True; i += 1; continue
        if ch == '"': in_d=True; i += 1; continue
        if ch == "`": in_b=True; i += 1; continue

        if ch == open_ch: depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0: return i
        i += 1
    return -1

def detect_tokens(js: str):
    # side tokens
    sides = set(re.findall(r"side\s*:\s*['\"]([^'\"]+)['\"]", js))
    def pick_side(name):
        for s in sides:
            if name in s.lower():
                return s
        return "Blue" if name=="blue" else "Red"
    SIDE_BLUE = pick_side("blue")
    SIDE_RED  = pick_side("red")

    # type tokens
    types = set(re.findall(r"type\s*:\s*['\"]([^'\"]+)['\"]", js))
    def pick_type(t):
        for s in types:
            if s.lower() == t.lower():
                return s
        for s in types:
            if t.lower() in s.lower():
                return s
        return t.upper()
    T_INF = pick_type("INF")
    T_CAV = pick_type("CAV")
    T_SKR = pick_type("SKR")
    T_ARC = pick_type("ARC")
    T_GEN = pick_type("GEN")

    # quality tokens
    quals = set(re.findall(r"quality\s*:\s*['\"]([^'\"]+)['\"]", js))
    def pick_q(name, fallback):
        for s in quals:
            if name in s.lower():
                return s
        return fallback
    Q_GREEN = pick_q("green", "Green")
    Q_REG   = pick_q("regular", "Regular")

    # terrain tokens
    terrs = set(re.findall(r"terrain\s*:\s*['\"]([^'\"]+)['\"]", js))
    def pick_t(name, fallback):
        for s in terrs:
            if s.lower() == name:
                return s
        for s in terrs:
            if name in s.lower():
                return s
        return fallback
    TR_HILLS = pick_t("hills", "hills")
    TR_WOODS = pick_t("woods", "woods")
    TR_ROUGH = pick_t("rough", "rough")
    TR_WATER = pick_t("water", "water")

    return {
        "SIDE_BLUE": SIDE_BLUE, "SIDE_RED": SIDE_RED,
        "T_INF": T_INF, "T_CAV": T_CAV, "T_SKR": T_SKR, "T_ARC": T_ARC, "T_GEN": T_GEN,
        "Q_GREEN": Q_GREEN, "Q_REG": Q_REG,
        "TR_HILLS": TR_HILLS, "TR_WOODS": TR_WOODS, "TR_ROUGH": TR_ROUGH, "TR_WATER": TR_WATER,
    }

def base_armies(tok):
    # 28 units per side, mirrored. Mostly Regular to keep “terrain lesson” primary.
    blue_units = []
    def U(q,r,side,t,qual):
        assert valid_hex(q,r), (q,r)
        blue_units.append({"q":q,"r":r,"side":side,"type":t,"quality":qual})

    # Generals
    for q in [4,6,8]:
        U(q,1,tok["SIDE_BLUE"],tok["T_GEN"],tok["Q_GREEN"])

    # Archers
    for q in [3,5,7,9]:
        U(q,0,tok["SIDE_BLUE"],tok["T_ARC"],tok["Q_REG"])

    # Infantry blocks
    for q in range(3,10):
        U(q,2,tok["SIDE_BLUE"],tok["T_INF"],tok["Q_REG"])
    for q in range(4,11):
        U(q,3,tok["SIDE_BLUE"],tok["T_INF"],tok["Q_REG"])

    # Skirmishers
    for q in [2,6,12]:
        U(q,4,tok["SIDE_BLUE"],tok["T_SKR"],tok["Q_REG"])

    # Cavalry wings
    for (q,r) in [(0,3),(1,2),(13,2),(14,3)]:
        U(q,r,tok["SIDE_BLUE"],tok["T_CAV"],tok["Q_REG"])

    # Mirror to Red
    red_units=[]
    for u in blue_units:
        red_units.append({
            "q": u["q"],
            "r": mirror_r(u["r"]),
            "side": tok["SIDE_RED"],
            "type": u["type"],
            "quality": u["quality"] if u["type"] != tok["T_GEN"] else tok["Q_GREEN"]
        })

    # sanity: no duplicates
    assert len({(u["q"],u["r"]) for u in blue_units}) == len(blue_units)
    assert len({(u["q"],u["r"]) for u in red_units}) == len(red_units)
    return blue_units + red_units

def uniq_terrain(entries):
    seen=set()
    out=[]
    for (q,r,t) in entries:
        if not valid_hex(q,r): raise ValueError(f"invalid hex {(q,r)} for {t}")
        key=(q,r,t)
        if key in seen: continue
        seen.add(key)
        out.append((q,r,t))
    return out

def terrain_sets(tok, units_xy):
    H,W,R,WAT = tok["TR_HILLS"], tok["TR_WOODS"], tok["TR_ROUGH"], tok["TR_WATER"]

    # A: Ridge Line
    ridge=[]
    for q in range(4,13):
        ridge.append((q,5,H))
    ridge += [(5,4,H),(10,4,H),(5,6,H),(10,6,H)]
    ridge += [(2,5,W),(3,5,W),(13,5,W),(14,5,W)]
    ridge = uniq_terrain(ridge)

    # B: River & Twin Fords
    river=[]
    for q in range(0,17):
        if q in (6,10):  # fords
            continue
        river.append((q,5,WAT))
    river += [(5,4,W),(7,4,W),(9,4,W),(11,4,W),
              (5,6,W),(7,6,W),(9,6,W),(11,6,W)]
    river += [(8,4,H),(8,6,H)]
    river = uniq_terrain(river)

    # C: Twin Woods & Clear Corridor
    woods=[]
    left=[(3,4),(4,4),(5,4),
          (2,5),(3,5),(4,5),(5,5),
          (3,6),(4,6),(5,6)]
    for q,r in left:
        woods.append((q,r,W))
        woods.append((mirror_q(q,r),r,W))
    woods += [(7,5,R),(9,5,R)]
    woods = uniq_terrain(woods)

    # D: Broken Ground
    broken=[]
    for q in range(4,13):
        broken.append((q,5,R))
    for q in range(7,10):
        broken.append((q,4,R))
        broken.append((q,6,R))
    broken += [(6,5,H),(10,5,H)]
    broken = uniq_terrain(broken)

    # E: The Pass
    pas=[]
    left=[(0,4),(1,4),(0,5),(1,5),(2,5),(0,6),(1,6)]
    for q,r in left:
        pas.append((q,r,WAT))
        pas.append((mirror_q(q,r),r,WAT))
    pas += [(7,5,H),(8,5,H),(9,5,H)]
    pas += [(6,5,R),(10,5,R),(7,4,R),(9,4,R),(7,6,R),(9,6,R)]
    pas = uniq_terrain(pas)

    # F: Ponds & Hill Spur (avoid starting units on water)
    ponds=[]
    ponds += [(5,5,WAT),(6,5,WAT),(5,4,WAT),(4,5,WAT),
              (11,5,WAT),(10,5,WAT),(11,6,WAT),(10,6,WAT)]
    ponds += [(8,4,H),(9,5,H),(8,6,H)]
    ponds += [(4,6,W),(12,4,W),(3,5,W),(13,5,W)]
    ponds = uniq_terrain(ponds)

    packs = [
        ("Terrain A — Ridge Line (28v28, mirrored)", ridge),
        ("Terrain B — River & Twin Fords (28v28, mirrored)", river),
        ("Terrain C — Twin Woods & Clear Corridor (28v28, mirrored)", woods),
        ("Terrain D — Broken Ground (28v28, mirrored)", broken),
        ("Terrain E — The Pass (28v28, mirrored)", pas),
        ("Terrain F — Ponds & Hill Spur (28v28, mirrored)", ponds),
    ]

    # Make sure no unit starts on water
    units_xy = set(units_xy)
    for name, terr in packs:
        water_xy = {(q,r) for (q,r,t) in terr if t == WAT}
        bad = water_xy.intersection(units_xy)
        if bad:
            raise ValueError(f"{name}: units start on water at {sorted(bad)}")

    return packs

def js_obj_units(units, indent="      "):
    lines=[]
    for u in units:
        lines.append(indent + "{ q: %d, r: %d, side: '%s', type: '%s', quality: '%s' }," %
                     (u["q"],u["r"],u["side"],u["type"],u["quality"]))
    return "\n".join(lines)

def js_obj_terrain(terr, indent="      "):
    lines=[]
    for (q,r,t) in terr:
        lines.append(indent + "{ q: %d, r: %d, terrain: '%s' }," % (q,r,t))
    return "\n".join(lines)

def find_scenarios_block(js: str):
    m = re.search(r"\bconst\s+SCENARIOS\s*=\s*{", js)
    if not m:
        m = re.search(r"\bSCENARIOS\s*=\s*{", js)
    if not m:
        return None

    brace0 = js.find("{", m.end()-1)
    brace1 = match_brace(js, brace0, "{", "}")
    if brace0 < 0 or brace1 < 0:
        return None
    return brace0, brace1

def patch_file(path: Path):
    js = path.read_text(encoding="utf-8")

    loc = find_scenarios_block(js)
    if not loc:
        print(f"ERROR: couldn't find SCENARIOS object in {path}")
        return False
    brace0, brace1 = loc
    scenarios_obj = js[brace0:brace1+1]

    tok = detect_tokens(js)
    units = base_armies(tok)
    units_xy = [(u["q"],u["r"]) for u in units]
    packs = terrain_sets(tok, units_xy)

    start_mark = "  // === TERRAIN PACK (BERSERKER) ==="
    end_mark   = "  // === END TERRAIN PACK ==="

    pack_lines=[start_mark]
    for name, terr in packs:
        pack_lines.append(f"  '{name}': {{")
        pack_lines.append("    terrain: [")
        pack_lines.append(js_obj_terrain(terr, indent="      "))
        pack_lines.append("    ],")
        pack_lines.append("    units: [")
        pack_lines.append(js_obj_units(units, indent="      "))
        pack_lines.append("    ],")
        pack_lines.append("  },")
        pack_lines.append("")
    pack_lines.append(end_mark)
    pack_block = "\n" + "\n".join(pack_lines) + "\n"

    if start_mark in scenarios_obj and end_mark in scenarios_obj:
        a0 = scenarios_obj.find(start_mark)
        a1 = scenarios_obj.find(end_mark, a0)
        a1 = scenarios_obj.find("\n", a1)
        if a1 < 0: a1 = len(scenarios_obj)
        scenarios_new = scenarios_obj[:a0] + pack_block.strip("\n") + scenarios_obj[a1:]
    else:
        # Insert before final "}" of SCENARIOS object; ensure there is a comma before new props if needed
        insert_at = len(scenarios_obj) - 1  # before closing }
        # find last non-whitespace before insert
        j = insert_at - 1
        while j > 0 and scenarios_obj[j].isspace():
            j -= 1
        needs_comma = scenarios_obj[j] != "," and scenarios_obj[j] != "{"
        prefix = ",\n" if needs_comma else "\n"
        scenarios_new = scenarios_obj[:insert_at] + prefix + pack_block + scenarios_obj[insert_at:]

    # Backup
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = path.with_suffix(f".js.bak_{ts}")
    shutil.copy2(path, bak)

    js2 = js[:brace0] + scenarios_new + js[brace1+1:]
    path.write_text(js2, encoding="utf-8")
    print(f"✅ Patched {path} (backup: {bak.name})")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 add_terrain_pack_scenarios.py <path-to-main.js>")
        sys.exit(1)
    patch_file(Path(sys.argv[1]))
