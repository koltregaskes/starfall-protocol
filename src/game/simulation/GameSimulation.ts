import { COMMS_LINES, DOOR_OBSTACLE, GUARD_ROUTES, MISSION_POINTS, STATIC_OBSTACLES, WORLD_BOUNDS } from "../content/mission";
import type { MissionConfig } from "../content/progression";
import type {
  GameEvent,
  GuardState,
  InputSnapshot,
  ProjectileState,
  RectObstacle,
  SimulationState,
  TurretState,
  UiState,
  Vec2,
} from "./types";

const PLAYER_SPEED = 4.8;
const PLAYER_SPRINT_SPEED = 7.1;
const PLAYER_RADIUS = 0.55;
const FIRE_SPEED = 24;
const HOLD_DURATIONS = {
  insertion: 1.2,
  terminal: 1.9,
  core: 1.6,
  extraction: 1.5,
} as const;
const SCAN_DURATION = 3.6;
const SCAN_COOLDOWN = 6;
const ALERT_THRESHOLD = 1;

function clonePoint(point: Vec2): Vec2 {
  return { x: point.x, z: point.z };
}

function createUiState(): UiState {
  return {
    objective: "Stabilize insertion",
    objectiveDetail: "Hold E on the skiff ring to sync the breach route before you move.",
    location: "Skiff Berth",
    tutorial: "Move with WASD. Sprint with Shift. Stay low around the cargo stacks.",
    prompt: null,
    callout: COMMS_LINES.deploy,
    intelOpen: false,
    exposure: 0,
    alarm: false,
  };
}

function createGuardState(
  id: string,
  type: GuardState["type"],
  routeIndex: number,
  config: MissionConfig,
  facing = 0,
): GuardState {
  const route = GUARD_ROUTES[routeIndex];
  const speedMultiplier = config.operation.modifiers.guardSpeedMultiplier * config.campaignPressure.guardSpeedMultiplier;
  const healthBonus = type === "drone" ? config.operation.modifiers.droneHealthBonus : config.operation.modifiers.guardHealthBonus;

  return {
    id,
    type,
    position: clonePoint(route[0]),
    facing,
    route: route.map(clonePoint),
    routeIndex: 1,
    health: (type === "drone" ? 3 : 2) + healthBonus,
    alert: false,
    suspicion: 0,
    active: true,
    down: false,
    speed: (type === "drone" ? 2.85 : routeIndex === 2 ? 2.55 : 2.35) * speedMultiplier,
    attackCooldown: type === "drone" ? 0.9 : 1.1,
  };
}

function createGuards(config: MissionConfig): GuardState[] {
  const guards: GuardState[] = [
    createGuardState("sentinel-alpha", "guard", 0, config),
    createGuardState("relay-drone", "drone", 1, config, Math.PI),
  ];

  if (config.operation.modifiers.extraGuard) {
    guards.push(createGuardState("sentinel-beta", "guard", 2, config, Math.PI * 0.25));
  }

  return guards;
}

function createTurret(config: MissionConfig): TurretState {
  return {
    position: clonePoint(MISSION_POINTS.turret),
    health: 4 + config.operation.modifiers.turretHealthBonus,
    active: false,
    destroyed: false,
    attackCooldown: 0.7,
    facing: 0,
  };
}

