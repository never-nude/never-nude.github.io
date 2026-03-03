import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const CORE_BUILD_ID = "1772481939";
const STIMFLOW_BUILD_ID = "1772570301";
const MILESTONE_LABEL = "VERITAS";
const CACHE_BUST = `${CORE_BUILD_ID}-${STIMFLOW_BUILD_ID}`;

const GRAPH_DENSE_URL = `../assets/aal_graph_dense.json?v=${CACHE_BUST}`;
const GRAPH_URL = `../assets/aal_graph.json?v=${CACHE_BUST}`;
const HULL_URL = `../assets/brain_hull.obj?v=${CACHE_BUST}`;
const STIMULI_LIBRARY_URL = `./stimuli.library.json?v=${CACHE_BUST}`;
const STIMULI_EMPIRICAL_URL = `./stimuli.empirical.json?v=${CACHE_BUST}`;
const CONNECTIVITY_EMPIRICAL_URL = `./connectivity.empirical.json?v=${CACHE_BUST}`;
const STIMULI_TEMPLATE_URL = `./stimuli.template.json?v=${CACHE_BUST}`;
const REGION_CARDS_URL = `../edu/aal_region_cards.json?v=${CACHE_BUST}`;

const SCALE = 0.01;
const DEFAULT_HRF = { model: "canonical_bold_like", rise_s: 4, peak_s: 6, fall_s: 12 };
const VALID_TIERS = new Set([
  "TEMPLATE_META_ANALYTIC",
  "EMPIRICAL_TASK_FMRI",
  "SIMULATED_PROPAGATION",
]);
const CONFIDENCE_CLASSES = ["conf-low", "conf-medium", "conf-high"];
const AAL_LABEL_ALIASES = new Map([
  ["Frontal_Orb_Med", "Frontal_Med_Orb"],
  ["Frontal_Orb_Med_L", "Frontal_Med_Orb_L"],
  ["Frontal_Orb_Med_R", "Frontal_Med_Orb_R"],
]);
const CARD_LABEL_ALIASES = new Map([
  ["Frontal_Med_Orb", "Frontal_Orb_Med"],
  ["Frontal_Med_Orb_L", "Frontal_Orb_Med_L"],
  ["Frontal_Med_Orb_R", "Frontal_Orb_Med_R"],
]);
const PATH_SEQUENCE_LIMIT = 12;
const NODE_BASE_SCALE_FACTOR = 0.70;
const SELECTED_REGION_SCALE_MULTIPLIER = 2.50;
const DEFAULT_SCRUB_STEP_S = 0.5;
const DEFAULT_TRAVEL_WINDOW_S = 7.0;
const DEFAULT_MODEL_DURATION_S = 25.0;
const VERY_LOW_CONFIDENCE_THRESHOLD = 0.26;
const VERY_LOW_CONFIDENCE_NOTE =
  "Evidence for a stable canonical pathway is limited, so interpret this map as a provisional network hypothesis.";
const DEFAULT_CORE_QUANTILE = 0.62;
const DEFAULT_ENGAGEMENT = {
  arrival_quantile: 0.88,
  edge_weight_min: 0.12,
  coactivation_lag_s: 2.6,
};
const MAJOR_REGION_LABELS = [
  "Frontal lobe",
  "Parietal lobe",
  "Temporal lobe",
  "Occipital lobe",
  "Insula",
  "Cingulate cortex",
  "Limbic medial temporal",
  "Thalamus",
  "Basal ganglia",
  "Cerebellum",
];
const SEARCH_CONCEPTS = [
  {
    id: "cerebellum_concept",
    display_label: "Cerebellum (concept)",
    aliases: ["cerebellum", "cerebellar", "cerebelum", "vermis"],
    kind: "proxy",
    note: "Mapped to cerebellar hemisphere and vermis nodes available in this atlas.",
    matchLabel: (canonical) => canonical.startsWith("Cerebelum_") || canonical.startsWith("Vermis_"),
  },
  {
    id: "vermis_concept",
    display_label: "Vermis (concept)",
    aliases: ["vermis", "cerebellar vermis"],
    kind: "proxy",
    note: "Mapped to vermis nodes available in this atlas.",
    matchLabel: (canonical) => canonical.startsWith("Vermis_"),
  },
  {
    id: "corpus_callosum_proxy",
    display_label: "Corpus callosum",
    aliases: [
      "corpus callosum",
      "corpus calosum",
      "callosum",
      "callosal",
      "corpus callosal",
      "interhemispheric tract",
    ],
    kind: "proxy",
    note: "Corpus callosum is a white-matter tract and not a gray-matter node in AAL; showing medial/interhemispheric cortical proxy regions.",
    matchLabel: (canonical) =>
      canonical.startsWith("Cingulum_")
      || canonical.startsWith("Precuneus_")
      || canonical.startsWith("Frontal_Sup_Medial_"),
  },
  {
    id: "brainstem_proxy",
    display_label: "Brainstem",
    aliases: ["brainstem", "brain stem"],
    kind: "proxy",
    note: "Brainstem nuclei are not explicitly parcellated in this AAL atlas; showing nearby relay/vestibular proxy regions.",
    matchLabel: (canonical) =>
      canonical.startsWith("Thalamus_")
      || canonical.startsWith("Cerebelum_9_")
      || canonical.startsWith("Cerebelum_10_")
      || canonical === "Vermis_9"
      || canonical === "Vermis_10",
  },
  {
    id: "pons_proxy",
    display_label: "Pons",
    aliases: ["pons", "pontine"],
    kind: "proxy",
    note: "Pons is not explicitly represented in AAL; showing cerebellar/vestibular proxy regions most related to pontine pathways.",
    matchLabel: (canonical) =>
      canonical.startsWith("Cerebelum_8_")
      || canonical.startsWith("Cerebelum_9_")
      || canonical.startsWith("Cerebelum_10_")
      || canonical === "Vermis_8"
      || canonical === "Vermis_9"
      || canonical === "Vermis_10",
  },
  {
    id: "medulla_proxy",
    display_label: "Medulla",
    aliases: ["medulla", "medulla oblongata"],
    kind: "proxy",
    note: "Medulla is not explicitly represented in AAL; showing inferior posterior cerebellar and vestibular proxy regions.",
    matchLabel: (canonical) =>
      canonical.startsWith("Cerebelum_9_")
      || canonical.startsWith("Cerebelum_10_")
      || canonical === "Vermis_9"
      || canonical === "Vermis_10",
  },
  {
    id: "midbrain_proxy",
    display_label: "Midbrain",
    aliases: ["midbrain", "mesencephalon"],
    kind: "proxy",
    note: "Midbrain is not explicitly represented in AAL; showing thalamic relay and related cerebellar proxy regions.",
    matchLabel: (canonical) =>
      canonical.startsWith("Thalamus_")
      || canonical.startsWith("Cerebelum_9_")
      || canonical.startsWith("Cerebelum_10_")
      || canonical === "Vermis_9"
      || canonical === "Vermis_10",
  },
];

const CORE_SOURCE_LINKS = [
  { label: "AAL DOI", href: "https://doi.org/10.1006/nimg.2001.0978" },
  { label: "HCP Young Adult", href: "https://www.humanconnectome.org/study/hcp-young-adult" },
  { label: "HCP Wiki", href: "https://wiki.humanconnectome.org/" },
  { label: "Neurosynth", href: "https://neurosynth.org/" },
];
const MECHANISM_SOURCE_LINKS_COMMON = [
  { label: "MedlinePlus Drug Info", href: "https://medlineplus.gov/druginformation.html" },
  { label: "DailyMed", href: "https://dailymed.nlm.nih.gov/dailymed/" },
  { label: "NCBI Bookshelf", href: "https://www.ncbi.nlm.nih.gov/books/" },
];
const SEARCH_HIGHLIGHT_PALETTE = [
  0xffef00,
  0x00e8ff,
  0xff62ff,
  0x61ff7a,
  0xff8a00,
];
const HULL_OPACITY = 0.12;
const HULL_OPACITY_MIN = 0.10;
const HULL_OPACITY_MAX = 0.95;
const TIER_NONE = 0;
const TIER_EXTENDED = 1;
const TIER_CORE = 2;
const DEFAULT_PHASE_MODEL = [
  { id: "onset", label: "Onset", start_s: 0.0, end_s: 4.5, core_gain: 1.12, extended_gain: 0.12, edge_gain: 0.92 },
  { id: "early_integration", label: "Early integration", start_s: 4.5, end_s: 10.5, core_gain: 1.00, extended_gain: 0.70, edge_gain: 1.00 },
  { id: "late_modulation", label: "Late modulation", start_s: 10.5, end_s: 25.0, core_gain: 0.76, extended_gain: 0.92, edge_gain: 0.86 },
];
const TEXT_NARRATION_MAX_LINES = 52;
const NARRATION_STAGE_WINDOW_S = 0.55;
const SEARCH_FOCUS_DURATION_MS = 520;
const SEARCH_FOCUS_MIN_DISTANCE = 0.22;
const SEARCH_FOCUS_MAX_DISTANCE = 0.78;
const SEARCH_FOCUS_PADDING = 3.2;
const CLICK_DRAG_THRESHOLD_PX = 6;
const ATLAS_MODE_ID = "atlas_explore";
const DEFAULT_STIMULUS_ID = "resting_state_baseline";
const STIMULUS_REAL_COURSE_SECONDS = new Map([
  [ATLAS_MODE_ID, 0],
  [DEFAULT_STIMULUS_ID, 600],
  ["joy_positive_affect", 120],
  ["sadness_grief", 180],
  ["anger_reactivity", 120],
  ["disgust_avoidance", 120],
  ["surprise_orienting", 90],
  ["love_attachment", 180],
  ["hate_aversion", 120],
  ["anxiety_anticipation", 180],
  ["calm_safety", 300],
  ["empathy_resonance", 120],
  ["guilt_self_evaluation", 180],
  ["shame_social_evaluation", 180],
  ["trust_affiliation", 150],
  ["jealousy_envy", 120],
  ["awe_salience", 180],
  ["frustration_conflict", 120],
  ["music", 120],
  ["pain", 120],
  ["fear", 120],
  ["reward", 120],
  ["visual_flash", 45],
  ["motor_tapping", 60],
  ["language_comprehension", 120],
  ["working_memory", 180],
  ["response_inhibition", 120],
  ["face_processing", 90],
  ["episodic_memory_encoding", 300],
  ["semantic_retrieval", 180],
  ["associative_learning", 300],
  ["memory_retrieval", 240],
  ["sleep_transition", 28800],
  ["sleep_stage_n1", 420],
  ["sleep_stage_n2", 1500],
  ["sleep_stage_n3", 1800],
  ["sleep_stage_rem", 1200],
  ["nicotine_cue", 900],
  ["alcohol_cue", 1200],
  ["stimulant_cue", 900],
  ["cannabis_cue", 1200],
  ["opioid_cue", 1200],
  ["caffeine_alerting", 14400],
  ["caffeine_challenge", 14400],
  ["nicotine_administration", 7200],
  ["alcohol_intoxication", 21600],
  ["thc_challenge", 21600],
  ["opioid_analgesia", 14400],
  ["psilocybin_challenge", 28800],
  ["lsd_challenge", 43200],
  ["ketamine_challenge", 7200],
  ["acetaminophen", 21600],
  ["clonazepam_klonopin", 28800],
  ["losartan", 86400],
  ["morphine", 14400],
  ["fentanyl", 7200],
  ["hydromorphone", 10800],
  ["oxycodone", 21600],
  ["ketorolac", 21600],
  ["ondansetron", 21600],
  ["metoclopramide", 21600],
  ["pantoprazole", 86400],
  ["enoxaparin", 43200],
  ["heparin", 21600],
  ["insulin_lispro", 18000],
  ["insulin_glargine", 86400],
  ["metoprolol", 43200],
  ["labetalol", 21600],
  ["furosemide", 21600],
  ["ceftriaxone", 86400],
  ["vancomycin", 43200],
  ["piperacillin_tazobactam", 28800],
  ["albuterol", 21600],
  ["ipratropium", 21600],
  ["dexamethasone", 86400],
  ["lorazepam", 21600],
  ["propofol", 5400],
  ["norepinephrine", 7200],
]);

function prettyAalLabel(raw) {
  if (!raw) return "";
  raw = String(raw).replace(/__\d+$/, "");

  let hemi = "";
  if (raw.endsWith("_L")) { hemi = "Left"; raw = raw.slice(0, -2); }
  else if (raw.endsWith("_R")) { hemi = "Right"; raw = raw.slice(0, -2); }

  const tok = {
    Sup: "Superior",
    Mid: "Middle",
    Inf: "Inferior",
    Ant: "Anterior",
    Post: "Posterior",
    Med: "Medial",
    Lat: "Lateral",
    Orb: "Orbital",
    Oper: "Opercular",
    Tri: "Triangular",
    Rol: "Rolandic",
    Rect: "Rectus",
    Supp: "Supplementary",
    Cingulum: "Cingulate",
    ParaHippocampal: "Parahippocampal",
  };

  let parts = raw.split("_").map((p) => tok[p] || p);
  parts = parts.map((p) => p.replace(/([a-z])([A-Z])/g, "$1 $2"));

  const lobes = new Set(["Frontal", "Temporal", "Parietal", "Occipital"]);
  const desc = new Set(["Superior", "Middle", "Inferior", "Medial", "Lateral", "Anterior", "Posterior", "Orbital"]);

  if (parts.length >= 2 && lobes.has(parts[0]) && desc.has(parts[1])) {
    parts = [parts[1], parts[0], ...parts.slice(2)];
  }

  if (parts.length >= 2 && parts[0] === "Cingulate" && (parts[1] === "Anterior" || parts[1] === "Posterior")) {
    parts = [parts[1], parts[0], ...parts.slice(2)];
  }

  let label = parts.join(" ");
  if (hemi) label += ` (${hemi})`;
  return label;
}

function mniToThree([x, y, z]) {
  return new THREE.Vector3(x * SCALE, z * SCALE, -y * SCALE);
}

function clamp01(v) {
  return THREE.MathUtils.clamp(v, 0, 1);
}

function emit(type, detail) {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function safeText(value, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

const STIMULUS_LABEL_NOISE_PAREN_RE = /\s*\((?:[^)]*\b(?:anchor|template)\b[^)]*)\)\s*$/i;

function cleanStimulusDisplayLabel(rawLabel, fallback = "") {
  let label = safeText(rawLabel, fallback);
  let prev = "";
  while (label && label !== prev && STIMULUS_LABEL_NOISE_PAREN_RE.test(label)) {
    prev = label;
    label = label.replace(STIMULUS_LABEL_NOISE_PAREN_RE, "").trim();
  }
  return safeText(label, fallback);
}

function stimulusDisplayLabel(stimulus) {
  if (!stimulus) return "none";
  return cleanStimulusDisplayLabel(stimulus.label, safeText(stimulus.id, "stimulus"));
}

function normalizeSearchText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/__\d+$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isTextEntryTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function normalizeGraphMode(value) {
  const v = safeText(value, "auto").toLowerCase();
  if (v === "dense") return "dense";
  if (v === "core") return "core";
  return "auto";
}

function normalizeTier(value) {
  const tier = safeText(value, "TEMPLATE_META_ANALYTIC");
  return VALID_TIERS.has(tier) ? tier : "TEMPLATE_META_ANALYTIC";
}

function normalizeHrf(rawHrf) {
  const rise = Math.max(0.1, Number(rawHrf?.rise_s) || DEFAULT_HRF.rise_s);
  const peak = Math.max(rise, Number(rawHrf?.peak_s) || DEFAULT_HRF.peak_s);
  const fall = Math.max(0.1, Number(rawHrf?.fall_s) || DEFAULT_HRF.fall_s);
  const model = safeText(rawHrf?.model, DEFAULT_HRF.model);
  return { model, rise_s: rise, peak_s: peak, fall_s: fall };
}

function normalizeSeedRegions(rawSeedRegions) {
  if (!Array.isArray(rawSeedRegions)) return [];
  const out = [];

  for (const seed of rawSeedRegions) {
    const aalLabel = safeText(seed?.aal_label);
    const weight = Math.max(0, Number(seed?.w ?? seed?.weight) || 0);
    if (!aalLabel || weight <= 0) continue;
    out.push({ aal_label: aalLabel, w: weight });
  }

  return out;
}

