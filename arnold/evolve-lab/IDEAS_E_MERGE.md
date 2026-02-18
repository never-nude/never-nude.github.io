# E-merge — Idea Parking Lot (to trial later)

## EM-001 — Trait loss / tradeoffs across generations
Two data-driven mechanisms:
- Maintenance costs: traits burn energy / reduce efficiency; expensive traits that don’t help get selected against.
- Use-it-or-lose-it: traits drift toward what the player actually does; unused traits decay toward baseline over generations.

Implementation note:
- Better after save slots / lineage persistence, or after we have strong trait visualization.

## EM-002 — Variable mate responses (0–3) + “find mates before calling”
Replace “spawn mates on call” with:
- mates exist in world (or in regions)
- C is a broadcast; mates respond only if within radius and attractiveness >= threshold
- lower-tier mates respond easier; higher-tier mates are rarer + pickier

This naturally yields:
- sometimes none respond (not up to level / wrong region)
- sometimes 1–3 respond based on density + attractiveness

## EM-003 — Mate traits readable without words
Goal: interpret mate offers at a glance, without text labels on the mates.

Candidates:
A) Trait glyph ring (recommended): 3 spokes/icons (leaf/fang/bolt) encode offered traits via size/thickness.
B) Motion language: jitter/glide/trail length as cues.
C) Body morph hints: nose/tail/limb buds indicate specialization.

## EM-004 — Peacock / display skill
Optional “courtship display” mechanic for high-tier mates:
- small timing/sequence mini-challenge (low UI clutter)
- success boosts attraction; failure triggers cute “embarrassed” behavior
- only for rare/picky mates, not everyday mating

## EM-005 — Mate gating by “level”
High-value mates ignore you unless your attractiveness score clears their threshold.
Lower-value mates may still approach.

## EM-006 — Hazard-zone diet drives tolerance
Eating in hazardous zones (heat, cold, toxins) should contribute to adaptation/tolerance traits over generations.
Example: repeated feeding in hot zones slowly increases heat tolerance, reducing penalties or unlocking new foods.

## EM-007 — Resource competition and scarcity
We need visible competitors for resources (flora/fauna), so evolution is driven by pressure rather than convenience.

Ideas:
- Make flora patchy and harder to find; introduce environmental obstacles/hazards guarding some flora.
- Prey sometimes cluster near flora patches (feeding), gaining defensive benefit when grouped.
- Group defense vs predation: clustered prey are safer; stragglers/weaker individuals are pickable.
- Competitors can include other herbivores, other predators, or environmental “claimants” (fungus/toxin zones).
- This should scale by epoch/biome: Nursery forgiving, later epochs harsher with scarcer resources and higher competition.

## EM-008 — Food chain, competitors, packs, confrontation
Food web direction:
- Some weaker prey (herbivores) consume flora.
- Stronger prey (predators) consume weaker prey.
- Player competes with these species for food and later for mates.

Competition / social:
- Competitor organisms can compete for food and for mates.
- Potential to form packs/alliances with competitors depending on sociability/strategy.

Confrontation (later layer):
- Not necessarily combat-first: could be display, chase, intimidation, theft, or direct fighting.
- Design goal: pressure + tradeoffs, not “win button.”

## EM-009 — Multi-tier food web + competitors + packs (future)
Food web layering:
- Herbivores consume flora.
- Predators consume herbivores.
- Player can compete, prey on, or cooperate with species depending on traits.

Competitors:
- Rival organisms compete for food patches and for mates.
- Some competitors could become pack allies if sociability is high.

Confrontation (later):
- Not necessarily combat-only: intimidation, chase-off, stealing, display, or fighting depending on traits.
