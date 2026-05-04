export type OperationId = "ghost-signal" | "storm-window" | "cinder-vector";

export type LoadoutId = "ghostweave" | "breach-rig" | "vanguard-shell";

export type SkillId =
  | "shadow-mesh"
  | "route-memory"
  | "servo-brace"
  | "kill-chain"
  | "ghost-handshake"
  | "relay-savant"
  | "thruster-line"
  | "mag-clamp";

export type SkillTrack = "infiltration" | "combat" | "cyberwarfare" | "mobility";

export type OperationDefinition = {
  id: OperationId;
  name: string;
  risk: string;
  summary: string;
  modifiers: {
    extraGuard: boolean;
    guardSpeedMultiplier: number;
    suspicionMultiplier: number;
    guardHealthBonus: number;
    droneHealthBonus: number;
    turretHealthBonus: number;
    enemyFireRateMultiplier: number;
  };
  tags: string[];
};

export type LoadoutDefinition = {
  id: LoadoutId;
  name: string;
  role: string;
  summary: string;
  perks: string[];
  modifiers: {
    maxHealth: number;
    sprintMultiplier: number;
    fireCooldownMultiplier: number;
    damagePerShot: number;
    detectionMultiplier: number;
    interactionSpeedMultiplier: number;
    scanCooldownMultiplier: number;
    scanDurationMultiplier: number;
    incomingDamageMultiplier: number;
  };
};

export type SkillDefinition = {
  id: SkillId;
  name: string;
  track: SkillTrack;
  tier: 1 | 2;
  cost: number;
  summary: string;
  requirements: SkillId[];
  modifiers: {
    maxHealthBonus?: number;
    sprintMultiplier?: number;
    fireCooldownMultiplier?: number;
    damageBonus?: number;
    detectionMultiplier?: number;
    interactionSpeedMultiplier?: number;
    scanCooldownMultiplier?: number;
    scanDurationMultiplier?: number;
    incomingDamageMultiplier?: number;
  };
};

export type ResolvedPlayerModifiers = {
  maxHealth: number;
  sprintMultiplier: number;
  fireCooldownMultiplier: number;
  damagePerShot: number;
  detectionMultiplier: number;
  interactionSpeedMultiplier: number;
  scanCooldownMultiplier: number;
  scanDurationMultiplier: number;
  incomingDamageMultiplier: number;
};

export type CampaignPressureTone = "stable" | "heated" | "critical";

export type CampaignPressure = {
  blackGlassHeat: number;
  evacuationLaneStability: number;
  safehouseExposure: number;
  guardSpeedMultiplier: number;
  suspicionMultiplier: number;
  enemyFireRateMultiplier: number;
  directive: string;
  summary: string;
  tags: string[];
  tone: CampaignPressureTone;
};

export type MissionConfig = {
  operation: OperationDefinition;
  loadout: LoadoutDefinition;
  skills: SkillDefinition[];
  playerModifiers: ResolvedPlayerModifiers;
  campaignPressure: CampaignPressure;
};

export const OPERATIONS: OperationDefinition[] = [
  {
    id: "ghost-signal",
    name: "Ghost Signal",
    risk: "Controlled",
    summary:
      "Balanced retrieval contract. Patrol rhythm stays readable, the breach window is stable, and the dock behaves like the clean benchmark run.",
    modifiers: {
      extraGuard: false,
      guardSpeedMultiplier: 1,
      suspicionMultiplier: 1,
      guardHealthBonus: 0,
      droneHealthBonus: 0,
      turretHealthBonus: 0,
      enemyFireRateMultiplier: 1,
    },
    tags: ["Baseline patrol lattice", "Balanced lockdown", "Best for route learning"],
  },
  {
    id: "storm-window",
    name: "Storm Window",
    risk: "Elevated",
    summary:
      "A stormfront is scrubbing civilian traffic and the dock is running hot. Patrols move harder, suspicion spikes faster, and another sentinel is roaming the hangar spine.",
    modifiers: {
      extraGuard: true,
      guardSpeedMultiplier: 1.12,
      suspicionMultiplier: 1.24,
      guardHealthBonus: 0,
      droneHealthBonus: 1,
      turretHealthBonus: 0,
      enemyFireRateMultiplier: 0.92,
    },
    tags: ["Extra sentinel", "Sharper stealth pressure", "Faster hostile fire"],
  },
  {
    id: "cinder-vector",
    name: "Cinder Vector",
    risk: "Severe",
    summary:
      "Black Glass is already hunting the leak. The relay drone is hardened, the turret comes up heavier, and the exit expects a louder break than a silent drift.",
    modifiers: {
      extraGuard: false,
      guardSpeedMultiplier: 1.06,
      suspicionMultiplier: 1.08,
      guardHealthBonus: 1,
      droneHealthBonus: 2,
      turretHealthBonus: 2,
      enemyFireRateMultiplier: 0.84,
    },
    tags: ["Reinforced lockdown", "Tougher combat finish", "High extraction pressure"],
  },
];

