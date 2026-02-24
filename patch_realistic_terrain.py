#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil, sys

def find_matching(s, i0, open_ch, close_ch):
    depth = 0
    i = i0
    in_s = in_d = in_b = False
    in_lc = in_bc = False
    esc = False
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
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == "'": in_s = False
            i += 1; continue
        if in_d:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == '"': in_d = False
            i += 1; continue
        if in_b:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == "`": in_b = False
            i += 1; continue

        if ch == "/" and nxt == "/": in_lc = True; i += 2; continue
        if ch == "/" and nxt == "*": in_bc = True; i += 2; continue
        if ch == "'": in_s = True; i += 1; continue
        if ch == '"': in_d = True; i += 1; continue
        if ch == "`": in_b = True; i += 1; continue

        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

TARGETS = [
  ("Grand A — Even Lines (30v30, mirrored)", "GRAND_A",
   [
     (4,4,'woods'), (5,4,'woods'), (6,4,'woods'),
     (4,6,'woods'), (5,6,'woods'), (6,6,'woods'),
     (10,4,'hills'), (11,4,'hills'), (12,4,'hills'),
     (10,6,'hills'), (11,6,'hills'), (12,6,'hills'),
     (7,5,'rough'), (8,5,'rough'), (9,5,'rough'),
   ]),
  ("Grand B — Wing Hammer (28v28, mirrored)", "GRAND_B",
   [
     (6,4,'woods'), (7,4,'woods'), (8,4,'woods'),
     (6,6,'woods'), (7,6,'woods'), (8,6,'woods'),
     (1,4,'rough'), (2,4,'rough'),
     (1,6,'rough'), (2,6,'rough'),
     (13,4,'hills'), (14,4,'hills'),
     (13,6,'hills'), (14,6,'hills'),
   ]),
  ("Berserker A — Wedge vs Shieldwall (26v26)", "BERSERKER_A",
   [
     (2,4,'woods'), (3,4,'woods'), (4,4,'woods'),
     (2,6,'woods'), (3,6,'woods'), (4,6,'woods'),
     (11,4,'hills'), (12,4,'hills'), (13,4,'hills'),
     (11,6,'hills'), (12,6,'hills'), (13,6,'hills'),
     (7,5,'rough'), (8,5,'rough'),
   ]),
  ("Berserker D — Refused Flank vs Wide Wings (28v28)", "BERSERKER_D",
   [
     (1,4,'rough'), (2,4,'rough'), (3,4,'rough'),
     (1,6,'rough'), (2,6,'rough'), (3,6,'rough'),
     (12,4,'woods'), (13,4,'woods'), (14,4,'woods'),
     (12,6,'woods'), (13,6,'woods'), (14,6,'woods'),
     (7,5,'hills'), (8,5,'hills'), (9,5,'hills'),
   ]),
]

def patch_scenario_terrain(js: str, scenario_name: str, tag: str, entries):
    key1 = f"'{scenario_name}'"
    key2 = f"\"{scenario_name}\""
    i = js.find(key1)
    if i == -1:
        i = js.find(key2)
    if i == -1:
        print(f"⚠️  Scenario not found: {scenario_name}")
        return js, False

    # Find the scenario object braces
    colon = js.find(":", i)
    brace0 = js.find("{", colon)
    brace1 = find_matching(js, brace0, "{", "}")
    if brace0 == -1 or brace1 == -1:
        print(f"⚠️  Couldn't parse scenario object: {scenario_name}")
        return js, False

    scen = js[brace0:brace1+1]

    # Find terrain array
    tpos = scen.find("terrain")
    if tpos == -1:
        print(f"⚠️  No terrain field inside: {scenario_name}")
        return js, False
    b0 = scen.find("[", tpos)
    b1 = find_matching(scen, b0, "[", "]")
    if b0 == -1 or b1 == -1:
        print(f"⚠️  Couldn't parse terrain array: {scenario_name}")
        return js, False

    arr = scen[b0:b1+1]
    start_mark = f"// === REAL TERRAIN: {tag} ==="
    end_mark   = f"// === END REAL TERRAIN: {tag} ==="

    # Determine indentation (use the indentation of the first non-empty line after '[')
    lines = arr.splitlines()
    base_indent = "        "  # safe default
    if len(lines) >= 2:
        # indentation of line after '[' (if present), otherwise use terrain line indent + 2 spaces
        base_indent = (lines[1][:len(lines[1]) - len(lines[1].lstrip())]) or base_indent

    block_lines = [base_indent + start_mark]
    for (q,r,t) in entries:
        block_lines.append(base_indent + f"{{ q: {q}, r: {r}, terrain: '{t}' }},")
    block_lines.append(base_indent + end_mark)

    block = "\n" + "\n".join(block_lines) + "\n"

    if start_mark in arr and end_mark in arr:
        # replace existing block
        a0 = arr.find(start_mark)
        a1 = arr.find(end_mark, a0)
        a1 = arr.find("\n", a1)
        if a1 == -1: a1 = len(arr)
        # include the end line
        arr_new = arr[:a0] + block.strip("\n") + arr[a1:]
    else:
        # insert right after '['
        insert_at = arr.find("[") + 1
        arr_new = arr[:insert_at] + block + arr[insert_at:]

    scen_new = scen[:b0] + arr_new + scen[b1+1:]
    js_new = js[:brace0] + scen_new + js[brace1+1:]
    print(f"✅ Terrain patched: {scenario_name}")
    return js_new, True

def patch_file(path: Path):
    text = path.read_text(encoding="utf-8")
    bak = path.with_suffix(f".js.bak_{datetime.now().strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(path, bak)

    changed = False
    for (name, tag, entries) in TARGETS:
        text, did = patch_scenario_terrain(text, name, tag, entries)
        changed = changed or did

    if changed:
        path.write_text(text, encoding="utf-8")
        print(f"✅ Wrote {path} (backup: {bak.name})")
    else:
        print(f"⚠️  No scenario terrain changes applied in {path} (maybe names differ).")
    return changed

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 patch_realistic_terrain.py <path-to-main.js>")
        sys.exit(1)
    patch_file(Path(sys.argv[1]))
