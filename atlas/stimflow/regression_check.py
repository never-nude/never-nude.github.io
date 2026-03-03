#!/usr/bin/env python3
"""Deterministic regression checks for StimFlow pathway snapshots.

Usage:
  python3 regression_check.py
  python3 regression_check.py --update
"""

from __future__ import annotations

import argparse
import heapq
import json
import math
import pathlib
import sys
from typing import Dict, Iterable, List, Tuple


DEFAULT_ENGAGEMENT = {
    "arrival_quantile": 0.88,
    "edge_weight_min": 0.12,
    "coactivation_lag_s": 2.6,
}
DEFAULT_CORE_QUANTILE = 0.62
TRAVEL_WINDOW_S = 7.0
AAL_ALIASES = {
    "Frontal_Orb_Med": "Frontal_Med_Orb",
    "Frontal_Orb_Med_L": "Frontal_Med_Orb_L",
    "Frontal_Orb_Med_R": "Frontal_Med_Orb_R",
}


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def canonical_label(label: str) -> str:
    label = str(label or "").strip()
    if label.endswith(tuple(str(i) for i in range(10))):
        label = label.split("__", 1)[0]
    return AAL_ALIASES.get(label, label)


def edge_key(a: int, b: int) -> Tuple[int, int]:
    return (a, b) if a < b else (b, a)


def quantile_cutoff(values: List[float], quantile: float) -> float:
    if not values:
        return math.inf
    sorted_vals = sorted(values)
    q = clamp01(quantile)
    idx = min(len(sorted_vals) - 1, max(0, int(math.floor(q * (len(sorted_vals) - 1)))))
    return sorted_vals[idx]


def dijkstra_from(start_idx: int, adjacency: List[List[Tuple[int, float]]]) -> List[float]:
    n = len(adjacency)
    dist = [math.inf] * n
    dist[start_idx] = 0.0
    pq: List[Tuple[float, int]] = [(0.0, start_idx)]
    while pq:
        best, node = heapq.heappop(pq)
        if best > dist[node]:
            continue
        for nb, w in adjacency[node]:
            edge_cost = 1.0 / max(0.04, w)
            cand = best + edge_cost
            if cand < dist[nb]:
                dist[nb] = cand
                heapq.heappush(pq, (cand, nb))
    return dist


def multi_source_path(seed_indices: Iterable[int], adjacency: List[List[Tuple[int, float]]]) -> Tuple[List[float], List[int]]:
    n = len(adjacency)
    dist = [math.inf] * n
    parent = [-1] * n
    pq: List[Tuple[float, int]] = []
    for idx in seed_indices:
        if 0 <= idx < n:
            dist[idx] = 0.0
            heapq.heappush(pq, (0.0, idx))
    while pq:
        best, node = heapq.heappop(pq)
        if best > dist[node]:
            continue
        for nb, w in adjacency[node]:
            edge_cost = 1.0 / max(0.04, w)
            cand = best + edge_cost
            if cand < dist[nb]:
                dist[nb] = cand
                parent[nb] = node
                heapq.heappush(pq, (cand, nb))
    return dist, parent


def build_label_index(graph_nodes: List[dict]) -> Tuple[Dict[str, int], Dict[str, List[int]]]:
    label_to_index: Dict[str, int] = {}
    label_to_indices: Dict[str, List[int]] = {}
    for idx, node in enumerate(graph_nodes):
        name = node.get("name", "")
        label_to_index[name] = idx
        canonical = canonical_label(name)
        label_to_indices.setdefault(canonical, []).append(idx)
    return label_to_index, label_to_indices


def expand_seed(seed: dict, label_to_index: Dict[str, int]) -> List[Tuple[str, float]]:
    raw_label = canonical_label(seed.get("aal_label", ""))
    raw_weight = float(seed.get("w", seed.get("weight", 0)) or 0)
    if not raw_label or raw_weight <= 0:
        return []
    if raw_label in label_to_index:
        return [(raw_label, raw_weight)]
    if raw_label.endswith("_L") or raw_label.endswith("_R"):
        return []

    left_label = canonical_label(f"{raw_label}_L")
    right_label = canonical_label(f"{raw_label}_R")
    has_left = left_label in label_to_index
    has_right = right_label in label_to_index
    if has_left and has_right:
        return [(left_label, raw_weight * 0.5), (right_label, raw_weight * 0.5)]
    if has_left:
        return [(left_label, raw_weight)]
    if has_right:
        return [(right_label, raw_weight)]
    return []


def normalize_pair(raw_pair: dict, default_confidence: float) -> dict | None:
    from_label = canonical_label(raw_pair.get("from") or raw_pair.get("source") or raw_pair.get("a"))
    to_label = canonical_label(raw_pair.get("to") or raw_pair.get("target") or raw_pair.get("b"))
    if not from_label or not to_label or from_label == to_label:
        return None
    confidence = clamp01(float(raw_pair.get("confidence", default_confidence)))
    return {"from": from_label, "to": to_label, "confidence": confidence}


