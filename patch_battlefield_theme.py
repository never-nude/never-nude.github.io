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

THEME_KEY = "battlefield"
THEME_BLOCK = """    // Battlefield Dust: sun-baked earth instead of blank paper.
    battlefield: {
      base: '#d8cfb0',
      grid: 'rgba(0,0,0,0.30)',
      tint: {
        hills: 'rgba(183, 131, 43, 0.22)',
        woods: 'rgba(36, 122, 63, 0.24)',
        rough: 'rgba(107, 84, 70, 0.20)',
        water: 'rgba(30, 90, 170, 0.30)',
      },
    },
"""

def patch_file(path: Path):
    text = path.read_text(encoding="utf-8")
    bak = path.with_suffix(f".js.bak_{datetime.now().strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(path, bak)

    # 1) Insert/update battlefield theme inside TERRAIN_THEMES
    idx = text.find("const TERRAIN_THEMES")
    if idx == -1:
        print(f"WARNING: TERRAIN_THEMES not found in {path}")
        return False

    brace0 = text.find("{", idx)
    brace1 = find_matching(text, brace0, "{", "}")
    if brace0 == -1 or brace1 == -1:
        print(f"ERROR: couldn't parse TERRAIN_THEMES braces in {path}")
        return False

    obj = text[brace0:brace1+1]

    if f"{THEME_KEY}:" in obj:
        # replace existing theme block (rough but safe: find key, then brace-match that theme)
        k = obj.find(f"{THEME_KEY}:")
        tb0 = obj.find("{", k)
        tb1 = find_matching(obj, tb0, "{", "}")
        # include trailing comma if present
        after = obj[tb1+1:]
        comma = ""
        if after.lstrip().startswith(","):
            comma = ","
            # remove that comma from after so we don't double it
            cut = after.find(",")
            after = after[:cut] + after[cut+1:]
        obj = obj[:k] + THEME_BLOCK.rstrip() + obj[tb1+1:]
    else:
        # insert right after opening brace
        obj = "{\n" + THEME_BLOCK + obj[2:]

    text = text[:brace0] + obj + text[brace1+1:]

    # 2) Make battlefield the default in state
    text = text.replace("terrainTheme: 'vivid'", "terrainTheme: 'battlefield'")
    text = text.replace('terrainTheme: "vivid"', 'terrainTheme: "battlefield"')

    # 3) Put battlefield first in theme cycle order if TERRAIN_THEME_ORDER exists
    import re
    text, _ = re.subn(
        r"const\s+TERRAIN_THEME_ORDER\s*=\s*\[[^\]]*\]\s*;",
        "const TERRAIN_THEME_ORDER = ['battlefield', 'vivid', 'classic', 'dusk'];",
        text,
        count=1
    )

    path.write_text(text, encoding="utf-8")
    print(f"✅ Patched {path} (backup: {bak.name})")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 patch_battlefield_theme.py <path-to-main.js>")
        sys.exit(1)
    patch_file(Path(sys.argv[1]))
