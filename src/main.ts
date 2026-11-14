import "./style.css";

import { AudioEngine } from "./game/audio/AudioEngine";
import { CAMPAIGN_ORDER, campaignMissionName } from "./game/content/campaign";
import { createMissionConfig } from "./game/content/progression";
import {
  createReviewProfile,
  deriveCampaignPressure,
  getAvailableSkillPoints,
  loadCareerProfile,
  recordCareerRun,
  saveCareerProfile,
  unlockCareerSkill,
  updateCareerSelection,
} from "./game/progression/ProfileStore";
import { getRunAssessment } from "./game/progression/runAssessment";
import { InputController } from "./game/input/InputController";
import { GameSimulation } from "./game/simulation/GameSimulation";
import { GameRuntime } from "./render/app/GameRuntime";
import { Hud, type RunResolution } from "./ui/Hud";

const root = document.querySelector<HTMLDivElement>("#app");
const searchParams = new URLSearchParams(window.location.search);
const reviewMode = searchParams.get("review") === "1";
const reviewState =
  reviewMode &&
  (searchParams.get("reviewState") === "complete" ||
    searchParams.get("reviewState") === "failed" ||
    searchParams.get("reviewState") === "insert" ||
    searchParams.get("reviewState") === "walkthrough")
    ? (searchParams.get("reviewState") as "complete" | "failed" | "insert" | "walkthrough")
    : searchParams.get("autostart") === "1"
      ? "mission"
      : "safehouse";

if (!root) {
  throw new Error("Missing app root");
}

function createActiveProfile() {
  return reviewMode ? createReviewProfile() : loadCareerProfile();
}

let profile = createActiveProfile();
let missionConfig = createMissionConfig(
  profile.selectedOperationId,
  profile.selectedLoadoutId,
  profile.unlockedSkillIds,
  deriveCampaignPressure(profile),
);

const simulation = new GameSimulation(missionConfig);
const input = new InputController();
const audio = new AudioEngine();

function persistProfile(nextProfile: typeof profile) {
  if (reviewMode) {
    return;
  }

  saveCareerProfile(nextProfile);
}

function syncSafehouseState(options: { resetSimulation?: boolean } = {}) {
  const { resetSimulation = true } = options;
  if (!reviewMode && !profile.campaignCleared) {
    profile = {
      ...profile,
      selectedOperationId: CAMPAIGN_ORDER[profile.campaignStep] ?? "ghost-signal",
    };
  }
  missionConfig = createMissionConfig(
    profile.selectedOperationId,
    profile.selectedLoadoutId,
    profile.unlockedSkillIds,
    deriveCampaignPressure(profile),
  );
  if (resetSimulation) {
    simulation.configure(missionConfig);
  }
  hud.setBriefingState({
    profile,
    operation: missionConfig.operation,
    loadout: missionConfig.loadout,
    skills: missionConfig.skills,
    availableSkillPoints: getAvailableSkillPoints(profile),
    campaignPressure: missionConfig.campaignPressure,
    consequenceReports: profile.consequenceReports,
  });
}

const hud = new Hud(root, {
  onDeploy: async () => {
    if (!reviewMode && profile.campaignCleared) {
      profile = { ...profile, campaignCleared: false, campaignStep: 0, selectedOperationId: "ghost-signal" };
      persistProfile(profile);
    }
    await audio.unlock();
    syncSafehouseState();
    simulation.configure(missionConfig);
    simulation.startMission();
    hud.hideBriefing();
    hud.setResolution(null);
    lastRecordedPhase = null;
  },
  onResume: () => {
    simulation.togglePause();
  },
  onRestart: async () => {
    if (!reviewMode && resolution?.kind === "game-win") {
      profile = { ...profile, campaignCleared: false, campaignStep: 0, selectedOperationId: "ghost-signal" };
      persistProfile(profile);
    }
    await audio.unlock();
    syncSafehouseState();
    simulation.configure(missionConfig);
    simulation.startMission();
    hud.hideBriefing();
    hud.setResolution(null);
    resolution = null;
    lastRecordedPhase = null;
  },
  onReturnToSafehouse: () => {
    if (reviewMode) {
      profile = createActiveProfile();
    }
    syncSafehouseState();
    hud.showBriefing();
    lastRecordedPhase = null;
  },
  onToggleIntel: () => {
    simulation.setIntelOpen(!simulation.getSnapshot().ui.intelOpen);
  },
  onSelectOperation: (operationId) => {
    if (!reviewMode) {
      const index = CAMPAIGN_ORDER.indexOf(operationId);
      if (profile.campaignCleared || index !== profile.campaignStep) {
        return;
      }
    }
    profile = updateCareerSelection(profile, { selectedOperationId: operationId });
    persistProfile(profile);
    syncSafehouseState();
  },
  onSelectLoadout: (loadoutId) => {
    profile = updateCareerSelection(profile, { selectedLoadoutId: loadoutId });
    persistProfile(profile);
    syncSafehouseState();
  },
  onUnlockSkill: (skillId) => {
    profile = unlockCareerSkill(profile, skillId);
    persistProfile(profile);
    syncSafehouseState();
  },
});