def normalize_path_pairs(raw_pairs: list, default_confidence: float) -> List[dict]:
    out = []
    for raw in raw_pairs or []:
        norm = normalize_pair(raw, default_confidence)
        if norm:
            out.append(norm)
    return out


def apply_connectivity_for_stimulus(
    stimulus_id: str,
    base_adjacency: List[List[Tuple[int, float]]],
    edge_weight: Dict[Tuple[int, int], float],
    label_to_indices: Dict[str, List[int]],
    connectivity_spec: dict,
) -> List[List[Tuple[int, float]]]:
    edge_scale: Dict[Tuple[int, int], float] = {}
    global_pairs = connectivity_spec.get("global_pairs") or []
    stimulus_pairs = ((connectivity_spec.get("stimuli") or {}).get(stimulus_id) or {}).get("pairs") or []
    all_pairs = list(global_pairs) + list(stimulus_pairs)

    for pair in all_pairs:
        from_label = canonical_label(pair.get("from") or pair.get("a") or pair.get("source"))
        to_label = canonical_label(pair.get("to") or pair.get("b") or pair.get("target"))
        if not from_label or not to_label or from_label == to_label:
            continue
        scale = float(pair.get("scale", pair.get("multiplier", pair.get("w", 1))) or 1)
        scale = max(0.2, min(3.5, scale))
        if abs(scale - 1.0) < 1e-9:
            continue
        from_indices = label_to_indices.get(from_label, [])
        to_indices = label_to_indices.get(to_label, [])
        for a in from_indices:
            for b in to_indices:
                if a == b:
                    continue
                key = edge_key(a, b)
                if key not in edge_weight:
                    continue
                prev = edge_scale.get(key)
                if prev is None or abs(scale - 1.0) > abs(prev - 1.0):
                    edge_scale[key] = scale

    out: List[List[Tuple[int, float]]] = []
    for i, row in enumerate(base_adjacency):
        next_row = []
        for nb, w in row:
            key = edge_key(i, nb)
            scale = edge_scale.get(key, 1.0)
            next_row.append((nb, max(0.001, min(1.0, w * scale))))
        out.append(next_row)
    return out


