// Headless tests of the mission simulation (KOL-7008): no browser, no three.js, no DOM.
// They drive the real GameSimulation through its public update() with the same input the
// keyboard produces. The player is placed at each objective rather than walked there:
// these test the objective, combat and ending logic, not the movement or pathing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/game/simulation/GameSimulation.ts';
import { createMissionConfig, DEFAULT_LOADOUT_ID, DEFAULT_OPERATION_ID } from '../src/game/content/progression.ts';
import { MISSION_POINTS } from '../src/game/content/mission.ts';
import { getRunAssessment } from '../src/game/progression/runAssessment.ts';
import type { InputSnapshot, Vec2 } from '../src/game/simulation/types.ts';

const DT = 1 / 60;
const IDLE: InputSnapshot = {
  moveX: 0, moveY: 0, sprint: false,
  interactHeld: false, interactPressed: false, scanPressed: false,
  firePressed: false, pausePressed: false, intelPressed: false,
};

function newMission() {
  const sim = new GameSimulation(createMissionConfig(DEFAULT_OPERATION_ID, DEFAULT_LOADOUT_ID));
  sim.startMission();
  return sim;
}

function placeAt(sim: GameSimulation, point: Vec2) {
  sim.getSnapshot().player.position = { x: point.x, z: point.z };
}

/** Steps until `done()` is true or `maxSeconds` of game time pass; returns the seconds used. */
function stepUntil(sim: GameSimulation, input: Partial<InputSnapshot>, done: () => boolean, maxSeconds: number) {
  let t = 0;
  while (!done() && t < maxSeconds) {
    sim.update(DT, { ...IDLE, ...input });
    t += DT;
  }
  return t;
}

function insertAndCollectCore(sim: GameSimulation) {
  const s = sim.getSnapshot();
  placeAt(sim, MISSION_POINTS.deployPad);
  stepUntil(sim, { interactHeld: true }, () => s.insertionComplete, 5);
  assert.equal(s.insertionComplete, true, 'insertion completes when E is held on the drop pad');
  assert.equal(s.phase, 'mission');
  assert.equal(s.objective, 'survey');

  placeAt(sim, MISSION_POINTS.surveyPoint);
  stepUntil(sim, { scanPressed: true }, () => s.scanComplete, 5);
  assert.equal(s.scanComplete, true, 'Q at the overlook completes the survey');
  assert.equal(s.objective, 'hack');

  placeAt(sim, MISSION_POINTS.terminal);
  stepUntil(sim, { interactHeld: true }, () => s.hackComplete, 6);
  assert.equal(s.hackComplete, true, 'holding E at the terminal breaches the archive');
  assert.equal(s.doorOpen, true);
  assert.equal(s.objective, 'collect');

  placeAt(sim, MISSION_POINTS.core);
  stepUntil(sim, { interactHeld: true }, () => s.coreCollected, 6);
  assert.equal(s.coreCollected, true, 'holding E secures the navigation seed');
  assert.equal(s.objective, 'combat');
  assert.equal(s.turret.active, true, 'the turret comes online at lockdown');
}

test('a mission starts in insertion, at full health, on the first objective', () => {
  const s = newMission().getSnapshot();
  assert.equal(s.phase, 'insertion');
  assert.equal(s.objective, 'insert');
  assert.equal(s.player.health, s.player.maxHealth);
});

