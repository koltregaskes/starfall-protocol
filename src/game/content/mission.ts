import type { RectObstacle, Vec2 } from "../simulation/types";

export const WORLD_BOUNDS = {
  minX: -18,
  maxX: 18,
  minZ: -16,
  maxZ: 16,
};

export const MISSION_POINTS = {
  playerStart: { x: -11.8, z: 10.4 },
  deployPad: { x: -15.2, z: 13.6 },
  surveyPoint: { x: 11.8, z: 4.8 },
  terminal: { x: 6.2, z: -1.2 },
  archiveDoor: { x: 4.5, z: -4.1 },
  core: { x: 7.6, z: -10.6 },
  turret: { x: 7.2, z: -8.4 },
  extraction: { x: -16.1, z: 13.9 },
} satisfies Record<string, Vec2>;

export const STATIC_OBSTACLES: RectObstacle[] = [
  { id: "crate-alpha", x: -1.5, z: 5.2, halfWidth: 1.6, halfDepth: 1.6, height: 1.7, blocksSight: true },
  { id: "crate-beta", x: 3.8, z: 6.7, halfWidth: 1.2, halfDepth: 1.8, height: 1.9, blocksSight: true },
  { id: "crate-gamma", x: -4.6, z: 0.8, halfWidth: 1.4, halfDepth: 1.4, height: 1.7, blocksSight: true },
  { id: "crate-delta", x: 8.8, z: 8.6, halfWidth: 1.4, halfDepth: 1.2, height: 1.5, blocksSight: true },
  { id: "console-bank", x: 11.4, z: 0.8, halfWidth: 1.2, halfDepth: 1.6, height: 1.6, blocksSight: true },
  { id: "safehouse-rack", x: -11.8, z: 13.7, halfWidth: 1.8, halfDepth: 0.9, height: 1.4, blocksSight: true },
  { id: "archive-pylon", x: 2.1, z: -11.4, halfWidth: 1.2, halfDepth: 1.2, height: 2.8, blocksSight: true },
];

export const DOOR_OBSTACLE: RectObstacle = {
  id: "archive-door",
  x: 4.5,
  z: -4.1,
  halfWidth: 6.2,
  halfDepth: 0.55,
  height: 3.6,
  blocksSight: true,
};

export const GUARD_ROUTES: Vec2[][] = [
  [
    { x: -6.2, z: 9.8 },
    { x: 4.4, z: 8.4 },
    { x: 11.6, z: 3.5 },
    { x: 2.8, z: 0.2 },
    { x: -4.8, z: 2.4 },
  ],
  [
    { x: 2.5, z: 11.8 },
    { x: 9.8, z: 9.4 },
    { x: 9.2, z: 1.6 },
    { x: 4.2, z: 3.6 },
  ],
  [
    { x: -2.4, z: -2.6 },
    { x: 3.4, z: 0.4 },
    { x: 9.6, z: -1.4 },
    { x: 4.8, z: -4.8 },
    { x: -0.8, z: -3.6 },
  ],
];

export const MENU_PANELS = {
  Continue: {
    eyebrow: "Orbital breach demo",
    title: "Ghost Signal at Aurelion Gate",
    body:
      "Deploy into a failing dock, slip past patrol optics, crack the archive door, and pull the navigation seed before the zone drops dark.",
  },
  Operations: {
    eyebrow: "Mission frame",
    title: "Contained review slice",
    body:
      "Safehouse berth, stealth route through the hangar spine, one security breach, one archive retrieval, one lockdown combat beat, one extraction endpoint.",
  },
  Loadout: {
    eyebrow: "Operator kit",
    title: "Cold-entry package",
    body:
      "Pulse carbine, breach rig, short-burst scan lattice, carbon cloak weave, and one emergency recovery dose. This is a light recon loadout, not a war chest.",
  },
  Intel: {
    eyebrow: "Story tone",
    title: "Why this matters",
    body:
      "The navigation seed routes civilian lifeboats through the storm belt below. If the Black Glass Combine sells it first, the outer rings lose the evacuation lane.",
  },
  Options: {
    eyebrow: "Play note",
    title: "Best experienced on desktop",
    body:
      "This browser slice is tuned for keyboard play. Movement uses WASD, sprint uses Shift, scan uses Q, interact uses E, and pulse fire uses F. Audio unlocks after deployment.",
  },
} as const;

export const COMMS_LINES = {
  deploy: "Kestrel: Drift quiet. Cross the berth, sweep the overlook, and find me a clean route into the archive.",
  insertion: "Kestrel: Insertion sync is live. Pin the skiff and take the berth on my mark.",
  scanned: "Kestrel: Patrol lattice painted. The security terminal beside the door is your breach path.",
  hacked: "Kestrel: Door is soft. Archive chamber just woke up on my board.",
  collected: "Kestrel: Seed secured. Lockdown is live. Break the relay gun and clear your way out.",
  escalation: "Kestrel: Shutters are down. Turret is up. Clear the relay drone and the ceiling gun to open extraction.",
  combat: "Kestrel: Lockdown broken. Extraction skiff is hot on the berth. Move.",
  complete: "Kestrel: Clean lift. The dock can die behind us now.",
  failed: "Kestrel: Runner down. Reset the insertion and take the route cleaner.",
};