function deriveStimulusId(rawStimulus, index) {
  const explicitId = safeText(rawStimulus?.id);
  if (explicitId) return explicitId;

  const fromLabel = safeText(rawStimulus?.label, `stimulus_${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return fromLabel || `stimulus_${index + 1}`;
}

function normalizeStringList(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((v) => safeText(v))
    .filter(Boolean);
}

function normalizeEngagement(rawEngagement) {
  const q = Number(rawEngagement?.arrival_quantile);
  const edgeMin = Number(rawEngagement?.edge_weight_min);
  const lag = Number(rawEngagement?.coactivation_lag_s);
  return {
    arrival_quantile: clamp01(Number.isFinite(q) ? q : DEFAULT_ENGAGEMENT.arrival_quantile),
    edge_weight_min: THREE.MathUtils.clamp(
      Number.isFinite(edgeMin) ? edgeMin : DEFAULT_ENGAGEMENT.edge_weight_min,
      0,
      1
    ),
    coactivation_lag_s: THREE.MathUtils.clamp(
      Number.isFinite(lag) ? lag : DEFAULT_ENGAGEMENT.coactivation_lag_s,
      0.1,
      12
    ),
  };
}

function normalizePathPair(rawPair, defaultConfidence) {
  const from = canonicalNodeLabel(rawPair?.from ?? rawPair?.source ?? rawPair?.a);
  const to = canonicalNodeLabel(rawPair?.to ?? rawPair?.target ?? rawPair?.b);
  if (!from || !to || from === to) return null;

  const confidenceRaw = Number(rawPair?.confidence);
  const confidence = clamp01(Number.isFinite(confidenceRaw) ? confidenceRaw : defaultConfidence);
  const latencyRaw = Number(rawPair?.latency_s ?? rawPair?.latency);
  const latency_s = Number.isFinite(latencyRaw) ? Math.max(0, latencyRaw) : 0;

  return {
    from,
    to,
    confidence,
    latency_s,
    role_from: safeText(rawPair?.role_from),
    role_to: safeText(rawPair?.role_to),
  };
}

function normalizePathPairs(rawPairs, defaultConfidence) {
  if (!Array.isArray(rawPairs)) return [];
  return rawPairs
    .map((pair) => normalizePathPair(pair, defaultConfidence))
    .filter(Boolean);
}

function normalizePhase(rawPhase, fallback) {
  const id = safeText(rawPhase?.id, fallback.id);
  const label = safeText(rawPhase?.label, fallback.label);
  const startRaw = Number(rawPhase?.start_s);
  const endRaw = Number(rawPhase?.end_s);
  const start_s = Number.isFinite(startRaw) ? Math.max(0, startRaw) : fallback.start_s;
  const end_s = Number.isFinite(endRaw) ? Math.max(start_s + 0.05, endRaw) : fallback.end_s;
  const coreGainRaw = Number(rawPhase?.core_gain);
  const extGainRaw = Number(rawPhase?.extended_gain);
  const edgeGainRaw = Number(rawPhase?.edge_gain);

  return {
    id,
    label,
    start_s,
    end_s,
    core_gain: THREE.MathUtils.clamp(Number.isFinite(coreGainRaw) ? coreGainRaw : fallback.core_gain, 0, 2.5),
    extended_gain: THREE.MathUtils.clamp(Number.isFinite(extGainRaw) ? extGainRaw : fallback.extended_gain, 0, 2.5),
    edge_gain: THREE.MathUtils.clamp(Number.isFinite(edgeGainRaw) ? edgeGainRaw : fallback.edge_gain, 0, 2.5),
  };
}

function normalizePhaseModel(rawPhases, durationS) {
  const fallback = DEFAULT_PHASE_MODEL.map((phase) => ({ ...phase }));
  const phases = Array.isArray(rawPhases) && rawPhases.length
    ? rawPhases.map((raw, i) => normalizePhase(raw, fallback[Math.min(i, fallback.length - 1)]))
    : fallback;

  phases.sort((a, b) => a.start_s - b.start_s);
  if (phases.length) phases[0].start_s = 0;
  for (let i = 1; i < phases.length; i++) {
    phases[i].start_s = Math.max(phases[i].start_s, phases[i - 1].end_s);
    phases[i].end_s = Math.max(phases[i].end_s, phases[i].start_s + 0.05);
  }

  const duration = Math.max(0.5, Number(durationS) || DEFAULT_PHASE_MODEL[DEFAULT_PHASE_MODEL.length - 1].end_s);
  const last = phases[phases.length - 1];
  last.end_s = Math.max(last.end_s, duration);
  return phases;
}

function defaultModelDurationForHrf(hrf) {
  const peak = Math.max(0.1, Number(hrf?.peak_s) || DEFAULT_HRF.peak_s);
  const fall = Math.max(0.1, Number(hrf?.fall_s) || DEFAULT_HRF.fall_s);
  return Math.max(8, peak + fall + DEFAULT_TRAVEL_WINDOW_S);
}

function inferApproxRealCourseSeconds(stimulusId, label, tier, evidenceType) {
  const id = safeText(stimulusId).toLowerCase();
  if (STIMULUS_REAL_COURSE_SECONDS.has(id)) {
    return STIMULUS_REAL_COURSE_SECONDS.get(id);
  }

  const haystack = `${id} ${safeText(label).toLowerCase()} ${safeText(evidenceType).toLowerCase()}`;
  if (haystack.includes("sleep")) return 28800;
  if (haystack.includes("cue")) return 1200;
  if (haystack.includes("pharmacological")) return 14400;
  if (haystack.includes("medication")) return 21600;
  if (tier === "EMPIRICAL_TASK_FMRI") return 120;
  return DEFAULT_MODEL_DURATION_S;
}

function normalizeTimingProfile(rawTiming, fallbackModelDurationS, stimulusMeta) {
  const modelRaw = Number(rawTiming?.model_duration_s ?? rawTiming?.sim_duration_s ?? rawTiming?.duration_s);
  const model_duration_s = THREE.MathUtils.clamp(
    Number.isFinite(modelRaw) ? modelRaw : fallbackModelDurationS,
    8,
    240
  );

  const travelRaw = Number(rawTiming?.travel_window_s ?? rawTiming?.propagation_window_s);
  const travel_window_s = THREE.MathUtils.clamp(
    Number.isFinite(travelRaw) ? travelRaw : DEFAULT_TRAVEL_WINDOW_S,
    1.5,
    Math.max(2, model_duration_s - 0.5)
  );

  const inferredReal = inferApproxRealCourseSeconds(
    stimulusMeta?.id,
    stimulusMeta?.label,
    stimulusMeta?.tier,
    stimulusMeta?.evidence_type
  );
  const realRaw = Number(rawTiming?.real_course_s ?? rawTiming?.real_duration_s ?? rawTiming?.course_s);
  let real_course_s = Math.max(1, Number.isFinite(realRaw) ? realRaw : inferredReal);

  const onsetRaw = Number(rawTiming?.onset_real_s ?? rawTiming?.onset_s);
  const peakRaw = Number(rawTiming?.peak_real_s ?? rawTiming?.peak_s);
  const offsetRaw = Number(rawTiming?.offset_real_s ?? rawTiming?.offset_s);

  const defaultOnset = Math.max(1, real_course_s * 0.08);
  const defaultPeak = Math.max(defaultOnset + 1, real_course_s * 0.35);
  const onset_real_s = Number.isFinite(onsetRaw) ? Math.max(0, onsetRaw) : defaultOnset;
  const peak_real_s = Number.isFinite(peakRaw) ? Math.max(onset_real_s, peakRaw) : defaultPeak;
  let offset_real_s = Number.isFinite(offsetRaw) ? Math.max(peak_real_s, offsetRaw) : real_course_s;
  real_course_s = Math.max(real_course_s, offset_real_s);
  offset_real_s = Math.min(offset_real_s, real_course_s);

  return {
    model_duration_s,
    travel_window_s,
    real_course_s,
    onset_real_s,
    peak_real_s,
    offset_real_s,
    source: safeText(rawTiming?.source, "EDUCATIONAL_APPROX"),
    note: safeText(rawTiming?.note, "Approximate timeline for educational pacing, not patient-specific pharmacokinetics."),
  };
}

function formatDurationCompact(totalSeconds) {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (sec < 60) return `${sec}s`;
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) {
    if (minutes > 0) return `${hours}h ${minutes}m`;
    return `${hours}h`;
  }
  if (minutes >= 10 || seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function normalizeStimulus(rawStimulus, index, libraryHrf = DEFAULT_HRF) {
  const seedRegions = normalizeSeedRegions(rawStimulus?.seed_regions);
  if (!seedRegions.length) return null;

  const id = deriveStimulusId(rawStimulus, index);
  const label = safeText(rawStimulus?.label, id);
  const tier = normalizeTier(rawStimulus?.tier);
  const explanation = safeText(rawStimulus?.explanation, "Summary unavailable.");
  const rawConfidence = Number(rawStimulus?.confidence);
  const confidence = Number.isFinite(rawConfidence) ? clamp01(rawConfidence) : 0.4;
  const evidenceType = safeText(
    rawStimulus?.evidence_type,
    tier === "EMPIRICAL_TASK_FMRI" ? "task-fMRI summary" : "template curation"
  );
  const datasets = normalizeStringList(rawStimulus?.datasets ?? rawStimulus?.data_sources);
  const citations = normalizeStringList(rawStimulus?.citations);
  const engagement = normalizeEngagement(rawStimulus?.engagement);
  const corePath = normalizePathPairs(rawStimulus?.core_path, 0.84);
  const extendedPath = normalizePathPairs(rawStimulus?.extended_path, 0.58);
  const coreQuantileRaw = Number(rawStimulus?.core_quantile ?? rawStimulus?.path_profile?.core_quantile);
  const core_quantile = THREE.MathUtils.clamp(
    Number.isFinite(coreQuantileRaw) ? coreQuantileRaw : DEFAULT_CORE_QUANTILE,
    0.35,
    0.90
  );

  const hrf = normalizeHrf(rawStimulus?.hrf || libraryHrf);
  const defaultDurationS = defaultModelDurationForHrf(hrf);
  const timing_profile = normalizeTimingProfile(
    rawStimulus?.time_profile ?? rawStimulus?.timing ?? rawStimulus?.timeline,
    defaultDurationS,
    { id, label, tier, evidence_type: evidenceType }
  );
  const phases = normalizePhaseModel(rawStimulus?.phases, timing_profile.model_duration_s);

  return {
    id,
    label,
    tier,
    explanation,
    confidence,
    evidence_type: evidenceType,
    datasets,
    citations,
    engagement,
    core_quantile,
    core_path: corePath,
    extended_path: extendedPath,
    model_duration_s: timing_profile.model_duration_s,
    travel_window_s: timing_profile.travel_window_s,
    timing_profile,
    phases,
    seed_regions: seedRegions,
  };
}

function normalizeStimulusLibrary(rawLibrary, sourceName) {
  const hrf = normalizeHrf(rawLibrary?.hrf);
  const stimuli = [];

  const rawStimuli = Array.isArray(rawLibrary?.stimuli) ? rawLibrary.stimuli : [];
  for (let i = 0; i < rawStimuli.length; i++) {
    const normalized = normalizeStimulus(rawStimuli[i], i, hrf);
    if (normalized) stimuli.push(normalized);
  }

  if (!stimuli.length) {
    throw new Error(`No valid stimuli found in ${sourceName}`);
  }

  return {
    schema_version: Number(rawLibrary?.schema_version) || 1,
    source_name: sourceName,
    hrf,
    stimuli,
  };
}

function resolveAalAlias(label) {
  return AAL_LABEL_ALIASES.get(label) || label;
}

function canonicalNodeLabel(label) {
  const raw = safeText(label).replace(/__\d+$/, "");
  return resolveAalAlias(raw);
}

function expandSeedLabel(seed) {
  const rawLabel = safeText(seed?.aal_label);
  const rawWeight = Math.max(0, Number(seed?.w) || 0);
  if (!rawLabel || rawWeight <= 0) return [];

  const label = resolveAalAlias(rawLabel);
  if (labelToIndex.has(label)) return [{ aal_label: label, w: rawWeight }];

  if (label.endsWith("_L") || label.endsWith("_R")) return [];

  const leftLabel = resolveAalAlias(`${label}_L`);
  const rightLabel = resolveAalAlias(`${label}_R`);
  const hasLeft = labelToIndex.has(leftLabel);
  const hasRight = labelToIndex.has(rightLabel);

  if (hasLeft && hasRight) {
    return [
      { aal_label: leftLabel, w: rawWeight * 0.5 },
      { aal_label: rightLabel, w: rawWeight * 0.5 },
    ];
  }
  if (hasLeft) return [{ aal_label: leftLabel, w: rawWeight }];
  if (hasRight) return [{ aal_label: rightLabel, w: rawWeight }];
  return [];
}

function confidenceLevel(score) {
  const v = clamp01(Number(score) || 0);
  if (v >= 0.70) return { level: "high", className: "conf-high" };
  if (v >= 0.45) return { level: "medium", className: "conf-medium" };
  return { level: "low", className: "conf-low" };
}

function joinSourceItems(items, fallback = "not specified", maxItems = 3) {
  const clean = (Array.isArray(items) ? items : [])
    .map((x) => safeText(x))
    .filter(Boolean)
    .slice(0, maxItems);
  return clean.length ? clean.join("; ") : fallback;
}

function isSummaryDisclaimerSentence(sentence) {
  const text = safeText(sentence);
  if (!text) return false;
  return [
    /\bnon[- ]diagnostic\b/i,
    /\bsimplified\b/i,
    /\beducational\b/i,
    /\bplaceholder\b/i,
    /\bconservative\b.*\b(approximation|template|placeholder)\b/i,
    /\bnot\b.*\b(clinical|diagnostic|behavioral|patient|treatment|recommendation|prescribing|dose|efficacy|safety|risk|pharmacokinetic|pharmacodynamic|prediction|model)\b/i,
    /\bdoes not\b.*\b(infer|imply|represent|model|encode)\b/i,
    /\btrait-level\b/i,
    /\bindividual(?:ized)?\b/i,
  ].some((pattern) => pattern.test(text));
}

function sanitizeStimulusSummary(explanation, confidenceScore) {
  const raw = safeText(explanation, "Summary unavailable.");
  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((part) => safeText(part))
    .filter(Boolean);
  if (!sentences.length) return "Summary unavailable.";

  const informative = sentences.filter((sentence) => !isSummaryDisclaimerSentence(sentence));
  let cleaned = informative.join(" ").trim();
  if (!cleaned) cleaned = sentences[0];

  const confidence = clamp01(Number(confidenceScore) || 0);
  if (confidence <= VERY_LOW_CONFIDENCE_THRESHOLD) {
    const hasLowConfidenceCue = /\b(limited|low-confidence|provisional|uncertain|sparse)\b/i.test(cleaned);
    if (!hasLowConfidenceCue) cleaned = `${cleaned} ${VERY_LOW_CONFIDENCE_NOTE}`;
  }
  return cleaned;
}

function stimulusExperienceSummary(stimulus) {
  const key = `${safeText(stimulus?.id)} ${safeText(stimulus?.label)} ${safeText(stimulus?.evidence_type)}`.toLowerCase();
  const withSources = (entry, links = MECHANISM_SOURCE_LINKS_COMMON) => ({ ...entry, mechanismLinks: links });

  if (/\bibuprofen\b/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is lower inflammatory pain intensity and less tenderness over time.",
      processing: "In this atlas, thalamic-insular-cingulate pain appraisal networks show reduced nociceptive salience as incoming pain signaling drops.",
      bridge: "Ibuprofen's anti-inflammatory action is mainly peripheral (outside the brain, via prostaglandin pathway suppression); the brain map reflects how reduced peripheral pain input is represented centrally.",
      sourceContext: "Mechanism synthesis: NSAID pharmacology (peripheral inflammation signaling) + cortical pain-network representation.",
    });
  }

  if (/\bacetaminophen\b|paracetamol/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is reduced pain and fever discomfort, often without strong peripheral anti-inflammatory action.",
      processing: "This atlas highlights thalamic-insular-cingulate pain and interoceptive pathways where perceived pain burden can decrease.",
      bridge: "For acetaminophen, central pain and thermoregulatory modulation is emphasized more than classic peripheral anti-inflammatory effects.",
      sourceContext: "Mechanism synthesis: analgesic/antipyretic pharmacology + cortical pain and interoception networks.",
    });
  }

  if (/\bketamine\b/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effects can include altered perception, dissociation, and shifts in pain experience or mood state.",
      processing: "This pattern emphasizes thalamo-cortical, insular, cingulate, and frontal-network reconfiguration commonly reported in ketamine challenge paradigms.",
      bridge: "At systems level, NMDA-related signaling shifts can change sensory integration and prediction, which can manifest as altered conscious experience.",
      sourceContext: "Mechanism synthesis: NMDA-antagonist challenge literature + large-scale network integration models.",
    });
  }

  if (/\b(myocardial|infarction|chest_pain|acute_myocardial)\b/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is acute chest-pain distress with autonomic symptoms such as diaphoresis, dyspnea, or nausea.",
      processing: "Insular-cingulate-thalamic and somatosensory pathways commonly represent interoceptive threat and pain salience during cardiac pain states.",
      bridge: "Primary injury is cardiac/peripheral, while this map shows how intense visceral and autonomic signals are represented centrally in the brain.",
      sourceContext: "Mechanism synthesis: visceral pain/interoception neuroscience + acute cardiac distress network mapping.",
    });
  }

  if (/\b(stroke|ischemic|infarct|hemorrhage|intracerebral)\b/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is sudden focal neurologic deficit such as weakness, speech disturbance, neglect, or altered awareness.",
      processing: "Region-specific cortical and subcortical networks lose normal integration, with surrounding systems showing compensatory or disrupted communication.",
      bridge: "The represented pathway pattern reflects territory-level network disruption rather than a vessel-level diagnostic determination.",
      sourceContext: "Mechanism synthesis: acute cerebrovascular network disruption literature + territory-level functional mapping.",
    });
  }

  if (/\b(seizure|epilep|postictal|status)\b/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect can include transient sensory/motor events, impaired awareness, convulsions, and post-event confusion.",
      processing: "Focal or thalamo-cortical circuits enter abnormally synchronized high-excitability states with rapid recruitment of connected regions.",
      bridge: "Symptoms emerge as synchronized activity propagates across motor, limbic, and association networks, then resolves into postictal network suppression.",
      sourceContext: "Mechanism synthesis: epilepsy network physiology + focal/generalized propagation models.",
    });
  }

  if (/\b(anaphylaxis|allergic|allergy|systemic_reaction)\b/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is abrupt systemic distress with airway, skin, cardiovascular, and autonomic symptoms.",
      processing: "Insular-cingulate-amygdalar salience and interoceptive networks commonly represent high-threat internal-body signals.",
      bridge: "Primary pathology is systemic immune-mediated; this brain map represents central integration of severe autonomic and respiratory distress signals.",
      sourceContext: "Mechanism synthesis: autonomic/interoceptive distress neuroscience + severe allergic reaction clinical context.",
    });
  }

  if (/\b(sepsis|delirium|encephalopathy)\b/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is fluctuating attention, confusion, altered cognition, and reduced executive clarity.",
      processing: "Thalamic, frontal-control, posterior-midline, and limbic-memory systems show reduced coordinated signaling.",
      bridge: "Systemic inflammatory and metabolic stress can disrupt large-scale brain-network integration, which manifests as delirium-like cognitive states.",
      sourceContext: "Mechanism synthesis: critical-care delirium neuroscience + distributed network-disruption models.",
    });
  }

  if (/\b(hypoglycemia|neuroglycopenia|low_glucose)\b/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is adrenergic warning symptoms plus cognitive slowing, confusion, or altered awareness if severe.",
      processing: "Insular-cingulate-thalamic warning networks and frontal-control systems track metabolic threat and cognitive load changes.",
      bridge: "As glucose availability drops, network efficiency declines and autonomic alarm pathways rise, shaping both bodily and cognitive symptoms.",
      sourceContext: "Mechanism synthesis: hypoglycemia counterregulation physiology + interoceptive/control-network mapping.",
    });
  }

  if (/\borgasm\b/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is peak autonomic arousal with rewarding, climax-associated bodily sensations.",
      processing: "This map emphasizes limbic-insular-cingulate-frontal valuation and salience integration during climax-associated states.",
      bridge: "Cortical and limbic signals interact with hypothalamic/brainstem autonomic control and spinal pattern generators that coordinate pelvic output.",
      sourceContext: "Mechanism synthesis: autonomic and sexual-function neurophysiology + cortical salience/valuation network mapping.",
    });
  }

  if (/\bsexual[_ -]?arousal\b/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is heightened arousal, attention to sexual cues, and autonomic bodily readiness.",
      processing: "Insular, cingulate, limbic, and valuation-related frontal regions commonly coordinate salience and motivational state.",
      bridge: "Brain-state changes influence autonomic and endocrine pathways that shape genital and cardiovascular arousal responses.",
      sourceContext: "Mechanism synthesis: sexual-arousal neurophysiology + salience and valuation network models.",
    });
  }

  if (/(pain|pinprick|nocicept|analges|nsaid|opioid|morphine|fentanyl|hydromorphone|ketorolac)/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is a change in pain intensity, urgency, and body discomfort.",
      processing: "Somatosensory cortex contributes localization/intensity while insula and anterior cingulate contribute salience and affective load.",
      bridge: "Changes in peripheral nociceptive input and central modulation together shape how pain is consciously experienced and behaviorally acted on.",
      sourceContext: "Mechanism synthesis: nociceptive neurophysiology + cortical pain-network mapping.",
    });
  }

  if (/(music|auditory|hearing|heschl|temporal[_ -]?sup|voice|language)/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is stronger detection of sound patterns, rhythm, timbre, or speech salience.",
      processing: "Auditory cortex parses frequency/time structure, then temporal-frontal circuits integrate meaning, memory, and attention.",
      bridge: "The felt percept emerges as sensory decoding is integrated with expectation, context, and memory networks.",
      sourceContext: "Mechanism synthesis: auditory systems neuroscience + task-fMRI auditory network findings.",
    });
  }

  if (/(fear|threat|anx|panic|stress|hypervigil|amygdala)/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is heightened vigilance, faster threat appraisal, and autonomic arousal.",
      processing: "Amygdala-salience circuits detect relevance while cingulate and frontal control regions regulate response selection.",
      bridge: "When salience weighting rises, body-state and attention systems shift toward rapid protective behavior.",
      sourceContext: "Mechanism synthesis: threat/salience task families + autonomic state regulation networks.",
    });
  }

  if (/(reward|surprise|motivat|dopamin|striat|orbitofrontal)/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is increased motivation, salience of outcomes, and reinforcement-driven behavior.",
      processing: "Fronto-striatal valuation pathways estimate expected value and prediction error, then update action policies.",
      bridge: "This can manifest as stronger approach behavior, expectancy shifts, and attention toward reward-relevant cues.",
      sourceContext: "Mechanism synthesis: reward-learning neuroscience + valuation-network task paradigms.",
    });
  }

  if (/(sleep|nrem|rem|wake|arousal|melatonin|circadian)/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is a stage-dependent shift in alertness, sensory gating, and mentation.",
      processing: "Thalamo-cortical gating and limbic-frontal balance change across wake, NREM, and REM network states.",
      bridge: "Those network shifts alter responsiveness, memory consolidation context, and dream-like or internally generated cognition.",
      sourceContext: "Mechanism synthesis: sleep-stage neurophysiology + fMRI sleep network studies.",
    });
  }

  if (/(memory|learning|hippocamp|recall|encoding)/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is stronger or weaker encoding, retrieval fluency, and contextual recall.",
      processing: "Hippocampal-medial temporal systems bind new information, while frontal control networks guide strategy and recall.",
      bridge: "Experience becomes memory when salience, context binding, and retrieval control are coordinated across these networks.",
      sourceContext: "Mechanism synthesis: learning/memory systems neuroscience + task-fMRI encoding/retrieval patterns.",
    });
  }

  if (/(benzodiazep|klonopin|clonazepam|lorazepam|midazolam|propofol|dexmedetomidine|sedat)/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is reduced arousal, anxiolysis/sedation, and slower reactive processing.",
      processing: "Frontal-limbic and thalamo-cortical signaling shifts toward lower excitatory drive and stronger inhibitory tone.",
      bridge: "These network changes can manifest as calmer affect, less vigilance, and reduced response intensity.",
      sourceContext: "Mechanism synthesis: sedative/anxiolytic pharmacology + thalamo-cortical state-regulation networks.",
    });
  }

  if (/(losartan|lisinopril|amlodipine|metoprolol|cardio|hypertens|angiotensin|beta[- ]?block)/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effects are subtle internal-state shifts rather than a discrete sensory event.",
      processing: "Interoceptive-insular-cingulate and control networks track cardiovascular body state and contextual salience.",
      bridge: "Primary drug action is systemic/peripheral; this map shows likely central representation of changing autonomic/interoceptive input.",
      sourceContext: "Mechanism synthesis: cardiovascular pharmacology + interoceptive/autonomic brain-network representation.",
    });
  }

  if (/(touch|tactile|itch|tickle|temperature|warm|cool|pressure|vibration|sneeze|cough|yawn|hunger|thirst|nausea|dizziness|vertigo|dyspnea|heartbeat|bladder|bowel)/.test(key)) {
    return withSources({
      manifestation: "Typical person-level effect is a bodily sensation, urge, or autonomic-state signal that biases behavior.",
      processing: "Primary modality pathways plus insular-cingulate integration map intensity, salience, and action urgency.",
      bridge: "Cortical representation interacts with autonomic and brainstem-spinal control loops to shape the observable response.",
      sourceContext: "Mechanism synthesis: interoception/autonomic neurophysiology + salience network mapping.",
    });
  }

  return withSources({
    manifestation: "Person-level effects can appear as shifts in attention, emotion, body state, or behavior depending on context.",
    processing: "Distributed cortical and subcortical networks coordinate salience detection, integration, and response selection over time.",
    bridge: "In this atlas, pathways represent network-level communication patterns linked to likely experiential and behavioral manifestations.",
    sourceContext: "Mechanism synthesis: systems-neuroscience pathway interpretation anchored to the loaded stimulus library.",
  });
}

function renderMechanismLinksLine(links = []) {
  const clean = (Array.isArray(links) ? links : [])
    .filter((item) => item && safeText(item.label) && safeText(item.href));
  if (!clean.length) return "";
  const seen = new Set();
  const dedup = clean.filter((item) => {
    const href = safeText(item.href);
    if (seen.has(href)) return false;
    seen.add(href);
    return true;
  });
  return `Mechanism links: ${dedup
    .map((item) => `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a>`)
    .join(" | ")}`;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSourceLinksLine(sourceFileName = "") {
  const links = [];
  if (/^[a-z0-9_.-]+\.json$/i.test(sourceFileName)) {
    links.push({ label: sourceFileName, href: `./${sourceFileName}` });
  }
  links.push(...CORE_SOURCE_LINKS);
  const seen = new Set();
  const dedup = links.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
  return `Links: ${dedup
    .map((item) => `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a>`)
    .join(" | ")}`;
}

function activeRealCourseSeconds() {
  const raw = Number(activeStimulus?.timing_profile?.real_course_s);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

function modelTimeToRealSeconds(modelTimeS, modelDurationS) {
  const totalRealS = activeRealCourseSeconds();
  if (!Number.isFinite(totalRealS)) return Math.max(0, Number(modelTimeS) || 0);
  const totalModelS = Math.max(0.001, Number(modelDurationS) || state.durationS || DEFAULT_MODEL_DURATION_S);
  const pct = clamp01((Math.max(0, Number(modelTimeS) || 0)) / totalModelS);
  return pct * totalRealS;
}

function renderStimulusMeta(stimulus) {
  const explanation = sanitizeStimulusSummary(stimulus.explanation, stimulus.confidence);
  const outcome = stimulusExperienceSummary(stimulus);
  const seeds = Array.isArray(stimulus?.seed_regions)
    ? stimulus.seed_regions
        .map((s) => prettyAalLabel(resolveAalAlias(s?.aal_label || "")))
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const seedLine = seeds.length
    ? `Primary seeded regions include ${seeds.join(", ")}.`
    : "Primary seeded regions vary by the selected scenario.";
  if (ui.stimExplain) {
    ui.stimExplain.textContent =
      `${explanation} ${outcome.manifestation} ${outcome.processing} ${outcome.bridge} ${seedLine}`;
  }

  const tier = safeText(stimulus?.tier, "not specified");
  const evidenceType = safeText(stimulus?.evidence_type, "not specified");
  const datasets = joinSourceItems(stimulus?.datasets, "not specified");
  const citations = joinSourceItems(stimulus?.citations, "not specified");
  const sourceFile = safeText(stimulusLibrary?.source_name, "unknown");
  if (ui.stimSourceTier) ui.stimSourceTier.textContent = `Scenario source: ${sourceFile} | tier ${tier}`;
  if (ui.stimSourceEvidence) ui.stimSourceEvidence.textContent = `Evidence basis: ${evidenceType}`;
  if (ui.stimSourceMechanism) ui.stimSourceMechanism.textContent = `Mechanism context: ${outcome.sourceContext}`;
  if (ui.stimSourceDatasets) ui.stimSourceDatasets.textContent = `Datasets: ${datasets}`;
  if (ui.stimSourceCitations) ui.stimSourceCitations.textContent = `Scenario citation tags: ${citations}`;
  if (ui.stimSourceLinks) {
    const primaryLinks = renderSourceLinksLine(sourceFile);
    const mechanismLinks = renderMechanismLinksLine(outcome.mechanismLinks);
    ui.stimSourceLinks.innerHTML = mechanismLinks ? `${primaryLinks}<br/>${mechanismLinks}` : primaryLinks;
  }

  if (!ui.stimConfidence) return;
  const confidence = confidenceLevel(stimulus.confidence);
  ui.stimConfidence.classList.remove(...CONFIDENCE_CLASSES);
  ui.stimConfidence.classList.add(confidence.className);
  ui.stimConfidence.textContent = `Signal confidence: ${confidence.level} (${clamp01(stimulus.confidence).toFixed(2)})`;
}

function renderAtlasMeta() {
  if (ui.stimExplain) {
    ui.stimExplain.textContent =
      "Atlas explore mode has no active stimulus driving the network. Use click, hover, and region search to inspect baseline organization and connectivity context.";
  }
  if (ui.stimSourceTier) ui.stimSourceTier.textContent = "Scenario source: atlas explore baseline (no active stimulus)";
  if (ui.stimSourceEvidence) ui.stimSourceEvidence.textContent = "Evidence basis: baseline exploration";
  if (ui.stimSourceMechanism) ui.stimSourceMechanism.textContent = "Mechanism context: no active stimulus selected in atlas-explore mode.";
  if (ui.stimSourceDatasets) ui.stimSourceDatasets.textContent = "Datasets: not applicable";
  if (ui.stimSourceCitations) ui.stimSourceCitations.textContent = "Scenario citation tags: structural atlas and connectivity context";
  if (ui.stimSourceLinks) ui.stimSourceLinks.innerHTML = renderSourceLinksLine("stimuli.empirical.json");
  if (ui.stimConfidence) {
    ui.stimConfidence.classList.remove(...CONFIDENCE_CLASSES);
    ui.stimConfidence.textContent = "Signal confidence: n/a (atlas explore)";
  }
}

function libraryModeLabel(mode) {
  if (mode === "empirical") return "EMPIRICAL_ANCHORS";
  return "TEMPLATE_META_ANALYTIC";
}

function resolveLibraryMode(preferredMode) {
  if (preferredMode === "empirical" && stimulusLibraries.empirical) return "empirical";
  if (preferredMode === "template" && stimulusLibraries.template) return "template";
  if (stimulusLibraries.empirical) return "empirical";
  if (stimulusLibraries.template) return "template";
  return null;
}

function updateBasisStatus() {
  if (!ui.basisStatus) return;
  const mode = resolveLibraryMode(state.libraryMode);
  if (!mode) {
    ui.basisStatus.textContent = "Basis: unavailable";
    return;
  }
  const lib = stimulusLibraries[mode];
  const source = safeText(lib?.source_name, "unknown");
  const count = Array.isArray(lib?.stimuli) ? lib.stimuli.length : 0;
  ui.basisStatus.textContent = `Basis: ${libraryModeLabel(mode)} | ${count} stimuli | source ${source}`;
}

function updateGraphStatus() {
  if (!ui.graphStatus) return;
  if (!graph) {
    ui.graphStatus.textContent = `Graph: loading (${state.graphMode})`;
    return;
  }
  const requested = normalizeGraphMode(state.graphMode);
  const atlasMode = safeText(graph?.atlas?.mode, "aal_core");
  ui.graphStatus.textContent = `Graph: ${requested} -> ${atlasMode} | ${graph.nodes.length} nodes`;
}

function updateConnectivityStatus() {
  if (!ui.connectivityStatus) return;
  if (!connectivitySourceName) {
    ui.connectivityStatus.textContent = "Connectivity: loading...";
    return;
  }

  if (!activeStimulus) {
    if (!connectivityByStimulus.size) {
      ui.connectivityStatus.textContent = "Connectivity: baseline graph weights";
      return;
    }

    ui.connectivityStatus.textContent = `Connectivity: matrix loaded (${connectivityByStimulus.size} stimulus maps)`;
    return;
  }

  if (activeConnectivityEdgeCount > 0) {
    ui.connectivityStatus.textContent =
      `Connectivity: matrix ${activeConnectivityEdgeCount} links (${connectivitySourceName})`;
    return;
  }

  ui.connectivityStatus.textContent = `Connectivity: baseline graph weights (${connectivitySourceName})`;
}

const buildEl = document.getElementById("build");
const hudEl = document.getElementById("hud");
const IS_TOUCH_DEVICE = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
const MAX_RENDER_PIXEL_RATIO = IS_TOUCH_DEVICE ? 1.5 : 2;
const query = new URLSearchParams(window.location.search);
const requestedGraphMode = normalizeGraphMode(query.get("graph_mode"));
const initialGraphMode = IS_TOUCH_DEVICE
  ? (requestedGraphMode === "auto" ? "dense" : requestedGraphMode)
  : (requestedGraphMode === "auto" ? "dense" : requestedGraphMode);
const initialBreadthQ = THREE.MathUtils.clamp(Number(query.get("path_breadth_q")) || DEFAULT_ENGAGEMENT.arrival_quantile, 0.60, 0.98);

const ui = {
  basisBlock: document.getElementById("basisBlock"),
  graphBlock: document.getElementById("graphBlock"),
  scrubRateBlock: document.getElementById("scrubRateBlock"),
  arrivalJumpBlock: document.getElementById("arrivalJumpBlock"),
  narrationAdvancedBlock: document.getElementById("narrationAdvancedBlock"),
  breadthBlock: document.getElementById("breadthBlock"),
  exportBlock: document.getElementById("exportBlock"),
  pathOnlyBlock: document.getElementById("pathOnlyBlock"),
  reachedOnlyBlock: document.getElementById("reachedOnlyBlock"),
  radiationBlock: document.getElementById("radiationBlock"),
  hoverGroupBlock: document.getElementById("hoverGroupBlock"),
  edgeThresholdBlock: document.getElementById("edgeThresholdBlock"),
  basisSelect: document.getElementById("basisSelect"),
  basisStatus: document.getElementById("basisStatus"),
  graphSelect: document.getElementById("graphSelect"),
  graphStatus: document.getElementById("graphStatus"),
  connectivityStatus: document.getElementById("connectivityStatus"),
  stimSelect: document.getElementById("stimSelect"),
  compareModeSelect: document.getElementById("compareModeSelect"),
  stimCompareSelect: document.getElementById("stimCompareSelect"),
  compareStatus: document.getElementById("compareStatus"),
  liveNarrationLog: document.getElementById("liveNarrationLog"),
  regionQuickCard: document.getElementById("regionQuickCard"),
  regionQuickTitle: document.getElementById("regionQuickTitle"),
  regionQuickSummary: document.getElementById("regionQuickSummary"),
  modeSelect: document.getElementById("modeSelect"),
  speedRange: document.getElementById("speedRange"),
  speedVal: document.getElementById("speedVal"),
  gainRange: document.getElementById("gainRange"),
  gainVal: document.getElementById("gainVal"),
  breadthRange: document.getElementById("breadthRange"),
  breadthVal: document.getElementById("breadthVal"),
  btnPlay: document.getElementById("btnPlay"),
  btnPause: document.getElementById("btnPause"),
  btnStop: document.getElementById("btnStop"),
  btnStepBack: document.getElementById("btnStepBack"),
  btnStepForward: document.getElementById("btnStepForward"),
  btnPrevArrival: document.getElementById("btnPrevArrival"),
  btnNextArrival: document.getElementById("btnNextArrival"),
  timelineText: document.getElementById("timelineText"),
  scrubRange: document.getElementById("scrubRange"),
  scrubVal: document.getElementById("scrubVal"),
  scrubRateRange: document.getElementById("scrubRateRange"),
  scrubRateVal: document.getElementById("scrubRateVal"),
  statusText: document.getElementById("statusText"),
  progressFill: document.getElementById("progressFill"),
  stimConfidence: document.getElementById("stimConfidence"),
  stimExplain: document.getElementById("stimExplain"),
  stimSourceTier: document.getElementById("stimSourceTier"),
  stimSourceEvidence: document.getElementById("stimSourceEvidence"),
  stimSourceMechanism: document.getElementById("stimSourceMechanism"),
  stimSourceDatasets: document.getElementById("stimSourceDatasets"),
  stimSourceCitations: document.getElementById("stimSourceCitations"),
  stimSourceLinks: document.getElementById("stimSourceLinks"),
  majorRegionWords: document.getElementById("majorRegionWords"),
  majorRegionStatus: document.getElementById("majorRegionStatus"),
  pathSequence: document.getElementById("pathSequence"),
  btnExportJson: document.getElementById("btnExportJson"),
  btnExportCsv: document.getElementById("btnExportCsv"),
  exportStatus: document.getElementById("exportStatus"),
  regionSearchInput: document.getElementById("regionSearchInput"),
  regionSearchSuggest: document.getElementById("regionSearchSuggest"),
  btnRegionSearch: document.getElementById("btnRegionSearch"),
  btnRegionPrev: document.getElementById("btnRegionPrev"),
  btnRegionNext: document.getElementById("btnRegionNext"),
  regionSearchStatus: document.getElementById("regionSearchStatus"),
  regionTitle: document.getElementById("regionTitle"),
  regionSummary: document.getElementById("regionSummary"),
  regionNetworks: document.getElementById("regionNetworks"),
  inspectorPhase: document.getElementById("inspectorPhase"),
  inspectorLast: document.getElementById("inspectorLast"),
  inspectorNext: document.getElementById("inspectorNext"),
  inspectorRole: document.getElementById("inspectorRole"),
  inspectorConfidence: document.getElementById("inspectorConfidence"),
  inspectorCompare: document.getElementById("inspectorCompare"),
  toggleEdges: document.getElementById("toggleEdges"),
  togglePathOnly: document.getElementById("togglePathOnly"),
  toggleReachedOnly: document.getElementById("toggleReachedOnly"),
  toggleRadiation: document.getElementById("toggleRadiation"),
  toggleHoverGroup: document.getElementById("toggleHoverGroup"),
  toggleHull: document.getElementById("toggleHull"),
  hullOpacityRange: document.getElementById("hullOpacityRange"),
  hullOpacityVal: document.getElementById("hullOpacityVal"),
  toggleAuto: document.getElementById("toggleAuto"),
  toggleNarration: document.getElementById("toggleNarration"),
  narrationRateRange: document.getElementById("narrationRateRange"),
  narrationRateVal: document.getElementById("narrationRateVal"),
  btnNarrateNow: document.getElementById("btnNarrateNow"),
  btnNarrationMute: document.getElementById("btnNarrationMute"),
  narrationStatus: document.getElementById("narrationStatus"),
  btnReset: document.getElementById("btnReset"),
  edgeThresh: document.getElementById("edgeThresh"),
  edgeVal: document.getElementById("edgeVal"),
};

const mobileUi = {
  dock: document.getElementById("mobileDock"),
  btnPanel: document.getElementById("btnMobilePanel"),
  btnNarration: document.getElementById("btnMobileNarration"),
  btnCanvas: document.getElementById("btnMobileCanvas"),
};

function hud(msg, isError = false) {
  hudEl.textContent = msg;
  hudEl.classList.toggle("error", isError);
}

function syncMobileDockState() {
  if (!mobileUi.btnPanel || !mobileUi.btnNarration || !mobileUi.btnCanvas) return;
  const panelOpen = document.body.classList.contains("mobile-panel-open");
  const logOpen = document.body.classList.contains("mobile-log-open");
  mobileUi.btnPanel.setAttribute("aria-pressed", panelOpen ? "true" : "false");
  mobileUi.btnNarration.setAttribute("aria-pressed", logOpen ? "true" : "false");
  mobileUi.btnCanvas.setAttribute("aria-pressed", (!panelOpen && !logOpen) ? "true" : "false");
}

function closeMobileOverlays() {
  document.body.classList.remove("mobile-panel-open", "mobile-log-open");
  syncMobileDockState();
}

function toggleMobileOverlay(name) {
  if (!IS_TOUCH_DEVICE) return;
  const panelOpen = document.body.classList.contains("mobile-panel-open");
  const logOpen = document.body.classList.contains("mobile-log-open");

  if (name === "panel") {
    if (panelOpen) closeMobileOverlays();
    else {
      document.body.classList.add("mobile-panel-open");
      document.body.classList.remove("mobile-log-open");
      syncMobileDockState();
    }
    return;
  }

  if (name === "log") {
    if (logOpen) closeMobileOverlays();
    else {
      document.body.classList.add("mobile-log-open");
      document.body.classList.remove("mobile-panel-open");
      syncMobileDockState();
    }
    return;
  }

  closeMobileOverlays();
}

function setupMobileOverlayControls() {
  if (!IS_TOUCH_DEVICE || !mobileUi.dock) return;
  document.body.classList.add("mobile-ready");
  // Force closed default state even when Safari restores previous page UI state.
  document.body.classList.remove("mobile-panel-open", "mobile-log-open");

  if (mobileUi.btnPanel) {
    mobileUi.btnPanel.addEventListener("click", () => {
      toggleMobileOverlay("panel");
    });
  }

  if (mobileUi.btnNarration) {
    mobileUi.btnNarration.addEventListener("click", () => {
      toggleMobileOverlay("log");
    });
  }

  if (mobileUi.btnCanvas) {
    mobileUi.btnCanvas.addEventListener("click", () => {
      toggleMobileOverlay("canvas");
    });
  }

  syncMobileDockState();
}

if (IS_TOUCH_DEVICE) {
  addEventListener("pageshow", () => {
    closeMobileOverlays();
  });
}

buildEl.textContent = `STIMFLOW • ${MILESTONE_LABEL} • BUILD ${STIMFLOW_BUILD_ID}`;

const state = {
  graphMode: initialGraphMode,
  pathBreadthQ: initialBreadthQ,
  libraryMode: "empirical",
  edgesOn: true,
  pathOnly: false,
  reachedOnly: false,
  radiationOn: false,
  hoverGroupOn: false,
  hullOn: true,
  hullOpacity: HULL_OPACITY,
  autoRotate: true,
  edgeThreshold: IS_TOUCH_DEVICE ? 0.12 : 0.08,
  gain: 1.0,
  speed: 1.0,
  compareMode: "off",
  compareStimulusId: "",
  scrubStepS: DEFAULT_SCRUB_STEP_S,
  mode: "loop",
  narrationOn: false,
  narrationRate: 1.0,
  durationS: DEFAULT_MODEL_DURATION_S,
  running: false,
  paused: false,
  t: 0,
  lastMs: 0,
  searchExploreOn: false,
};

let graph = null;
let connectivitySourceName = "";
let connectivitySpec = null;
let activeConnectivityEdgeCount = 0;
let activeConnectivityMap = null;
let stimulusLibrary = null;
let stimulusLibraries = { template: null, empirical: null };
let activeStimulus = null;
let regionCards = null;
const regionCardLookup = new Map();

let nodeMesh = null;
let nodeHaloMesh = null;
let nodeSelectionMesh = null;
let hullGroup = null;
let edgeLines = null;
let edgeHighlightLines = null;
let edgeFlow = [];

let edgesFiltered = [];
let edgesShown = 0;
let hoveredIdx = null;
let selectedIdx = null;
let selectedNeighbors = new Set();
let selectedRegionIndices = new Set();
let hoverGroupLabel = "";
const hoverGroupIndices = new Set();
let pathEdgeKeys = new Set();
let comparePathEdgeKeys = new Set();
let pathEdgeMeta = new Map();
let comparePathEdgeMeta = new Map();
let pathParent = [];
let reachableNodeCount = 0;
let latestReachedIdx = null;
let majorRegionsNow = [];
let arrivalEventsCache = [];
let compareArrivalEventsCache = [];
let lastNarratedArrivalCursor = -1;
let regionSearchQuery = "";
let regionSearchMatches = [];
let regionSearchCursor = -1;
let regionSuggestEntries = [];
let regionSuggestCursor = -1;
let searchExploreLabel = "";
const searchExploreIndices = new Set();
const narrationPreviewIndices = new Set();
let activePathModel = null;
let comparePathModel = null;
let compareStimulus = null;
let activePhaseState = null;
let comparePhaseState = null;
let textNarrationTimeline = [];
let textNarrationCursor = -1;
const textNarrationLines = [];
let cameraFocusTween = null;

const nodeBase = []; // { pos, baseScale, baseColor }
const nodeActivation = [];
const compareNodeActivation = [];
const nodeRelevant = [];
const adjacency = [];
const adjacencyBase = [];
const labelToIndex = new Map();
const labelToIndices = new Map();
const edgeKeySet = new Set();
const connectivityByStimulus = new Map();
const dummy = new THREE.Object3D();

let seedNodes = []; // { idx, w, distances, maxDist }
const nodeArrival = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 1000);
const DEFAULT_CAMERA_Z = IS_TOUCH_DEVICE ? 5.55 : 3.75;
camera.position.set(-0.06, 1.12, DEFAULT_CAMERA_Z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MAX_RENDER_PIXEL_RATIO));
document.body.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";
renderer.domElement.addEventListener("contextmenu", (ev) => ev.preventDefault());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const DEFAULT_DAMPING_FACTOR = 0.08;
controls.dampingFactor = DEFAULT_DAMPING_FACTOR;
const AUTO_ROTATE_SPEED = 1.2;
controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
controls.enablePan = true;
controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.target.set(0, 0.16, 0);
controls.update();
controls.saveState();

function easeInOutQuad(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? (2 * t * t) : (1 - (Math.pow(-2 * t + 2, 2) / 2));
}

function cancelCameraFocusTween() {
  cameraFocusTween = null;
}

function focusCameraOnIndices(indices, options = {}) {
  if (!Array.isArray(indices) || !indices.length || !nodeBase.length) return;
  const immediate = options.immediate === true;

  const center = new THREE.Vector3();
  let count = 0;
  for (const idx of indices) {
    if (!Number.isInteger(idx)) continue;
    const base = nodeBase[idx];
    if (!base?.pos) continue;
    center.add(base.pos);
    count += 1;
  }
  if (!count) return;
  center.multiplyScalar(1 / count);

  let radius = 0;
  for (const idx of indices) {
    if (!Number.isInteger(idx)) continue;
    const base = nodeBase[idx];
    if (!base?.pos) continue;
    radius = Math.max(radius, center.distanceTo(base.pos));
  }

  const offset = camera.position.clone().sub(controls.target);
  if (offset.lengthSq() < 1e-9) offset.set(0.4, 0.3, 0.45);
  const currentDistance = offset.length();
  const fitDistance = THREE.MathUtils.clamp(
    (radius * SEARCH_FOCUS_PADDING) + 0.16,
    SEARCH_FOCUS_MIN_DISTANCE,
    SEARCH_FOCUS_MAX_DISTANCE
  );
  const targetDistance = Math.max(SEARCH_FOCUS_MIN_DISTANCE, Math.min(currentDistance, fitDistance));
  const targetPosition = center.clone().addScaledVector(offset.normalize(), targetDistance);

  if (immediate) {
    cancelCameraFocusTween();
    camera.position.copy(targetPosition);
    controls.target.copy(center);
    controls.update();
    return;
  }

  cameraFocusTween = {
    startMs: performance.now(),
    durationMs: SEARCH_FOCUS_DURATION_MS,
    fromPosition: camera.position.clone(),
    toPosition: targetPosition,
    fromTarget: controls.target.clone(),
    toTarget: center,
  };
}

function updateCameraFocusTween(nowMs) {
  if (!cameraFocusTween) return;
  const elapsed = Math.max(0, nowMs - cameraFocusTween.startMs);
  const t = THREE.MathUtils.clamp(elapsed / cameraFocusTween.durationMs, 0, 1);
  const k = easeInOutQuad(t);

  camera.position.lerpVectors(cameraFocusTween.fromPosition, cameraFocusTween.toPosition, k);
  controls.target.lerpVectors(cameraFocusTween.fromTarget, cameraFocusTween.toTarget, k);

  if (t >= 1) {
    cameraFocusTween = null;
  }
}

function setAutoRotateEnabled(enabled, syncCheckbox = true) {
  const next = Boolean(enabled);
  state.autoRotate = next;
  controls.autoRotate = next;
  controls.autoRotateSpeed = next ? AUTO_ROTATE_SPEED : 0;
  controls.enableDamping = next;
  controls.dampingFactor = next ? DEFAULT_DAMPING_FACTOR : 0;

  if (!next) {
    // Flush any residual motion immediately when auto-rotate is turned off.
    controls.update();
  }

  if (syncCheckbox && ui.toggleAuto) ui.toggleAuto.checked = next;
}

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 1.05);
dir.position.set(2, 3, 2);
scene.add(dir);

function updateMouseFromEvent(ev) {
  mouse.x = (ev.clientX / innerWidth) * 2 - 1;
  mouse.y = -(ev.clientY / innerHeight) * 2 + 1;
}

function hrfEnvelopeAt(t, hrf) {
  if (!hrf) return 0;
  const rise = Math.max(0.1, Number(hrf.rise_s) || 4);
  const peak = Math.max(rise, Number(hrf.peak_s) || 6);
  const fall = Math.max(0.1, Number(hrf.fall_s) || 12);
  const end = peak + fall;

  if (t <= 0) return 0;
  if (t < rise) return t / rise;
  if (t < peak) return 1;
  if (t < end) return 1 - ((t - peak) / fall);
  return 0;
}

function activationColor(v) {
  const t = clamp01(v);
  const c = new THREE.Color();
  c.setRGB(
    THREE.MathUtils.lerp(0.22, 1.00, t),
    THREE.MathUtils.lerp(0.30, 0.95, t),
    THREE.MathUtils.lerp(0.40, 0.86, t)
  );
  return c;
}

function temporalSpectrumColor(arrivalS, tSec, windowS) {
  const c = new THREE.Color();
  if (!Number.isFinite(arrivalS)) {
    c.setHex(0x8d9db1);
    return { color: c, phase: 0, active: false };
  }

  const localT = tSec - arrivalS;
  if (localT < 0) {
    c.setHex(0x4f6179);
    return { color: c, phase: 0, active: false };
  }

  const phase = clamp01(localT / Math.max(0.25, windowS));
  // Full spectrum progression: red on arrival -> blue as activation ages.
  const hue = THREE.MathUtils.lerp(0.00, 0.66, phase);
  const sat = THREE.MathUtils.lerp(0.90, 0.96, phase);
  const light = THREE.MathUtils.lerp(0.50, 0.56, phase);
  c.setHSL(hue, sat, light);
  return { color: c, phase, active: localT <= windowS };
}

function arrivalWavePulse(arrivalS, tSec) {
  if (!Number.isFinite(arrivalS)) return 0;
  const dt = tSec - arrivalS;
  if (dt < -0.45 || dt > 3.2) return 0;
  const center = 0.42;
  const sigma = 0.52;
  return Math.exp(-Math.pow(dt - center, 2) / (2 * sigma * sigma));
}

function edgeColorTo(target, v, isPath) {
  const t = clamp01(v);
  if (isPath) {
    target.setRGB(
      THREE.MathUtils.lerp(0.30, 0.96, t),
      THREE.MathUtils.lerp(0.38, 0.98, t),
      THREE.MathUtils.lerp(0.48, 1.00, t)
    );
    return;
  }

  target.setRGB(
    THREE.MathUtils.lerp(0.14, 0.40, t),
    THREE.MathUtils.lerp(0.16, 0.45, t),
    THREE.MathUtils.lerp(0.20, 0.52, t)
  );
}

function countReachedNodes(tSec) {
  let reached = 0;
  let latest = null;
  let latestT = -Infinity;
  for (let i = 0; i < nodeArrival.length; i++) {
    if (!nodeRelevant[i]) continue;
    const arrival = nodeArrival[i];
    if (!Number.isFinite(arrival) || arrival > tSec) continue;
    reached += 1;
    if (arrival >= latestT) {
      latestT = arrival;
      latest = i;
    }
  }
  return { reached, latest };
}

function collectArrivalEvents() {
  const events = [];
  for (let i = 0; i < nodeArrival.length; i++) {
    if (!nodeRelevant[i]) continue;
    const t = nodeArrival[i];
    if (!Number.isFinite(t)) continue;
    events.push({ idx: i, t });
  }
  events.sort((a, b) => (a.t - b.t) || (a.idx - b.idx));
  for (let i = 0; i < events.length; i++) {
    events[i].rank = i + 1;
  }
  return events;
}

function majorRegionForNodeLabel(label) {
  const canonical = canonicalNodeLabel(label);
  const base = canonical.replace(/_(L|R)$/i, "").toLowerCase();
  if (!base) return null;

  if (base.startsWith("insula")) return "Insula";
  if (base.startsWith("cingulum")) return "Cingulate cortex";
  if (base.startsWith("hippocampus") || base.startsWith("parahippocampal") || base.startsWith("amygdala")) {
    return "Limbic medial temporal";
  }
  if (base.startsWith("thalamus")) return "Thalamus";
  if (base.startsWith("caudate") || base.startsWith("putamen") || base.startsWith("pallidum")) {
    return "Basal ganglia";
  }
  if (base.startsWith("cerebellum") || base.startsWith("vermis")) return "Cerebellum";

  if (
    base.startsWith("frontal")
    || base.startsWith("precentral")
    || base.startsWith("rolandic_oper")
    || base.startsWith("supp_motor_area")
    || base.startsWith("olfactory")
    || base.startsWith("rectus")
  ) {
    return "Frontal lobe";
  }

  if (
    base.startsWith("parietal")
    || base.startsWith("postcentral")
    || base.startsWith("precuneus")
    || base.startsWith("supramarginal")
    || base.startsWith("angular")
    || base.startsWith("paracentral_lobule")
  ) {
    return "Parietal lobe";
  }

  if (base.startsWith("temporal") || base.startsWith("heschl")) return "Temporal lobe";

  if (
    base.startsWith("occipital")
    || base.startsWith("calcarine")
    || base.startsWith("cuneus")
    || base.startsWith("lingual")
    || base.startsWith("fusiform")
  ) {
    return "Occipital lobe";
  }

  return null;
}

function readoutActivationAt(idx) {
  const primary = nodeActivation[idx] || 0;
  if (state.compareMode === "off" || !comparePathModel) return primary;
  const secondary = compareNodeActivation[idx] || 0;
  if (state.compareMode === "difference") return Math.abs(primary - secondary);
  return Math.max(primary, secondary);
}

function updateMajorRegionReadout() {
  if (!ui.majorRegionWords || !ui.majorRegionStatus) return;

  if (!graph || !activeStimulus) {
    majorRegionsNow = [];
    ui.majorRegionWords.textContent = "waiting...";
    ui.majorRegionStatus.textContent = "Major regions: n/a";
    return;
  }

  const scoreByRegion = new Map();
  for (const label of MAJOR_REGION_LABELS) scoreByRegion.set(label, 0);

  for (let i = 0; i < nodeActivation.length; i++) {
    const a = readoutActivationAt(i);
    if (a < 0.03) continue;
    const region = majorRegionForNodeLabel(graph.nodes[i]?.name || "");
    if (!region) continue;
    scoreByRegion.set(region, (scoreByRegion.get(region) || 0) + a);
  }

  const entries = [...scoreByRegion.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    majorRegionsNow = [];
    ui.majorRegionWords.textContent = "none";
    ui.majorRegionStatus.textContent = "Major regions: none (below activation threshold)";
    return;
  }

  const peak = Math.max(entries[0][1], 1e-6);
  const floor = Math.max(0.20, peak * 0.22);
  majorRegionsNow = entries
    .filter(([, score]) => score >= floor)
    .slice(0, 5)
    .map(([name, score]) => ({ name, score, rel: clamp01(score / peak) }));

  ui.majorRegionWords.textContent = "";
  for (let i = 0; i < majorRegionsNow.length; i++) {
    const item = majorRegionsNow[i];
    const token = document.createElement("span");
    token.className = i === 0 ? "token lead" : "token";
    token.textContent = item.name;
    token.style.opacity = (0.68 + (0.32 * item.rel)).toFixed(2);
    ui.majorRegionWords.appendChild(token);
  }

  ui.majorRegionStatus.textContent = `Major regions: ${majorRegionsNow.map((x) => x.name).join(" | ")}`;
}

function speechSynthesisAvailable() {
  return typeof window !== "undefined"
    && typeof window.speechSynthesis !== "undefined"
    && typeof window.SpeechSynthesisUtterance !== "undefined";
}

function refreshNarrationStatus(extra = "") {
  if (!ui.narrationStatus) return;
  if (!state.narrationOn) {
    ui.narrationStatus.textContent = "Narration: off";
    return;
  }
  ui.narrationStatus.textContent = extra || `Narration: on (${state.narrationRate.toFixed(2)}x)`;
}

function updateStepControls() {
  const step = THREE.MathUtils.clamp(Number(state.scrubStepS) || DEFAULT_SCRUB_STEP_S, 0.1, 2.0);
  if (ui.scrubRateVal) ui.scrubRateVal.textContent = `${step.toFixed(2)}s/step`;
  if (ui.scrubRateRange) ui.scrubRateRange.value = step.toFixed(2);
  if (ui.btnStepBack) ui.btnStepBack.textContent = `-${step.toFixed(2)}s`;
  if (ui.btnStepForward) ui.btnStepForward.textContent = `+${step.toFixed(2)}s`;
}

function updateNarrationCursorFromTime() {
  const eps = 1e-5;
  let cursor = -1;
  for (let i = 0; i < arrivalEventsCache.length; i++) {
    if (arrivalEventsCache[i].t <= (state.t + eps)) cursor = i;
    else break;
  }
  lastNarratedArrivalCursor = cursor;
}

function fallbackRegionSummary(label) {
  const canonical = canonicalNodeLabel(label);
  const noHemi = canonical.replace(/_(L|R)$/, "");

  if (/^Postcentral/.test(noHemi)) {
    return "Primary somatosensory cortex that processes touch, body position, and sensory input from the opposite side of the body.";
  }
  if (/^Precentral/.test(noHemi)) {
    return "Primary motor cortex involved in planning and executing voluntary movement on the opposite side of the body.";
  }
  if (/^Fusiform/.test(noHemi)) {
    return "Ventral temporal cortex often involved in high-level visual processing such as object, face, and word-form recognition depending on task demands.";
  }
  if (/^Temporal_Sup|^Heschl/.test(noHemi)) {
    return "Auditory cortex network commonly involved in processing sound features, speech, and acoustic context.";
  }
  if (/^Cingulum|^Cingulate/.test(noHemi)) {
    return "Cingulate network region often involved in salience, monitoring, attention allocation, and context-dependent control.";
  }
  if (/^Insula/.test(noHemi)) {
    return "Insular cortex region often involved in interoceptive awareness, salience processing, and state integration.";
  }
  if (/^Precuneus|^Cuneus|^Calcarine|^Lingual|^Occipital/.test(noHemi)) {
    return "Posterior cortical region often involved in visual integration, spatial processing, and internal scene representation.";
  }
  if (/^Hippocampus|^ParaHippocampal|^Amygdala/.test(noHemi)) {
    return "Limbic-region node commonly involved in memory, emotional salience, and context encoding.";
  }

  return "This region participates in the current pathway; a more specific summary is still being curated for this label.";
}

function regionSummaryForLabel(label) {
  const card = lookupRegionCard(label);
  return safeText(card?.summary, fallbackRegionSummary(label));
}

function narrationTextForEvent(event) {
  if (!graph || !event) return "";
  const node = graph.nodes[event.idx];
  const label = node?.name || "";
  const card = lookupRegionCard(label);
  const title = safeText(card?.title, prettyAalLabel(label) || "region");
  const summary = regionSummaryForLabel(label);
  const firstSentence = safeText(summary.split(/(?<=[.!?])\s+/)[0], summary);
  return `Pathway step ${event.rank}. ${title} reached at ${event.t.toFixed(1)} seconds. ${firstSentence}`;
}

function speakNarration(text, force = false) {
  if (!text) return false;
  if (!speechSynthesisAvailable()) {
    if (ui.narrationStatus) ui.narrationStatus.textContent = "Narration: speech API unavailable";
    return false;
  }
  if (!force && !state.narrationOn) return false;

  const synth = window.speechSynthesis;
  if (!force && (synth.speaking || synth.pending)) return false;
  if (force) synth.cancel();

  const utter = new window.SpeechSynthesisUtterance(text);
  utter.rate = THREE.MathUtils.clamp(Number(state.narrationRate) || 1, 0.6, 1.8);
  utter.pitch = 1.0;
  utter.volume = 1.0;
  utter.onstart = () => refreshNarrationStatus(`Narration: speaking (${state.narrationRate.toFixed(2)}x)`);
  utter.onend = () => refreshNarrationStatus();
  utter.onerror = () => refreshNarrationStatus("Narration: speech error");
  synth.speak(utter);
  return true;
}

function stopNarration() {
  if (speechSynthesisAvailable()) {
    window.speechSynthesis.cancel();
  }
  refreshNarrationStatus("Narration: silenced");
}

function narrateNextArrival(force = false) {
  if (!arrivalEventsCache.length) {
    refreshNarrationStatus("Narration: no arrival events");
    return false;
  }
  const eps = 1e-5;
  const next = arrivalEventsCache.find((ev) => ev.t > (state.t + eps)) || null;
  if (!next) {
    refreshNarrationStatus("Narration: at final arrival");
    return false;
  }
  const spoke = speakNarration(narrationTextForEvent(next), force);
  if (spoke) {
    const idx = arrivalEventsCache.findIndex((ev) => ev.idx === next.idx && ev.t === next.t);
    if (idx >= 0) lastNarratedArrivalCursor = idx;
  }
  return spoke;
}

function narrateProgress(prevT, nextT) {
  if (!state.narrationOn || !arrivalEventsCache.length || !speechSynthesisAvailable()) return;
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) return;

  const eps = 1e-5;
  for (let i = Math.max(0, lastNarratedArrivalCursor + 1); i < arrivalEventsCache.length; i++) {
    const ev = arrivalEventsCache[i];
    if (ev.t <= (prevT + eps)) {
      lastNarratedArrivalCursor = i;
      continue;
    }
    if (ev.t <= (nextT + eps)) {
      const spoke = speakNarration(narrationTextForEvent(ev), false);
      if (spoke) lastNarratedArrivalCursor = i;
    }
    break;
  }
}

function jumpToArrival(direction) {
  if (!graph || !activeStimulus) return;
  const events = collectArrivalEvents();
  if (!events.length) {
    setStatus("no arrival events");
    return;
  }

  const eps = 1e-5;
  let target = null;

  if (direction > 0) {
    target = events.find((ev) => ev.t > (state.t + eps)) || null;
    if (!target) {
      setStatus("at final arrival");
      return;
    }
  } else {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].t < (state.t - eps)) {
        target = events[i];
        break;
      }
    }
    if (!target) {
      setStatus("at first arrival");
      return;
    }
  }

  setTimelinePosition(target.t, direction > 0 ? "jump_next" : "jump_prev");
  setSelection(target.idx);
}

function lookupRegionCard(label) {
  if (!regionCards || !regionCards.cards) return null;
  label = String(label || "").replace(/__\d+$/, "");
  if (regionCardLookup.has(label)) return regionCardLookup.get(label);

  const canonical = resolveAalAlias(label);
  if (regionCardLookup.has(canonical)) return regionCardLookup.get(canonical);

  const legacy = CARD_LABEL_ALIASES.get(label) || CARD_LABEL_ALIASES.get(canonical);
  if (legacy && regionCardLookup.has(legacy)) return regionCardLookup.get(legacy);
  return null;
}

function renderRegionRole(idx) {
  if (!ui.regionTitle || !ui.regionSummary || !ui.regionNetworks || !graph || idx === null || idx === undefined) {
    if (ui.regionTitle) ui.regionTitle.textContent = "Region role: none";
    if (ui.regionSummary) ui.regionSummary.textContent = "Select a node or press Play to follow network activation.";
    if (ui.regionNetworks) ui.regionNetworks.textContent = "Networks: n/a";
    return;
  }

  const node = graph.nodes[idx];
  const label = node?.name || "";
  const card = lookupRegionCard(label);
  const title = card?.title || prettyAalLabel(label);
  const summary = regionSummaryForLabel(label);
  const networks = Array.isArray(card?.networks) && card.networks.length ? card.networks.join(", ") : "n/a";

  ui.regionTitle.textContent = `Region role: ${title}`;
  ui.regionSummary.textContent = summary;
  ui.regionNetworks.textContent = `Networks: ${networks}`;
}

function renderRegionQuickCard(idx) {
  if (!ui.regionQuickCard || !ui.regionQuickTitle || !ui.regionQuickSummary) return;
  if (!graph || !Number.isInteger(idx)) {
    ui.regionQuickCard.classList.add("empty");
    ui.regionQuickTitle.textContent = "Hover or select a region";
    ui.regionQuickSummary.textContent = "Region quick card appears here with the region's commonly described functional role.";
    return;
  }

  const node = graph.nodes[idx];
  const label = node?.name || "";
  const card = lookupRegionCard(label);
  const title = safeText(card?.title, prettyAalLabel(label) || "Region");
  const summaryRaw = regionSummaryForLabel(label);
  const sentences = summaryRaw.split(/(?<=[.!?])\s+/).filter(Boolean);
  const summary = sentences.slice(0, 2).join(" ") || summaryRaw;

  ui.regionQuickCard.classList.remove("empty");
  ui.regionQuickTitle.textContent = title;
  ui.regionQuickSummary.textContent = summary;
}

function prettyPathRole(roleKey) {
  switch (roleKey) {
    case "seed_entry": return "Seed entry";
    case "core_hub": return "Core hub";
    case "core_relay": return "Core relay";
    case "extended_integration": return "Extended integration";
    case "late_output": return "Late modulation/output";
    default: return "Background";
  }
}

function narrationStageKey(entry) {
  if (!entry || !Number.isInteger(entry.idx)) return "";
  return `${entry.idx}@${(Math.max(0, Number(entry.t) || 0)).toFixed(4)}`;
}

function computeNarrationStageIndices(entry) {
  const idx = Number(entry?.idx);
  if (!Number.isInteger(idx)) return [];

  const indices = new Set([idx]);
  const parent = Number(pathParent[idx]);
  if (Number.isInteger(parent) && parent >= 0) indices.add(parent);

  for (const ev of arrivalEventsCache) {
    if (Math.abs((Number(ev.t) || 0) - (Number(entry.t) || 0)) <= NARRATION_STAGE_WINDOW_S) {
      if (Number.isInteger(ev.idx)) indices.add(ev.idx);
    }
  }

  for (const key of pathEdgeKeys) {
    const [aRaw, bRaw] = key.split("-");
    const a = Number(aRaw);
    const b = Number(bRaw);
    if (!Number.isInteger(a) || !Number.isInteger(b)) continue;
    if (a === idx) indices.add(b);
    else if (b === idx) indices.add(a);
  }

  return Array.from(indices);
}

function setNarrationStagePreview(indices) {
  const next = new Set((indices || []).filter((v) => Number.isInteger(v)));
  if (next.size === narrationPreviewIndices.size) {
    let same = true;
    for (const v of next) {
      if (!narrationPreviewIndices.has(v)) {
        same = false;
        break;
      }
    }
    if (same) return;
  }
  narrationPreviewIndices.clear();
  for (const idx of next) narrationPreviewIndices.add(idx);
  applyNodeStyle();
}

function clearNarrationStagePreview() {
  if (!narrationPreviewIndices.size) return;
  narrationPreviewIndices.clear();
  applyNodeStyle();
}

function activateNarrationStage(line) {
  if (!line || !Number.isInteger(line.idx)) return;
  setTimelinePosition(line.t, "narration_stage");
  setSelection(line.idx);
  setHoveredIndex(line.idx);
  setNarrationStagePreview(line.stageIndices || []);

  const title = prettyAalLabel(graph?.nodes?.[line.idx]?.name || "");
  setStatus(`narration stage: ${title || "region"} highlighted`);
}

function renderTextNarration() {
  if (!ui.liveNarrationLog) return;
  ui.liveNarrationLog.textContent = "";

  if (!textNarrationLines.length) {
    ui.liveNarrationLog.textContent = "Waiting for pathway events...";
    return;
  }

  const frag = document.createDocumentFragment();
  let activeStageKey = "";
  for (let i = textNarrationLines.length - 1; i >= 0; i--) {
    const line = textNarrationLines[i];
    if (!Number.isInteger(line.idx)) continue;
    if (line.t <= (state.t + 1e-5)) {
      activeStageKey = line.stageKey || narrationStageKey(line);
      break;
    }
  }
  if (!activeStageKey && textNarrationLines.length) {
    const fallback = textNarrationLines[0];
    activeStageKey = fallback.stageKey || narrationStageKey(fallback);
  }

  for (const line of textNarrationLines) {
    const row = document.createElement("div");
    row.className = "line";
    const stageKey = line.stageKey || narrationStageKey(line);
    const isStage = Number.isInteger(line.idx) && Array.isArray(line.stageIndices) && line.stageIndices.length > 0;
    if (isStage) {
      row.classList.add("stage");
      row.dataset.stageKey = stageKey;
      row.tabIndex = 0;

      row.addEventListener("mouseenter", () => setNarrationStagePreview(line.stageIndices));
      row.addEventListener("mouseleave", () => clearNarrationStagePreview());
      row.addEventListener("focus", () => setNarrationStagePreview(line.stageIndices));
      row.addEventListener("blur", () => clearNarrationStagePreview());
      row.addEventListener("click", () => activateNarrationStage(line));
      row.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          activateNarrationStage(line);
        }
      });

      const badge = document.createElement("span");
      badge.className = "stage-badge";
      badge.textContent = line.rank ? `Stage ${line.rank}` : "Stage";
      row.appendChild(badge);
    } else {
      row.classList.add("note");
      const badge = document.createElement("span");
      badge.className = "stage-badge note";
      badge.textContent = "Note";
      row.appendChild(badge);
    }

    const text = document.createElement("span");
    text.textContent = line.text;
    row.appendChild(text);

    if (activeStageKey && stageKey === activeStageKey) {
      row.classList.add("current");
    }

    frag.appendChild(row);
  }

  ui.liveNarrationLog.appendChild(frag);
  ui.liveNarrationLog.scrollTop = ui.liveNarrationLog.scrollHeight;
}

function pushTextNarrationLine(t, text, meta = null) {
  const line = {
    t: Math.max(0, Number(t) || 0),
    text: safeText(text, ""),
    idx: Number.isInteger(meta?.idx) ? meta.idx : null,
    rank: Number.isInteger(meta?.rank) ? meta.rank : null,
    stageKey: safeText(meta?.stageKey),
    stageIndices: Array.isArray(meta?.stageIndices)
      ? meta.stageIndices.filter((v) => Number.isInteger(v))
      : [],
  };

  textNarrationLines.push(line);
  while (textNarrationLines.length > TEXT_NARRATION_MAX_LINES) {
    textNarrationLines.shift();
  }
  renderTextNarration();
}

function resetTextNarration(contextText = "") {
  textNarrationLines.length = 0;
  textNarrationCursor = -1;
  clearNarrationStagePreview();
  if (activeStimulus) {
    pushTextNarrationLine(0, `Scenario loaded: ${stimulusDisplayLabel(activeStimulus)}.`);
  }
  if (contextText) {
    pushTextNarrationLine(state.t, contextText);
  }
  renderTextNarration();
}

function buildTextNarrationTimeline() {
  textNarrationTimeline = [];
  if (!graph || !activePathModel || !arrivalEventsCache.length) return;

  const seenCanonical = new Set();
  for (const ev of arrivalEventsCache) {
    const rawLabel = graph.nodes[ev.idx]?.name || "";
    const canonical = canonicalNodeLabel(rawLabel);
    if (!canonical || seenCanonical.has(canonical)) continue;
    seenCanonical.add(canonical);

    const card = lookupRegionCard(rawLabel);
    const title = safeText(card?.title, prettyAalLabel(rawLabel));
    const summary = regionSummaryForLabel(rawLabel);
    const firstSentence = safeText(summary.split(/(?<=[.!?])\s+/)[0], summary);
    const stage = { idx: ev.idx, t: ev.t };
    textNarrationTimeline.push({
      t: ev.t,
      idx: ev.idx,
      rank: ev.rank,
      stageKey: narrationStageKey(stage),
      stageIndices: computeNarrationStageIndices(stage),
      text: `${title}: ${firstSentence}`,
    });
  }
}

function syncTextNarrationToTime(tSec, options = {}) {
  const rebuild = Boolean(options.rebuild);
  const reason = safeText(options.reason, "");
  const eps = 1e-5;
  const t = Math.max(0, Number(tSec) || 0);
  let pushedAny = false;

  if (rebuild) {
    resetTextNarration(reason);
  }

  if (!textNarrationTimeline.length) {
    renderTextNarration();
    return;
  }

  while (
    textNarrationCursor + 1 < textNarrationTimeline.length
    && textNarrationTimeline[textNarrationCursor + 1].t <= (t + eps)
  ) {
    textNarrationCursor += 1;
    const entry = textNarrationTimeline[textNarrationCursor];
    pushTextNarrationLine(entry.t, entry.text, entry);
    pushedAny = true;
  }

  if (!pushedAny && rebuild) renderTextNarration();
}

function summarizeEdgeConfidence(edgeMeta, tier) {
  const vals = [];
  for (const meta of edgeMeta.values()) {
    if (meta.tier !== tier) continue;
    vals.push(clamp01(meta.confidence));
  }
  if (!vals.length) return `${tier} 0`;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return `${tier} ${vals.length} (mean ${mean.toFixed(2)})`;
}

function updatePathInspector() {
  if (!ui.inspectorPhase || !ui.inspectorLast || !ui.inspectorNext || !ui.inspectorRole || !ui.inspectorConfidence) {
    return;
  }
  if (!graph || !activeStimulus || !activePathModel) {
    ui.inspectorPhase.textContent = "Phase: n/a";
    ui.inspectorLast.textContent = "Last reached: n/a";
    ui.inspectorNext.textContent = "Next: n/a";
    ui.inspectorRole.textContent = "Role class: n/a";
    ui.inspectorConfidence.textContent = "Path confidence: n/a";
    return;
  }

  const phase = activePhaseState || phaseAtTime(activePathModel, state.t);
  ui.inspectorPhase.textContent = `Phase: ${phase.label} (${phase.start_s.toFixed(1)}-${phase.end_s.toFixed(1)}s, ${(phase.progress * 100).toFixed(0)}%)`;

  let last = null;
  for (const ev of arrivalEventsCache) {
    if (ev.t <= state.t + 1e-5) last = ev;
    else break;
  }
  if (last) {
    const label = graph.nodes[last.idx]?.name || "";
    const title = prettyAalLabel(label);
    const role = prettyPathRole(activePathModel.nodeRole[last.idx]);
    ui.inspectorLast.textContent = `Last reached: ${title} @ ${last.t.toFixed(2)}s`;
    ui.inspectorRole.textContent = `Role class: ${role}`;
  } else {
    ui.inspectorLast.textContent = "Last reached: pending";
    ui.inspectorRole.textContent = "Role class: seed staging";
  }

  const nextEvents = arrivalEventsCache.filter((ev) => ev.t > state.t + 1e-5).slice(0, 3);
  if (!nextEvents.length) {
    ui.inspectorNext.textContent = "Next: final phase reached";
  } else {
    const text = nextEvents
      .map((ev) => `${prettyAalLabel(graph.nodes[ev.idx]?.name || "")} @ ${ev.t.toFixed(2)}s`)
      .join(" | ");
    ui.inspectorNext.textContent = `Next: ${text}`;
  }

  ui.inspectorConfidence.textContent = `Path confidence: ${summarizeEdgeConfidence(pathEdgeMeta, "core")} | ${summarizeEdgeConfidence(pathEdgeMeta, "extended")}`;
}

function setRegionSearchStatus(text) {
  if (!ui.regionSearchStatus) return;
  ui.regionSearchStatus.textContent = text;
}

function resetRegionSearchStatus() {
  setRegionSearchStatus("Search: enter region");
}

function renderPathSequence(limit = PATH_SEQUENCE_LIMIT) {
  if (!ui.pathSequence) return;
  if (!graph || !activeStimulus) {
    ui.pathSequence.textContent = "waiting...";
    return;
  }

  const arrivals = [];
  for (let i = 0; i < nodeArrival.length; i++) {
    const t = nodeArrival[i];
    if (Number.isFinite(t)) arrivals.push({ idx: i, t });
  }
  arrivals.sort((a, b) => a.t - b.t);

  if (!arrivals.length) {
    ui.pathSequence.textContent = "No reachable nodes.";
    return;
  }

  const lines = [];
  const slice = arrivals.slice(0, limit);
  for (let i = 0; i < slice.length; i++) {
    const item = slice[i];
    const node = graph.nodes[item.idx];
    const label = node?.name || "";
    const card = lookupRegionCard(label);
    const title = card?.title || prettyAalLabel(label);
    const reachedMark = item.t <= state.t ? "*" : " ";
    const seedMark = pathParent[item.idx] === -1 ? " [seed]" : "";
    const tier = activePathModel?.nodeTier?.[item.idx] === TIER_CORE ? "C" : "E";
    lines.push(
      `${reachedMark} ${(i + 1).toString().padStart(2, "0")}  ${item.t.toFixed(2)}s  [${tier}] ${title}${seedMark}`
    );
  }

  const remainder = arrivals.length - slice.length;
  if (remainder > 0) lines.push(`... +${remainder} more`);
  ui.pathSequence.textContent = lines.join("\n");
}

function regionMatchScore(canonicalLabel, haystack, query) {
  if (!query) return 0;
  let score = 0;

  const labelQuery = query.replace(/\s+/g, "_");
  if (canonicalLabel.toLowerCase() === labelQuery) score += 120;
  if (canonicalLabel.toLowerCase().startsWith(labelQuery)) score += 90;
  if (haystack.startsWith(query)) score += 75;

  const firstIdx = haystack.indexOf(query);
  if (firstIdx >= 0) score += Math.max(0, 60 - firstIdx);

  const tokens = query.split(" ").filter(Boolean);
  for (const tok of tokens) {
    if (tok.length < 2) continue;
    if (canonicalLabel.toLowerCase().includes(tok)) score += 20;
  }
  return score;
}

function regionMatchHaystack(canonicalLabel) {
  const card = lookupRegionCard(canonicalLabel);
  const cardTitle = safeText(card?.title, "");
  const aliases = Array.isArray(card?.aliases) ? card.aliases.join(" ") : "";
  const raw = canonicalLabel.replace(/_/g, " ");
  const pretty = prettyAalLabel(canonicalLabel);
  return normalizeSearchText(`${raw} ${pretty} ${cardTitle} ${aliases}`);
}

function conceptAliasScore(alias, query, tokens) {
  if (!alias || !query) return 0;
  if (alias === query) return 180;
  if (alias.startsWith(query)) return 130;
  if (query.startsWith(alias)) return 110;
  if (tokens.length && tokens.every((tok) => alias.includes(tok))) return 92;
  if (alias.includes(query)) return 76;
  return 0;
}

function conceptIndicesForSearch(concept) {
  const indices = new Set();
  for (const [canonicalLabel, list] of labelToIndices.entries()) {
    if (typeof concept.matchLabel === "function" && !concept.matchLabel(canonicalLabel)) continue;
    for (const idx of list || []) {
      if (Number.isInteger(idx)) indices.add(idx);
    }
  }
  return Array.from(indices);
}

function computeConceptSearchMatches(query, tokens) {
  if (!query) return [];
  const matches = [];

  for (const concept of SEARCH_CONCEPTS) {
    const aliases = (concept.aliases || []).map((a) => normalizeSearchText(a)).filter(Boolean);
    let bestScore = 0;
    let matchedAlias = "";
    for (const alias of aliases) {
      const score = conceptAliasScore(alias, query, tokens);
      if (score > bestScore) {
        bestScore = score;
        matchedAlias = alias;
      }
    }
    if (bestScore <= 0) continue;

    const indices = concept.kind === "proxy" ? conceptIndicesForSearch(concept) : [];
    if (!indices.length) continue;
    matches.push({
      canonical: concept.id,
      display_label: concept.display_label,
      indices,
      score: bestScore + (indices.length ? Math.min(indices.length * 0.01, 1.5) : 0),
      concept_kind: concept.kind,
      concept_note: concept.note,
      query_value: matchedAlias || concept.display_label,
    });
  }

  return matches;
}

function computeRegionSearchMatches(rawQuery) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [];

  const tokens = query.split(" ").filter(Boolean);
  if (!tokens.length) return [];

  const matches = [];
  for (const [canonicalLabel, indices] of labelToIndices.entries()) {
    const haystack = regionMatchHaystack(canonicalLabel);
    const allTokensPresent = tokens.every((tok) => haystack.includes(tok));
    if (!allTokensPresent) continue;

    matches.push({
      canonical: canonicalLabel,
      display_label: prettyAalLabel(canonicalLabel),
      indices,
      score: regionMatchScore(canonicalLabel, haystack, query),
      concept_kind: "atlas",
      concept_note: "",
      query_value: canonicalLabel,
    });
  }

  matches.push(...computeConceptSearchMatches(query, tokens));

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const labelA = safeText(a.display_label, a.canonical);
    const labelB = safeText(b.display_label, b.canonical);
    return labelA.localeCompare(labelB);
  });
  return matches;
}

function hideRegionSearchSuggest() {
  regionSuggestEntries = [];
  regionSuggestCursor = -1;
  if (!ui.regionSearchSuggest) return;
  ui.regionSearchSuggest.hidden = true;
  ui.regionSearchSuggest.innerHTML = "";
}

function renderRegionSearchSuggest(entries, cursor = 0) {
  if (!ui.regionSearchSuggest) return;
  regionSuggestEntries = entries.slice(0, 8);
  if (!regionSuggestEntries.length) {
    hideRegionSearchSuggest();
    return;
  }

  regionSuggestCursor = THREE.MathUtils.clamp(cursor, 0, regionSuggestEntries.length - 1);
  ui.regionSearchSuggest.innerHTML = "";

  for (let i = 0; i < regionSuggestEntries.length; i++) {
    const match = regionSuggestEntries[i];
    const label = safeText(match.display_label, prettyAalLabel(match.canonical));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `item${i === regionSuggestCursor ? " active" : ""}`;
    btn.dataset.idx = String(i);
    btn.textContent = `${label} (${match.indices.length})`;
    ui.regionSearchSuggest.appendChild(btn);
  }

  ui.regionSearchSuggest.hidden = false;
}

function updateRegionAutocomplete(rawQuery) {
  const query = normalizeSearchText(rawQuery);
  if (!query || query.length < 2) {
    hideRegionSearchSuggest();
    return;
  }

  const matches = computeRegionSearchMatches(query);
  if (!matches.length) {
    hideRegionSearchSuggest();
    return;
  }

  renderRegionSearchSuggest(matches, 0);
}

function acceptRegionSuggestion(index) {
  const entry = regionSuggestEntries[index];
  if (!entry) return false;

  if (ui.regionSearchInput) {
    ui.regionSearchInput.value = safeText(entry.display_label, prettyAalLabel(entry.canonical));
  }

  const ok = rebuildRegionSearch(entry.canonical);
  hideRegionSearchSuggest();
  return ok;
}

function clearSearchExplore() {
  state.searchExploreOn = false;
  searchExploreLabel = "";
  searchExploreIndices.clear();
}

function setSearchExplore(match) {
  if (!match || !Array.isArray(match.indices) || !match.indices.length) {
    clearSearchExplore();
    return;
  }

  state.searchExploreOn = true;
  searchExploreLabel = match.canonical;
  searchExploreIndices.clear();
  for (const idx of match.indices) {
    if (Number.isInteger(idx)) searchExploreIndices.add(idx);
  }
}

function searchExploreColor(idx) {
  const paletteIndex = Math.abs(Number(idx) || 0) % SEARCH_HIGHLIGHT_PALETTE.length;
  return new THREE.Color(SEARCH_HIGHLIGHT_PALETTE[paletteIndex]);
}

function updateHoverGroup() {
  hoverGroupIndices.clear();
  hoverGroupLabel = "";

  if (!graph || !state.hoverGroupOn || hoveredIdx === null) return;
  const node = graph.nodes[hoveredIdx];
  const canonical = canonicalNodeLabel(node?.name || "");
  if (!canonical) return;

  const matches = labelToIndices.get(canonical) || [];
  hoverGroupLabel = canonical;
  for (const idx of matches) hoverGroupIndices.add(idx);
}

function setHoveredIndex(nextIdx) {
  const normalized = Number.isInteger(nextIdx) ? nextIdx : null;
  if (hoveredIdx === normalized) return;
  hoveredIdx = normalized;
  updateHoverGroup();
  if (state.hoverGroupOn) applyNodeStyle();
  renderHud();
}

function applyRegionSearchMatch(index, reason = "search") {
  if (!regionSearchMatches.length) return false;
  const count = regionSearchMatches.length;
  const normalized = ((index % count) + count) % count;
  regionSearchCursor = normalized;
  const match = regionSearchMatches[regionSearchCursor];
  const idx = match?.indices?.[0];

  if (Number.isInteger(idx)) {
    setSelection(idx);
    setHoveredIndex(idx);
  } else {
    renderHud();
  }

  setSearchExplore(match);
  focusCameraOnIndices(match.indices);
  if (state.running && !state.paused) {
    state.paused = true;
  }
  applyActivationAtTime(state.t);

  const regionName = safeText(match.display_label, prettyAalLabel(match.canonical));
  const proxySuffix = match.concept_note ? " [proxy]" : "";
  setRegionSearchStatus(`Search: ${regionSearchCursor + 1}/${count} ${regionName} (${match.indices.length} nodes)${proxySuffix}`);
  if (match.concept_note) {
    setStatus(`search ${reason}: ${regionName} (proxy)`);
  } else {
    setStatus(`search ${reason}: ${regionName} (explore view)`);
  }
  hideRegionSearchSuggest();
  return true;
}

function rebuildRegionSearch(rawQuery) {
  const query = normalizeSearchText(rawQuery);
  regionSearchQuery = query;
  regionSearchMatches = computeRegionSearchMatches(query);
  regionSearchCursor = -1;
  hideRegionSearchSuggest();

  if (!query) {
    clearSearchExplore();
    applyActivationAtTime(state.t);
    resetRegionSearchStatus();
    return false;
  }

  if (!regionSearchMatches.length) {
    clearSearchExplore();
    applyActivationAtTime(state.t);
    setRegionSearchStatus(`Search: no matches for "${query}"`);
    setStatus(`search: no matches`);
    return false;
  }

  return applyRegionSearchMatch(0, "find");
}

function cycleRegionSearch(delta) {
  if (!ui.regionSearchInput) return;
  const query = normalizeSearchText(ui.regionSearchInput.value);
  const needsRefresh = query !== regionSearchQuery || !regionSearchMatches.length;
  if (needsRefresh) {
    const ok = rebuildRegionSearch(ui.regionSearchInput.value);
    if (!ok) return;
    return;
  }

  const count = regionSearchMatches.length;
  if (!count) return;
  applyRegionSearchMatch(regionSearchCursor + delta, delta > 0 ? "next" : "prev");
}

function setExportStatus(text) {
  if (!ui.exportStatus) return;
  ui.exportStatus.textContent = `Export: ${text}`;
}

function csvCell(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

function slugify(value, fallback = "stimulus") {
  const base = safeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || fallback;
}

function collectArrivalRecords() {
  if (!graph || !activeStimulus || !activePathModel) return [];

  const arrivals = [];
  for (let i = 0; i < nodeArrival.length; i++) {
    const t = nodeArrival[i];
    if (!Number.isFinite(t)) continue;
    const node = graph.nodes[i];
    const label = node?.name || "";
    const card = lookupRegionCard(label);
    const title = card?.title || prettyAalLabel(label);
    const networks = Array.isArray(card?.networks) ? card.networks.slice() : [];
    const parentIdx = pathParent[i];
    const parentLabel = parentIdx >= 0 ? (graph.nodes[parentIdx]?.name || "") : "";
    const parentCard = parentIdx >= 0 ? lookupRegionCard(parentLabel) : null;
    const parentTitle = parentCard?.title || (parentLabel ? prettyAalLabel(parentLabel) : "");
    let pathTier = "none";
    if (activePathModel.nodeTier[i] === TIER_CORE) pathTier = "core";
    else if (activePathModel.nodeTier[i] === TIER_EXTENDED) pathTier = "extended";

    let pathConfidence = 0;
    if (parentIdx >= 0) {
      const parentEdge = pathEdgeMeta.get(edgeKey(i, parentIdx));
      if (parentEdge) pathConfidence = Math.max(pathConfidence, clamp01(parentEdge.confidence));
    }
    for (const nb of adjacency[i] || []) {
      const meta = pathEdgeMeta.get(edgeKey(i, nb.to));
      if (meta) pathConfidence = Math.max(pathConfidence, clamp01(meta.confidence));
    }

    arrivals.push({
      idx: i,
      arrival_s: t,
      is_seed: parentIdx === -1,
      aal_label: label,
      title,
      networks,
      parent_idx: parentIdx,
      parent_aal_label: parentLabel,
      parent_title: parentTitle,
      path_tier: pathTier,
      path_role: prettyPathRole(activePathModel.nodeRole[i]),
      path_confidence: pathConfidence,
    });
  }

  arrivals.sort((a, b) => a.arrival_s - b.arrival_s);
  for (let i = 0; i < arrivals.length; i++) {
    arrivals[i].rank = i + 1;
    arrivals[i].reached_at_export_t = arrivals[i].arrival_s <= state.t;
  }
  return arrivals;
}

function currentExportContext() {
  const mode = resolveLibraryMode(state.libraryMode) || "template";
  const sourceName = safeText(stimulusLibrary?.source_name, "unknown");
  return {
    basis: mode,
    basis_label: libraryModeLabel(mode),
    source_name: sourceName,
  };
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function exportPathReportJson() {
  const records = collectArrivalRecords();
  if (!records.length) {
    setExportStatus("no path data");
    return;
  }

  const ctx = currentExportContext();
  const payload = {
    schema_version: 1,
    build_id: STIMFLOW_BUILD_ID,
    generated_at_utc: new Date().toISOString(),
    route: "/model/stimflow/",
    basis: ctx.basis,
    basis_label: ctx.basis_label,
    stimulus_library_source: ctx.source_name,
    stimulus: {
      id: activeStimulus.id,
      label: activeStimulus.label,
      tier: activeStimulus.tier,
      confidence: activeStimulus.confidence,
      evidence_type: activeStimulus.evidence_type,
      datasets: activeStimulus.datasets || [],
      citations: activeStimulus.citations || [],
    },
    settings: {
      mode: state.mode,
      compare_mode: state.compareMode,
      compare_stimulus_id: compareStimulus?.id || null,
      speed: state.speed,
      gain: state.gain,
      edge_threshold: state.edgeThreshold,
      edges_on: state.edgesOn,
      path_only: state.pathOnly,
      reached_only: state.reachedOnly,
      radiation_on: state.radiationOn,
      hull_on: state.hullOn,
      auto_rotate: state.autoRotate,
      connectivity_source: connectivitySourceName || "graph-only",
      connectivity_adjusted_links: activeConnectivityEdgeCount,
      timeline_t_s: state.t,
      timeline_duration_s: state.durationS,
      timeline_real_t_s: modelTimeToRealSeconds(state.t, state.durationS),
      timeline_real_duration_s: activeRealCourseSeconds(),
      timing_profile: activeStimulus?.timing_profile || null,
      engagement: activeStimulus.engagement || DEFAULT_ENGAGEMENT,
      path_breadth_quantile: state.pathBreadthQ,
      phase_model: activePathModel?.phases || [],
    },
    graph: {
      nodes_total: graph.nodes.length,
      edges_total: graph.edges.length,
      edges_visible: edgesShown,
      atlas_mode: safeText(graph.atlas?.mode, "aal_core"),
      nodes_reachable: reachableNodeCount > 0 ? reachableNodeCount : records.length,
      path_links: pathEdgeKeys.size,
    },
    arrivals: records,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `stimflow_path_${slugify(activeStimulus.id)}_${ctx.basis}_${stamp}.json`;
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  downloadBlob(name, blob);

  setExportStatus(`JSON downloaded (${records.length} nodes)`);
  emit("stimflow:export", {
    format: "json",
    rows: records.length,
    basis: ctx.basis,
    stimulus_id: activeStimulus.id,
    build_id: STIMFLOW_BUILD_ID,
  });
}

function exportPathReportCsv() {
  const records = collectArrivalRecords();
  if (!records.length) {
    setExportStatus("no path data");
    return;
  }

  const ctx = currentExportContext();
  const headers = [
    "rank",
    "arrival_s",
    "reached_at_export_t",
    "is_seed",
    "aal_label",
    "title",
    "parent_aal_label",
    "parent_title",
    "path_tier",
    "path_role",
    "path_confidence",
    "networks",
    "stimulus_id",
    "stimulus_label",
    "stimulus_tier",
    "basis",
    "source_name",
    "timeline_t_s",
    "timeline_duration_s",
    "timeline_real_t_s",
    "timeline_real_duration_s",
    "speed",
    "gain",
    "edge_threshold",
    "engagement_arrival_quantile",
    "engagement_edge_weight_min",
    "engagement_coactivation_lag_s",
    "connectivity_source",
    "connectivity_adjusted_links",
    "path_only",
    "reached_only",
    "radiation_on",
    "edges_on",
  ];

  const rows = records.map((r) => [
    r.rank,
    r.arrival_s.toFixed(4),
    r.reached_at_export_t ? 1 : 0,
    r.is_seed ? 1 : 0,
    r.aal_label,
    r.title,
    r.parent_aal_label,
    r.parent_title,
    r.path_tier,
    r.path_role,
    r.path_confidence.toFixed(4),
    r.networks.join("|"),
    activeStimulus.id,
    activeStimulus.label,
    activeStimulus.tier,
    ctx.basis,
    ctx.source_name,
    state.t.toFixed(4),
    state.durationS.toFixed(4),
    modelTimeToRealSeconds(state.t, state.durationS).toFixed(4),
    Number(activeRealCourseSeconds() || 0).toFixed(4),
    state.speed.toFixed(4),
    state.gain.toFixed(4),
    state.edgeThreshold.toFixed(4),
    Number(activeStimulus?.engagement?.arrival_quantile ?? DEFAULT_ENGAGEMENT.arrival_quantile).toFixed(4),
    Number(activeStimulus?.engagement?.edge_weight_min ?? DEFAULT_ENGAGEMENT.edge_weight_min).toFixed(4),
    Number(activeStimulus?.engagement?.coactivation_lag_s ?? DEFAULT_ENGAGEMENT.coactivation_lag_s).toFixed(4),
    connectivitySourceName || "graph-only",
    activeConnectivityEdgeCount,
    state.pathOnly ? 1 : 0,
    state.reachedOnly ? 1 : 0,
    state.radiationOn ? 1 : 0,
    state.edgesOn ? 1 : 0,
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `stimflow_path_${slugify(activeStimulus.id)}_${ctx.basis}_${stamp}.csv`;
  const blob = new Blob([`${csv}\n`], { type: "text/csv;charset=utf-8" });
  downloadBlob(name, blob);

  setExportStatus(`CSV downloaded (${records.length} nodes)`);
  emit("stimflow:export", {
    format: "csv",
    rows: records.length,
    basis: ctx.basis,
    stimulus_id: activeStimulus.id,
    build_id: STIMFLOW_BUILD_ID,
  });
}

function updatePathReadout() {
  if (!graph) return;
  const { latest } = countReachedNodes(state.t);
  latestReachedIdx = latest;
  const focusIdx = selectedIdx !== null ? selectedIdx : latest;
  renderRegionRole(focusIdx);
  renderPathSequence();
  updatePathInspector();
}

function renderHud() {
  if (!graph) {
    hud(`${MILESTONE_LABEL}\nLoading viewer...`);
    return;
  }

  const lines = [];
  lines.push(`${MILESTONE_LABEL} • BUILD ${STIMFLOW_BUILD_ID}`);
  lines.push(`Stimulus: ${activeStimulus ? stimulusDisplayLabel(activeStimulus) : "none"}`);
  const reachedInfo = countReachedNodes(state.t);
  const reachedTotal = reachableNodeCount > 0 ? reachableNodeCount : graph.nodes.length;
  const playbackState = state.running ? (state.paused ? "Paused" : "Playing") : "Stopped";
  lines.push(`Time: ${state.t.toFixed(2)}s / ${state.durationS.toFixed(2)}s • ${playbackState}`);
  const realTotalS = activeRealCourseSeconds();
  if (Number.isFinite(realTotalS)) {
    const realNowS = modelTimeToRealSeconds(state.t, state.durationS);
    lines.push(`Approx real-time: ${formatDurationCompact(realNowS)} / ${formatDurationCompact(realTotalS)} (educational approximation)`);
  }
  if (activePhaseState) {
    lines.push(`Phase: ${activePhaseState.label}`);
  }
  lines.push(`Reached: ${reachedInfo.reached}/${reachedTotal} nodes`);
  lines.push(`Major regions: ${majorRegionsNow.length ? majorRegionsNow.map((x) => x.name).join(", ") : "none"}`);
  if (state.searchExploreOn && searchExploreIndices.size > 0) {
    lines.push(`Explore: ${prettyAalLabel(searchExploreLabel)} (${searchExploreIndices.size} nodes)`);
  }

  if (selectedIdx !== null) {
    lines.push(`Selected: ${prettyAalLabel(graph.nodes[selectedIdx].name)}`);
  } else {
    lines.push("Selected: none");
  }

  if (hoveredIdx !== null) {
    lines.push(`Hover: ${prettyAalLabel(graph.nodes[hoveredIdx].name)}`);
  } else {
    lines.push("Hover: none");
  }

  const quickCardIdx = hoveredIdx !== null ? hoveredIdx : selectedIdx;
  renderRegionQuickCard(quickCardIdx);

  hud(lines.join("\n"));
  updatePathReadout();
}

function setStatus(text) {
  if (ui.statusText) ui.statusText.textContent = text;
}

function setTimelinePosition(nextT, reason = "scrub") {
  const t = THREE.MathUtils.clamp(Number(nextT) || 0, 0, state.durationS);
  state.t = t;
  state.paused = true;
  state.lastMs = performance.now();

  const reachedInfo = countReachedNodes(state.t);
  const latestLabel = reachedInfo.latest !== null
    ? prettyAalLabel(graph?.nodes?.[reachedInfo.latest]?.name || "")
    : "n/a";

  const stepLabel = state.scrubStepS.toFixed(2);
  if (reason === "step_back") {
    setStatus(`paused (step -${stepLabel}s)`);
  } else if (reason === "step_forward") {
    setStatus(`paused (step +${stepLabel}s)`);
  } else if (reason === "jump_next") {
    setStatus(`paused (next arrival: ${latestLabel})`);
  } else if (reason === "jump_prev") {
    setStatus(`paused (prev arrival: ${latestLabel})`);
  } else if (reason === "narration_stage") {
    setStatus(`paused (narration stage: ${latestLabel})`);
  } else if (state.running) {
    setStatus("paused (scrub)");
  }

  applyActivationAtTime(state.t);
  updateNarrationCursorFromTime();
  syncTextNarrationToTime(state.t, { rebuild: true });
  renderHud();
  emit("stimflow:frame", {
    stimulus_id: activeStimulus?.id || null,
    t: state.t,
    speed: state.speed,
    gain: state.gain,
    build_id: STIMFLOW_BUILD_ID,
  });
}

function renderTimeline() {
  const p = clamp01(state.t / state.durationS);
  const pct = Math.round(p * 100);
  const phaseLabel = activePhaseState?.label ? `${activePhaseState.label.toLowerCase()} phase` : "current phase";
  const realTotalS = activeRealCourseSeconds();
  if (Number.isFinite(realTotalS)) {
    const realNowS = modelTimeToRealSeconds(state.t, state.durationS);
    ui.timelineText.textContent =
      `Scenario progress: ${pct}% (${phaseLabel}); this point represents about ${formatDurationCompact(realNowS)} of an estimated ${formatDurationCompact(realTotalS)} course.`;
  } else {
    ui.timelineText.textContent =
      `Scenario progress: ${pct}% (${phaseLabel}); this slider shows educational progression through the pathway sequence.`;
  }
  ui.progressFill.style.width = `${(p * 100).toFixed(1)}%`;
  if (ui.scrubRange) {
    ui.scrubRange.max = state.durationS.toFixed(2);
    ui.scrubRange.value = Math.min(state.t, state.durationS).toFixed(2);
  }
  if (ui.scrubVal) {
    ui.scrubVal.textContent = `${pct}%`;
  }
}

function computeSelectedNeighbors() {
  selectedNeighbors = new Set();
  selectedRegionIndices = new Set();
  if (selectedIdx === null) return;
  const selectedLabel = canonicalNodeLabel(graph?.nodes?.[selectedIdx]?.name || "");
  const sameRegion = labelToIndices.get(selectedLabel) || [];
  for (const idx of sameRegion) selectedRegionIndices.add(idx);
  for (const e of edgesFiltered) {
    if (e.source === selectedIdx) selectedNeighbors.add(e.target);
    else if (e.target === selectedIdx) selectedNeighbors.add(e.source);
  }
}

function applyNodeStyle() {
  if (!nodeMesh || !graph) return;

  computeSelectedNeighbors();
  const searchMode = state.searchExploreOn && searchExploreIndices.size > 0;
  const compareOn = state.compareMode !== "off" && comparePathModel && compareStimulus;
  const hrf = stimulusLibrary?.hrf || DEFAULT_HRF;
  const phaseWindowS = Math.max(0.5, (Number(hrf.peak_s) || 6) + (Number(hrf.fall_s) || 12));

  const neighColor = new THREE.Color(0xffc6b8);
  const hoverColor = new THREE.Color(0xd5e8ff);
  const narrationPreviewColor = new THREE.Color(0xfff3ba);
  const haloDormant = new THREE.Color(0x7d90a6);
  const searchDimColor = new THREE.Color(0x16202e);
  const haloColor = new THREE.Color();
  const selectOverlayCoreColor = new THREE.Color(0xff7f90);
  const selectOverlayRegionColor = new THREE.Color(0xffa167);
  const selectOverlayColor = new THREE.Color();
  const selectOverlayDormantColor = new THREE.Color(0x000000);

  const updateSelectionOverlay = (nodeIndex, baseNode, isPrimarySelection, isRegionSelection) => {
    if (!nodeSelectionMesh) return;
    if (isRegionSelection) {
      const overlayScale = baseNode.baseScale * (
        isPrimarySelection
          ? (SELECTED_REGION_SCALE_MULTIPLIER * 1.22)
          : (SELECTED_REGION_SCALE_MULTIPLIER * 1.04)
      );
      dummy.position.copy(baseNode.pos);
      dummy.scale.setScalar(overlayScale);
      dummy.updateMatrix();
      nodeSelectionMesh.setMatrixAt(nodeIndex, dummy.matrix);
      selectOverlayColor.copy(isPrimarySelection ? selectOverlayCoreColor : selectOverlayRegionColor);
      nodeSelectionMesh.setColorAt(nodeIndex, selectOverlayColor);
      return;
    }

    dummy.position.copy(baseNode.pos);
    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    nodeSelectionMesh.setMatrixAt(nodeIndex, dummy.matrix);
    nodeSelectionMesh.setColorAt(nodeIndex, selectOverlayDormantColor);
  };

  for (let i = 0; i < graph.nodes.length; i++) {
    const base = nodeBase[i];
    let scale = base.baseScale;
    let color = base.baseColor.clone();

    if (searchMode) {
      const isMatch = searchExploreIndices.has(i);
      if (isMatch) {
        color.copy(searchExploreColor(i));
        scale *= selectedIdx === i ? 2.08 : 1.46;
        if (selectedRegionIndices.has(i)) {
          scale = Math.max(scale, base.baseScale * SELECTED_REGION_SCALE_MULTIPLIER);
        }
      } else {
        color.copy(searchDimColor);
        scale *= 0.42;
      }

      dummy.position.copy(base.pos);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      nodeMesh.setMatrixAt(i, dummy.matrix);
      nodeMesh.setColorAt(i, color);

      if (nodeHaloMesh) {
        let haloIntensity = isMatch ? 0.22 : 0;
        const haloScale = haloIntensity > 0.005
          ? base.baseScale * (3.00 + (5.20 * haloIntensity))
          : 0.0001;
        dummy.position.copy(base.pos);
        dummy.scale.setScalar(haloScale);
        dummy.updateMatrix();
        nodeHaloMesh.setMatrixAt(i, dummy.matrix);

        if (haloIntensity > 0.005) {
          haloColor.copy(searchExploreColor(i)).multiplyScalar(0.58 + (1.45 * haloIntensity));
        } else {
          haloColor.copy(haloDormant).multiplyScalar(0.01);
        }
        nodeHaloMesh.setColorAt(i, haloColor);
      }
      updateSelectionOverlay(i, base, selectedIdx === i, selectedRegionIndices.has(i));
      continue;
    }

    const a = nodeActivation[i] || 0;
    const b = compareOn ? (compareNodeActivation[i] || 0) : 0;
    const primaryRelevant = nodeRelevant[i];
    const secondaryRelevant = compareOn ? Boolean(comparePathModel.nodeRelevant[i]) : false;
    const relevantAny = primaryRelevant || secondaryRelevant;
    const primaryPhaseColor = temporalSpectrumColor(nodeArrival[i], state.t, phaseWindowS).color;
    const secondaryPhaseColor = compareOn
      ? temporalSpectrumColor(comparePathModel.nodeArrival[i], state.t, phaseWindowS).color
      : primaryPhaseColor;

    if (!compareOn) {
      if (a > 0) {
        const hot = activationColor(a);
        hot.lerp(primaryPhaseColor, 0.78);
        color.lerp(hot, 0.58 + (0.78 * a));
        scale *= 1 + (0.62 * a);
      }

      if (activeStimulus && !primaryRelevant) {
        color.multiplyScalar(0.42);
        scale *= 0.88;
      }
    } else if (state.compareMode === "overlay") {
      const onlyA = Math.max(0, a - b);
      const onlyB = Math.max(0, b - a);
      const shared = Math.min(a, b);
      const aColor = primaryPhaseColor.clone().lerp(new THREE.Color(0xff7648), 0.38);
      const bColor = secondaryPhaseColor.clone().lerp(new THREE.Color(0x45c8ff), 0.46);
      const sharedColor = new THREE.Color(0xf1ffbc);

      if (shared > 0) color.lerp(sharedColor, clamp01(0.24 + (0.72 * shared)));
      if (onlyA > 0) color.lerp(aColor, clamp01(0.18 + (0.82 * onlyA)));
      if (onlyB > 0) color.lerp(bColor, clamp01(0.18 + (0.82 * onlyB)));
      scale *= 1 + (0.66 * Math.max(a, b));

      if (!relevantAny) {
        color.multiplyScalar(0.26);
        scale *= 0.78;
      }
    } else {
      const delta = a - b;
      const absDelta = Math.abs(delta);
      if (absDelta > 0.01) {
        const plusColor = primaryPhaseColor.clone().lerp(new THREE.Color(0xff5656), 0.55);
        const minusColor = secondaryPhaseColor.clone().lerp(new THREE.Color(0x57adff), 0.62);
        color.lerp(delta >= 0 ? plusColor : minusColor, clamp01(0.22 + (0.85 * absDelta)));
      } else {
        color.lerp(new THREE.Color(0x9dc4d8), 0.22);
      }
      scale *= 1 + (0.54 * absDelta);

      if (!relevantAny) {
        color.multiplyScalar(0.20);
        scale *= 0.72;
      }
    }

    if (activeStimulus && state.reachedOnly) {
      const reachedA = Number.isFinite(nodeArrival[i]) && nodeArrival[i] <= state.t;
      const reachedB = compareOn && Number.isFinite(comparePathModel.nodeArrival[i]) && comparePathModel.nodeArrival[i] <= state.t;
      const reached = compareOn ? (reachedA || reachedB) : reachedA;
      if (!reached) {
        color.multiplyScalar(relevantAny ? 0.18 : 0.10);
        scale *= relevantAny ? 0.62 : 0.50;
      } else {
        color.lerp(new THREE.Color(0xf7fbff), compareOn ? 0.14 : 0.08);
      }
    }

    if (selectedIdx !== null) {
      if (selectedRegionIndices.has(i)) {
        if (i === selectedIdx) {
          scale = Math.max(scale, base.baseScale * (SELECTED_REGION_SCALE_MULTIPLIER * 1.18));
        } else {
          scale = Math.max(scale, base.baseScale * SELECTED_REGION_SCALE_MULTIPLIER);
        }
      } else if (selectedNeighbors.has(i)) {
        scale *= 1.16;
        color.lerp(neighColor, 0.52);
      } else {
        color.multiplyScalar(0.33);
      }
    }

    if (state.hoverGroupOn && hoverGroupIndices.size > 0) {
      if (hoverGroupIndices.has(i)) {
        const isHovered = hoveredIdx === i;
        scale *= isHovered ? 1.26 : 1.10;
        color.lerp(hoverColor, isHovered ? 0.62 : 0.30);
      } else if (selectedIdx === null) {
        color.multiplyScalar(0.46);
      }
    }

    if (narrationPreviewIndices.size > 0) {
      if (narrationPreviewIndices.has(i)) {
        scale *= selectedIdx === i ? 1.08 : 1.20;
        color.lerp(narrationPreviewColor, selectedIdx === i ? 0.44 : 0.68);
      } else if (selectedIdx === null && !state.hoverGroupOn) {
        color.multiplyScalar(0.62);
      }
    }

    dummy.position.copy(base.pos);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(i, dummy.matrix);
    nodeMesh.setColorAt(i, color);

    if (nodeHaloMesh) {
      let haloIntensity = 0;
      let haloPhaseColor = primaryPhaseColor;
      if (state.radiationOn && activeStimulus && relevantAny) {
        const waveA = arrivalWavePulse(nodeArrival[i], state.t);
        const dtA = Number.isFinite(nodeArrival[i]) ? (nodeArrival[i] - state.t) : Infinity;
        const preA = dtA >= 0 && dtA < 0.45 ? (0.12 * (1 - (dtA / 0.45))) : 0;
        let wave = waveA;
        let preArrival = preA;

        if (compareOn) {
          const arrB = comparePathModel.nodeArrival[i];
          const waveB = arrivalWavePulse(arrB, state.t);
          const dtB = Number.isFinite(arrB) ? (arrB - state.t) : Infinity;
          const preB = dtB >= 0 && dtB < 0.45 ? (0.12 * (1 - (dtB / 0.45))) : 0;
          wave = Math.max(waveA, waveB);
          preArrival = Math.max(preA, preB);
          haloPhaseColor = primaryPhaseColor.clone().lerp(secondaryPhaseColor, 0.5);
        }

        const sustain = compareOn ? (0.54 * Math.max(a, b)) : (0.52 * a);
        haloIntensity = clamp01(Math.max(1.25 * wave, sustain, preArrival));

        if (state.reachedOnly) {
          const reachedA = Number.isFinite(nodeArrival[i]) && nodeArrival[i] <= state.t;
          const reachedB = compareOn && Number.isFinite(comparePathModel.nodeArrival[i]) && comparePathModel.nodeArrival[i] <= state.t;
          const reached = compareOn ? (reachedA || reachedB) : reachedA;
          if (!reached) haloIntensity *= 0.22;
        }
      }

      if (narrationPreviewIndices.has(i)) {
        haloIntensity = Math.max(haloIntensity, 0.30);
      }

      const haloScale = haloIntensity > 0.005
        ? base.baseScale * (2.40 + (5.30 * haloIntensity))
        : 0.0001;
      dummy.position.copy(base.pos);
      dummy.scale.setScalar(haloScale);
      dummy.updateMatrix();
      nodeHaloMesh.setMatrixAt(i, dummy.matrix);

      if (haloIntensity > 0.005) {
        const hot = activationColor(Math.max(Math.max(a, b), haloIntensity));
        haloColor.copy(haloPhaseColor).lerp(hot, 0.40);
        haloColor.multiplyScalar(0.70 + (1.80 * haloIntensity));
      } else {
        haloColor.copy(haloDormant).multiplyScalar(0.015);
      }
      nodeHaloMesh.setColorAt(i, haloColor);
    }

    updateSelectionOverlay(i, base, selectedIdx === i, selectedRegionIndices.has(i));
  }

  nodeMesh.instanceMatrix.needsUpdate = true;
  nodeMesh.instanceColor.needsUpdate = true;
  if (nodeHaloMesh) {
    nodeHaloMesh.instanceMatrix.needsUpdate = true;
    nodeHaloMesh.instanceColor.needsUpdate = true;
    nodeHaloMesh.visible = searchMode || state.radiationOn || narrationPreviewIndices.size > 0;
  }
  if (nodeSelectionMesh) {
    nodeSelectionMesh.instanceMatrix.needsUpdate = true;
    nodeSelectionMesh.instanceColor.needsUpdate = true;
    nodeSelectionMesh.visible = selectedIdx !== null;
  }
}

function clearSelection() {
  selectedIdx = null;
  applyNodeStyle();
  rebuildEdgeHighlight();
  renderHud();
}

function setSelection(idx) {
  selectedIdx = idx;
  applyNodeStyle();
  rebuildEdgeHighlight();
  renderHud();
}

function removeLines(kind) {
  const obj = kind === "base" ? edgeLines : edgeHighlightLines;
  if (!obj) return;
  scene.remove(obj);
  obj.geometry.dispose();
  obj.material.dispose();
  if (kind === "base") edgeLines = null;
  else edgeHighlightLines = null;
}

function updateEdgeColors() {
  if (!edgeLines || !graph || !state.edgesOn) return;
  const compareOn = state.compareMode !== "off" && comparePathModel && compareStimulus;
  const hrf = stimulusLibrary?.hrf || DEFAULT_HRF;
  const phaseWindowS = Math.max(0.5, (Number(hrf.peak_s) || 6) + (Number(hrf.fall_s) || 12));

  const colAttr = edgeLines.geometry.getAttribute("color");
  if (!colAttr) return;
  const arr = colAttr.array;

  const srcColor = new THREE.Color();
  const dstColor = new THREE.Color();

  for (let k = 0; k < edgesFiltered.length; k++) {
    const e = edgesFiltered[k];
    const flow = edgeFlow[k];
    const isPathPrimary = flow?.isPathPrimary === true;
    const isPathCompare = flow?.isPathCompare === true;
    const sourceReachedPrimary = Number.isFinite(nodeArrival[e.source]) && nodeArrival[e.source] <= state.t;
    const targetReachedPrimary = Number.isFinite(nodeArrival[e.target]) && nodeArrival[e.target] <= state.t;
    const edgeReachedPrimary = sourceReachedPrimary && targetReachedPrimary;
    const sourceReachedCompare = compareOn
      ? (Number.isFinite(comparePathModel.nodeArrival[e.source]) && comparePathModel.nodeArrival[e.source] <= state.t)
      : false;
    const targetReachedCompare = compareOn
      ? (Number.isFinite(comparePathModel.nodeArrival[e.target]) && comparePathModel.nodeArrival[e.target] <= state.t)
      : false;
    const edgeReachedCompare = sourceReachedCompare && targetReachedCompare;
    const edgeReached = compareOn ? (edgeReachedPrimary || edgeReachedCompare) : edgeReachedPrimary;

    const srcPrimary = nodeActivation[e.source] || 0;
    const dstPrimary = nodeActivation[e.target] || 0;
    const srcCompare = compareOn ? (compareNodeActivation[e.source] || 0) : 0;
    const dstCompare = compareOn ? (compareNodeActivation[e.target] || 0) : 0;
    const primaryMean = clamp01(0.5 * (srcPrimary + dstPrimary));
    const compareMean = clamp01(0.5 * (srcCompare + dstCompare));

    if (state.reachedOnly && !edgeReached) {
      edgeColorTo(srcColor, 0.01, false);
      edgeColorTo(dstColor, 0.01, false);
      const base = k * 6;
      arr[base + 0] = srcColor.r; arr[base + 1] = srcColor.g; arr[base + 2] = srcColor.b;
      arr[base + 3] = dstColor.r; arr[base + 4] = dstColor.g; arr[base + 5] = dstColor.b;
      continue;
    }

    if (!compareOn) {
      const confidence = clamp01(flow?.confidencePrimary ?? 0);
      const tier = flow?.tierPrimary === "core" ? "core" : "extended";
      const phaseGain = activePhaseState ? (Number(activePhaseState.edge_gain) || 1) : 1;
      const sustainSource = clamp01((0.68 * srcPrimary) + (0.26 * dstPrimary));
      const sustainTarget = clamp01((0.68 * dstPrimary) + (0.26 * srcPrimary));

      let sourcePulse = 0;
      let targetPulse = 0;
      if (flow && isPathPrimary && Number.isFinite(flow.startPrimary)) {
        const sigma = 0.18;
        const rawHead = (state.t - flow.startPrimary) / (flow.spanPrimary + 0.55);
        const sourceAnchor = flow.dirPrimary === 1 ? 0 : 1;
        const targetAnchor = flow.dirPrimary === 1 ? 1 : 0;
        const inWindow = rawHead >= -0.2 && rawHead <= 1.35;
        if (inWindow) {
          sourcePulse = Math.exp(-Math.pow(rawHead - sourceAnchor, 2) / (2 * sigma * sigma));
          targetPulse = Math.exp(-Math.pow(rawHead - targetAnchor, 2) / (2 * sigma * sigma));
        }
      }

      const baseline = isPathPrimary ? (0.08 + (0.12 * confidence)) : 0.02;
      const sustainGain = isPathPrimary ? (tier === "core" ? 0.58 : 0.42) : 0.12;
      const pulseGain = isPathPrimary ? (0.60 + (0.25 * confidence)) : 0;
      const sourceI = clamp01((baseline + (sustainGain * sustainSource) + (pulseGain * sourcePulse)) * phaseGain);
      const targetI = clamp01((baseline + (sustainGain * sustainTarget) + (pulseGain * targetPulse)) * phaseGain);

      if (isPathPrimary) {
        const sourceArrival = temporalSpectrumColor(nodeArrival[e.source], state.t, phaseWindowS).color;
        const targetArrival = temporalSpectrumColor(nodeArrival[e.target], state.t, phaseWindowS).color;
        const sourceHot = activationColor(sourceI);
        const targetHot = activationColor(targetI);
        srcColor.copy(sourceArrival).lerp(sourceHot, 0.35);
        dstColor.copy(targetArrival).lerp(targetHot, 0.35);
        srcColor.multiplyScalar(0.28 + (1.50 * sourceI));
        dstColor.multiplyScalar(0.28 + (1.50 * targetI));
      } else {
        edgeColorTo(srcColor, sourceI, false);
        edgeColorTo(dstColor, targetI, false);
      }
    } else if (state.compareMode === "overlay") {
      const onlyPrimary = Math.max(0, primaryMean - compareMean);
      const onlyCompare = Math.max(0, compareMean - primaryMean);
      const shared = Math.min(primaryMean, compareMean);
      const primaryColorSource = temporalSpectrumColor(nodeArrival[e.source], state.t, phaseWindowS).color;
      const primaryColorTarget = temporalSpectrumColor(nodeArrival[e.target], state.t, phaseWindowS).color;
      const compareColorSource = temporalSpectrumColor(comparePathModel.nodeArrival[e.source], state.t, phaseWindowS).color;
      const compareColorTarget = temporalSpectrumColor(comparePathModel.nodeArrival[e.target], state.t, phaseWindowS).color;

      srcColor.setRGB(0.10, 0.14, 0.20);
      dstColor.setRGB(0.10, 0.14, 0.20);
      if (isPathPrimary) {
        srcColor.lerp(primaryColorSource.clone().lerp(new THREE.Color(0xff8148), 0.40), 0.25 + (0.55 * Math.max(shared, onlyPrimary)));
        dstColor.lerp(primaryColorTarget.clone().lerp(new THREE.Color(0xff8148), 0.40), 0.25 + (0.55 * Math.max(shared, onlyPrimary)));
      }
      if (isPathCompare) {
        srcColor.lerp(compareColorSource.clone().lerp(new THREE.Color(0x47c9ff), 0.46), 0.25 + (0.55 * Math.max(shared, onlyCompare)));
        dstColor.lerp(compareColorTarget.clone().lerp(new THREE.Color(0x47c9ff), 0.46), 0.25 + (0.55 * Math.max(shared, onlyCompare)));
      }
      if (isPathPrimary && isPathCompare) {
        srcColor.lerp(new THREE.Color(0xf7ffcc), 0.38 + (0.45 * shared));
        dstColor.lerp(new THREE.Color(0xf7ffcc), 0.38 + (0.45 * shared));
      }
      srcColor.multiplyScalar(0.36 + (1.25 * Math.max(primaryMean, compareMean)));
      dstColor.multiplyScalar(0.36 + (1.25 * Math.max(primaryMean, compareMean)));
    } else {
      const deltaSource = srcPrimary - srcCompare;
      const deltaTarget = dstPrimary - dstCompare;
      const absSource = Math.abs(deltaSource);
      const absTarget = Math.abs(deltaTarget);
      if (absSource < 0.015) srcColor.setRGB(0.35, 0.40, 0.45);
      else if (deltaSource > 0) srcColor.setRGB(0.95, 0.34, 0.34);
      else srcColor.setRGB(0.34, 0.62, 0.98);

      if (absTarget < 0.015) dstColor.setRGB(0.35, 0.40, 0.45);
      else if (deltaTarget > 0) dstColor.setRGB(0.95, 0.34, 0.34);
      else dstColor.setRGB(0.34, 0.62, 0.98);

      srcColor.multiplyScalar(0.24 + (1.70 * absSource));
      dstColor.multiplyScalar(0.24 + (1.70 * absTarget));
    }

    const base = k * 6;
    arr[base + 0] = srcColor.r; arr[base + 1] = srcColor.g; arr[base + 2] = srcColor.b;
    arr[base + 3] = dstColor.r; arr[base + 4] = dstColor.g; arr[base + 5] = dstColor.b;
  }

  colAttr.needsUpdate = true;
}

function rebuildEdges() {
  if (!graph) return;
  const compareOn = state.compareMode !== "off" && comparePathModel && compareStimulus;
  const forceAllEdges = !activeStimulus;

  const thresholded = graph.edges.filter((e) => (e.weight_norm ?? 0) >= state.edgeThreshold);
  let visiblePathKeys = pathEdgeKeys;
  if (compareOn) {
    visiblePathKeys = new Set([...pathEdgeKeys, ...comparePathEdgeKeys]);
  }
  edgesFiltered = (state.pathOnly && !forceAllEdges)
    ? thresholded.filter((e) => visiblePathKeys.has(edgeKey(e.source, e.target)))
    : thresholded;
  removeLines("base");

  if (!state.edgesOn) {
    edgesShown = 0;
    rebuildEdgeHighlight();
    applyNodeStyle();
    renderHud();
    return;
  }

  edgesShown = edgesFiltered.length;
  const flowFromArrival = (src, dst, arrivalArray) => {
    const a = arrivalArray[src];
    const b = arrivalArray[dst];
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return { start: Infinity, span: 1, dir: 1 };
    }
    return {
      start: Math.min(a, b),
      span: Math.max(0.25, Math.abs(b - a)),
      dir: a <= b ? 1 : -1,
    };
  };

  edgeFlow = edgesFiltered.map((e) => {
    const key = edgeKey(e.source, e.target);
    const isPathPrimary = pathEdgeKeys.has(key);
    const isPathCompare = compareOn && comparePathEdgeKeys.has(key);
    const flowPrimary = isPathPrimary ? flowFromArrival(e.source, e.target, nodeArrival) : { start: Infinity, span: 1, dir: 1 };
    const flowCompare = isPathCompare
      ? flowFromArrival(e.source, e.target, comparePathModel.nodeArrival)
      : { start: Infinity, span: 1, dir: 1 };
    const primaryMeta = pathEdgeMeta.get(key) || null;
    const compareMeta = comparePathEdgeMeta.get(key) || null;

    return {
      key,
      isPathPrimary,
      isPathCompare,
      tierPrimary: primaryMeta?.tier || (isPathPrimary ? "extended" : "none"),
      tierCompare: compareMeta?.tier || (isPathCompare ? "extended" : "none"),
      confidencePrimary: clamp01(primaryMeta?.confidence ?? 0),
      confidenceCompare: clamp01(compareMeta?.confidence ?? 0),
      startPrimary: flowPrimary.start,
      spanPrimary: flowPrimary.span,
      dirPrimary: flowPrimary.dir,
      startCompare: flowCompare.start,
      spanCompare: flowCompare.span,
      dirCompare: flowCompare.dir,
    };
  });

  const positions = new Float32Array(edgesFiltered.length * 6);
  const colors = new Float32Array(edgesFiltered.length * 6);
  const baseColor = new THREE.Color();
  edgeColorTo(baseColor, 0.02, false);

  for (let k = 0; k < edgesFiltered.length; k++) {
    const e = edgesFiltered[k];
    const a = mniToThree(graph.nodes[e.source].mni_mm);
    const b = mniToThree(graph.nodes[e.target].mni_mm);
    const base = k * 6;

    positions[base + 0] = a.x; positions[base + 1] = a.y; positions[base + 2] = a.z;
    positions[base + 3] = b.x; positions[base + 4] = b.y; positions[base + 5] = b.z;

    colors[base + 0] = baseColor.r; colors[base + 1] = baseColor.g; colors[base + 2] = baseColor.b;
    colors[base + 3] = baseColor.r; colors[base + 4] = baseColor.g; colors[base + 5] = baseColor.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.90,
  });

  edgeLines = new THREE.LineSegments(geo, mat);
  scene.add(edgeLines);

  updateEdgeColors();
  rebuildEdgeHighlight();
  renderHud();
}

function rebuildEdgeHighlight() {
  removeLines("highlight");
  if (!graph || selectedIdx === null || !state.edgesOn) return;

  const incident = edgesFiltered.filter((e) => e.source === selectedIdx || e.target === selectedIdx);
  if (!incident.length) return;

  const positions = new Float32Array(incident.length * 6);
  for (let k = 0; k < incident.length; k++) {
    const e = incident[k];
    const a = mniToThree(graph.nodes[e.source].mni_mm);
    const b = mniToThree(graph.nodes[e.target].mni_mm);
    const base = k * 6;
    positions[base + 0] = a.x; positions[base + 1] = a.y; positions[base + 2] = a.z;
    positions[base + 3] = b.x; positions[base + 4] = b.y; positions[base + 5] = b.z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xf2f7ff, transparent: true, opacity: 0.95 });
  edgeHighlightLines = new THREE.LineSegments(geo, mat);
  scene.add(edgeHighlightLines);
}

function addHull(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshStandardMaterial({
        color: 0xe6edf8,
        transparent: true,
        opacity: state.hullOpacity,
        roughness: 0.86,
        metalness: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
    }
  });

  hullGroup = new THREE.Group();
  hullGroup.add(obj);

  const basis = new THREE.Matrix4().set(
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, -1, 0, 0,
    0, 0, 0, 1
  );
  hullGroup.applyMatrix4(basis);
  hullGroup.scale.setScalar(SCALE);
  hullGroup.visible = state.hullOn;
  scene.add(hullGroup);
  applyHullOpacity(state.hullOpacity);
}

function addNodes(g) {
  const sphereGeo = new THREE.SphereGeometry(0.014, 14, 14);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x67c6ff,
    roughness: 0.88,
    metalness: 0.02,
    toneMapped: false,
  });
  const haloGeo = new THREE.SphereGeometry(0.040, 12, 12);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x8ec9ff,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const selectionGeo = new THREE.SphereGeometry(0.0155, 14, 14);
  const selectionMat = new THREE.MeshBasicMaterial({
    color: 0xff7e76,
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const nodeSizeMultiplier = (g.nodes.length > 1000 ? 0.72 : 0.84) * NODE_BASE_SCALE_FACTOR;

  nodeMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, g.nodes.length);
  nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  nodeHaloMesh = new THREE.InstancedMesh(haloGeo, haloMat, g.nodes.length);
  nodeHaloMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  nodeHaloMesh.renderOrder = 2;
  nodeHaloMesh.frustumCulled = false;
  nodeSelectionMesh = new THREE.InstancedMesh(selectionGeo, selectionMat, g.nodes.length);
  nodeSelectionMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  nodeSelectionMesh.renderOrder = 4;
  nodeSelectionMesh.frustumCulled = false;

  labelToIndex.clear();
  labelToIndices.clear();
  edgeKeySet.clear();

  const c = new THREE.Color();
  for (let i = 0; i < g.nodes.length; i++) {
    const n = g.nodes[i];
    const pos = mniToThree(n.mni_mm);
    const baseScale = THREE.MathUtils.clamp(
      (0.58 + 0.48 * Math.sqrt(n.volume_mm3 / 20000)) * nodeSizeMultiplier,
      0.36,
      1.08
    );

    if (n.hemisphere === "L") c.setHex(0x667286);
    else if (n.hemisphere === "R") c.setHex(0x6b778a);
    else c.setHex(0x636d7c);

    nodeBase[i] = { pos, baseScale, baseColor: c.clone() };
    nodeActivation[i] = 0;
    compareNodeActivation[i] = 0;
    nodeRelevant[i] = false;
    nodeArrival[i] = Infinity;
    adjacency[i] = [];
    adjacencyBase[i] = [];
    labelToIndex.set(n.name, i);
    const canonical = canonicalNodeLabel(n.name);
    if (!labelToIndices.has(canonical)) labelToIndices.set(canonical, []);
    labelToIndices.get(canonical).push(i);

    dummy.position.copy(pos);
    dummy.scale.setScalar(baseScale);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(i, dummy.matrix);
    nodeMesh.setColorAt(i, c);

    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    nodeHaloMesh.setMatrixAt(i, dummy.matrix);
    nodeHaloMesh.setColorAt(i, c.clone().multiplyScalar(0.02));

    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    nodeSelectionMesh.setMatrixAt(i, dummy.matrix);
    nodeSelectionMesh.setColorAt(i, new THREE.Color(0x000000));
  }

  for (const e of g.edges) {
    const w = Number(e.weight_norm) || 0;
    adjacencyBase[e.source].push({ to: e.target, w });
    adjacencyBase[e.target].push({ to: e.source, w });
    edgeKeySet.add(edgeKey(e.source, e.target));
  }

  applyStimulusConnectivity(null);

  nodeMesh.instanceColor.needsUpdate = true;
  nodeHaloMesh.instanceColor.needsUpdate = true;
  nodeSelectionMesh.instanceColor.needsUpdate = true;
  nodeHaloMesh.visible = state.radiationOn;
  nodeSelectionMesh.visible = true;
  scene.add(nodeHaloMesh);
  scene.add(nodeMesh);
  scene.add(nodeSelectionMesh);

  const clickSelect = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
    hitIdx: null,
  };

  if (!IS_TOUCH_DEVICE) {
    window.addEventListener("pointermove", (ev) => {
      if (clickSelect.active && ev.pointerId === clickSelect.pointerId) {
        const dx = ev.clientX - clickSelect.startX;
        const dy = ev.clientY - clickSelect.startY;
        if (Math.hypot(dx, dy) >= CLICK_DRAG_THRESHOLD_PX) clickSelect.moved = true;
      }
      updateMouseFromEvent(ev);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(nodeMesh);
      setHoveredIndex(hits.length ? hits[0].instanceId : null);
    });

    renderer.domElement.addEventListener("pointerleave", () => {
      setHoveredIndex(null);
    });
  }

  renderer.domElement.addEventListener("pointerdown", (ev) => {
    cancelCameraFocusTween();
    if (IS_TOUCH_DEVICE && ev.pointerType === "touch") {
      closeMobileOverlays();
    }
    if (ev.button !== 0) return;
    clickSelect.active = true;
    clickSelect.pointerId = ev.pointerId;
    clickSelect.startX = ev.clientX;
    clickSelect.startY = ev.clientY;
    clickSelect.moved = false;
    updateMouseFromEvent(ev);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(nodeMesh);
    clickSelect.hitIdx = hits.length ? hits[0].instanceId : null;
  });

  window.addEventListener("pointermove", (ev) => {
    if (!clickSelect.active || ev.pointerId !== clickSelect.pointerId) return;
    const dx = ev.clientX - clickSelect.startX;
    const dy = ev.clientY - clickSelect.startY;
    if (Math.hypot(dx, dy) >= CLICK_DRAG_THRESHOLD_PX) clickSelect.moved = true;
  });

  window.addEventListener("pointerup", (ev) => {
    if (ev.button !== 0) return;
    if (!clickSelect.active || ev.pointerId !== clickSelect.pointerId) return;
    const didMove = clickSelect.moved;
    const hitIdx = clickSelect.hitIdx;
    clickSelect.active = false;
    clickSelect.pointerId = null;
    clickSelect.hitIdx = null;
    clickSelect.moved = false;

    if (didMove) return;
    if (hitIdx !== null) setSelection(hitIdx);
    else clearSelection();
  });

  window.addEventListener("pointercancel", (ev) => {
    if (!clickSelect.active || ev.pointerId !== clickSelect.pointerId) return;
    clickSelect.active = false;
    clickSelect.pointerId = null;
    clickSelect.hitIdx = null;
    clickSelect.moved = false;
  });
}

function dijkstraFrom(startIdx, adjacencyGraph = adjacency) {
  const n = graph.nodes.length;
  const dist = new Array(n).fill(Infinity);
  const seen = new Array(n).fill(false);
  dist[startIdx] = 0;

  for (let step = 0; step < n; step++) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (!seen[i] && dist[i] < bestD) {
        best = i;
        bestD = dist[i];
      }
    }
    if (best === -1) break;
    seen[best] = true;

    for (const nb of (adjacencyGraph[best] || [])) {
      const edgeCost = 1 / Math.max(0.04, nb.w);
      const cand = dist[best] + edgeCost;
      if (cand < dist[nb.to]) dist[nb.to] = cand;
    }
  }

  return dist;
}

function buildMultiSourcePathModel(seedIndices, adjacencyGraph = adjacency) {
  const n = graph.nodes.length;
  const dist = new Array(n).fill(Infinity);
  const parent = new Array(n).fill(-1);
  const seen = new Array(n).fill(false);

  for (const idx of seedIndices) {
    if (Number.isInteger(idx) && idx >= 0 && idx < n) {
      dist[idx] = 0;
    }
  }

  for (let step = 0; step < n; step++) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (!seen[i] && dist[i] < bestD) {
        best = i;
        bestD = dist[i];
      }
    }
    if (best === -1) break;
    seen[best] = true;

    for (const nb of (adjacencyGraph[best] || [])) {
      const edgeCost = 1 / Math.max(0.04, nb.w);
      const cand = dist[best] + edgeCost;
      if (cand < dist[nb.to]) {
        dist[nb.to] = cand;
        parent[nb.to] = best;
      }
    }
  }

  return { dist, parent };
}

function quantileCutoff(values, quantile) {
  if (!Array.isArray(values) || values.length === 0) return Infinity;
  const sorted = values.slice().sort((a, b) => a - b);
  const q = clamp01(Number.isFinite(quantile) ? quantile : 1);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx];
}

function normalizeConnectivityPair(rawPair) {
  const from = canonicalNodeLabel(rawPair?.from ?? rawPair?.a ?? rawPair?.source ?? rawPair?.left);
  const to = canonicalNodeLabel(rawPair?.to ?? rawPair?.b ?? rawPair?.target ?? rawPair?.right);
  const rawScale = Number(rawPair?.scale ?? rawPair?.multiplier ?? rawPair?.w);
  const scale = THREE.MathUtils.clamp(
    Number.isFinite(rawScale) ? rawScale : 1,
    0.2,
    3.5
  );

  if (!from || !to || from === to || !Number.isFinite(scale) || scale === 1) return null;
  return { from, to, scale };
}

function normalizeConnectivitySpec(rawSpec) {
  const source_name = safeText(rawSpec?.source_name, "connectivity.empirical.json");
  const globalPairsRaw = Array.isArray(rawSpec?.global_pairs) ? rawSpec.global_pairs : [];
  const global_pairs = globalPairsRaw
    .map((pair) => normalizeConnectivityPair(pair))
    .filter(Boolean);

  const stimuli = new Map();
  const rawStimuli = rawSpec?.stimuli;

  if (Array.isArray(rawStimuli)) {
    for (const rawItem of rawStimuli) {
      const id = safeText(rawItem?.id);
      if (!id) continue;
      const pairs = Array.isArray(rawItem?.pairs)
        ? rawItem.pairs.map((pair) => normalizeConnectivityPair(pair)).filter(Boolean)
        : [];
      if (pairs.length) stimuli.set(id, pairs);
    }
  } else if (rawStimuli && typeof rawStimuli === "object") {
    for (const [rawId, rawItem] of Object.entries(rawStimuli)) {
      const id = safeText(rawId);
      if (!id) continue;
      const rawPairs = Array.isArray(rawItem?.pairs) ? rawItem.pairs : [];
      const pairs = rawPairs.map((pair) => normalizeConnectivityPair(pair)).filter(Boolean);
      if (pairs.length) stimuli.set(id, pairs);
    }
  }

  return { source_name, global_pairs: global_pairs, stimuli };
}

function applyConnectivityPairsToEdgeMap(pairs, edgeScaleMap) {
  if (!Array.isArray(pairs) || !pairs.length) return;

  for (const pair of pairs) {
    const fromIndices = labelToIndices.get(pair.from) || [];
    const toIndices = labelToIndices.get(pair.to) || [];
    if (!fromIndices.length || !toIndices.length) continue;

    for (const fromIdx of fromIndices) {
      for (const toIdx of toIndices) {
        if (fromIdx === toIdx) continue;
        const key = edgeKey(fromIdx, toIdx);
        if (!edgeKeySet.has(key)) continue;

        const prev = edgeScaleMap.get(key);
        if (
          prev === undefined ||
          Math.abs(pair.scale - 1) > Math.abs(prev - 1)
        ) {
          edgeScaleMap.set(key, pair.scale);
        }
      }
    }
  }
}

function buildConnectivityMaps(spec) {
  connectivityByStimulus.clear();
  if (!spec) return;

  const globalMap = new Map();
  applyConnectivityPairsToEdgeMap(spec.global_pairs, globalMap);
  if (globalMap.size) connectivityByStimulus.set("*", globalMap);

  for (const [stimulusId, pairs] of spec.stimuli.entries()) {
    const edgeScaleMap = new Map(globalMap);
    applyConnectivityPairsToEdgeMap(pairs, edgeScaleMap);
    if (edgeScaleMap.size) connectivityByStimulus.set(stimulusId, edgeScaleMap);
  }
}

function applyStimulusConnectivity(stimulusId) {
  const edgeScaleMap = (
    stimulusId && connectivityByStimulus.get(stimulusId)
  ) || connectivityByStimulus.get("*") || null;

  activeConnectivityMap = edgeScaleMap;
  activeConnectivityEdgeCount = edgeScaleMap ? edgeScaleMap.size : 0;

  for (let i = 0; i < adjacencyBase.length; i++) {
    const baseRow = adjacencyBase[i] || [];
    const activeRow = new Array(baseRow.length);
    for (let j = 0; j < baseRow.length; j++) {
      const nb = baseRow[j];
      const scale = edgeScaleMap ? (edgeScaleMap.get(edgeKey(i, nb.to)) || 1) : 1;
      activeRow[j] = {
        to: nb.to,
        w: THREE.MathUtils.clamp(nb.w * scale, 0.001, 1.0),
      };
    }
    adjacency[i] = activeRow;
  }

  updateConnectivityStatus();
}

function findStimulusById(id) {
  if (!stimulusLibrary || !Array.isArray(stimulusLibrary.stimuli)) return null;
  return stimulusLibrary.stimuli.find((stim) => stim.id === id) || null;
}

function buildAdjacencyForStimulus(stimulusId) {
  const edgeScaleMap = (
    stimulusId && connectivityByStimulus.get(stimulusId)
  ) || connectivityByStimulus.get("*") || null;

  return adjacencyBase.map((baseRow, i) => {
    const row = new Array(baseRow.length);
    for (let j = 0; j < baseRow.length; j++) {
      const nb = baseRow[j];
      const scale = edgeScaleMap ? (edgeScaleMap.get(edgeKey(i, nb.to)) || 1) : 1;
      row[j] = {
        to: nb.to,
        w: THREE.MathUtils.clamp(nb.w * scale, 0.001, 1.0),
      };
    }
    return row;
  });
}

function phaseAtTime(model, tSec) {
  const phases = Array.isArray(model?.phases) && model.phases.length
    ? model.phases
    : DEFAULT_PHASE_MODEL;
  const t = Math.max(0, Number(tSec) || 0);
  let chosen = phases[phases.length - 1];
  for (const phase of phases) {
    if (t >= phase.start_s && t < phase.end_s) {
      chosen = phase;
      break;
    }
  }
  const span = Math.max(0.05, chosen.end_s - chosen.start_s);
  const progress = clamp01((t - chosen.start_s) / span);
  return { ...chosen, progress };
}

function addPathEdgeMeta(edgeMeta, key, tier, confidence, source = "") {
  const conf = clamp01(Number(confidence) || 0);
  const normalizedTier = tier === "core" ? "core" : "extended";
  const prev = edgeMeta.get(key);
  if (!prev) {
    edgeMeta.set(key, { tier: normalizedTier, confidence: conf, source });
    return;
  }
  const prevRank = prev.tier === "core" ? 2 : 1;
  const nextRank = normalizedTier === "core" ? 2 : 1;
  if (nextRank > prevRank || (nextRank === prevRank && conf > prev.confidence)) {
    edgeMeta.set(key, { tier: normalizedTier, confidence: conf, source });
  }
}

function addCuratedPairsToMeta(pairs, tier, edgeMeta) {
  for (const pair of pairs || []) {
    const fromIndices = labelToIndices.get(pair.from) || [];
    const toIndices = labelToIndices.get(pair.to) || [];
    if (!fromIndices.length || !toIndices.length) continue;

    for (const fromIdx of fromIndices) {
      for (const toIdx of toIndices) {
        if (fromIdx === toIdx) continue;
        const key = edgeKey(fromIdx, toIdx);
        if (!edgeKeySet.has(key)) continue;
        addPathEdgeMeta(edgeMeta, key, tier, pair.confidence, "curated");
      }
    }
  }
}

function buildStimulusPathModel(stimulus, adjacencyGraph) {
  const hrf = stimulusLibrary?.hrf || DEFAULT_HRF;
  const fallbackDurationS = defaultModelDurationForHrf(hrf);
  const durationS = THREE.MathUtils.clamp(
    Number(stimulus?.model_duration_s) || fallbackDurationS,
    8,
    240
  );
  const travelWindowS = THREE.MathUtils.clamp(
    Number(stimulus?.travel_window_s) || DEFAULT_TRAVEL_WINDOW_S,
    1.5,
    Math.max(2, durationS - 0.5)
  );
  const phases = normalizePhaseModel(stimulus?.phases, durationS);
  const n = graph.nodes.length;
  const nodeArrivalLocal = new Array(n).fill(Infinity);
  const nodeRelevantLocal = new Array(n).fill(false);
  const nodeTierLocal = new Array(n).fill(TIER_NONE);
  const nodeRoleLocal = new Array(n).fill("background");
  const edgeMeta = new Map();
  const pathParentLocal = new Array(n).fill(-1);
  const seedNodesLocal = [];
  const seedIndices = [];
  const seedSet = new Set();

  const resolvedSeeds = [];
  for (const seed of stimulus?.seed_regions || []) {
    resolvedSeeds.push(...expandSeedLabel(seed));
  }

  for (const seed of resolvedSeeds) {
    const idx = labelToIndex.get(seed.aal_label);
    if (!Number.isInteger(idx)) continue;
    const w = Math.max(0, Number(seed.w) || 0);
    if (w <= 0) continue;
    seedIndices.push(idx);
    seedSet.add(idx);
    seedNodesLocal.push({ idx, w, distances: dijkstraFrom(idx, adjacencyGraph), maxDist: 1 });
  }

  for (const seed of seedNodesLocal) {
    let maxD = 0;
    for (const d of seed.distances) {
      if (Number.isFinite(d)) maxD = Math.max(maxD, d);
    }
    seed.maxDist = Math.max(1, maxD);
  }

  let reachableNodeCountLocal = 0;
  if (seedIndices.length) {
    const model = buildMultiSourcePathModel(seedIndices, adjacencyGraph);
    const engagement = stimulus?.engagement || DEFAULT_ENGAGEMENT;
    const breadthQ = THREE.MathUtils.clamp(
      Number(state.pathBreadthQ) || engagement.arrival_quantile,
      0.60,
      0.98
    );
    const finiteDistances = model.dist.filter((d) => Number.isFinite(d));
    const distanceCutoff = quantileCutoff(finiteDistances, breadthQ);
    let maxRelevantDist = 0;

    for (let i = 0; i < model.dist.length; i++) {
      const d = model.dist[i];
      const relevant = Number.isFinite(d) && (d <= distanceCutoff || seedSet.has(i));
      nodeRelevantLocal[i] = relevant;
      if (relevant) maxRelevantDist = Math.max(maxRelevantDist, d);
    }

    const coreQuantile = THREE.MathUtils.clamp(
      Number(stimulus?.core_quantile ?? DEFAULT_CORE_QUANTILE),
      0.35,
      0.90
    );
    const relevantFinite = [];
    for (let i = 0; i < model.dist.length; i++) {
      if (nodeRelevantLocal[i] && Number.isFinite(model.dist[i])) relevantFinite.push(model.dist[i]);
    }
    const coreCutoff = quantileCutoff(relevantFinite, coreQuantile);
    const distNorm = Math.max(0.1, maxRelevantDist);

    for (let i = 0; i < model.dist.length; i++) {
      pathParentLocal[i] = model.parent[i];
      if (!nodeRelevantLocal[i]) continue;
      const d = model.dist[i];
      nodeArrivalLocal[i] = (d / distNorm) * travelWindowS;
      reachableNodeCountLocal += 1;
      if (seedSet.has(i) || d <= coreCutoff) nodeTierLocal[i] = TIER_CORE;
      else nodeTierLocal[i] = TIER_EXTENDED;
    }

    for (let i = 0; i < model.parent.length; i++) {
      const p = model.parent[i];
      if (p < 0 || !nodeRelevantLocal[i] || !nodeRelevantLocal[p]) continue;
      const tier = (nodeTierLocal[i] === TIER_CORE && nodeTierLocal[p] === TIER_CORE)
        ? "core"
        : "extended";
      const conf = clamp01(0.58 + (0.42 * (1 - (model.dist[i] / distNorm))));
      addPathEdgeMeta(edgeMeta, edgeKey(i, p), tier, conf, "tree");
    }

    for (const e of graph.edges) {
      const w = Number(e.weight_norm) || 0;
      if (w < engagement.edge_weight_min) continue;
      if (!nodeRelevantLocal[e.source] || !nodeRelevantLocal[e.target]) continue;
      const a = nodeArrivalLocal[e.source];
      const b = nodeArrivalLocal[e.target];
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const lag = Math.abs(a - b);
      if (lag > engagement.coactivation_lag_s) continue;
      const tier = (nodeTierLocal[e.source] === TIER_CORE && nodeTierLocal[e.target] === TIER_CORE)
        ? "core"
        : "extended";
      const lagFactor = 1 - clamp01(lag / Math.max(0.1, engagement.coactivation_lag_s));
      const wFactor = clamp01((w - engagement.edge_weight_min) / Math.max(0.01, 1 - engagement.edge_weight_min));
      const conf = clamp01(0.34 + (0.28 * wFactor) + (0.34 * lagFactor));
      addPathEdgeMeta(edgeMeta, edgeKey(e.source, e.target), tier, conf, "coactivation");
    }
  }

  addCuratedPairsToMeta(stimulus?.core_path, "core", edgeMeta);
  addCuratedPairsToMeta(stimulus?.extended_path, "extended", edgeMeta);

  for (const idx of seedSet) nodeTierLocal[idx] = TIER_CORE;
  for (const [key, meta] of edgeMeta.entries()) {
    const [aRaw, bRaw] = key.split("-");
    const a = Number(aRaw);
    const b = Number(bRaw);
    if (!Number.isInteger(a) || !Number.isInteger(b)) continue;
    if (meta.tier === "core") {
      if (nodeTierLocal[a] !== TIER_NONE) nodeTierLocal[a] = TIER_CORE;
      if (nodeTierLocal[b] !== TIER_NONE) nodeTierLocal[b] = TIER_CORE;
    } else {
      if (nodeTierLocal[a] === TIER_NONE) nodeTierLocal[a] = TIER_EXTENDED;
      if (nodeTierLocal[b] === TIER_NONE) nodeTierLocal[b] = TIER_EXTENDED;
    }
  }

  const childCount = new Array(n).fill(0);
  for (let i = 0; i < pathParentLocal.length; i++) {
    const p = pathParentLocal[i];
    if (p >= 0) childCount[p] += 1;
  }
  for (let i = 0; i < n; i++) {
    if (!nodeRelevantLocal[i]) {
      nodeRoleLocal[i] = "background";
      continue;
    }
    if (seedSet.has(i)) {
      nodeRoleLocal[i] = "seed_entry";
      continue;
    }
    if (nodeTierLocal[i] === TIER_CORE) {
      nodeRoleLocal[i] = childCount[i] > 1 ? "core_hub" : "core_relay";
      continue;
    }
    nodeRoleLocal[i] = childCount[i] === 0 ? "late_output" : "extended_integration";
  }

  const arrivalEvents = [];
  for (let i = 0; i < nodeArrivalLocal.length; i++) {
    const t = nodeArrivalLocal[i];
    if (!nodeRelevantLocal[i] || !Number.isFinite(t)) continue;
    arrivalEvents.push({ idx: i, t });
  }
  arrivalEvents.sort((a, b) => (a.t - b.t) || (a.idx - b.idx));
  for (let i = 0; i < arrivalEvents.length; i++) arrivalEvents[i].rank = i + 1;

  return {
    seedNodes: seedNodesLocal,
    seedSet,
    nodeArrival: nodeArrivalLocal,
    nodeRelevant: nodeRelevantLocal,
    nodeTier: nodeTierLocal,
    nodeRole: nodeRoleLocal,
    pathParent: pathParentLocal,
    pathEdgeKeys: new Set(edgeMeta.keys()),
    pathEdgeMeta: edgeMeta,
    reachableNodeCount: reachableNodeCountLocal,
    arrivalEvents,
    travelWindowS,
    durationS,
    phases,
  };
}

function activateAtlasMode() {
  activeStimulus = null;
  compareStimulus = null;
  activePathModel = null;
  comparePathModel = null;
  comparePathEdgeKeys = new Set();
  comparePathEdgeMeta = new Map();
  compareArrivalEventsCache = [];
  pathEdgeKeys = new Set();
  pathEdgeMeta = new Map();
  pathParent = new Array(graph?.nodes?.length || 0).fill(-1);
  reachableNodeCount = 0;
  arrivalEventsCache = [];
  state.durationS = DEFAULT_MODEL_DURATION_S;
  state.t = 0;
  state.running = false;
  state.paused = false;
  state.compareMode = "off";

  for (let i = 0; i < nodeArrival.length; i++) {
    nodeArrival[i] = Infinity;
    nodeRelevant[i] = false;
    nodeActivation[i] = 0;
    compareNodeActivation[i] = 0;
  }

  if (ui.compareModeSelect) ui.compareModeSelect.value = "off";
  if (ui.compareModeSelect) ui.compareModeSelect.disabled = true;
  if (ui.stimCompareSelect) ui.stimCompareSelect.disabled = true;
  if (ui.compareStatus) ui.compareStatus.textContent = "Compare: off (atlas mode)";
  if (ui.stimSelect) ui.stimSelect.value = ATLAS_MODE_ID;

  applyStimulusConnectivity(null);
  buildTextNarrationTimeline();
  syncTextNarrationToTime(state.t, { rebuild: true, reason: "Atlas explore mode loaded." });
  renderAtlasMeta();
  rebuildEdges();
  applyNodeStyle();
  renderTimeline();
  refreshNarrationStatus();
  setStatus("atlas explore ready");
  renderHud();
}

function setActiveStimulus(stimulusId) {
  if (!stimulusLibrary || !Array.isArray(stimulusLibrary.stimuli) || !graph) return false;
  if (stimulusId === ATLAS_MODE_ID) {
    activateAtlasMode();
    return true;
  }
  const next = findStimulusById(stimulusId);
  if (!next) return false;

  activeStimulus = next;
  if (ui.compareModeSelect) ui.compareModeSelect.disabled = false;
  renderStimulusMeta(next);
  applyStimulusConnectivity(next.id);
  activePathModel = buildStimulusPathModel(next, adjacency);
  seedNodes = activePathModel.seedNodes;
  pathEdgeKeys = new Set(activePathModel.pathEdgeKeys);
  pathEdgeMeta = new Map(activePathModel.pathEdgeMeta);
  pathParent = activePathModel.pathParent.slice();
  reachableNodeCount = activePathModel.reachableNodeCount;
  arrivalEventsCache = activePathModel.arrivalEvents.slice();
  state.durationS = activePathModel.durationS;

  for (let i = 0; i < nodeArrival.length; i++) {
    nodeArrival[i] = activePathModel.nodeArrival[i];
    nodeRelevant[i] = activePathModel.nodeRelevant[i];
  }

  rebuildCompareModel();
  rebuildEdges();
  state.t = 0;
  buildTextNarrationTimeline();
  updateNarrationCursorFromTime();
  syncTextNarrationToTime(state.t, { rebuild: true, reason: "Timeline reset." });
  renderTimeline();
  if (!seedNodes.length) {
    setStatus(`No graph seeds resolved for "${stimulusDisplayLabel(next)}"`);
  } else {
    const realCourseS = Number(next?.timing_profile?.real_course_s);
    if (Number.isFinite(realCourseS) && realCourseS > 0) {
      setStatus(`ready (~${formatDurationCompact(realCourseS)} modeled course)`);
    } else {
      setStatus("ready");
    }
  }
  applyActivationAtTime(state.t);
  refreshNarrationStatus();
  renderHud();
  return true;
}

function rebuildCompareModel(preferredStimulusId = "") {
  if (!graph || !stimulusLibrary || !Array.isArray(stimulusLibrary.stimuli)) return;
  if (ui.stimCompareSelect) ui.stimCompareSelect.disabled = state.compareMode === "off";

  if (state.compareMode === "off") {
    compareStimulus = null;
    comparePathModel = null;
    comparePathEdgeKeys = new Set();
    comparePathEdgeMeta = new Map();
    compareArrivalEventsCache = [];
    for (let i = 0; i < compareNodeActivation.length; i++) compareNodeActivation[i] = 0;
    if (ui.compareStatus) ui.compareStatus.textContent = "Compare: off";
    return;
  }

  const ids = stimulusLibrary.stimuli.map((s) => s.id);
  let compareId = preferredStimulusId || state.compareStimulusId || "";
  if (!compareId || !ids.includes(compareId) || compareId === activeStimulus?.id) {
    compareId = ids.find((id) => id !== activeStimulus?.id) || "";
  }
  state.compareStimulusId = compareId;
  if (ui.stimCompareSelect && compareId) ui.stimCompareSelect.value = compareId;

  compareStimulus = findStimulusById(compareId);
  if (!compareStimulus) {
    comparePathModel = null;
    comparePathEdgeKeys = new Set();
    comparePathEdgeMeta = new Map();
    compareArrivalEventsCache = [];
    for (let i = 0; i < compareNodeActivation.length; i++) compareNodeActivation[i] = 0;
    if (ui.compareStatus) ui.compareStatus.textContent = "Compare: unavailable";
    return;
  }

  const compareAdjacency = buildAdjacencyForStimulus(compareStimulus.id);
  comparePathModel = buildStimulusPathModel(compareStimulus, compareAdjacency);
  comparePathEdgeKeys = new Set(comparePathModel.pathEdgeKeys);
  comparePathEdgeMeta = new Map(comparePathModel.pathEdgeMeta);
  compareArrivalEventsCache = comparePathModel.arrivalEvents.slice();

  if (ui.compareStatus) {
    ui.compareStatus.textContent = `Compare: ${state.compareMode} • B=${compareStimulus.label}`;
  }
}

function fillActivationForModel(model, tSec, outArray, gain) {
  for (let i = 0; i < outArray.length; i++) outArray[i] = 0;
  if (!model) return null;

  const hrf = stimulusLibrary?.hrf || DEFAULT_HRF;
  const phase = phaseAtTime(model, tSec);
  const travelWindowS = model.travelWindowS || DEFAULT_TRAVEL_WINDOW_S;

  for (const seed of model.seedNodes) {
    for (let i = 0; i < outArray.length; i++) {
      if (!model.nodeRelevant[i]) continue;
      const d = seed.distances[i];
      if (!Number.isFinite(d)) continue;
      const dNorm = d / seed.maxDist;
      const arrival = dNorm * travelWindowS;
      const local = hrfEnvelopeAt(tSec - arrival, hrf);
      if (local <= 0) continue;
      const tier = model.nodeTier[i];
      const tierGain = tier === TIER_CORE ? phase.core_gain : (tier === TIER_EXTENDED ? phase.extended_gain : 0);
      if (tierGain <= 0) continue;
      const atten = Math.exp(-2.2 * dNorm);
      outArray[i] += seed.w * atten * local * tierGain;
    }
  }

  const g = Math.max(0, Number(gain) || 0);
  for (let i = 0; i < outArray.length; i++) {
    outArray[i] = clamp01(outArray[i] * g);
  }
  return phase;
}

function applyActivationAtTime(tSec) {
  if (!graph || !activeStimulus || !activePathModel) return;

  activePhaseState = fillActivationForModel(activePathModel, tSec, nodeActivation, state.gain);
  const compareOn = state.compareMode !== "off" && comparePathModel && compareStimulus;
  comparePhaseState = compareOn
    ? fillActivationForModel(comparePathModel, tSec, compareNodeActivation, state.gain)
    : null;
  if (!compareOn) {
    for (let i = 0; i < compareNodeActivation.length; i++) compareNodeActivation[i] = 0;
  }

  updateMajorRegionReadout();
  applyNodeStyle();
  updateEdgeColors();
  renderTimeline();
}

function play() {
  if (!activeStimulus) {
    setStatus("atlas mode: no playback");
    return;
  }
  if (state.running && !state.paused) return;
  if (state.searchExploreOn) {
    clearSearchExplore();
    applyActivationAtTime(state.t);
  }
  state.running = true;
  state.paused = false;
  state.lastMs = performance.now();
  updateNarrationCursorFromTime();
  refreshNarrationStatus();
  setStatus("playing");
  emit("stimflow:play", {
    stimulus_id: activeStimulus.id,
    mode: state.mode,
    speed: state.speed,
    gain: state.gain,
    build_id: STIMFLOW_BUILD_ID,
  });
}

function pause() {
  if (!state.running) return;
  state.paused = true;
  refreshNarrationStatus();
  setStatus("paused");
  emit("stimflow:pause", {
    stimulus_id: activeStimulus?.id || null,
    t: state.t,
    build_id: STIMFLOW_BUILD_ID,
  });
}

function stop() {
  const priorT = state.t;
  state.running = false;
  state.paused = false;
  state.t = 0;
  updateNarrationCursorFromTime();
  stopNarration();
  setStatus("stopped");
  applyActivationAtTime(state.t);
  syncTextNarrationToTime(state.t, { rebuild: true, reason: "Playback stopped." });
  emit("stimflow:stop", {
    stimulus_id: activeStimulus?.id || null,
    t: priorT,
    build_id: STIMFLOW_BUILD_ID,
  });
}

function syncUI() {
  const resolvedMode = resolveLibraryMode(state.libraryMode);
  if (ui.basisSelect && resolvedMode) ui.basisSelect.value = resolvedMode;
  if (ui.graphSelect) ui.graphSelect.value = normalizeGraphMode(state.graphMode);
  if (ui.compareModeSelect) ui.compareModeSelect.value = state.compareMode;
  if (ui.stimCompareSelect && state.compareStimulusId) ui.stimCompareSelect.value = state.compareStimulusId;
  if (ui.compareStatus) {
    ui.compareStatus.textContent = state.compareMode === "off" || !compareStimulus
      ? "Compare: off"
      : `Compare: ${state.compareMode} • B=${compareStimulus.label}`;
  }
  ui.toggleEdges.checked = state.edgesOn;
  if (ui.togglePathOnly) ui.togglePathOnly.checked = state.pathOnly;
  if (ui.toggleReachedOnly) ui.toggleReachedOnly.checked = state.reachedOnly;
  if (ui.toggleRadiation) ui.toggleRadiation.checked = state.radiationOn;
  if (ui.toggleHoverGroup) ui.toggleHoverGroup.checked = state.hoverGroupOn;
  ui.toggleHull.checked = state.hullOn;
  if (ui.hullOpacityRange) ui.hullOpacityRange.value = state.hullOpacity.toFixed(2);
  if (ui.hullOpacityVal) ui.hullOpacityVal.textContent = state.hullOpacity.toFixed(2);
  ui.toggleAuto.checked = state.autoRotate;
  ui.edgeThresh.value = String(state.edgeThreshold);
  ui.edgeVal.textContent = state.edgeThreshold.toFixed(2);

  ui.speedRange.value = String(state.speed);
  ui.speedVal.textContent = `${state.speed.toFixed(2)}x`;
  updateStepControls();
  if (ui.toggleNarration) ui.toggleNarration.checked = state.narrationOn;
  if (ui.narrationRateRange) ui.narrationRateRange.value = state.narrationRate.toFixed(2);
  if (ui.narrationRateVal) ui.narrationRateVal.textContent = `${state.narrationRate.toFixed(2)}x`;
  refreshNarrationStatus();
  ui.gainRange.value = String(state.gain);
  ui.gainVal.textContent = state.gain.toFixed(2);
  if (ui.breadthRange) ui.breadthRange.value = state.pathBreadthQ.toFixed(2);
  if (ui.breadthVal) ui.breadthVal.textContent = state.pathBreadthQ.toFixed(2);
  ui.modeSelect.value = state.mode;
  setExportStatus("ready");
  updateGraphStatus();
  updateConnectivityStatus();
  if (!regionSearchQuery) resetRegionSearchStatus();
}

function applyHullOpacity(value) {
  const nextOpacity = THREE.MathUtils.clamp(Number(value), HULL_OPACITY_MIN, HULL_OPACITY_MAX);
  state.hullOpacity = Number.isFinite(nextOpacity) ? nextOpacity : HULL_OPACITY;
  if (ui.hullOpacityRange) ui.hullOpacityRange.value = state.hullOpacity.toFixed(2);
  if (ui.hullOpacityVal) ui.hullOpacityVal.textContent = state.hullOpacity.toFixed(2);

  if (!hullGroup) return;
  hullGroup.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    child.material.transparent = true;
    child.material.opacity = state.hullOpacity;
    child.material.needsUpdate = true;
  });
}

window.addEventListener("keydown", (ev) => {
  if (isTextEntryTarget(ev.target)) return;

  if (ev.key === "Escape") clearSelection();
  if (ev.code === "Space") {
    ev.preventDefault();
    if (!state.running || state.paused) play();
    else pause();
  }
  if (ev.code === "ArrowLeft") {
    ev.preventDefault();
    if (ev.shiftKey) jumpToArrival(-1);
    else setTimelinePosition(state.t - state.scrubStepS, "step_back");
  }
  if (ev.code === "ArrowRight") {
    ev.preventDefault();
    if (ev.shiftKey) jumpToArrival(1);
    else setTimelinePosition(state.t + state.scrubStepS, "step_forward");
  }
});

ui.btnPlay.addEventListener("click", () => play());
ui.btnPause.addEventListener("click", () => pause());
ui.btnStop.addEventListener("click", () => stop());
if (ui.btnStepBack) {
  ui.btnStepBack.addEventListener("click", () => {
    setTimelinePosition(state.t - state.scrubStepS, "step_back");
  });
}
if (ui.btnStepForward) {
  ui.btnStepForward.addEventListener("click", () => {
    setTimelinePosition(state.t + state.scrubStepS, "step_forward");
  });
}
if (ui.btnPrevArrival) {
  ui.btnPrevArrival.addEventListener("click", () => {
    jumpToArrival(-1);
  });
}
if (ui.btnNextArrival) {
  ui.btnNextArrival.addEventListener("click", () => {
    jumpToArrival(1);
  });
}
if (ui.btnExportJson) ui.btnExportJson.addEventListener("click", () => exportPathReportJson());
if (ui.btnExportCsv) ui.btnExportCsv.addEventListener("click", () => exportPathReportCsv());
if (ui.btnRegionSearch && ui.regionSearchInput) {
  ui.btnRegionSearch.addEventListener("click", () => {
    rebuildRegionSearch(ui.regionSearchInput.value);
  });
}
if (ui.btnRegionPrev) {
  ui.btnRegionPrev.addEventListener("click", () => {
    cycleRegionSearch(-1);
  });
}
if (ui.btnRegionNext) {
  ui.btnRegionNext.addEventListener("click", () => {
    cycleRegionSearch(1);
  });
}
if (ui.regionSearchSuggest) {
  ui.regionSearchSuggest.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button.item");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    if (!Number.isInteger(idx)) return;
    acceptRegionSuggestion(idx);
  });
}
if (ui.regionSearchInput) {
  ui.regionSearchInput.addEventListener("input", () => {
    const normalized = normalizeSearchText(ui.regionSearchInput.value);
    if (!normalized) {
      regionSearchQuery = "";
      regionSearchMatches = [];
      regionSearchCursor = -1;
      clearSearchExplore();
      resetRegionSearchStatus();
      applyActivationAtTime(state.t);
    }
    updateRegionAutocomplete(ui.regionSearchInput.value);
  });
  ui.regionSearchInput.addEventListener("focus", () => {
    updateRegionAutocomplete(ui.regionSearchInput.value);
  });
  ui.regionSearchInput.addEventListener("blur", () => {
    // Delay so click on suggestion can register before hide.
    setTimeout(() => hideRegionSearchSuggest(), 120);
  });
  ui.regionSearchInput.addEventListener("keydown", (ev) => {
    const suggestOpen = Boolean(regionSuggestEntries.length && ui.regionSearchSuggest && !ui.regionSearchSuggest.hidden);

    if (ev.key === "ArrowDown" && suggestOpen) {
      ev.preventDefault();
      regionSuggestCursor = (regionSuggestCursor + 1 + regionSuggestEntries.length) % regionSuggestEntries.length;
      renderRegionSearchSuggest(regionSuggestEntries, regionSuggestCursor);
      return;
    }

    if (ev.key === "ArrowUp" && suggestOpen) {
      ev.preventDefault();
      regionSuggestCursor = (regionSuggestCursor - 1 + regionSuggestEntries.length) % regionSuggestEntries.length;
      renderRegionSearchSuggest(regionSuggestEntries, regionSuggestCursor);
      return;
    }

    if (ev.key === "Escape" && suggestOpen) {
      ev.preventDefault();
      hideRegionSearchSuggest();
      return;
    }

    if (ev.key === "Enter") {
      ev.preventDefault();
      if (suggestOpen && regionSuggestCursor >= 0) {
        acceptRegionSuggestion(regionSuggestCursor);
      } else {
        rebuildRegionSearch(ui.regionSearchInput.value);
      }
    }
  });
}

ui.modeSelect.addEventListener("change", () => {
  state.mode = ui.modeSelect.value === "once" ? "once" : "loop";
});

ui.speedRange.addEventListener("input", () => {
  state.speed = Number(ui.speedRange.value) || 1;
  ui.speedVal.textContent = `${state.speed.toFixed(2)}x`;
});

if (ui.scrubRange) {
  ui.scrubRange.addEventListener("input", () => {
    setTimelinePosition(ui.scrubRange.value, "scrub");
  });
}

if (ui.scrubRateRange) {
  ui.scrubRateRange.addEventListener("input", () => {
    state.scrubStepS = THREE.MathUtils.clamp(Number(ui.scrubRateRange.value) || DEFAULT_SCRUB_STEP_S, 0.1, 2.0);
    updateStepControls();
  });
}

if (ui.toggleNarration) {
  ui.toggleNarration.addEventListener("change", () => {
    state.narrationOn = ui.toggleNarration.checked;
    if (!state.narrationOn) {
      stopNarration();
      refreshNarrationStatus();
    } else {
      refreshNarrationStatus();
    }
  });
}

if (ui.narrationRateRange) {
  ui.narrationRateRange.addEventListener("input", () => {
    state.narrationRate = THREE.MathUtils.clamp(Number(ui.narrationRateRange.value) || 1, 0.6, 1.8);
    if (ui.narrationRateVal) ui.narrationRateVal.textContent = `${state.narrationRate.toFixed(2)}x`;
    refreshNarrationStatus();
  });
}

if (ui.btnNarrateNow) {
  ui.btnNarrateNow.addEventListener("click", () => {
    narrateNextArrival(true);
  });
}

if (ui.btnNarrationMute) {
  ui.btnNarrationMute.addEventListener("click", () => {
    stopNarration();
  });
}

ui.gainRange.addEventListener("input", () => {
  state.gain = Number(ui.gainRange.value) || 1;
  ui.gainVal.textContent = state.gain.toFixed(2);
  applyActivationAtTime(state.t);
});

if (ui.breadthRange) {
  ui.breadthRange.addEventListener("input", () => {
    state.pathBreadthQ = THREE.MathUtils.clamp(Number(ui.breadthRange.value) || DEFAULT_ENGAGEMENT.arrival_quantile, 0.60, 0.98);
    if (ui.breadthVal) ui.breadthVal.textContent = state.pathBreadthQ.toFixed(2);
    if (activeStimulus) {
      const activeId = activeStimulus.id;
      const wasRunning = state.running && !state.paused;
      setActiveStimulus(activeId);
      if (wasRunning) play();
      else renderHud();
    }
  });
}

ui.stimSelect.addEventListener("change", () => {
  const id = ui.stimSelect.value;
  const ok = setActiveStimulus(id);
  if (!ok) {
    setStatus(`missing stimulus "${id}"`);
    return;
  }
  if (state.running && !state.paused) {
    state.t = 0;
    state.lastMs = performance.now();
    emit("stimflow:play", {
      stimulus_id: activeStimulus.id,
      mode: state.mode,
      speed: state.speed,
      gain: state.gain,
      build_id: STIMFLOW_BUILD_ID,
    });
  }
});

if (ui.compareModeSelect) {
  ui.compareModeSelect.addEventListener("change", () => {
    const mode = safeText(ui.compareModeSelect.value, "off").toLowerCase();
    state.compareMode = mode === "overlay" || mode === "difference" ? mode : "off";
    populateCompareStimuliSelect(state.compareStimulusId);
    rebuildCompareModel();
    rebuildEdges();
    applyActivationAtTime(state.t);
    renderHud();
  });
}

if (ui.stimCompareSelect) {
  ui.stimCompareSelect.addEventListener("change", () => {
    state.compareStimulusId = safeText(ui.stimCompareSelect.value);
    rebuildCompareModel(state.compareStimulusId);
    rebuildEdges();
    applyActivationAtTime(state.t);
    renderHud();
  });
}

if (ui.basisSelect) {
  ui.basisSelect.addEventListener("change", () => {
    const keepStimulusId = ui.stimSelect.value || activeStimulus?.id || "";
    setActiveLibrary(ui.basisSelect.value, keepStimulusId);
    if (state.running && !state.paused) {
      state.t = 0;
      state.lastMs = performance.now();
    }
    renderHud();
  });
}

if (ui.graphSelect) {
  ui.graphSelect.addEventListener("change", () => {
    const mode = normalizeGraphMode(ui.graphSelect.value);
    const url = new URL(window.location.href);
    url.searchParams.set("graph_mode", mode);
    url.searchParams.set("path_breadth_q", state.pathBreadthQ.toFixed(2));
    window.location.href = url.toString();
  });
}

ui.toggleEdges.addEventListener("change", () => {
  state.edgesOn = ui.toggleEdges.checked;
  rebuildEdges();
});

if (ui.togglePathOnly) {
  ui.togglePathOnly.addEventListener("change", () => {
    state.pathOnly = ui.togglePathOnly.checked;
    rebuildEdges();
  });
}

if (ui.toggleReachedOnly) {
  ui.toggleReachedOnly.addEventListener("change", () => {
    state.reachedOnly = ui.toggleReachedOnly.checked;
    applyActivationAtTime(state.t);
    renderHud();
  });
}

if (ui.toggleRadiation) {
  ui.toggleRadiation.addEventListener("change", () => {
    state.radiationOn = ui.toggleRadiation.checked;
    if (nodeHaloMesh) nodeHaloMesh.visible = state.radiationOn;
    applyActivationAtTime(state.t);
    renderHud();
  });
}

if (ui.toggleHoverGroup) {
  ui.toggleHoverGroup.addEventListener("change", () => {
    state.hoverGroupOn = ui.toggleHoverGroup.checked;
    updateHoverGroup();
    applyNodeStyle();
    renderHud();
  });
}

ui.toggleHull.addEventListener("change", () => {
  state.hullOn = ui.toggleHull.checked;
  if (hullGroup) hullGroup.visible = state.hullOn;
  renderHud();
});

if (ui.hullOpacityRange) {
  ui.hullOpacityRange.addEventListener("input", () => {
    applyHullOpacity(ui.hullOpacityRange.value);
    renderHud();
  });
}

ui.toggleAuto.addEventListener("change", () => {
  setAutoRotateEnabled(ui.toggleAuto.checked, true);
  renderHud();
});

ui.edgeThresh.addEventListener("input", () => {
  state.edgeThreshold = Number(ui.edgeThresh.value) || 0;
  ui.edgeVal.textContent = state.edgeThreshold.toFixed(2);
  rebuildEdges();
});

ui.btnReset.addEventListener("click", () => {
  cancelCameraFocusTween();
  controls.reset();
  renderHud();
});

function animate(nowMs) {
  requestAnimationFrame(animate);

  if (state.running && !state.paused) {
    if (!state.lastMs) state.lastMs = nowMs;
    const dt = Math.max(0, (nowMs - state.lastMs) / 1000);
    state.lastMs = nowMs;
    const prevT = state.t;
    state.t += dt * state.speed;

    const finished = state.t >= state.durationS;
    let loopRestarted = false;
    if (finished) {
      if (state.mode === "loop") {
        state.t = 0;
        loopRestarted = true;
        updateNarrationCursorFromTime();
      } else {
        state.t = state.durationS;
        state.running = false;
        state.paused = false;
        setStatus("completed");
      }
    }

    applyActivationAtTime(state.t);
    if (!loopRestarted) narrateProgress(prevT, state.t);
    if (loopRestarted && state.narrationOn) {
      refreshNarrationStatus("Narration: loop restart");
    }
    if (loopRestarted) {
      syncTextNarrationToTime(state.t, { rebuild: true, reason: "Loop restart." });
    } else {
      syncTextNarrationToTime(state.t);
    }
    emit("stimflow:frame", {
      stimulus_id: activeStimulus?.id || null,
      t: state.t,
      speed: state.speed,
      gain: state.gain,
      build_id: STIMFLOW_BUILD_ID,
    });
  }

  if (!state.autoRotate) {
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
  }
  updateCameraFocusTween(nowMs);
  controls.update();
  renderer.render(scene, camera);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MAX_RENDER_PIXEL_RATIO));
  if (!window.matchMedia("(max-width: 520px), (pointer: coarse)").matches) {
    closeMobileOverlays();
  }
});

async function loadGraph() {
  const mode = normalizeGraphMode(state.graphMode);
  if (mode === "core") {
    return await fetchJson(GRAPH_URL, "aal_graph.json");
  }

  if (mode === "dense") {
    try {
      return await fetchJson(GRAPH_DENSE_URL, "aal_graph_dense.json");
    } catch (err) {
      console.warn("Dense graph unavailable, falling back to core graph:", err);
      return await fetchJson(GRAPH_URL, "aal_graph.json");
    }
  }

  try {
    return await fetchJson(GRAPH_DENSE_URL, "aal_graph_dense.json");
  } catch (err) {
    console.warn("Dense graph unavailable, falling back to core graph:", err);
    return await fetchJson(GRAPH_URL, "aal_graph.json");
  }
}

async function fetchJson(url, label) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${label} HTTP ${r.status}`);
  return await r.json();
}

