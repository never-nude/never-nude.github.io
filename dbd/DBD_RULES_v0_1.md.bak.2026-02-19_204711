# Death Before Dishonor (DBD) — Rules v0.1

This is the v0.1 rules pack for **Death Before Dishonor**, a 2‑player hex tactical war game focused on formations, pressure, and retreat cascades.

**Design target:** "Memoir ’44 class" immediacy — meaningful turns within minutes, rules that live in hands, not an encyclopedia.

## Version anchors

- Rules: **v0.1**
- Board: **DBD-157-v1** (157 hexes, fixed silhouette)
- Scenario schema: **dbd-scn-0.1**

These anchors exist to prevent drift. If code and rules disagree, code must change or the version must bump.

---

## 1) Core invariants (do not drift)

- The battlefield silhouette is fixed:
  - 11 rows with lengths: `12, 13, 14, 15, 16, 17, 16, 15, 14, 13, 12`
  - Total playable hexes: **157**
- Every hex has a stable internal ID (“metacap”):
  - IDs are integers **0..156** and never change meaning.
- Two sides: **BLUE** and **RED**.
- A unit occupies exactly one hex.
- **No stacking** (no two units in the same hex).
- Players alternate turns.
- Baseline tempo: **3 activations per turn**.
- Randomness is only d6 combat dice (v0.1).
- Dice legend (universal):
  - `5–6 = HIT`
  - `4 = RETREAT`
  - `1–3 = MISS`
- Blocked retreat rule (universal):
  - If a unit cannot complete a required retreat step, it takes **1 additional HIT** per unfulfilled step.

---

## 2) Board + metacaps (DBD-157-v1)

### 2.1 Metacap numbering (row-major)
Row 0 starts at 0 and proceeds left-to-right; then row 1 continues, etc.

Row lengths:
- Row 0: 12
- Row 1: 13
- Row 2: 14
- Row 3: 15
- Row 4: 16
- Row 5: 17
- Row 6: 16
- Row 7: 15
- Row 8: 14
- Row 9: 13
- Row 10: 12

Row starts:
- Row 0 start = 0
- Row 1 start = 12
- Row 2 start = 25
- Row 3 start = 39
- Row 4 start = 54
- Row 5 start = 70
- Row 6 start = 87
- Row 7 start = 103
- Row 8 start = 118
- Row 9 start = 132
- Row 10 start = 145

Metacap ID formula:
- `metacapId = rowStart[row] + col`

Neighbors / adjacency are defined by `dbd/board_157_v1.json` (generated deterministically).

---

## 3) Terrain (v0.1)

Terrain types:
- `CLEAR`
- `WOODS`
- `ROUGH`
- `HILL`
- `WATER`

Movement costs:
- CLEAR: cost 1
- WOODS: cost 2
- ROUGH: cost 2
- HILL: cost 1
- WATER: impassable

Movement constraints:
- You cannot move through occupied hexes.
- You cannot end movement on an occupied hex.
- You cannot enter WATER.

Cavalry constraint (v0.1):
- Cavalry may enter WOODS/ROUGH, but **entering WOODS/ROUGH ends its movement** for that activation (no charge through it).

Cover (dice reduction):
- If defender is in WOODS or ROUGH: attacker rolls **-1 die** (minimum 1).
- If defender is on HILL: attacker rolls **-1 die for ranged attacks only** (minimum 1).

Line of sight:
- v0.1 uses **range only** (no LOS blocking). LOS can be added later as a versioned layer.

---

## 4) Units

Every unit has:
- `side`: BLUE or RED
- `type`: INF, CAV, SKR, ARC, GEN
- `quality`: GREEN, REGULAR, VETERAN
- `maxHP` (derived)
- `hp` (current hit points)
- `hex` (metacapId)
- (optionally) `id` (a stable unit identifier string)

### 4.1 Unit points vs hit points
- **Unit points** are scenario composition (token count). In v0.1, each token = 1 unit point.
- **Hit points** are persistence (battle damage). HP changes during play.

### 4.2 Quality (v0.1 effects only)
Quality affects:
1) Max HP
2) Retreat resilience (canceling retreats)

Max HP modifier:
- GREEN: `maxHP = baseHP - 1`
- REGULAR: `maxHP = baseHP`
- VETERAN: `maxHP = baseHP + 1`

### 4.3 Base stats (REGULAR baseline)

| Type | Move | Base HP | Melee dice | Ranged dice | Ranged range | Notes |
|------|------|---------|------------|-------------|--------------|------|
| INF  | 1    | 5       | 2          | —           | —            | Backbone line-holder |
| CAV  | 2    | 4       | 2          | —           | —            | Charge bonus (below) |
| SKR  | 2    | 3       | 1          | 1           | 2            | Can move+shoot; flexible disengage |
| ARC  | 1    | 3       | 1          | 2           | 3            | Cannot ranged-fire while engaged; cannot move+shoot (v0.1) |
| GEN  | 1    | 6       | 1          | —           | —            | Weak attack, strong staying power |

