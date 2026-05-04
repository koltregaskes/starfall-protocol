import {
  type CampaignPressure,
  getSkill,
  type LoadoutId,
  type MissionConfig,
  type OperationId,
  type SkillId,
} from "../content/progression";

const STORAGE_KEYS = ["starfall-protocol-career-v3", "starfall-protocol-career-v2"] as const;

type CareerRecord = {
  runs: number;
  completions: number;
  bestTimeSeconds: number | null;
};

export type CareerReport = {
  timestamp: string;
  operationName: string;
  loadoutName: string;
  outcome: "complete" | "failed";
  assessment: string;
  elapsedSeconds: number;
};

export type ConsequenceReport = {
  timestamp: string;
  title: string;
  body: string;
  tone: "stable" | "heated" | "critical";
};

export type CareerProfile = {
  version: 3;
  selectedOperationId: OperationId;
  selectedLoadoutId: LoadoutId;
  unlockedSkillIds: SkillId[];
  totalRuns: number;
  successfulRuns: number;
  seedsRecovered: number;
  blackGlassHeat: number;
  evacuationLaneStability: number;
  safehouseExposure: number;
  bestAssessment: string | null;
  bestTimeSeconds: number | null;
  recentReports: CareerReport[];
  consequenceReports: ConsequenceReport[];
  operationRecords: Record<OperationId, CareerRecord>;
  loadoutRecords: Record<LoadoutId, CareerRecord>;
};

function createRecord(): CareerRecord {
  return {
    runs: 0,
    completions: 0,
    bestTimeSeconds: null,
  };
}

function assessmentRank(assessment: string | null): number {
  const order = [
    "Ghost clean",
    "Cold extraction",
    "Hard exit",
    "Barely aboard",
    "Compromised",
    "Broken insertion",
  ];

  const index = order.indexOf(assessment ?? "");
  return index === -1 ? order.length : index;
}

function normalizeRecord(value: unknown): CareerRecord {
  if (!value || typeof value !== "object") {
    return createRecord();
  }

  const record = value as Partial<CareerRecord>;
  return {
    runs: typeof record.runs === "number" ? record.runs : 0,
    completions: typeof record.completions === "number" ? record.completions : 0,
    bestTimeSeconds: typeof record.bestTimeSeconds === "number" ? record.bestTimeSeconds : null,
  };
}

export function createDefaultProfile(): CareerProfile {
  return {
    version: 3,
    selectedOperationId: "ghost-signal",
    selectedLoadoutId: "breach-rig",
    unlockedSkillIds: [],
    totalRuns: 0,
    successfulRuns: 0,
    seedsRecovered: 0,
    blackGlassHeat: 34,
    evacuationLaneStability: 52,
    safehouseExposure: 18,
    bestAssessment: null,
    bestTimeSeconds: null,
    recentReports: [],
    consequenceReports: [],
    operationRecords: {
      "ghost-signal": createRecord(),
      "storm-window": createRecord(),
      "cinder-vector": createRecord(),
    },
    loadoutRecords: {
      ghostweave: createRecord(),
      "breach-rig": createRecord(),
      "vanguard-shell": createRecord(),
    },
  };
}