async function loadHullObj() {
  const loader = new OBJLoader();
  return await loader.loadAsync(HULL_URL);
}

async function loadTemplateStimulusLibrary() {
  try {
    const fromLibrary = await fetchJson(STIMULI_LIBRARY_URL, "stimuli.library.json");
    return normalizeStimulusLibrary(fromLibrary, "stimuli.library.json");
  } catch (err) {
    console.warn("Stimulus library load failed, falling back to template:", err);
  }

  const fromTemplate = await fetchJson(STIMULI_TEMPLATE_URL, "stimuli.template.json");
  return normalizeStimulusLibrary(fromTemplate, "stimuli.template.json");
}

async function loadEmpiricalStimulusLibrary() {
  const raw = await fetchJson(STIMULI_EMPIRICAL_URL, "stimuli.empirical.json");
  return normalizeStimulusLibrary(raw, "stimuli.empirical.json");
}

async function loadStimulusLibraries() {
  const libs = { template: null, empirical: null };

  try {
    libs.empirical = await loadEmpiricalStimulusLibrary();
  } catch (err) {
    console.warn("Empirical stimulus library unavailable:", err);
  }

  try {
    libs.template = await loadTemplateStimulusLibrary();
  } catch (err) {
    console.warn("Template stimulus library unavailable:", err);
  }

  if (!libs.empirical && !libs.template) {
    throw new Error("No valid stimulus libraries available");
  }

  return libs;
}

