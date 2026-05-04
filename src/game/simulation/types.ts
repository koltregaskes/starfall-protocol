export type MissionPhase = "briefing" | "mission" | "paused" | "failed" | "complete" | "insertion";

export type ObjectiveId = "insert" | "survey" | "hack" | "collect" | "combat" | "extract";

export type Vec2 = {
  x: number;
  z: number;
};

export type InputSnapshot = {
  moveX: number;
  moveY: number;
  sprint: boolean;
  interactHeld: boolean;
  interactPressed: boolean;
  scanPressed: boolean;
  firePressed: boolean;
  pausePressed: boolean;
  intelPressed: boolean;
};

export type RectObstacle = {
  id: string;
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  height: number;
  blocksSight?: boolean;
};

export type PlayerState = {
  position: Vec2;
  facing: number;
  radius: number;
  maxHealth: number;
  health: number;
  fireCooldown: number;
  shotFlash: number;
  scanCooldown: number;
  scanRevealTimer: number;
};

export type GuardState = {
  id: string;
  type: "guard" | "drone";
  position: Vec2;
  facing: number;
  route: Vec2[];
  routeIndex: number;
  health: number;
  alert: boolean;
  suspicion: number;
  active: boolean;
  down: boolean;
  speed: number;
  attackCooldown: number;
};

export type TurretState = {
  position: Vec2;
  health: number;
  active: boolean;
  destroyed: boolean;
  attackCooldown: number;
  facing: number;
};

export type ProjectileState = {
  id: number;
  owner: "player" | "enemy";
  position: Vec2;
  velocity: Vec2;
  life: number;
  height: number;
};

export type PromptState = {
  text: string;
  progress: number;
};

export type UiState = {
  objective: string;
  objectiveDetail: string;
  location: string;
  tutorial: string;
  prompt: PromptState | null;
  callout: string;
  intelOpen: boolean;
  exposure: number;
  alarm: boolean;
};

export type MissionStats = {
  scansUsed: number;
  shotsFired: number;
  enemiesNeutralized: number;
  damageTaken: number;
  alarmsTriggered: number;
};

export type GameEvent =
  | { type: "message"; text: string }
  | { type: "sfx"; cue: "deploy" | "scan" | "hack" | "alarm" | "shot" | "impact" | "success" | "fail" | "ui" };

export type SimulationState = {
  phase: MissionPhase;
  elapsed: number;
  objective: ObjectiveId;
  player: PlayerState;
  guards: GuardState[];
  turret: TurretState;
  projectiles: ProjectileState[];
  ui: UiState;
  alert: boolean;
  doorOpen: boolean;
  coreCollected: boolean;
  extractionReady: boolean;
  insertionComplete: boolean;
  scanComplete: boolean;
  hackComplete: boolean;
  combatComplete: boolean;
  interactionTarget: string | null;
  interactionProgress: number;
  messageTtl: number;
  stats: MissionStats;
  reviewWalkthrough: boolean;
  reviewWalkthroughTimer: number;
  reviewWalkthroughStage: number;
};