export function createReviewProfile(): CareerProfile {
  return {
    version: 3,
    selectedOperationId: "ghost-signal",
    selectedLoadoutId: "breach-rig",
    unlockedSkillIds: ["shadow-mesh", "ghost-handshake", "thruster-line", "servo-brace"],
    totalRuns: 7,
    successfulRuns: 5,
    seedsRecovered: 5,
    blackGlassHeat: 41,
    evacuationLaneStability: 64,
    safehouseExposure: 22,
    bestAssessment: "Ghost clean",
    bestTimeSeconds: 72.4,
    recentReports: [
      {
        timestamp: "2026-04-08T08:41:00.000Z",
        operationName: "Ghost Signal",
        loadoutName: "Breach Rig",
        outcome: "complete",
        assessment: "Ghost clean",
        elapsedSeconds: 72.4,
      },
      {
        timestamp: "2026-04-08T07:12:00.000Z",
        operationName: "Storm Window",
        loadoutName: "Ghostweave",
        outcome: "complete",
        assessment: "Cold extraction",
        elapsedSeconds: 86.1,
      },
      {
        timestamp: "2026-04-07T22:18:00.000Z",
        operationName: "Cinder Vector",
        loadoutName: "Vanguard Shell",
        outcome: "failed",
        assessment: "Compromised",
        elapsedSeconds: 63.9,
      },
    ],
    consequenceReports: [
      {
        timestamp: "2026-04-08T08:41:00.000Z",
        title: "Evacuation lane stabilized",
        body: "Ghost Signal cleared without a dirty signature. The civilian corridor is holding and Black Glass has not locked the dock into a full hunt.",
        tone: "stable",
      },
      {
        timestamp: "2026-04-08T07:12:00.000Z",
        title: "Pressure held, but not erased",
        body: "Storm Window came back aboard with visible heat. The route remains viable, but Kestrel still reads the district as heated whenever the dock goes loud.",
        tone: "heated",
      },
      {
        timestamp: "2026-04-07T22:18:00.000Z",
        title: "Black Glass counter-hunt accelerated",
        body: "Cinder Vector burned the approach. Safehouse cover survived, but the district now watches for repeat signatures on the berth spine.",
        tone: "critical",
      },
    ],
    operationRecords: {
      "ghost-signal": {
        runs: 3,
        completions: 3,
        bestTimeSeconds: 72.4,
      },
      "storm-window": {
        runs: 2,
        completions: 1,
        bestTimeSeconds: 86.1,
      },
      "cinder-vector": {
        runs: 2,
        completions: 1,
        bestTimeSeconds: 91.8,
      },
    },
    loadoutRecords: {
      ghostweave: {
        runs: 2,
        completions: 1,
        bestTimeSeconds: 86.1,
      },
      "breach-rig": {
        runs: 3,
        completions: 3,
        bestTimeSeconds: 72.4,
      },
      "vanguard-shell": {
        runs: 2,
        completions: 1,
        bestTimeSeconds: 91.8,
      },
    },
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readStoredProfile(): Partial<CareerProfile> | null {
  for (const storageKey of STORAGE_KEYS) {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      continue;
    }

    return JSON.parse(raw) as Partial<CareerProfile>;
  }

  return null;
}

export function loadCareerProfile(): CareerProfile {
  const fallback = createDefaultProfile();

  try {
    const parsed = readStoredProfile();
    if (!parsed) {
      return fallback;
    }

    const nextProfile: CareerProfile = {
      ...fallback,
      ...parsed,
      version: 3,
      selectedOperationId:
        parsed.selectedOperationId === "storm-window" || parsed.selectedOperationId === "cinder-vector"
          ? parsed.selectedOperationId
          : "ghost-signal",
      selectedLoadoutId:
        parsed.selectedLoadoutId === "ghostweave" ||
        parsed.selectedLoadoutId === "vanguard-shell" ||
        parsed.selectedLoadoutId === "breach-rig"
          ? parsed.selectedLoadoutId
          : "breach-rig",
      unlockedSkillIds: Array.isArray(parsed.unlockedSkillIds)
        ? parsed.unlockedSkillIds.filter((skillId): skillId is SkillId => Boolean(getSkill(skillId as SkillId)))
        : [],
      blackGlassHeat: clampPercent(typeof parsed.blackGlassHeat === "number" ? parsed.blackGlassHeat : fallback.blackGlassHeat),
      evacuationLaneStability: clampPercent(
        typeof parsed.evacuationLaneStability === "number" ? parsed.evacuationLaneStability : fallback.evacuationLaneStability,
      ),
      safehouseExposure: clampPercent(
        typeof parsed.safehouseExposure === "number" ? parsed.safehouseExposure : fallback.safehouseExposure,
      ),
      recentReports: Array.isArray(parsed.recentReports) ? parsed.recentReports.slice(0, 6) : [],
      consequenceReports: Array.isArray(parsed.consequenceReports)
        ? parsed.consequenceReports
            .filter((report): report is ConsequenceReport => Boolean(report && typeof report === "object"))
            .slice(0, 6)
        : [],
      operationRecords: {
        "ghost-signal": normalizeRecord(parsed.operationRecords?.["ghost-signal"]),
        "storm-window": normalizeRecord(parsed.operationRecords?.["storm-window"]),
        "cinder-vector": normalizeRecord(parsed.operationRecords?.["cinder-vector"]),
      },
      loadoutRecords: {
        ghostweave: normalizeRecord(parsed.loadoutRecords?.ghostweave),
        "breach-rig": normalizeRecord(parsed.loadoutRecords?.["breach-rig"]),
        "vanguard-shell": normalizeRecord(parsed.loadoutRecords?.["vanguard-shell"]),
      },
    };

    return nextProfile;
  } catch {
    return fallback;
  }
}

export function saveCareerProfile(profile: CareerProfile) {
  window.localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(profile));
}