async function loadConnectivitySpec() {
  connectivitySourceName = "";
  connectivitySpec = null;
  connectivityByStimulus.clear();
  activeConnectivityMap = null;
  activeConnectivityEdgeCount = 0;
  updateConnectivityStatus();

  try {
    const raw = await fetchJson(CONNECTIVITY_EMPIRICAL_URL, "connectivity.empirical.json");
    const spec = normalizeConnectivitySpec(raw);
    connectivitySpec = spec;
    buildConnectivityMaps(spec);
    connectivitySourceName = spec.source_name;
  } catch (err) {
    console.warn("Connectivity matrix unavailable; using baseline graph weights:", err);
    connectivitySourceName = "graph-only";
  }

  applyStimulusConnectivity(activeStimulus?.id || null);
  updateConnectivityStatus();
}

async function loadRegionCards() {
  try {
    regionCards = await fetchJson(REGION_CARDS_URL, "aal_region_cards.json");
    regionCardLookup.clear();
    const cards = regionCards?.cards || {};
    for (const [label, card] of Object.entries(cards)) {
      regionCardLookup.set(label, card);
      const canonical = resolveAalAlias(label);
      regionCardLookup.set(canonical, card);

      const legacy = CARD_LABEL_ALIASES.get(label) || CARD_LABEL_ALIASES.get(canonical);
      if (legacy) regionCardLookup.set(legacy, card);

      if (Array.isArray(card.aliases)) {
        for (const alias of card.aliases) {
          if (alias) regionCardLookup.set(alias, card);
        }
      }
    }
  } catch (err) {
    console.warn("Region cards load failed:", err);
    regionCards = null;
    regionCardLookup.clear();
  }
}