test('the objective chain plays through to a win: lockdown, combat, extraction', () => {
  const sim = newMission();
  const s = sim.getSnapshot();
  insertAndCollectCore(sim);

  // Combat: aim at the turret, then at the relay drone, and fire, as the F key does.
  let t = 0;
  while (!s.combatComplete && s.phase === 'mission' && t < 90) {
    const drone = s.guards.find((g) => g.id === 'relay-drone');
    const target = !s.turret.destroyed ? s.turret.position : drone && !drone.down ? drone.position : null;
    if (target) {
      const p = s.player.position;
      s.player.facing = Math.atan2(target.x - p.x, target.z - p.z);
    }
    sim.update(DT, { ...IDLE, firePressed: true });
    t += DT;
  }
  assert.equal(s.phase, 'mission', `still alive after combat (health ${s.player.health})`);
  assert.equal(s.turret.destroyed, true, 'the turret is destroyed');
  assert.equal(s.combatComplete, true, 'combat completes once the turret and the relay drone are down');
  assert.equal(s.objective, 'extract');
  assert.equal(s.extractionReady, true);

  placeAt(sim, MISSION_POINTS.extraction);
  stepUntil(sim, { interactHeld: true }, () => s.phase === 'complete', 6);
  assert.equal(s.phase, 'complete', 'boarding the skiff wins the run');
  assert.ok(s.stats.shotsFired > 0);
  assert.notEqual(getRunAssessment(s.stats, true), 'Compromised');
});

test('standing in the turret fire after lockdown loses the run at 0 health', () => {
  const sim = newMission();
  const s = sim.getSnapshot();
  insertAndCollectCore(sim);
  stepUntil(sim, {}, () => s.phase === 'failed', 180);
  assert.equal(s.phase, 'failed', `the run is lost (health ${s.player.health}, damage ${s.stats.damageTaken})`);
  assert.ok(s.player.health <= 0);
  assert.ok(s.stats.damageTaken > 0);
  // A lost run ignores further input.
  const elapsed = s.elapsed;
  sim.update(DT, { ...IDLE, interactHeld: true });
  assert.equal(sim.getSnapshot().elapsed, elapsed);
});

test('reset after a loss gives a clean run', () => {
  const sim = newMission();
  insertAndCollectCore(sim);
  stepUntil(sim, {}, () => sim.getSnapshot().phase === 'failed', 180);
  sim.reset();
  const s = sim.getSnapshot();
  assert.equal(s.phase, 'briefing');
  assert.equal(s.objective, 'insert');
  assert.equal(s.player.health, s.player.maxHealth);
  assert.equal(s.coreCollected, false);
  assert.equal(s.stats.damageTaken, 0);
});

test('sight lines: a crate blocks a line through it, not a line beside it', () => {
  // Regression for the orientation() sign bug: every sight line used to hit every obstacle.
  const sim = newMission() as unknown as { hasLineOfSight(a: Vec2, b: Vec2): boolean };
  // crate-alpha sits at x -1.5, z 5.2, 1.6 each side.
  assert.equal(sim.hasLineOfSight({ x: -6, z: 5.2 }, { x: 3, z: 5.2 }), false, 'through the crate');
  assert.equal(sim.hasLineOfSight({ x: -6, z: 9 }, { x: 3, z: 9 }), true, 'clear of the crate');
  assert.equal(sim.hasLineOfSight({ x: 0, z: 0 }, { x: 1, z: 0 }), true, 'a short line in the open');
});

test('after lockdown the turret fires at a player it can see', () => {
  const sim = newMission();
  const s = sim.getSnapshot();
  insertAndCollectCore(sim);
  const health = s.player.health;
  stepUntil(sim, {}, () => s.player.health < health, 5);
  assert.ok(s.player.health < health, 'the player takes turret fire within 5 seconds');
});

test('debrief grades', () => {
  const clean = { scansUsed: 1, shotsFired: 2, enemiesNeutralized: 0, damageTaken: 0, alarmsTriggered: 0 };
  assert.equal(getRunAssessment(clean, true), 'Ghost clean');
  assert.equal(getRunAssessment({ ...clean, shotsFired: 9, damageTaken: 20, alarmsTriggered: 1 }, true), 'Cold extraction');
  assert.equal(getRunAssessment({ ...clean, damageTaken: 40, alarmsTriggered: 3 }, true), 'Hard exit');
  assert.equal(getRunAssessment({ ...clean, damageTaken: 90, alarmsTriggered: 3 }, true), 'Barely aboard');
  assert.equal(getRunAssessment(clean, false), 'Broken insertion');
  assert.equal(getRunAssessment({ ...clean, alarmsTriggered: 2 }, false), 'Compromised');
});