export function updateCareerSelection(
  profile: CareerProfile,
  updates: Partial<Pick<CareerProfile, "selectedOperationId" | "selectedLoadoutId">>,
): CareerProfile {
  return {
    ...profile,
    ...updates,
  };
}

export function getAvailableSkillPoints(profile: CareerProfile): number {
  return Math.max(0, profile.seedsRecovered - profile.unlockedSkillIds.length);
}

export function canUnlockSkill(profile: CareerProfile, skillId: SkillId): boolean {
  const skill = getSkill(skillId);
  if (!skill || profile.unlockedSkillIds.includes(skillId)) {
    return false;
  }

  if (getAvailableSkillPoints(profile) < skill.cost) {
    return false;
  }

  return skill.requirements.every((requirement) => profile.unlockedSkillIds.includes(requirement));
}

export function unlockCareerSkill(profile: CareerProfile, skillId: SkillId): CareerProfile {
  if (!canUnlockSkill(profile, skillId)) {
    return profile;
  }

  return {
    ...profile,
    unlockedSkillIds: [...profile.unlockedSkillIds, skillId],
  };
}

export function deriveCampaignPressure(profile: CareerProfile): CampaignPressure {
  const heat = clampPercent(profile.blackGlassHeat);
  const lane = clampPercent(profile.evacuationLaneStability);
  const exposure = clampPercent(profile.safehouseExposure);

  const tone =
    heat >= 72 || exposure >= 68 || lane <= 30
      ? "critical"
      : heat >= 50 || exposure >= 45 || lane <= 45
        ? "heated"
        : "stable";

  const summary =
    tone === "critical"
      ? "Black Glass is narrowing the district and the safehouse is bleeding cover. The next insertion needs to buy room back, not just survive."
      : tone === "heated"
        ? "The board is tightening. The corridor is still recoverable, but patrol discipline and quiet exits matter now."
        : "The corridor still bends in your favor. Clean lifts are buying the evacuation lane time and keeping the safehouse off the main hunt.";

  const directive =
    lane <= 34
      ? "Route discipline takes priority. Civilian lane integrity is failing faster than the safehouse can replace it."
      : exposure >= 60
        ? "Keep the dock cold. Safehouse cover is thinning and another loud run will cost future freedom of movement."
        : heat >= 58
          ? "Black Glass is watching for repeat signatures. Break sightlines early and finish the route with minimal alarm time."
          : "Kestrel wants a disciplined lift while the lane is still recoverable.";

  const tags = [
    `Black Glass heat ${heat}%`,
    `Lane stability ${lane}%`,
    `Safehouse exposure ${exposure}%`,
  ];

  return {
    blackGlassHeat: heat,
    evacuationLaneStability: lane,
    safehouseExposure: exposure,
    guardSpeedMultiplier: Math.max(0.94, Math.min(1.16, 0.96 + (heat / 100) * 0.12 + (exposure / 100) * 0.06)),
    suspicionMultiplier: Math.max(
      0.88,
      Math.min(1.32, 0.9 + (heat / 100) * 0.24 + (exposure / 100) * 0.12 - (lane / 100) * 0.08),
    ),
    enemyFireRateMultiplier: Math.max(
      0.82,
      Math.min(1.08, 1.06 - (heat / 100) * 0.18 - (exposure / 100) * 0.12 + (lane / 100) * 0.06),
    ),
    directive,
    summary,
    tags,
    tone,
  };
}