const STIMULUS_GROUP_ORDER = [
  "Clinical Medications (ED/ICU/Med-Surg)",
  "OTC Medications (Generic)",
  "Sensory and Motor",
  "Pain and Somatosensory",
  "Emotion and Threat",
  "Reward and Motivation",
  "Learning, Memory, and Sleep",
  "Drugs and Substance Effects",
  "Other Educational Stimuli",
];

function classifyStimulusGroup(stim) {
  const id = safeText(stim?.id).toLowerCase();
  const label = safeText(stim?.label).toLowerCase();
  const evidence = safeText(stim?.evidence_type).toLowerCase();
  const text = `${id} ${label} ${evidence}`;

  if (text.includes("inpatient medication template")) {
    return "Clinical Medications (ED/ICU/Med-Surg)";
  }

  if (text.includes("otc medication template")) {
    return "OTC Medications (Generic)";
  }

  if (
    /(acetaminophen|ibuprofen|naproxen|aspirin|diclofenac|diphenhydramine|doxylamine|dextromethorphan|guaifenesin|pseudoephedrine|phenylephrine|loratadine|cetirizine|fexofenadine|famotidine|omeprazole|loperamide|bismuth|calcium carbonate|magnesium hydroxide|polyethylene glycol|senna|psyllium|meclizine|dimenhydrinate|melatonin|nicotine replacement|naloxone nasal)/.test(text)
  ) {
    return "OTC Medications (Generic)";
  }

  if (
    /(morphine|fentanyl|hydromorphone|oxycodone|ketorolac|ondansetron|metoclopramide|pantoprazole|enoxaparin|heparin|insulin|metoprolol|labetalol|furosemide|ceftriaxone|vancomycin|piperacillin|albuterol|ipratropium|dexamethasone|lorazepam|propofol|norepinephrine|losartan|clonazepam|klonopin)/.test(text)
  ) {
    return "Clinical Medications (ED/ICU/Med-Surg)";
  }

  if (/(pain|pinprick|nocicept|somatosensory|analgesi)/.test(text)) {
    return "Pain and Somatosensory";
  }

  if (/(fear|threat|anx|stress|salience|emotion|joy|sad|anger|disgust|surprise|love|hate|empathy|guilt|shame|trust|jealous|envy|awe|frustration)/.test(text)) {
    return "Emotion and Threat";
  }

  if (/(reward|surprise|motivat|dopamin)/.test(text)) {
    return "Reward and Motivation";
  }

  if (/(learning|memory|sleep|wake|consolidat)/.test(text)) {
    return "Learning, Memory, and Sleep";
  }

  if (/(music|auditory|hearing|visual|motor|tapping|language|speech)/.test(text)) {
    return "Sensory and Motor";
  }

  if (/(psilocybin|hallucin|lsd|cannabis|thc|alcohol|nicotine|caffeine|drug|substance)/.test(text)) {
    return "Drugs and Substance Effects";
  }

  return "Other Educational Stimuli";
}