function createState(config: MissionConfig): SimulationState {
  return {
    phase: "briefing",
    elapsed: 0,
    objective: "insert",
    player: {
      position: clonePoint(MISSION_POINTS.playerStart),
      facing: 1.82,
      radius: PLAYER_RADIUS,
      maxHealth: config.playerModifiers.maxHealth,
      health: config.playerModifiers.maxHealth,
      fireCooldown: 0,
      shotFlash: 0,
      scanCooldown: 0,
      scanRevealTimer: 0,
    },
    guards: createGuards(config),
    turret: createTurret(config),
    projectiles: [],
    ui: createUiState(),
    alert: false,
    doorOpen: false,
    coreCollected: false,
    extractionReady: false,
    insertionComplete: false,
    scanComplete: false,
    hackComplete: false,
    combatComplete: false,
    interactionTarget: null,
    interactionProgress: 0,
    messageTtl: 7,
    stats: {
      scansUsed: 0,
      shotsFired: 0,
      enemiesNeutralized: 0,
      damageTaken: 0,
      alarmsTriggered: 0,
    },
    reviewWalkthrough: false,
    reviewWalkthroughTimer: 0,
    reviewWalkthroughStage: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function length2d(vector: Vec2): number {
  return Math.hypot(vector.x, vector.z);
}

function normalize(vector: Vec2): Vec2 {
  const length = length2d(vector) || 1;
  return { x: vector.x / length, z: vector.z / length };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function directionFromAngle(angle: number): Vec2 {
  return { x: Math.sin(angle), z: Math.cos(angle) };
}

function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function lerpAngle(current: number, next: number, alpha: number): number {
  let delta = next - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * alpha;
}

function pointInRect(point: Vec2, obstacle: RectObstacle): boolean {
  return (
    point.x >= obstacle.x - obstacle.halfWidth &&
    point.x <= obstacle.x + obstacle.halfWidth &&
    point.z >= obstacle.z - obstacle.halfDepth &&
    point.z <= obstacle.z + obstacle.halfDepth
  );
}

function circleRectCollision(point: Vec2, radius: number, obstacle: RectObstacle): boolean {
  const closestX = clamp(point.x, obstacle.x - obstacle.halfWidth, obstacle.x + obstacle.halfWidth);
  const closestZ = clamp(point.z, obstacle.z - obstacle.halfDepth, obstacle.z + obstacle.halfDepth);
  const dx = point.x - closestX;
  const dz = point.z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

function orientation(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z);
}

function onSegment(a: Vec2, b: Vec2, c: Vec2): boolean {
  return (
    b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.z <= Math.max(a.z, c.z) &&
    b.z >= Math.min(a.z, c.z)
  );
}

function segmentsIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;

  return false;
}

function segmentHitsObstacle(start: Vec2, end: Vec2, obstacle: RectObstacle): boolean {
  if (pointInRect(start, obstacle) || pointInRect(end, obstacle)) {
    return true;
  }

  const topLeft = { x: obstacle.x - obstacle.halfWidth, z: obstacle.z - obstacle.halfDepth };
  const topRight = { x: obstacle.x + obstacle.halfWidth, z: obstacle.z - obstacle.halfDepth };
  const bottomLeft = { x: obstacle.x - obstacle.halfWidth, z: obstacle.z + obstacle.halfDepth };
  const bottomRight = { x: obstacle.x + obstacle.halfWidth, z: obstacle.z + obstacle.halfDepth };

  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
}

export class GameSimulation {
  private config: MissionConfig;

  private state: SimulationState;

  private events: GameEvent[] = [];

  private projectileId = 0;

  constructor(config: MissionConfig) {
    this.config = config;
    this.state = createState(config);
  }

  configure(config: MissionConfig) {
    this.config = config;
    this.reset();
  }

  startMission() {
    this.state.phase = "insertion";
    this.pushEvent({ type: "sfx", cue: "deploy" });
    this.setCallout(COMMS_LINES.deploy, 7);
  }

  seedReviewOutcome(outcome: "complete" | "failed" | "insert" | "walkthrough") {
    this.reset();
    if (outcome === "walkthrough") {
      this.state.phase = "insertion";
      this.state.objective = "insert";
      this.state.player.position = clonePoint(MISSION_POINTS.deployPad);
      this.state.player.scanCooldown = 0.8;
      this.state.player.scanRevealTimer = 0;
      this.state.insertionComplete = false;
      this.state.scanComplete = false;
      this.state.hackComplete = false;
      this.state.coreCollected = false;
      this.state.doorOpen = false;
      this.state.turret.active = false;
      this.state.reviewWalkthrough = true;
      this.state.reviewWalkthroughTimer = 0;
      this.state.reviewWalkthroughStage = -1;
      this.state.elapsed = 6.2;
      this.setCallout(COMMS_LINES.deploy, 6.5);
      this.updateUiState();
      return;
    }
    if (outcome === "insert") {
      this.state.phase = "insertion";
      this.state.objective = "insert";
      this.state.player.position = clonePoint(MISSION_POINTS.deployPad);
      this.state.player.scanCooldown = 0.8;
      this.state.player.scanRevealTimer = 0;
      this.state.insertionComplete = false;
      this.state.scanComplete = false;
      this.state.hackComplete = false;
      this.state.coreCollected = false;
      this.state.doorOpen = false;
      this.state.turret.active = false;
      this.state.elapsed = 9.4;
      this.setCallout(COMMS_LINES.insertion, 6.5);
      this.updateUiState();
      return;
    }

    this.state.insertionComplete = true;
    this.state.scanComplete = true;
    this.state.hackComplete = true;
    this.state.coreCollected = true;
    this.state.doorOpen = true;
    this.state.turret.active = true;
    this.state.player.scanCooldown = 1.4;
    this.state.player.scanRevealTimer = 1.8;
    this.state.elapsed = outcome === "complete" ? 78.6 : 64.2;

    if (outcome === "complete") {
      this.state.phase = "complete";
      this.state.objective = "extract";
      this.state.combatComplete = true;
      this.state.extractionReady = true;
      this.state.player.position = clonePoint(MISSION_POINTS.extraction);
      this.state.player.health = Math.max(62, this.state.player.maxHealth - 14);
      this.state.turret.destroyed = true;
      this.state.guards.forEach((guard) => {
        guard.down = guard.id === "relay-drone";
        guard.alert = false;
        guard.suspicion = 0;
      });
      this.state.alert = false;
      this.state.ui.alarm = false;
      this.state.stats = {
        scansUsed: 1,
        shotsFired: 6,
        enemiesNeutralized: 2,
        damageTaken: 14,
        alarmsTriggered: 1,
      };
      this.setCallout(COMMS_LINES.complete, 8);
    } else {
      this.state.phase = "failed";
      this.state.objective = "combat";
      this.state.player.position = { x: 1.8, z: -7.2 };
      this.state.player.health = 0;
      this.state.turret.destroyed = false;
      this.state.guards.forEach((guard) => {
        guard.alert = true;
        guard.suspicion = 1;
      });
      this.state.alert = true;
      this.state.ui.alarm = true;
      this.state.stats = {
        scansUsed: 1,
        shotsFired: 9,
        enemiesNeutralized: 1,
        damageTaken: this.state.player.maxHealth,
        alarmsTriggered: 2,
      };
      this.setCallout(COMMS_LINES.failed, 8);
    }

    this.updateUiState();
  }

  reset() {
    this.state = createState(this.config);
    this.events = [];
    this.projectileId = 0;
  }

  togglePause() {
    if (this.state.phase === "mission") {
      this.state.phase = "paused";
      return;
    }

    if (this.state.phase === "paused") {
      this.state.phase = "mission";
    }
  }

  setIntelOpen(open: boolean) {
    this.state.ui.intelOpen = open;
  }

  getSnapshot(): SimulationState {
    return this.state;
  }

  drainEvents(): GameEvent[] {
    const drained = [...this.events];
    this.events.length = 0;
    return drained;
  }

  update(dt: number, input: InputSnapshot) {
    if (input.pausePressed) {
      this.togglePause();
    }

    if (input.intelPressed) {
      this.state.ui.intelOpen = !this.state.ui.intelOpen;
      this.pushEvent({ type: "sfx", cue: "ui" });
    }

    if (this.state.phase !== "mission" && this.state.phase !== "insertion") {
      return;
    }

    const clampedDt = Math.min(dt, 1 / 20);
    this.state.elapsed += clampedDt;
    this.state.messageTtl = Math.max(0, this.state.messageTtl - clampedDt);
    this.state.player.fireCooldown = Math.max(0, this.state.player.fireCooldown - clampedDt);
    this.state.player.shotFlash = Math.max(0, this.state.player.shotFlash - clampedDt * 3.2);
    this.state.player.scanCooldown = Math.max(0, this.state.player.scanCooldown - clampedDt);
    this.state.player.scanRevealTimer = Math.max(0, this.state.player.scanRevealTimer - clampedDt);

    if (this.state.reviewWalkthrough) {
      this.updateReviewWalkthrough(clampedDt);
    }

    this.updatePlayer(clampedDt, input);
    this.updateInteractions(clampedDt, input);
    if (this.state.phase === "mission") {
      this.updateGuards(clampedDt);
      this.updateDetection(clampedDt);
      this.updateTurret(clampedDt);
      this.handleCombatInput(input);
      this.updateProjectiles(clampedDt);
    }
    this.updateObjectiveState();
    this.updateUiState();
  }

  private pushEvent(event: GameEvent) {
    this.events.push(event);
  }

  private getObstacles(): RectObstacle[] {
    return this.state.doorOpen ? STATIC_OBSTACLES : [...STATIC_OBSTACLES, DOOR_OBSTACLE];
  }

  private collides(position: Vec2, radius: number): boolean {
    if (
      position.x - radius < WORLD_BOUNDS.minX ||
      position.x + radius > WORLD_BOUNDS.maxX ||
      position.z - radius < WORLD_BOUNDS.minZ ||
      position.z + radius > WORLD_BOUNDS.maxZ
    ) {
      return true;
    }

    return this.getObstacles().some((obstacle) => circleRectCollision(position, radius, obstacle));
  }

  private moveActor(position: Vec2, radius: number, delta: Vec2): Vec2 {
    const moved = { ...position };
    const tryX = { x: moved.x + delta.x, z: moved.z };
    if (!this.collides(tryX, radius)) {
      moved.x = tryX.x;
    }

    const tryZ = { x: moved.x, z: moved.z + delta.z };
    if (!this.collides(tryZ, radius)) {
      moved.z = tryZ.z;
    }

    return moved;
  }

  private updatePlayer(dt: number, input: InputSnapshot) {
    const rawMove = { x: input.moveX, z: -input.moveY };
    const moving = rawMove.x !== 0 || rawMove.z !== 0;
    if (!moving) {
      return;
    }

    const move = normalize(rawMove);
    const speed = (input.sprint ? PLAYER_SPRINT_SPEED : PLAYER_SPEED) * this.config.playerModifiers.sprintMultiplier;
    const delta = { x: move.x * speed * dt, z: move.z * speed * dt };
    this.state.player.position = this.moveActor(this.state.player.position, this.state.player.radius, delta);
    this.state.player.facing = lerpAngle(this.state.player.facing, angleTo({ x: 0, z: 0 }, move), 0.28);
  }

  private updateInteractions(dt: number, input: InputSnapshot) {
    const player = this.state.player.position;
    const previousTarget = this.state.interactionTarget;
    let target: string | null = null;
    let prompt = "";

    if (!this.state.insertionComplete && distance(player, MISSION_POINTS.deployPad) < 2.3) {
      target = "insert";
      prompt = "Hold E to stabilize insertion link";
    } else if (this.state.insertionComplete && !this.state.scanComplete && distance(player, MISSION_POINTS.surveyPoint) < 2.6) {
      target = "survey";
      prompt = this.state.player.scanCooldown > 0 ? "Scan rig recharging" : "Press Q to sweep the overlook";
      if (input.scanPressed && this.state.player.scanCooldown <= 0) {
        this.state.player.scanCooldown = SCAN_COOLDOWN * this.config.playerModifiers.scanCooldownMultiplier;
        this.state.player.scanRevealTimer = SCAN_DURATION * this.config.playerModifiers.scanDurationMultiplier;
        this.state.scanComplete = true;
        this.state.objective = "hack";
        this.state.stats.scansUsed += 1;
        this.pushEvent({ type: "sfx", cue: "scan" });
        this.setCallout(COMMS_LINES.scanned, 7);
      }
    } else if (this.state.scanComplete && !this.state.hackComplete && distance(player, MISSION_POINTS.terminal) < 2.25) {
      target = "terminal";
      prompt = "Hold E to breach the archive door";
    } else if (this.state.hackComplete && !this.state.coreCollected && distance(player, MISSION_POINTS.core) < 2.45) {
      target = "core";
      prompt = "Hold E to secure the navigation seed";
    } else if (this.state.extractionReady && distance(player, MISSION_POINTS.extraction) < 2.4) {
      target = "extract";
      prompt = "Hold E to board the extraction skiff";
    }

    this.state.interactionTarget = target;
    if (!target) {
      this.state.interactionProgress = 0;
      this.state.ui.prompt = null;
      return;
    }

    if (target === "survey") {
      this.state.ui.prompt = { text: prompt, progress: 0 };
      this.state.interactionProgress = 0;
      return;
    }

    if (input.interactHeld && previousTarget === target) {
      const duration =
        target === "insert"
          ? HOLD_DURATIONS.insertion
          : target === "terminal"
          ? HOLD_DURATIONS.terminal
          : target === "core"
            ? HOLD_DURATIONS.core
            : HOLD_DURATIONS.extraction;
      this.state.interactionProgress = clamp(
        this.state.interactionProgress + (dt * this.config.playerModifiers.interactionSpeedMultiplier) / duration,
        0,
        1,
      );
    } else {
      this.state.interactionProgress = Math.max(0, this.state.interactionProgress - dt * 2.3);
    }

    this.state.ui.prompt = {
      text: prompt,
      progress: this.state.interactionProgress,
    };

    if (this.state.interactionProgress < 1) {
      return;
    }

    this.state.interactionProgress = 0;
    if (target === "insert") {
      this.state.insertionComplete = true;
      this.state.objective = "survey";
      this.state.phase = "mission";
      this.pushEvent({ type: "sfx", cue: "deploy" });
      this.setCallout(COMMS_LINES.insertion, 6.5);
      return;
    }
    if (target === "terminal") {
      this.state.hackComplete = true;
      this.state.doorOpen = true;
      this.state.objective = "collect";
      this.pushEvent({ type: "sfx", cue: "hack" });
      this.setCallout(COMMS_LINES.hacked, 6.5);
      return;
    }

    if (target === "core") {
      this.state.coreCollected = true;
      this.state.objective = "combat";
      this.triggerAlert(true);
      this.state.turret.active = true;
      this.pushEvent({ type: "sfx", cue: "alarm" });
      this.setCallout(COMMS_LINES.escalation, 7);
      return;
    }

    this.state.phase = "complete";
    this.state.ui.alarm = false;
    this.pushEvent({ type: "sfx", cue: "success" });
    this.setCallout(COMMS_LINES.complete, 7.5);
  }

  private updateGuards(dt: number) {
    for (const guard of this.state.guards) {
      if (!guard.active || guard.down) {
        continue;
      }

      guard.attackCooldown = Math.max(0, guard.attackCooldown - dt);
      if (guard.alert) {
        const toPlayer = {
          x: this.state.player.position.x - guard.position.x,
          z: this.state.player.position.z - guard.position.z,
        };
        const distanceToPlayer = length2d(toPlayer);
        guard.facing = lerpAngle(guard.facing, angleTo(guard.position, this.state.player.position), 0.14);

        if (distanceToPlayer > (guard.type === "drone" ? 5.2 : 6.4)) {
          const move = normalize(toPlayer);
          guard.position = this.moveActor(guard.position, 0.6, {
            x: move.x * guard.speed * dt,
            z: move.z * guard.speed * dt,
          });
        }

        if (distanceToPlayer < 12.5 && guard.attackCooldown <= 0 && this.hasLineOfSight(guard.position, this.state.player.position)) {
          guard.attackCooldown =
            (guard.type === "drone" ? 0.95 : 1.55) *
            this.config.operation.modifiers.enemyFireRateMultiplier *
            this.config.campaignPressure.enemyFireRateMultiplier;
          this.spawnProjectile("enemy", guard.position, this.state.player.position, 1.3);
        }
        continue;
      }

      const waypoint = guard.route[guard.routeIndex];
      const toWaypoint = { x: waypoint.x - guard.position.x, z: waypoint.z - guard.position.z };
      const waypointDistance = length2d(toWaypoint);

      if (waypointDistance < 0.35) {
        guard.routeIndex = (guard.routeIndex + 1) % guard.route.length;
      } else {
        const move = normalize(toWaypoint);
        guard.position = this.moveActor(guard.position, 0.6, {
          x: move.x * guard.speed * dt,
          z: move.z * guard.speed * dt,
        });
        guard.facing = lerpAngle(guard.facing, angleTo({ x: 0, z: 0 }, move), 0.1);
      }
    }
  }

  private hasLineOfSight(from: Vec2, to: Vec2): boolean {
    return !this.getObstacles()
      .filter((obstacle) => obstacle.blocksSight)
      .some((obstacle) => segmentHitsObstacle(from, to, obstacle));
  }

  private updateDetection(dt: number) {
    if (this.state.alert) {
      this.state.ui.exposure = 1;
      return;
    }

    let maxSuspicion = 0;
    for (const guard of this.state.guards) {
      if (!guard.active || guard.down) {
        continue;
      }

      const toPlayer = {
        x: this.state.player.position.x - guard.position.x,
        z: this.state.player.position.z - guard.position.z,
      };
      const distanceToPlayer = length2d(toPlayer);
      const forward = directionFromAngle(guard.facing);
      const direction = normalize(toPlayer);
      const dot = forward.x * direction.x + forward.z * direction.z;
      const visible = distanceToPlayer < 8.6 && dot > 0.45 && this.hasLineOfSight(guard.position, this.state.player.position);

      guard.suspicion = clamp(
        guard.suspicion +
          (visible
            ? dt *
              1.25 *
              this.config.operation.modifiers.suspicionMultiplier *
              this.config.campaignPressure.suspicionMultiplier *
              this.config.playerModifiers.detectionMultiplier
            : -dt * 0.75),
        0,
        ALERT_THRESHOLD,
      );
      maxSuspicion = Math.max(maxSuspicion, guard.suspicion);
    }

    this.state.ui.exposure = maxSuspicion;
    if (maxSuspicion >= ALERT_THRESHOLD) {
      this.triggerAlert(false);
      this.pushEvent({ type: "sfx", cue: "alarm" });
      this.setCallout("Kestrel: They have your silhouette. Break line or break them.", 5.5);
    }
  }

  private triggerAlert(forceCombat: boolean) {
    if (!this.state.alert) {
      this.state.stats.alarmsTriggered += 1;
    }
    this.state.alert = true;
    this.state.ui.alarm = true;
    for (const guard of this.state.guards) {
      if (!guard.down) {
        guard.alert = true;
        if (forceCombat && guard.id === "relay-drone") {
          guard.health = Math.max(guard.health, 4 + this.config.operation.modifiers.droneHealthBonus);
        }
      }
    }
  }

  private updateTurret(dt: number) {
    const turret = this.state.turret;
    if (!turret.active || turret.destroyed) {
      return;
    }

    turret.attackCooldown = Math.max(0, turret.attackCooldown - dt);
    turret.facing = lerpAngle(turret.facing, angleTo(turret.position, this.state.player.position), 0.18);
    const distanceToPlayer = distance(turret.position, this.state.player.position);
    if (distanceToPlayer < 14.5 && turret.attackCooldown <= 0 && this.hasLineOfSight(turret.position, this.state.player.position)) {
      turret.attackCooldown =
        0.8 * this.config.operation.modifiers.enemyFireRateMultiplier * this.config.campaignPressure.enemyFireRateMultiplier;
      this.spawnProjectile("enemy", turret.position, this.state.player.position, 1.8);
    }
  }

  private handleCombatInput(input: InputSnapshot) {
    if (!input.firePressed || this.state.player.fireCooldown > 0 || this.state.phase !== "mission") {
      return;
    }

    if (!this.state.alert) {
      this.triggerAlert(false);
    }

    const aimDirection = directionFromAngle(this.state.player.facing);
    let targetPoint = {
      x: this.state.player.position.x + aimDirection.x * 14,
      z: this.state.player.position.z + aimDirection.z * 14,
    };
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const guard of this.state.guards) {
      if (!guard.active || guard.down) {
        continue;
      }

      const toGuard = { x: guard.position.x - this.state.player.position.x, z: guard.position.z - this.state.player.position.z };
      const toGuardNormal = normalize(toGuard);
      const alignment = aimDirection.x * toGuardNormal.x + aimDirection.z * toGuardNormal.z;
      const range = length2d(toGuard);
      if (alignment > 0.1 && range < bestDistance && this.hasLineOfSight(this.state.player.position, guard.position)) {
        bestDistance = range;
        targetPoint = clonePoint(guard.position);
      }
    }

    if (this.state.turret.active && !this.state.turret.destroyed) {
      const toTurret = {
        x: this.state.turret.position.x - this.state.player.position.x,
        z: this.state.turret.position.z - this.state.player.position.z,
      };
      const toTurretNormal = normalize(toTurret);
      const alignment = aimDirection.x * toTurretNormal.x + aimDirection.z * toTurretNormal.z;
      const range = length2d(toTurret);
      if (alignment > 0.1 && range < bestDistance && this.hasLineOfSight(this.state.player.position, this.state.turret.position)) {
        targetPoint = clonePoint(this.state.turret.position);
      }
    }

    this.state.player.fireCooldown = 0.34 * this.config.playerModifiers.fireCooldownMultiplier;
    this.state.player.shotFlash = 1;
    this.state.stats.shotsFired += 1;
    this.pushEvent({ type: "sfx", cue: "shot" });
    this.spawnProjectile("player", this.state.player.position, targetPoint, 0.9);
  }

  private spawnProjectile(owner: "player" | "enemy", from: Vec2, to: Vec2, height: number) {
    const velocity = normalize({ x: to.x - from.x, z: to.z - from.z });
    const projectile: ProjectileState = {
      id: this.projectileId,
      owner,
      position: clonePoint(from),
      velocity: { x: velocity.x * FIRE_SPEED, z: velocity.z * FIRE_SPEED },
      life: 1.35,
      height,
    };

    this.projectileId += 1;
    this.state.projectiles.push(projectile);
  }

  private updateProjectiles(dt: number) {
    const nextProjectiles: ProjectileState[] = [];
    for (const projectile of this.state.projectiles) {
      projectile.life -= dt;
      projectile.position.x += projectile.velocity.x * dt;
      projectile.position.z += projectile.velocity.z * dt;

      if (projectile.life <= 0 || this.getObstacles().some((obstacle) => pointInRect(projectile.position, obstacle))) {
        continue;
      }

      if (projectile.owner === "enemy") {
        if (distance(projectile.position, this.state.player.position) < 0.75) {
          const damage = Math.max(7, Math.round(12 * this.config.playerModifiers.incomingDamageMultiplier));
          this.state.player.health = clamp(this.state.player.health - damage, 0, this.state.player.maxHealth);
          this.state.stats.damageTaken += damage;
          this.pushEvent({ type: "sfx", cue: "impact" });
          if (this.state.player.health <= 0) {
            this.state.phase = "failed";
            this.pushEvent({ type: "sfx", cue: "fail" });
            this.setCallout(COMMS_LINES.failed, 7.5);
          }
          continue;
        }
      } else {
        let hit = false;
        for (const guard of this.state.guards) {
          if (!guard.active || guard.down) {
            continue;
          }

          if (distance(projectile.position, guard.position) < (guard.type === "drone" ? 0.95 : 0.8)) {
            guard.health -= this.config.playerModifiers.damagePerShot;
            if (guard.health <= 0) {
              guard.down = true;
              this.state.stats.enemiesNeutralized += 1;
            }
            this.pushEvent({ type: "sfx", cue: "impact" });
            hit = true;
            break;
          }
        }

        if (hit) {
          continue;
        }

        if (this.state.turret.active && !this.state.turret.destroyed && distance(projectile.position, this.state.turret.position) < 1.1) {
          this.state.turret.health -= this.config.playerModifiers.damagePerShot;
          if (this.state.turret.health <= 0) {
            this.state.turret.destroyed = true;
            this.state.stats.enemiesNeutralized += 1;
          }
          this.pushEvent({ type: "sfx", cue: "impact" });
          continue;
        }
      }

      nextProjectiles.push(projectile);
    }

    this.state.projectiles = nextProjectiles;
  }

  private updateObjectiveState() {
    if (this.state.phase === "failed" || this.state.phase === "complete") {
      return;
    }

    if (this.state.coreCollected && !this.state.combatComplete && this.state.turret.destroyed) {
      const relayDrone = this.state.guards.find((guard) => guard.id === "relay-drone");
      if (!relayDrone || relayDrone.down) {
        this.state.combatComplete = true;
        this.state.extractionReady = true;
        this.state.objective = "extract";
        this.state.ui.alarm = false;
        this.pushEvent({ type: "sfx", cue: "success" });
        this.setCallout(COMMS_LINES.combat, 6.2);
      }
    }
  }

  private updateReviewWalkthrough(dt: number) {
    this.state.reviewWalkthroughTimer += dt;
    const t = this.state.reviewWalkthroughTimer;

    if (t < 1.2) {
      this.enterReviewWalkthroughStage(0);
      return;
    }
    if (t < 3.2) {
      this.enterReviewWalkthroughStage(1);
      return;
    }
    if (t < 4.6) {
      this.enterReviewWalkthroughStage(2);
      return;
    }
    if (t < 6.0) {
      this.enterReviewWalkthroughStage(3);
      return;
    }
    if (t < 7.6) {
      this.enterReviewWalkthroughStage(4);
      return;
    }
    if (t < 9.2) {
      this.enterReviewWalkthroughStage(5);
      return;
    }

    this.enterReviewWalkthroughStage(6);
  }

  private enterReviewWalkthroughStage(stage: number) {
    if (this.state.reviewWalkthroughStage === stage) {
      return;
    }

    this.state.reviewWalkthroughStage = stage;
    this.state.interactionTarget = null;
    this.state.interactionProgress = 0;

    switch (stage) {
      case 0:
        this.state.phase = "insertion";
        this.state.objective = "insert";
        this.state.player.position = clonePoint(MISSION_POINTS.deployPad);
        this.state.insertionComplete = false;
        this.state.scanComplete = false;
        this.state.hackComplete = false;
        this.state.coreCollected = false;
        this.state.extractionReady = false;
        this.state.combatComplete = false;
        this.state.doorOpen = false;
        this.state.alert = false;
        this.state.ui.alarm = false;
        this.state.turret.active = false;
        this.state.turret.destroyed = false;
        this.setCallout(COMMS_LINES.deploy, 6);
        break;
      case 1:
        this.state.insertionComplete = true;
        this.state.phase = "mission";
        this.state.objective = "survey";
        this.state.player.position = clonePoint(MISSION_POINTS.surveyPoint);
        this.setCallout(COMMS_LINES.insertion, 6);
        break;
      case 2:
        this.state.scanComplete = true;
        this.state.objective = "hack";
        this.state.player.position = clonePoint(MISSION_POINTS.terminal);
        this.state.stats.scansUsed = Math.max(this.state.stats.scansUsed, 1);
        this.setCallout(COMMS_LINES.scanned, 6);
        break;
      case 3:
        this.state.hackComplete = true;
        this.state.doorOpen = true;
        this.state.objective = "collect";
        this.state.player.position = clonePoint(MISSION_POINTS.core);
        this.setCallout(COMMS_LINES.hacked, 6);
        break;
      case 4:
        this.state.coreCollected = true;
        this.state.objective = "combat";
        this.state.turret.active = true;
        this.triggerAlert(true);
        this.pushEvent({ type: "sfx", cue: "alarm" });
        this.setCallout(COMMS_LINES.escalation, 6.5);
        break;
      case 5:
        this.state.combatComplete = true;
        this.state.extractionReady = true;
        this.state.objective = "extract";
        this.state.alert = false;
        this.state.ui.alarm = false;
        this.state.turret.destroyed = true;
        this.state.guards.forEach((guard) => {
          guard.down = true;
          guard.alert = false;
          guard.suspicion = 0;
        });
        this.setCallout(COMMS_LINES.combat, 6);
        break;
      case 6:
        this.state.phase = "complete";
        this.state.alert = false;
        this.state.ui.alarm = false;
        this.state.player.position = clonePoint(MISSION_POINTS.extraction);
        this.state.stats = {
          scansUsed: 1,
          shotsFired: 8,
          enemiesNeutralized: 2,
          damageTaken: 10,
          alarmsTriggered: 1,
        };
        this.state.elapsed = 82.4;
        this.setCallout(COMMS_LINES.complete, 7.5);
        this.state.reviewWalkthrough = false;
        break;
      default:
        break;
    }
  }

  private updateUiState() {
    this.state.ui.location = this.resolveLocation();
    this.state.ui.tutorial = this.resolveTutorial();

    switch (this.state.objective) {
      case "survey":
        this.state.ui.objective = "Sweep the overlook";
        this.state.ui.objectiveDetail = "Reach the glass and use Q to reveal patrol sightlines.";
        break;
      case "insert":
        this.state.ui.objective = "Stabilize insertion";
        this.state.ui.objectiveDetail = "Hold E on the skiff ring to sync the breach route before you move.";
        break;
      case "hack":
        this.state.ui.objective = "Breach the archive door";
        this.state.ui.objectiveDetail = "Get to the terminal beside the sealed door and hold E to crack it.";
        break;
      case "collect":
        this.state.ui.objective = "Secure the navigation seed";
        this.state.ui.objectiveDetail = "Slip into the archive chamber and pull the core before the dock closes.";
        break;
      case "combat":
        this.state.ui.objective = "Break the lockdown";
        this.state.ui.objectiveDetail = "Cut down the relay drone and the ceiling turret to reopen extraction.";
        break;
      case "extract":
        this.state.ui.objective = "Extract";
        this.state.ui.objectiveDetail = "Return to the skiff berth and hold E to leave with the seed.";
        break;
    }

    if (this.state.messageTtl <= 0 && (this.state.phase === "mission" || this.state.phase === "insertion")) {
      this.state.ui.callout = "";
    }
  }

  private resolveLocation(): string {
    const { x, z } = this.state.player.position;
    if (x < -8) return "Skiff Berth";
    if (z < -4) return "Archive Vault";
    if (x > 8) return "Observation Glass";
    return "Hangar Spine";
  }

  private resolveTutorial(): string {
    if (this.state.phase === "failed") {
      return "Runner down. Restart the insertion and keep the cargo stacks between you and the patrol beams.";
    }
    if (this.state.phase === "complete") {
      return "Demo clear. Replay to test a cleaner infiltration line or a louder breach.";
    }
    if (this.state.objective === "insert") {
      return "Hold E on the skiff ring to sync insertion. Once the line is stable, move on the overlook.";
    }
    if (this.state.objective === "survey") {
      if (this.config.campaignPressure.tone === "critical") {
        return `${this.config.campaignPressure.directive} Sweep early so the patrol lattice does not close before the breach.`;
      }
      if (this.config.loadout.id === "ghostweave") {
        return "WASD moves. Shift sprints. Ghostweave extends your scan read, so paint the overlook before you cross the spine.";
      }
      if (this.config.loadout.id === "vanguard-shell") {
        return "WASD moves. Shift sprints. Vanguard Shell is slower on the drift, so use the crates early before you commit to the overlook.";
      }
      return "WASD moves. Shift sprints. Breach Rig shortens the objective holds, so focus on route discipline before you touch the terminal.";
    }
    if (this.state.objective === "hack") {
      if (this.config.campaignPressure.safehouseExposure >= 60) {
        return "The safehouse is running thin on cover. Touch the terminal cleanly and do not let the dock build a repeat signature.";
      }
      return this.config.operation.id === "storm-window"
        ? "Storm Window runs hotter than the baseline slice. Stay outside the vision cones or the extra sentinel will collapse the hangar fast."
        : "Stay outside the orange vision cones unless you want to trigger the whole dock.";
    }
    if (this.state.objective === "collect") {
      return "The door is open. Cross cleanly, secure the seed, then prepare for a hard response.";
    }
    if (this.state.objective === "combat") {
      if (this.config.campaignPressure.blackGlassHeat >= 70) {
        return "Black Glass is on the hunt now. End the lockdown package fast and keep the berth route open for a hard break.";
      }
      if (this.config.operation.id === "cinder-vector") {
        return "Cinder Vector hardens the lockdown package. Break the drone first, then finish the reinforced turret from cover.";
      }
      if (this.config.loadout.id === "vanguard-shell") {
        return "F fires the pulse carbine. Vanguard Shell hits harder in the lockdown beat, so step out only when you can finish the angle.";
      }
      return "F fires the pulse carbine. The relay drone moves faster than the turret, so use the columns and crates.";
    }
    return "Extraction is live. Follow the blue strip back to the berth and hold E on the skiff ring.";
  }

  private setCallout(text: string, ttl: number) {
    this.state.ui.callout = text;
    this.state.messageTtl = ttl;
    this.pushEvent({ type: "message", text });
  }
}