function createConsequenceReport(
  config: MissionConfig,
  result: {
    outcome: "complete" | "failed";
    assessment: string;
    alarmsTriggered: number;
  },
  profile: CareerProfile,
): ConsequenceReport {
  const pressure = deriveCampaignPressure(profile);
  const cleanLift = result.outcome === "complete" && result.alarmsTriggered === 0;

  if (result.outcome === "failed") {
    return {
      timestamp: new Date().toISOString(),
      title:
        profile.safehouseExposure >= 65
          ? "Safehouse cover compromised"
          : pressure.blackGlassHeat >= 70
            ? "Black Glass counter-hunt accelerated"
            : "Evacuation window destabilized",
      body:
        `${config.operation.name} collapsed under the ${config.loadout.name} package. ` +
        `Black Glass pressure is now ${pressure.blackGlassHeat}% and lane stability has slipped to ${pressure.evacuationLaneStability}%.`,
      tone: pressure.tone,
    };
  }

  if (cleanLift) {
    return {
      timestamp: new Date().toISOString(),
      title: "Evacuation lane stabilized",
      body:
        `${config.operation.name} cleared without a dirty signature. The civilians' corridor climbed to ${pressure.evacuationLaneStability}% ` +
        `and Black Glass heat has been pushed back to ${pressure.blackGlassHeat}%.`,
      tone: pressure.tone,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    title: pressure.tone === "critical" ? "Clean lift, fragile board" : "Pressure held, but not erased",
    body:
      `${config.operation.name} closed as ${result.assessment.toLowerCase()} with ${result.alarmsTriggered} alarm${result.alarmsTriggered === 1 ? "" : "s"}. ` +
      `The route remains viable, but Kestrel still reads the district as ${pressure.tone}.`,
    tone: pressure.tone,
  };
}

export function recordCareerRun(
  profile: CareerProfile,
  config: MissionConfig,
  result: {
    outcome: "complete" | "failed";
    assessment: string;
    elapsedSeconds: number;
    alarmsTriggered: number;
    damageTaken: number;
    enemiesNeutralized: number;
  },
): CareerProfile {
  const success = result.outcome === "complete";
  const cleanLift = success && result.alarmsTriggered === 0 && result.damageTaken <= 16;
  const nextBlackGlassHeat = clampPercent(
    profile.blackGlassHeat +
      (success ? -6 : 12) +
      result.alarmsTriggered * 4 +
      Math.round(result.damageTaken / 20) +
      (cleanLift ? -4 : 0),
  );
  const nextLaneStability = clampPercent(
    profile.evacuationLaneStability +
      (success ? 8 : -11) +
      (cleanLift ? 4 : 0) -
      Math.min(result.alarmsTriggered * 2, 6) +
      (result.outcome === "failed" ? -2 : 0),
  );
  const nextSafehouseExposure = clampPercent(
    profile.safehouseExposure +
      (success ? -4 : 9) +
      result.alarmsTriggered * 3 +
      (result.outcome === "failed" ? 4 : 0) -
      (cleanLift ? 5 : 0),
  );
  const nextProfile: CareerProfile = {
    ...profile,
    totalRuns: profile.totalRuns + 1,
    successfulRuns: profile.successfulRuns + (success ? 1 : 0),
    seedsRecovered: profile.seedsRecovered + (success ? 1 : 0),
    blackGlassHeat: nextBlackGlassHeat,
    evacuationLaneStability: nextLaneStability,
    safehouseExposure: nextSafehouseExposure,
    bestAssessment:
      !profile.bestAssessment || assessmentRank(result.assessment) < assessmentRank(profile.bestAssessment)
        ? result.assessment
        : profile.bestAssessment,
    bestTimeSeconds:
      success && (profile.bestTimeSeconds === null || result.elapsedSeconds < profile.bestTimeSeconds)
        ? result.elapsedSeconds
        : profile.bestTimeSeconds,
    operationRecords: {
      ...profile.operationRecords,
      [config.operation.id]: {
        runs: profile.operationRecords[config.operation.id].runs + 1,
        completions: profile.operationRecords[config.operation.id].completions + (success ? 1 : 0),
        bestTimeSeconds:
          success &&
          (profile.operationRecords[config.operation.id].bestTimeSeconds === null ||
            result.elapsedSeconds < (profile.operationRecords[config.operation.id].bestTimeSeconds ?? Number.POSITIVE_INFINITY))
            ? result.elapsedSeconds
            : profile.operationRecords[config.operation.id].bestTimeSeconds,
      },
    },
    loadoutRecords: {
      ...profile.loadoutRecords,
      [config.loadout.id]: {
        runs: profile.loadoutRecords[config.loadout.id].runs + 1,
        completions: profile.loadoutRecords[config.loadout.id].completions + (success ? 1 : 0),
        bestTimeSeconds:
          success &&
          (profile.loadoutRecords[config.loadout.id].bestTimeSeconds === null ||
            result.elapsedSeconds < (profile.loadoutRecords[config.loadout.id].bestTimeSeconds ?? Number.POSITIVE_INFINITY))
            ? result.elapsedSeconds
            : profile.loadoutRecords[config.loadout.id].bestTimeSeconds,
      },
    },
    recentReports: [
      {
        timestamp: new Date().toISOString(),
        operationName: config.operation.name,
        loadoutName: config.loadout.name,
        outcome: result.outcome,
        assessment: result.assessment,
        elapsedSeconds: result.elapsedSeconds,
      },
      ...profile.recentReports,
    ].slice(0, 6),
    consequenceReports: profile.consequenceReports.slice(0, 6),
  };

  nextProfile.consequenceReports = [
    createConsequenceReport(config, result, nextProfile),
    ...nextProfile.consequenceReports,
  ].slice(0, 6);

  return nextProfile;
}