function populateStimuliSelect(preferredId = "") {
  if (!stimulusLibrary) return;
  ui.stimSelect.innerHTML = "";

  const baselineGroup = document.createElement("optgroup");
  baselineGroup.label = "Atlas and Baseline";

  const atlasOpt = document.createElement("option");
  atlasOpt.value = ATLAS_MODE_ID;
  atlasOpt.textContent = "Atlas explore (no stimulus)";
  baselineGroup.appendChild(atlasOpt);

  const restingStimulus = (stimulusLibrary.stimuli || []).find((stim) => stim.id === DEFAULT_STIMULUS_ID);
  if (restingStimulus) {
    const restingOpt = document.createElement("option");
    restingOpt.value = restingStimulus.id;
    restingOpt.textContent = stimulusDisplayLabel(restingStimulus);
    baselineGroup.appendChild(restingOpt);
  }
  ui.stimSelect.appendChild(baselineGroup);

  const grouped = new Map();
  for (const groupName of STIMULUS_GROUP_ORDER) grouped.set(groupName, []);

  for (const stim of stimulusLibrary.stimuli || []) {
    if (stim.id === DEFAULT_STIMULUS_ID) continue;
    const groupName = classifyStimulusGroup(stim);
    if (!grouped.has(groupName)) grouped.set(groupName, []);
    grouped.get(groupName).push(stim);
  }

  for (const groupName of STIMULUS_GROUP_ORDER) {
    const items = grouped.get(groupName) || [];
    if (!items.length) continue;

    const optgroup = document.createElement("optgroup");
    optgroup.label = groupName;

    items.sort((a, b) => stimulusDisplayLabel(a).localeCompare(stimulusDisplayLabel(b)));
    for (const stim of items) {
      const opt = document.createElement("option");
      opt.value = stim.id;
      opt.textContent = stimulusDisplayLabel(stim);
      optgroup.appendChild(opt);
    }
    ui.stimSelect.appendChild(optgroup);
  }

  const ids = (stimulusLibrary.stimuli || []).map((s) => s.id);
  const candidates = [
    DEFAULT_STIMULUS_ID,
    preferredId,
    activeStimulus?.id || "",
    "music",
    ids[0] || "",
  ];
  const validIds = new Set([ATLAS_MODE_ID, ...ids]);
  const defaultId = candidates.find((id) => id && validIds.has(id)) || "";
  if (defaultId) {
    ui.stimSelect.value = defaultId;
    setActiveStimulus(defaultId);
  }
}