export const LOADOUTS: LoadoutDefinition[] = [
  {
    id: "ghostweave",
    name: "Ghostweave",
    role: "Stealth scout",
    summary:
      "Light carbon weave and a tuned scan lattice for operators who want route clarity before the dock ever knows they were there.",
    perks: ["Lower visual exposure", "Faster scan recharge", "Longer patrol reveal"],
    modifiers: {
      maxHealth: 90,
      sprintMultiplier: 1.08,
      fireCooldownMultiplier: 1.08,
      damagePerShot: 1,
      detectionMultiplier: 0.72,
      interactionSpeedMultiplier: 1,
      scanCooldownMultiplier: 0.72,
      scanDurationMultiplier: 1.18,
      incomingDamageMultiplier: 1.12,
    },
  },
  {
    id: "breach-rig",
    name: "Breach Rig",
    role: "Objective runner",
    summary:
      "The practical contract kit. Strongest on terminal work, core grabs, and exfil under pressure without leaning too hard into either stealth or brute force.",
    perks: ["Faster breach actions", "Balanced survivability", "Stable trigger cadence"],
    modifiers: {
      maxHealth: 104,
      sprintMultiplier: 1,
      fireCooldownMultiplier: 1,
      damagePerShot: 1,
      detectionMultiplier: 1,
      interactionSpeedMultiplier: 1.38,
      scanCooldownMultiplier: 1,
      scanDurationMultiplier: 1,
      incomingDamageMultiplier: 1,
    },
  },
  {
    id: "vanguard-shell",
    name: "Vanguard Shell",
    role: "Combat anchor",
    summary:
      "Heavier plating and a hotter carbine package for runs where the dock is expected to go loud. You trade subtlety and speed for decisive lockdown control.",
    perks: ["More health", "Heavier pulse damage", "Lower incoming punishment"],
    modifiers: {
      maxHealth: 128,
      sprintMultiplier: 0.94,
      fireCooldownMultiplier: 0.82,
      damagePerShot: 2,
      detectionMultiplier: 1.16,
      interactionSpeedMultiplier: 0.94,
      scanCooldownMultiplier: 1.14,
      scanDurationMultiplier: 0.92,
      incomingDamageMultiplier: 0.82,
    },
  },
];

export const SKILLS: SkillDefinition[] = [
  {
    id: "shadow-mesh",
    name: "Shadow Mesh",
    track: "infiltration",
    tier: 1,
    cost: 1,
    summary: "Suppresses silhouette bleed against the patrol lattice and keeps suspicion lower during long sightline crossings.",
    requirements: [],
    modifiers: {
      detectionMultiplier: 0.88,
    },
  },
  {
    id: "route-memory",
    name: "Route Memory",
    track: "infiltration",
    tier: 2,
    cost: 1,
    summary: "Operators hold patrol cadence longer after a sweep, stretching scan value deeper into the route.",
    requirements: ["shadow-mesh"],
    modifiers: {
      scanDurationMultiplier: 1.16,
      scanCooldownMultiplier: 0.92,
    },
  },
  {
    id: "servo-brace",
    name: "Servo Brace",
    track: "combat",
    tier: 1,
    cost: 1,
    summary: "Armature reinforcement steadies the weapon package and lets the carbine cycle harder under pressure.",
    requirements: [],
    modifiers: {
      fireCooldownMultiplier: 0.9,
    },
  },
  {
    id: "kill-chain",
    name: "Kill Chain",
    track: "combat",
    tier: 2,
    cost: 1,
    summary: "Hotter pulse regulation pushes more damage through drones and turret armor once the dock goes loud.",
    requirements: ["servo-brace"],
    modifiers: {
      damageBonus: 1,
    },
  },
  {
    id: "ghost-handshake",
    name: "Ghost Handshake",
    track: "cyberwarfare",
    tier: 1,
    cost: 1,
    summary: "Breach routines cut cleaner into dock systems, trimming objective hold time on terminals and extraction hardware.",
    requirements: [],
    modifiers: {
      interactionSpeedMultiplier: 1.14,
    },
  },
  {
    id: "relay-savant",
    name: "Relay Savant",
    track: "cyberwarfare",
    tier: 2,
    cost: 1,
    summary: "Scan lattice tuning sharpens sweep cadence and reduces downtime between battlefield reads.",
    requirements: ["ghost-handshake"],
    modifiers: {
      scanCooldownMultiplier: 0.82,
    },
  },
  {
    id: "thruster-line",
    name: "Thruster Line",
    track: "mobility",
    tier: 1,
    cost: 1,
    summary: "Hip-thruster timing carries more speed through the dock and helps the operator reset angles faster after exposure.",
    requirements: [],
    modifiers: {
      sprintMultiplier: 1.08,
    },
  },
  {
    id: "mag-clamp",
    name: "Mag Clamp",
    track: "mobility",
    tier: 2,
    cost: 1,
    summary: "Smart clamp plates spread kinetic punishment across the suit, raising survivability without turning the runner into a tank.",
    requirements: ["thruster-line"],
    modifiers: {
      maxHealthBonus: 14,
      incomingDamageMultiplier: 0.9,
    },
  },
];

