#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re, shutil, sys

MAIN = Path("main.js")
if not MAIN.exists():
    print("ERROR: main.js not found (run this inside polemos/).")
    sys.exit(1)

BASE = "#c7c2a6"  # <- recommended dusty battlefield
HILLS = "rgba(176, 120, 40, 0.24)"  # warmer than base, avoids blending

THEME_BLOCK = f"""  battlefield: {{
    base: '{BASE}',
    grid: 'rgba(0,0,0,0.28)',
    tint: {{
      hills: '{HILLS}',
      woods: 'rgba(40, 120, 60, 0.22)',
      rough: 'rgba(110, 85, 70, 0.20)',
      water: 'rgba(30, 90, 170, 0.30)',
    }},
  }},
"""

text = MAIN.read_text(encoding="utf-8")

# Backup
ts = datetime.now().strftime("%Y%m%d-%H%M%S")
bak = MAIN.with_suffix(f".js.bak_{ts}")
shutil.copy2(MAIN, bak)

# Find TERRAIN_THEMES object
m = re.search(r"\bconst\s+TERRAIN_THEMES\s*=\s*{", text)
if not m:
    m = re.search(r"\bTERRAIN_THEMES\s*=\s*{", text)
if not m:
    print("ERROR: couldn't find TERRAIN_THEMES in main.js")
    sys.exit(1)

brace0 = text.find("{", m.end()-1)
if brace0 < 0:
    print("ERROR: couldn't find opening { for TERRAIN_THEMES")
    sys.exit(1)

# Brace match
def match_brace(s, i0):
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

        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

brace1 = match_brace(text, brace0)
if brace1 < 0:
    print("ERROR: couldn't find closing } for TERRAIN_THEMES")
    sys.exit(1)

themes_obj = text[brace0:brace1+1]

# Insert or update battlefield theme inside the object
if re.search(r"\bbattlefield\s*:", themes_obj):
    # Update base + hills inside battlefield (simple, safe replacements)
    themes_obj = re.sub(
        r"(battlefield\s*:\s*\{[^}]*?base\s*:\s*)['\"][^'\"]+['\"]",
        r"\1'" + BASE + r"'",
        themes_obj,
        flags=re.S,
        count=1
    )
    themes_obj = re.sub(
        r"(battlefield\s*:\s*\{.*?tint\s*:\s*\{.*?hills\s*:\s*)['\"][^'\"]+['\"]",
        r"\1'" + HILLS + r"'",
        themes_obj,
        flags=re.S,
        count=1
    )
else:
    # Insert right after opening brace
    themes_obj = "{\n" + THEME_BLOCK + themes_obj[2:]

# Put back into full file
text = text[:brace0] + themes_obj + text[brace1+1:]

# Set default terrainTheme to battlefield (first match only)
text2, n = re.subn(r"(terrainTheme\s*:\s*)['\"][^'\"]+['\"]", r"\1'battlefield'", text, count=1)
text = text2

MAIN.write_text(text, encoding="utf-8")

print("✅ Battlefield base applied.")
print("Base:", BASE)
print("Hills tint:", HILLS)
print("Backup:", bak.name)