General note (v0.1): Generals do **not** gate activations. They exist as physical pieces and leadership pressure, not as command bookkeeping.

---

## 5) Turn structure

Players alternate turns.

On your turn you have **3 activations**.

An activation is spent on exactly one friendly unit. You may end your turn early, but in v0.1 there is no benefit to doing so unless a scenario layer adds it.

---

## 6) Engagement + activation options

A unit is **engaged** if it is adjacent to any enemy unit.

### 6.1 If you start your activation engaged
You must choose ONE:
- **Melee Attack** an adjacent enemy, OR
- **Withdraw** (move to a hex where you are no longer adjacent to any enemy). Withdraw consumes the activation and does not include an attack.

Exceptions:
- **SKR (Skirmishers):** may withdraw up to their full Move and still make a ranged attack (range 2) in the same activation, as long as they end unengaged.

### 6.2 If you start your activation unengaged
You may:
- Move (up to your move allowance), then optionally attack if eligible.

Move + attack eligibility (v0.1):
- INF / CAV / GEN: may move, then make a melee attack if adjacent after moving.
- SKR: may move, then make a ranged attack (range 2). May melee if adjacent (1 die).
- ARC: may either move OR make a ranged attack (range 3). No move+shoot in v0.1.

Archers and adjacency:
- Archers cannot use ranged attacks while engaged.
- If adjacent to an enemy, archers may only melee (1 die) or withdraw.

---

## 7) Support + retreat resilience (the formation engine)

Define:
- `supportCount = number of adjacent friendly units` (friendly includes generals).

When an attack produces one or more RETREAT results, the defender may cancel retreats **before moving** according to quality:

- GREEN: cancel **1** retreat only if (`supportCount >= 2`) OR adjacent to a friendly GEN.
- REGULAR: cancel **1** retreat only if (`supportCount >= 1`) OR adjacent to a friendly GEN.
- VETERAN: cancel **1** retreat always; cancel **2** if (`supportCount >= 1`) OR adjacent to a friendly GEN. (Max cancel = 2.)

These cancellations happen per attack, not per turn.

---

## 8) Flanking (v0.1)

Facing is not used.

A defender is **flanked** if it is adjacent to **2 or more enemy units** at the moment it is attacked.

Effect:
- Melee attacks against a flanked defender get **+1 die**.

---

## 9) Combat resolution (exact order)

When a unit attacks:

1) Determine dice count:
   - Start from base dice for that attack type.
   - Apply cover reductions (WOODS/ROUGH/HILL).
   - Apply charge / flanking bonuses (if applicable).
   - Dice minimum is 1.

2) Roll that many d6:
   - 5–6 = HIT
   - 4 = RETREAT
   - 1–3 = MISS

3) Apply retreat resilience cancellations (Section 7).

4) Apply HITs immediately:
   - Reduce defender `hp` by hits.
   - If `hp <= 0`, the unit is destroyed and removed immediately (no retreats applied).

5) Apply remaining RETREAT steps:
   - For each retreat step, the defender must move 1 hex to a legal adjacent hex that increases its distance from the attacker.
   - Defender chooses among legal options.
   - A retreat step cannot enter occupied hexes or impassable terrain.
   - If no legal retreat hex exists for a required step:
     - Defender takes **1 extra HIT** for that unfulfilled step.
     - If `hp <= 0`, destroy and remove.

"Away from the attacker" is geometric:
- A legal retreat hex must result in strictly greater distance (in hex steps) from the attacker’s hex than the unit’s current distance.

---

## 10) Cavalry charge (v0.1)

If a CAV unit:
- moves **2 hexes** during its activation, AND
- ends adjacent to an enemy, AND
- makes a melee attack immediately,

Then that melee attack gets:
- **+1 die**.

Note: entering WOODS/ROUGH ends movement and prevents achieving the 2-hex charge condition.

---

## 11) Standards + victory (v0.1)

Standards are victory points.

Default victory threshold:
- **6 standards** to win (scenario-defined).

Scoring:
- Destroy an enemy unit: **+1 standard**
- Destroy an enemy general: **+2 standards**

Scenarios may add objective standards later, but v0.1 plays cleanly as "break the formation."

---

## 12) Scenario data contract (overview)

Scenario JSON is exportable/importable as one blob.

Required top-level fields (see schema file for full definition):
- `schema` (must equal `dbd-scn-0.1`)
- `board` (must equal `DBD-157-v1`)
- `standardsToWin` (integer)
- `terrain` (map: metacapId -> terrain string)
- `units` (list of units with side/type/quality/hp/hex)
- `turn` (whose turn, turn number, activations remaining)

Validation rules (engine MUST enforce):
- hex IDs must exist (0..156)
- no two units may share a hex
- hp must be within 1..maxHP for that unit

---

## 13) Future layers (explicitly NOT in v0.1)

- Command gating through generals
- Morale track / activation degradation
- Fatigue
- LOS blocking / raycasting
- Objective standards, scenario special rules

These layers are allowed later only if they deepen the same formation/retreat story without turning into logistics.