export const DEFAULT_OPERATION_ID: OperationId = "ghost-signal";

export const DEFAULT_LOADOUT_ID: LoadoutId = "breach-rig";

export const DEFAULT_CAMPAIGN_PRESSURE: CampaignPressure = {
  blackGlassHeat: 34,
  evacuationLaneStability: 52,
  safehouseExposure: 18,
  guardSpeedMultiplier: 1,
  suspicionMultiplier: 1,
  enemyFireRateMultiplier: 1,
  directive: "Kestrel wants a disciplined lift while the lane is still recoverable.",
  summary:
    "Black Glass has not locked the district down yet. The lane is bruised, the safehouse still holds cover, and a clean recovery can still shift the board.",
  tags: ["Measured pressure", "Lane still recoverable", "Safehouse cover intact"],
  tone: "stable",
};

export function getOperation(operationId: OperationId): OperationDefinition {
  return OPERATIONS.find((operation) => operation.id === operationId) ?? OPERATIONS[0];
}

export function getLoadout(loadoutId: LoadoutId): LoadoutDefinition {
  return LOADOUTS.find((loadout) => loadout.id === loadoutId) ?? LOADOUTS[0];
}

export function getSkill(skillId: SkillId): SkillDefinition | null {
  return SKILLS.find((skill) => skill.id === skillId) ?? null;
}

function resolvePlayerModifiers(loadout: LoadoutDefinition, unlockedSkillIds: SkillId[]): ResolvedPlayerModifiers {
  const resolved: ResolvedPlayerModifiers = {
    ...loadout.modifiers,
  };

  unlockedSkillIds.forEach((skillId) => {
    const skill = getSkill(skillId);
    if (!skill) {
      return;
    }

    if (skill.modifiers.maxHealthBonus) {
      resolved.maxHealth += skill.modifiers.maxHealthBonus;
    }
    if (skill.modifiers.sprintMultiplier) {
      resolved.sprintMultiplier *= skill.modifiers.sprintMultiplier;
    }
    if (skill.modifiers.fireCooldownMultiplier) {
      resolved.fireCooldownMultiplier *= skill.modifiers.fireCooldownMultiplier;
    }
    if (skill.modifiers.damageBonus) {
      resolved.damagePerShot += skill.modifiers.damageBonus;
    }
    if (skill.modifiers.detectionMultiplier) {
      resolved.detectionMultiplier *= skill.modifiers.detectionMultiplier;
    }
    if (skill.modifiers.interactionSpeedMultiplier) {
      resolved.interactionSpeedMultiplier *= skill.modifiers.interactionSpeedMultiplier;
    }
    if (skill.modifiers.scanCooldownMultiplier) {
      resolved.scanCooldownMultiplier *= skill.modifiers.scanCooldownMultiplier;
    }
    if (skill.modifiers.scanDurationMultiplier) {
      resolved.scanDurationMultiplier *= skill.modifiers.scanDurationMultiplier;
    }
    if (skill.modifiers.incomingDamageMultiplier) {
      resolved.incomingDamageMultiplier *= skill.modifiers.incomingDamageMultiplier;
    }
  });

  resolved.damagePerShot = Math.max(1, resolved.damagePerShot);
  resolved.maxHealth = Math.max(60, resolved.maxHealth);
  return resolved;
}

export function createMissionConfig(
  operationId: OperationId,
  loadoutId: LoadoutId,
  unlockedSkillIds: SkillId[] = [],
  campaignPressure: CampaignPressure = DEFAULT_CAMPAIGN_PRESSURE,
): MissionConfig {
  const loadout = getLoadout(loadoutId);
  const skills = unlockedSkillIds
    .map((skillId) => getSkill(skillId))
    .filter((skill): skill is SkillDefinition => Boolean(skill));

  return {
    operation: getOperation(operationId),
    loadout,
    skills,
    playerModifiers: resolvePlayerModifiers(loadout, unlockedSkillIds),
    campaignPressure,
  };
}
