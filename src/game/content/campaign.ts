import type { OperationId } from "./progression";
import type { MissionKind, Vec2 } from "../simulation/types";

export const CAMPAIGN_ORDER = ["ghost-signal", "storm-window", "cinder-vector"] as const satisfies readonly OperationId[];

export const WHOLE_GAME = {
  goal: "Open the civilian evacuation lane by finishing Ghost Signal, Storm Window, and Cinder Vector, in that order.",
  win: "You win Starfall Protocol when the skiff clears the storm gate at the end of Cinder Vector.",
  loss: "You lose the session if your vitals or the skiff hull hit zero before that gate is open.",
} as const;

export const RECOVERY_START: Vec2 = { x: -12.4, z: 6.2 };

export const RECOVERY_RELAYS = [
  { id: "relay-west", position: { x: -9.5, z: 3.2 } },
  { id: "relay-east", position: { x: 12.8, z: -8.6 } },
] as const;

export const ESCAPE_START: Vec2 = { x: -14.2, z: 9.2 };

export const ESCAPE_GATE: Vec2 = { x: 14.2, z: -12.2 };

export const LANE_GUN_RANGE = 9;

export const LANE_GUNS: Vec2[] = [
  { x: 1.6, z: 11.6 },
  { x: 13.2, z: 1.4 },
  { x: 8.4, z: -9.6 },
];

export function missionKindFor(operationId: OperationId): MissionKind {
  if (operationId === "storm-window") {
    return "recovery";
  }

  if (operationId === "cinder-vector") {
    return "escape";
  }

  return "infiltration";
}

export function campaignMissionName(index: number): string {
  if (index === 1) {
    return "Storm Window";
  }

  if (index === 2) {
    return "Cinder Vector";
  }

  return "Ghost Signal";
}