function populateCompareStimuliSelect(preferredId = "") {
  if (!ui.stimCompareSelect || !stimulusLibrary) return;
  ui.stimCompareSelect.innerHTML = "";

  for (const stim of stimulusLibrary.stimuli || []) {
    const opt = document.createElement("option");
    opt.value = stim.id;
    opt.textContent = stimulusDisplayLabel(stim);
    ui.stimCompareSelect.appendChild(opt);
  }

  const ids = (stimulusLibrary.stimuli || []).map((s) => s.id);
  let targetId = preferredId || state.compareStimulusId || "";
  if (!targetId || !ids.includes(targetId) || targetId === activeStimulus?.id) {
    targetId = ids.find((id) => id !== activeStimulus?.id) || "";
  }
  state.compareStimulusId = targetId;
  if (targetId) ui.stimCompareSelect.value = targetId;
}

function setActiveLibrary(preferredMode, preferredStimulusId = "") {
  const mode = resolveLibraryMode(preferredMode);
  if (!mode) {
    throw new Error("No stimulus library available");
  }

  state.libraryMode = mode;
  stimulusLibrary = stimulusLibraries[mode];
  if (ui.basisSelect) ui.basisSelect.value = mode;
  updateBasisStatus();
  setExportStatus("ready");
  populateStimuliSelect(preferredStimulusId);
  populateCompareStimuliSelect(state.compareStimulusId);
  rebuildCompareModel();
  emit("stimflow:library-change", {
    basis: mode,
    source_name: stimulusLibrary?.source_name || "unknown",
    build_id: STIMFLOW_BUILD_ID,
  });
}