def path_snapshot_for_stimulus(stimulus: dict, graph: dict, connectivity_spec: dict) -> dict:
    nodes = graph["nodes"]
    edges = graph["edges"]
    label_to_index, label_to_indices = build_label_index(nodes)
    edge_weight: Dict[Tuple[int, int], float] = {}
    base_adjacency: List[List[Tuple[int, float]]] = [[] for _ in nodes]
    for edge in edges:
        a = int(edge["source"])
        b = int(edge["target"])
        w = float(edge.get("weight_norm", 0) or 0)
        base_adjacency[a].append((b, w))
        base_adjacency[b].append((a, w))
        edge_weight[edge_key(a, b)] = w

    adjacency = apply_connectivity_for_stimulus(
        stimulus_id=stimulus["id"],
        base_adjacency=base_adjacency,
        edge_weight=edge_weight,
        label_to_indices=label_to_indices,
        connectivity_spec=connectivity_spec,
    )

    resolved_seeds: List[Tuple[str, float]] = []
    for seed in stimulus.get("seed_regions") or []:
        resolved_seeds.extend(expand_seed(seed, label_to_index))

    seed_nodes: List[Tuple[int, float, List[float], float]] = []
    seed_indices: List[int] = []
    seed_set = set()
    for label, weight in resolved_seeds:
        idx = label_to_index.get(label)
        if idx is None:
            continue
        dist = dijkstra_from(idx, adjacency)
        max_dist = max([d for d in dist if math.isfinite(d)] or [1.0])
        seed_nodes.append((idx, weight, dist, max(1.0, max_dist)))
        seed_indices.append(idx)
        seed_set.add(idx)

    if not seed_indices:
        return {"reachable_nodes": 0, "core_edges": 0, "extended_edges": 0, "first12": []}

    dist, parent = multi_source_path(seed_indices, adjacency)
    engagement = dict(DEFAULT_ENGAGEMENT)
    engagement.update(stimulus.get("engagement") or {})
    breadth_q = float(engagement.get("arrival_quantile", DEFAULT_ENGAGEMENT["arrival_quantile"]) or DEFAULT_ENGAGEMENT["arrival_quantile"])
    finite_dist = [d for d in dist if math.isfinite(d)]
    cutoff = quantile_cutoff(finite_dist, breadth_q)

    relevant = [False] * len(nodes)
    max_relevant_dist = 0.0
    for i, d in enumerate(dist):
        if math.isfinite(d) and (d <= cutoff or i in seed_set):
            relevant[i] = True
            max_relevant_dist = max(max_relevant_dist, d)
    dist_norm = max(0.1, max_relevant_dist)

    core_q = float(stimulus.get("core_quantile", DEFAULT_CORE_QUANTILE) or DEFAULT_CORE_QUANTILE)
    rel_dist = [dist[i] for i in range(len(nodes)) if relevant[i] and math.isfinite(dist[i])]
    core_cutoff = quantile_cutoff(rel_dist, core_q)
    tier = [0] * len(nodes)
    arrival = [math.inf] * len(nodes)
    for i, d in enumerate(dist):
        if not relevant[i]:
            continue
        arrival[i] = (d / dist_norm) * TRAVEL_WINDOW_S
        tier[i] = 2 if (i in seed_set or d <= core_cutoff) else 1

    edge_meta: Dict[Tuple[int, int], str] = {}
    for i, p in enumerate(parent):
        if p < 0 or not relevant[i] or not relevant[p]:
            continue
        key = edge_key(i, p)
        edge_meta[key] = "core" if (tier[i] == 2 and tier[p] == 2) else "extended"

    edge_min = float(engagement.get("edge_weight_min", DEFAULT_ENGAGEMENT["edge_weight_min"]) or DEFAULT_ENGAGEMENT["edge_weight_min"])
    lag_max = float(engagement.get("coactivation_lag_s", DEFAULT_ENGAGEMENT["coactivation_lag_s"]) or DEFAULT_ENGAGEMENT["coactivation_lag_s"])
    for edge in edges:
        a = int(edge["source"])
        b = int(edge["target"])
        w = float(edge.get("weight_norm", 0) or 0)
        if w < edge_min or not relevant[a] or not relevant[b]:
            continue
        if not math.isfinite(arrival[a]) or not math.isfinite(arrival[b]):
            continue
        if abs(arrival[a] - arrival[b]) > lag_max:
            continue
        key = edge_key(a, b)
        if key not in edge_meta:
            edge_meta[key] = "core" if (tier[a] == 2 and tier[b] == 2) else "extended"

    for pair in normalize_path_pairs(stimulus.get("core_path") or [], 0.84):
        for a in label_to_indices.get(pair["from"], []):
            for b in label_to_indices.get(pair["to"], []):
                key = edge_key(a, b)
                if key in edge_weight:
                    edge_meta[key] = "core"

    for pair in normalize_path_pairs(stimulus.get("extended_path") or [], 0.58):
        for a in label_to_indices.get(pair["from"], []):
            for b in label_to_indices.get(pair["to"], []):
                key = edge_key(a, b)
                if key in edge_weight and key not in edge_meta:
                    edge_meta[key] = "extended"

    events = []
    for i, t in enumerate(arrival):
        if relevant[i] and math.isfinite(t):
            events.append((t, i))
    events.sort(key=lambda item: (item[0], item[1]))
    first12 = []
    for t, i in events[:12]:
        first12.append({
            "aal_label": nodes[i].get("name", ""),
            "arrival_s": round(float(t), 3),
            "tier": "core" if tier[i] == 2 else "extended",
        })

    core_edges = sum(1 for value in edge_meta.values() if value == "core")
    extended_edges = sum(1 for value in edge_meta.values() if value == "extended")
    return {
        "reachable_nodes": int(sum(1 for x in relevant if x)),
        "core_edges": int(core_edges),
        "extended_edges": int(extended_edges),
        "first12": first12,
    }


def build_snapshot(root: pathlib.Path) -> dict:
    graph_path = root.parent / "assets" / "aal_graph_dense.json"
    stimuli_path = root / "stimuli.library.json"
    connectivity_path = root / "connectivity.empirical.json"

    with graph_path.open("r", encoding="utf-8") as f:
        graph = json.load(f)
    with stimuli_path.open("r", encoding="utf-8") as f:
        stimuli_lib = json.load(f)
    with connectivity_path.open("r", encoding="utf-8") as f:
        connectivity = json.load(f)

    target_ids = ["music", "pain", "fear", "reward"]
    stimuli_by_id = {stim.get("id"): stim for stim in (stimuli_lib.get("stimuli") or [])}
    result = {
        "schema_version": 1,
        "algorithm_version": 2,
        "graph_file": str(graph_path.name),
        "stimuli_file": str(stimuli_path.name),
        "connectivity_file": str(connectivity_path.name),
        "stimuli": {},
    }
    for stim_id in target_ids:
        stim = stimuli_by_id.get(stim_id)
        if not stim:
            continue
        result["stimuli"][stim_id] = path_snapshot_for_stimulus(stim, graph, connectivity)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="StimFlow regression checker")
    parser.add_argument("--update", action="store_true", help="Write a new expected snapshot")
    args = parser.parse_args()

    root = pathlib.Path(__file__).resolve().parent
    expected_path = root / "regression.expected.json"
    snapshot = build_snapshot(root)

    if args.update or not expected_path.exists():
        expected_path.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
        print(f"wrote snapshot: {expected_path}")
        return 0

    expected = json.loads(expected_path.read_text(encoding="utf-8"))
    if snapshot != expected:
        print("FAIL: regression snapshot mismatch")
        print("Run with --update to refresh expected snapshot if this change is intentional.")
        print("Expected:")
        print(json.dumps(expected, indent=2))
        print("Actual:")
        print(json.dumps(snapshot, indent=2))
        return 1

    print("PASS: regression snapshot matches expected")
    return 0


if __name__ == "__main__":
    sys.exit(main())