const runtime = new GameRuntime(hud.sceneHost);
let lastRecordedPhase: "complete" | "failed" | null = null;
let resolution: RunResolution | null = null;
let hiddenPauseTriggered = false;

syncSafehouseState();

if (reviewState === "mission") {
  simulation.configure(missionConfig);
  simulation.startMission();
  hud.hideBriefing();
} else if (reviewState === "complete" || reviewState === "failed" || reviewState === "insert" || reviewState === "walkthrough") {
  simulation.configure(missionConfig);
  simulation.seedReviewOutcome(reviewState);
  hud.hideBriefing();
}

let previous = performance.now();

function frame(now: number) {
  if (document.hidden) {
    previous = now;
    requestAnimationFrame(frame);
    return;
  }

  const dt = (now - previous) / 1000;
  previous = now;

  simulation.update(dt, input.sample());
  const state = simulation.getSnapshot();

  for (const event of simulation.drainEvents()) {
    if (event.type === "sfx") {
      audio.playCue(event.cue);
    }
  }

  if ((state.phase === "complete" || state.phase === "failed") && lastRecordedPhase !== state.phase) {
    const finishedIndex = profile.campaignStep;
    const finishedName = campaignMissionName(finishedIndex);
    const gameWon = !reviewMode && state.phase === "complete" && !profile.campaignCleared && finishedIndex >= CAMPAIGN_ORDER.length - 1;
    const missionWon = !reviewMode && state.phase === "complete" && !gameWon && !profile.campaignCleared;
    resolution =
      state.phase === "failed"
        ? { kind: "loss", missionName: missionConfig.operation.name, nextName: null }
        : gameWon
          ? { kind: "game-win", missionName: finishedName, nextName: null }
          : missionWon
            ? {
                kind: "mission-win",
                missionName: finishedName,
                nextName: campaignMissionName(finishedIndex + 1),
              }
            : null;
    profile = recordCareerRun(profile, missionConfig, {
      outcome: state.phase,
      assessment: getRunAssessment(state.stats, state.phase === "complete"),
      elapsedSeconds: state.elapsed,
      alarmsTriggered: state.stats.alarmsTriggered,
      damageTaken: state.stats.damageTaken,
      enemiesNeutralized: state.stats.enemiesNeutralized,
    });
    if (missionWon) {
      profile = {
        ...profile,
        campaignStep: finishedIndex + 1,
        selectedOperationId: CAMPAIGN_ORDER[finishedIndex + 1] ?? "ghost-signal",
      };
    }
    if (gameWon) {
      profile = { ...profile, campaignCleared: true };
    }
    persistProfile(profile);
    syncSafehouseState({ resetSimulation: false });
    hud.setResolution(resolution);
    lastRecordedPhase = state.phase;
  }

  audio.setAlert(state.ui.alarm, state.ui.exposure);
  hud.update(state);
  runtime.render(state, dt);

  requestAnimationFrame(frame);
}

hud.update(simulation.getSnapshot());
requestAnimationFrame(frame);

document.addEventListener("visibilitychange", () => {
  previous = performance.now();
  if (document.hidden) {
    if (simulation.getSnapshot().phase === "mission") {
      simulation.togglePause();
      hiddenPauseTriggered = true;
    }
    return;
  }

  if (hiddenPauseTriggered) {
    hiddenPauseTriggered = false;
  }
});

window.addEventListener("beforeunload", () => {
  input.destroy();
  runtime.dispose();
});