setupMobileOverlayControls();
syncUI();
setAutoRotateEnabled(state.autoRotate, false);
renderTimeline();
renderHud();
requestAnimationFrame(animate);

(async () => {
  try {
    hud(`${MILESTONE_LABEL}\nPreparing brain map...`);
    graph = await loadGraph();
    addNodes(graph);
    rebuildEdges();

    hud(`${MILESTONE_LABEL}\nLoading region notes...`);
    await loadRegionCards();

    hud(`${MILESTONE_LABEL}\nLoading scenarios...`);
    stimulusLibraries = await loadStimulusLibraries();

    hud(`${MILESTONE_LABEL}\nPreparing network pathways...`);
    await loadConnectivitySpec();

    setActiveLibrary(state.libraryMode, DEFAULT_STIMULUS_ID);

    hud(`${MILESTONE_LABEL}\nLoading cortex layer...`);
    try {
      const hullObj = await loadHullObj();
      addHull(hullObj);
    } catch (e) {
      console.warn("Cortex layer load failed:", e);
    }

    applyActivationAtTime(state.t);
    renderHud();
    play();
  } catch (e) {
    console.error(e);
    hud(`${MILESTONE_LABEL}\nUnable to load viewer\n${e.message}`, true);
    setStatus("error");
  }
})();
