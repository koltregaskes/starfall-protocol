import type {
  CampaignPressure,
  LoadoutDefinition,
  LoadoutId,
  OperationDefinition,
  OperationId,
  SkillDefinition,
  SkillId,
} from "../game/content/progression";
import { CAMPAIGN_ORDER, WHOLE_GAME } from "../game/content/campaign";
import { LOADOUTS, OPERATIONS, SKILLS } from "../game/content/progression";
import { canUnlockSkill, type CareerProfile, type ConsequenceReport } from "../game/progression/ProfileStore";
import { getRunAssessment } from "../game/progression/runAssessment";
import type { SimulationState } from "../game/simulation/types";

export type RunResolution = {
  kind: "mission-win" | "game-win" | "loss";
  missionName: string;
  nextName: string | null;
};

type SafehousePanel = "Continue" | "Operations" | "Loadout" | "Intel" | "Options";

type HudCallbacks = {
  onDeploy: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnToSafehouse: () => void;
  onToggleIntel: () => void;
  onSelectOperation: (operationId: OperationId) => void;
  onSelectLoadout: (loadoutId: LoadoutId) => void;
  onUnlockSkill: (skillId: SkillId) => void;
};

type BriefingState = {
  profile: CareerProfile;
  operation: OperationDefinition;
  loadout: LoadoutDefinition;
  skills: SkillDefinition[];
  availableSkillPoints: number;
  campaignPressure: CampaignPressure;
  consequenceReports: ConsequenceReport[];
};

const SAFEHOUSE_PANELS: SafehousePanel[] = ["Continue", "Operations", "Loadout", "Intel", "Options"];

const PANEL_META: Record<SafehousePanel, { eyebrow: string; title: string }> = {
  Continue: {
    eyebrow: "Ready room",
    title: "Stage the next insertion",
  },
  Operations: {
    eyebrow: "Operations board",
    title: "Choose the contract profile",
  },
  Loadout: {
    eyebrow: "Loadout bay",
    title: "Tune the operator package",
  },
  Intel: {
    eyebrow: "Career log",
    title: "Track the campaign pressure",
  },
  Options: {
    eyebrow: "Field notes",
    title: "Build lane and controls",
  },
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "--";
  }

  return `${seconds.toFixed(1)}s`;
}

function formatPressure(value: number): string {
  return `${Math.round(value)}%`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export class Hud {
  readonly sceneHost: HTMLDivElement;

  private readonly hudRoot: HTMLDivElement;

  private readonly briefingOverlay: HTMLDivElement;

  private readonly panelButtons: HTMLButtonElement[];

  private readonly panelEyebrow: HTMLParagraphElement;

  private readonly panelTitle: HTMLHeadingElement;

  private readonly panelContent: HTMLDivElement;

  private readonly summaryOperation: HTMLParagraphElement;

  private readonly summaryLoadout: HTMLParagraphElement;

  private readonly summaryCareer: HTMLParagraphElement;

  private readonly summaryBest: HTMLParagraphElement;

  private readonly deployButton: HTMLButtonElement;

  private readonly campaignProgress: HTMLParagraphElement;

  private readonly stepHost: HTMLDivElement;

  private readonly resultAction: HTMLButtonElement;

  private resolution: RunResolution | null = null;

  private readonly objective: HTMLHeadingElement;

  private readonly objectiveDetail: HTMLParagraphElement;

  private readonly rulesLine: HTMLParagraphElement;

  private readonly vitalLabel: HTMLSpanElement;

  private readonly location: HTMLParagraphElement;

  private readonly callout: HTMLParagraphElement;

  private readonly tutorial: HTMLParagraphElement;

  private readonly prompt: HTMLDivElement;

  private readonly promptText: HTMLParagraphElement;

  private readonly promptFill: HTMLDivElement;

  private readonly healthValue: HTMLSpanElement;

  private readonly healthFill: HTMLDivElement;

  private readonly exposureValue: HTMLSpanElement;

  private readonly exposureFill: HTMLDivElement;

  private readonly intelDrawer: HTMLDivElement;

  private readonly intelLog: HTMLParagraphElement;

  private readonly statusBadge: HTMLSpanElement;

  private readonly pauseOverlay: HTMLDivElement;

  private readonly resultOverlay: HTMLDivElement;

  private readonly resultTitle: HTMLHeadingElement;

  private readonly resultBody: HTMLParagraphElement;

  private readonly resultMetrics: HTMLDivElement;

  private readonly callbacks: HudCallbacks;

  private activePanel: SafehousePanel = "Continue";

  private briefingState: BriefingState | null = null;

  constructor(root: HTMLElement, callbacks: HudCallbacks) {
    this.callbacks = callbacks;

    root.innerHTML = `
      <div class="app-shell">
        <div class="scene-host" aria-label="Starfall Protocol mission scene"></div>
        <div class="hud">
          <div class="hud__objective">
            <p class="hud__eyebrow">Current operation</p>
            <h2 class="hud__title"></h2>
            <p class="hud__detail"></p>
            <p class="hud__rules"></p>
          </div>

          <div class="hud__status">
            <div class="status-pill">
              <span class="status-pill__label js-vital-label">Vitals</span>
              <strong><span class="health-value">100</span>%</strong>
              <div class="status-pill__meter"><div class="status-pill__fill health-fill"></div></div>
            </div>
            <div class="status-pill">
              <span class="status-pill__label">Exposure</span>
              <strong><span class="exposure-value">0</span>%</strong>
              <div class="status-pill__meter"><div class="status-pill__fill exposure-fill"></div></div>
            </div>
            <button class="hud__intel-toggle" type="button">Intel</button>
          </div>

          <div class="hud__callout">
            <span class="status-badge">Silent running</span>
            <p class="hud__location"></p>
            <p class="hud__callout-text"></p>
          </div>

          <div class="hud__tutorial">
            <p class="hud__tutorial-text"></p>
          </div>

          <div class="hud__prompt" hidden>
            <p class="hud__prompt-text"></p>
            <div class="hud__prompt-track"><div class="hud__prompt-fill"></div></div>
          </div>
        </div>

        <aside class="intel-drawer">
          <p class="drawer__eyebrow">Live dossier</p>
          <h3>Aurelion Gate</h3>
          <p class="drawer__copy">
            Open the evacuation lane. You win the game by clearing Cinder Vector. You lose the session if vitals or hull hit zero.
          </p>
          <div class="drawer__sequence js-steps" aria-label="Mission steps"></div>
          <div class="drawer__controls">
            <span>WASD move</span>
            <span>Shift sprint</span>
            <span>Q scan</span>
            <span>E interact</span>
            <span>F fire</span>
            <span>Esc pause</span>
          </div>
          <p class="drawer__log"></p>
        </aside>

        <div class="overlay overlay--briefing">
          <div class="overlay__grid">
            <section class="overlay__brand">
              <p class="overlay__eyebrow">Safehouse staging board</p>
              <p class="overlay__logo">Starfall Protocol</p>
              <h1>Open the evacuation lane.</h1>
              <p class="overlay__lede">
                Finish three missions in order. Ghost Signal steals the seed, Storm Window breaks the dock relays, and Cinder Vector flies the skiff out.
              </p>
              <ul class="session-rules" data-session-rules>
                <li><span>Goal</span><p data-rule="goal">${WHOLE_GAME.goal}</p></li>
                <li><span>Win</span><p data-rule="win">${WHOLE_GAME.win}</p></li>
                <li><span>Loss</span><p data-rule="loss">${WHOLE_GAME.loss}</p></li>
              </ul>
              <p class="briefing-copy js-campaign-progress"></p>
              <div class="briefing-rail">
                <div class="briefing-rail__item">
                  <span class="briefing-label">Current contract</span>
                  <p class="briefing-value js-summary-operation"></p>
                </div>
                <div class="briefing-rail__item">
                  <span class="briefing-label">Current loadout</span>
                  <p class="briefing-value js-summary-loadout"></p>
                </div>
                <div class="briefing-rail__item">
                  <span class="briefing-label">Recovered seeds</span>
                  <p class="briefing-value js-summary-career"></p>
                </div>
                <div class="briefing-rail__item">
                  <span class="briefing-label">Best extraction</span>
                  <p class="briefing-value js-summary-best"></p>
                </div>
              </div>
              <button class="button button--primary js-deploy" type="button">Deploy Current Run</button>
            </section>

            <section class="overlay__panel">
              <div class="overlay__menu">
                ${SAFEHOUSE_PANELS.map(
                  (label, index) =>
                    `<button class="button button--ghost js-panel${index === 0 ? " is-active" : ""}" data-panel="${label}" type="button">${label}</button>`,
                ).join("")}
              </div>
              <div class="overlay__content">
                <p class="overlay__content-eyebrow"></p>
                <h2 class="overlay__content-title"></h2>
                <div class="overlay__content-body"></div>
              </div>
            </section>
          </div>
        </div>

        <div class="overlay overlay--pause" hidden>
          <div class="overlay__modal">
            <p class="overlay__eyebrow">Mission paused</p>
            <h2>Hold the route.</h2>
            <p class="overlay__lede">The dock is suspended. Resume, redeploy the current contract, or drop back to the safehouse board.</p>
            <div class="overlay__menu overlay__menu--stack">
              <button class="button button--primary js-resume" type="button">Continue</button>
              <button class="button button--ghost js-intel" type="button">Intel</button>
              <button class="button button--ghost js-restart" type="button">Restart Run</button>
              <button class="button button--ghost js-safehouse" type="button">Safehouse</button>
            </div>
          </div>
        </div>

        <div class="overlay overlay--result" hidden>
          <div class="overlay__modal">
            <p class="overlay__eyebrow">Mission update</p>
            <h2 class="js-result-title"></h2>
            <p class="overlay__lede js-result-body"></p>
            <div class="result-metrics">
              <div class="result-metric"><span>Assessment</span><strong class="js-metric-grade"></strong></div>
              <div class="result-metric"><span>Time</span><strong class="js-metric-time"></strong></div>
              <div class="result-metric"><span>Scans</span><strong class="js-metric-scans"></strong></div>
              <div class="result-metric"><span>Shots</span><strong class="js-metric-shots"></strong></div>
              <div class="result-metric"><span>Takedowns</span><strong class="js-metric-kills"></strong></div>
              <div class="result-metric"><span>Damage</span><strong class="js-metric-damage"></strong></div>
              <div class="result-metric"><span>Alarms</span><strong class="js-metric-alarms"></strong></div>
            </div>
            <div class="overlay__menu overlay__menu--stack">
              <button class="button button--primary js-restart js-result-action" type="button">Redeploy</button>
              <button class="button button--ghost js-safehouse" type="button">Safehouse</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.sceneHost = root.querySelector(".scene-host") as HTMLDivElement;
    this.hudRoot = root.querySelector(".hud") as HTMLDivElement;
    this.briefingOverlay = root.querySelector(".overlay--briefing") as HTMLDivElement;
    this.panelButtons = Array.from(root.querySelectorAll(".js-panel"));
    this.panelEyebrow = root.querySelector(".overlay__content-eyebrow") as HTMLParagraphElement;
    this.panelTitle = root.querySelector(".overlay__content-title") as HTMLHeadingElement;
    this.panelContent = root.querySelector(".overlay__content-body") as HTMLDivElement;
    this.summaryOperation = root.querySelector(".js-summary-operation") as HTMLParagraphElement;
    this.summaryLoadout = root.querySelector(".js-summary-loadout") as HTMLParagraphElement;
    this.summaryCareer = root.querySelector(".js-summary-career") as HTMLParagraphElement;
    this.summaryBest = root.querySelector(".js-summary-best") as HTMLParagraphElement;
    this.deployButton = root.querySelector(".js-deploy") as HTMLButtonElement;
    this.campaignProgress = root.querySelector(".js-campaign-progress") as HTMLParagraphElement;
    this.stepHost = root.querySelector(".js-steps") as HTMLDivElement;
    this.objective = root.querySelector(".hud__title") as HTMLHeadingElement;
    this.objectiveDetail = root.querySelector(".hud__detail") as HTMLParagraphElement;
    this.rulesLine = root.querySelector(".hud__rules") as HTMLParagraphElement;
    this.vitalLabel = root.querySelector(".js-vital-label") as HTMLSpanElement;
    this.location = root.querySelector(".hud__location") as HTMLParagraphElement;
    this.callout = root.querySelector(".hud__callout-text") as HTMLParagraphElement;
    this.tutorial = root.querySelector(".hud__tutorial-text") as HTMLParagraphElement;
    this.prompt = root.querySelector(".hud__prompt") as HTMLDivElement;
    this.promptText = root.querySelector(".hud__prompt-text") as HTMLParagraphElement;
    this.promptFill = root.querySelector(".hud__prompt-fill") as HTMLDivElement;
    this.healthValue = root.querySelector(".health-value") as HTMLSpanElement;
    this.healthFill = root.querySelector(".health-fill") as HTMLDivElement;
    this.exposureValue = root.querySelector(".exposure-value") as HTMLSpanElement;
    this.exposureFill = root.querySelector(".exposure-fill") as HTMLDivElement;
    this.intelDrawer = root.querySelector(".intel-drawer") as HTMLDivElement;
    this.intelLog = root.querySelector(".drawer__log") as HTMLParagraphElement;
    this.statusBadge = root.querySelector(".status-badge") as HTMLSpanElement;
    this.pauseOverlay = root.querySelector(".overlay--pause") as HTMLDivElement;
    this.resultOverlay = root.querySelector(".overlay--result") as HTMLDivElement;
    this.resultTitle = root.querySelector(".js-result-title") as HTMLHeadingElement;
    this.resultBody = root.querySelector(".js-result-body") as HTMLParagraphElement;
    this.resultAction = root.querySelector(".js-result-action") as HTMLButtonElement;
    this.resultMetrics = root.querySelector(".result-metrics") as HTMLDivElement;

    this.panelButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const panel = button.dataset.panel as SafehousePanel;
        this.selectPanel(panel);
      });
    });

    this.panelContent.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!target) {
        return;
      }

      if (target.dataset.operationId) {
        this.callbacks.onSelectOperation(target.dataset.operationId as OperationId);
        return;
      }

      if (target.dataset.loadoutId) {
        this.callbacks.onSelectLoadout(target.dataset.loadoutId as LoadoutId);
        return;
      }

      if (target.dataset.skillId) {
        this.callbacks.onUnlockSkill(target.dataset.skillId as SkillId);
        return;
      }

      if (target.classList.contains("js-inline-deploy")) {
        this.callbacks.onDeploy();
      }
    });

    root.querySelector(".js-deploy")?.addEventListener("click", callbacks.onDeploy);
    root.querySelector(".js-resume")?.addEventListener("click", callbacks.onResume);
    root.querySelectorAll(".js-restart").forEach((button) => button.addEventListener("click", callbacks.onRestart));
    root.querySelectorAll(".js-intel, .hud__intel-toggle").forEach((button) => button.addEventListener("click", callbacks.onToggleIntel));
    root.querySelectorAll(".js-safehouse").forEach((button) => button.addEventListener("click", callbacks.onReturnToSafehouse));

    this.selectPanel("Continue");
  }

  setBriefingState(state: BriefingState) {
    this.briefingState = state;
    this.summaryOperation.textContent = `${state.operation.name} / ${state.operation.risk}`;
    this.summaryLoadout.textContent = `${state.loadout.name} / ${state.loadout.role}`;
    this.summaryCareer.textContent = `${state.profile.seedsRecovered} recovered / ${state.profile.totalRuns} runs`;
    this.summaryBest.textContent = state.profile.bestAssessment ?? "No clean exit yet";
    this.deployButton.textContent = this.deployLabel();
    this.campaignProgress.textContent = state.profile.campaignCleared
      ? "Campaign complete. The evacuation lane is open. Deploy plays the three missions again."
      : `Next mission ${state.profile.campaignStep + 1} of 3: ${state.operation.name}.`;
    this.renderActivePanel();
  }

  setResolution(resolution: RunResolution | null) {
    this.resolution = resolution;
  }

  private deployLabel(): string {
    if (this.briefingState?.profile.campaignCleared) {
      return "Play the campaign again";
    }

    return `Deploy ${this.briefingState?.operation.name ?? "Ghost Signal"}`;
  }

  hideBriefing() {
    this.briefingOverlay.hidden = true;
  }

  showBriefing() {
    this.briefingOverlay.hidden = false;
    this.pauseOverlay.hidden = true;
    this.resultOverlay.hidden = true;
  }

  setSafehousePanel(panel: SafehousePanel) {
    this.selectPanel(panel);
  }

  showPause(paused: boolean) {
    this.pauseOverlay.hidden = !paused;
  }

  update(state: SimulationState) {
    const missionStarted = state.phase !== "briefing";
    this.hudRoot.hidden = !missionStarted;
    this.intelDrawer.hidden = !missionStarted;

    this.objective.textContent = state.ui.objective;
    this.objectiveDetail.textContent = state.ui.objectiveDetail;
    this.rulesLine.textContent = `${WHOLE_GAME.win} ${WHOLE_GAME.loss}`;
    this.vitalLabel.textContent = state.missionKind === "escape" ? "Hull" : "Vitals";
    this.location.textContent = state.ui.location;
    this.callout.textContent = state.ui.callout || "Hold the route clean and keep the dock quiet.";
    this.tutorial.textContent = state.ui.tutorial;
    this.intelDrawer.classList.toggle("is-open", state.ui.intelOpen);
    this.intelLog.textContent = state.ui.callout || "Kestrel is holding the corridor. Keep the route clean.";
    this.syncObjectiveSteps(state);

    const healthPercent = Math.round((state.player.health / Math.max(state.player.maxHealth, 1)) * 100);
    this.healthValue.textContent = String(healthPercent);
    this.healthFill.style.width = `${healthPercent}%`;
    const exposurePercent = Math.round(state.ui.exposure * 100);
    this.exposureValue.textContent = String(exposurePercent);
    this.exposureFill.style.width = `${exposurePercent}%`;
    this.statusBadge.textContent = state.ui.alarm ? "Lockdown active" : exposurePercent > 0 ? "Scanning heat" : "Silent running";
    this.statusBadge.classList.toggle("is-alert", state.ui.alarm);

    if (state.ui.prompt) {
      this.prompt.hidden = false;
      this.promptText.textContent = state.ui.prompt.text;
      this.promptFill.style.width = `${Math.round(state.ui.prompt.progress * 100)}%`;
    } else {
      this.prompt.hidden = true;
      this.promptFill.style.width = "0%";
    }

    if (state.phase !== "complete" && state.phase !== "failed") {
      this.resolution = null;
    }

    this.showPause(state.phase === "paused");

    if (state.phase === "complete" && this.resolution?.kind === "game-win") {
      this.resultOverlay.hidden = false;
      this.resultTitle.textContent = "Evacuation lane open";
      this.resultBody.textContent = `${this.resolution.missionName} cleared the storm gate. You won Starfall Protocol. ${WHOLE_GAME.win}`;
      this.populateMetrics(state, true);
    } else if (state.phase === "complete" && this.resolution?.kind === "mission-win") {
      this.resultOverlay.hidden = false;
      this.resultTitle.textContent = `${this.resolution.missionName} secured`;
      this.resultBody.textContent = `${this.resolution.missionName} is clear. You have not won the game yet. Continue into ${this.resolution.nextName}. ${WHOLE_GAME.loss}`;
      this.populateMetrics(state, true);
    } else if (state.phase === "complete") {
      const assessment = getRunAssessment(state.stats, true);
      const latestConsequence = this.briefingState?.consequenceReports[0];
      const aftermath = this.buildAftermathLine(state, true);
      this.resultOverlay.hidden = false;
      this.resultTitle.textContent = "Extraction secured";
      this.resultBody.textContent = this.briefingState
        ? `${this.briefingState.operation.name} closed as ${assessment.toLowerCase()} with the ${this.briefingState.loadout.name} package. ${
            latestConsequence ? `${latestConsequence.title}: ${latestConsequence.body}` : "The safehouse board is ready for the next run."
          } ${aftermath}`
        : `The navigation seed is aboard and the corridor is open. ${aftermath}`;
      this.populateMetrics(state, true);
    } else if (state.phase === "failed") {
      const assessment = getRunAssessment(state.stats, false);
      const latestConsequence = this.briefingState?.consequenceReports[0];
      const aftermath = this.buildAftermathLine(state, false);
      const cause = state.missionKind === "escape" ? "The skiff hull hit zero." : "Your vitals hit zero.";
      this.resultOverlay.hidden = false;
      this.resultTitle.textContent = "Session lost";
      this.resultBody.textContent = this.resolution?.kind === "loss"
        ? `${cause} ${this.resolution.missionName} ended before the evacuation lane opened. ${WHOLE_GAME.loss}`
        : this.briefingState
          ? `${this.briefingState.operation.name} broke as ${assessment.toLowerCase()} under the ${this.briefingState.loadout.name} package. ${
              latestConsequence ? `${latestConsequence.title}: ${latestConsequence.body}` : "Drop to the safehouse, retune the run, and go again cleaner."
            } ${aftermath}`
          : `${cause} ${aftermath}`;
      this.populateMetrics(state, false);
    } else {
      this.resultOverlay.hidden = true;
    }

    if (this.resolution?.kind === "game-win") {
      this.resultAction.textContent = "Play the campaign again";
    } else if (this.resolution?.kind === "mission-win") {
      this.resultAction.textContent = "Continue campaign";
    } else if (state.phase === "failed") {
      this.resultAction.textContent = "Retry mission";
    } else {
      this.resultAction.textContent = "Redeploy";
    }
  }

  private selectPanel(name: SafehousePanel) {
    this.activePanel = name;
    this.panelButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.panel === name));
    const panel = PANEL_META[name];
    this.panelEyebrow.textContent = panel.eyebrow;
    this.panelTitle.textContent = panel.title;
    this.renderActivePanel();
  }

  private renderActivePanel() {
    if (!this.briefingState) {
      this.panelContent.innerHTML = "";
      return;
    }

    switch (this.activePanel) {
      case "Continue":
        this.panelContent.innerHTML = this.renderContinuePanel();
        break;
      case "Operations":
        this.panelContent.innerHTML = this.renderOperationsPanel();
        break;
      case "Loadout":
        this.panelContent.innerHTML = this.renderLoadoutPanel();
        break;
      case "Intel":
        this.panelContent.innerHTML = this.renderIntelPanel();
        break;
      case "Options":
        this.panelContent.innerHTML = this.renderOptionsPanel();
        break;
    }
  }

  private renderContinuePanel(): string {
    const { operation, loadout, profile, campaignPressure } = this.briefingState as BriefingState;
    return `
      <div class="briefing-cards">
        <article class="briefing-card">
          <p class="briefing-card__eyebrow">Selected contract</p>
          <h3>${escapeHtml(operation.name)}</h3>
          <p>${escapeHtml(operation.summary)}</p>
          <div class="briefing-tags">${operation.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        </article>
        <article class="briefing-card">
          <p class="briefing-card__eyebrow">Selected loadout</p>
          <h3>${escapeHtml(loadout.name)}</h3>
          <p>${escapeHtml(loadout.summary)}</p>
          <div class="briefing-tags">${loadout.perks.map((perk) => `<span>${escapeHtml(perk)}</span>`).join("")}</div>
        </article>
        <article class="briefing-card">
          <p class="briefing-card__eyebrow">Operator lattice</p>
          <h3>${this.briefingState?.skills.length ?? 0} nodes active</h3>
          <p>
            ${this.briefingState?.availableSkillPoints ?? 0} upgrade point${(this.briefingState?.availableSkillPoints ?? 0) === 1 ? "" : "s"} ready to spend.
            Clear more extractions to deepen the runner.
          </p>
          <div class="briefing-tags">
            ${
              (this.briefingState?.skills.length ?? 0) > 0
                ? this.briefingState?.skills.map((skill) => `<span>${escapeHtml(skill.name)}</span>`).join("")
                : "<span>No nodes unlocked</span>"
            }
          </div>
        </article>
        <article class="briefing-card">
          <p class="briefing-card__eyebrow">Campaign pressure</p>
          <h3>${campaignPressure.tone === "critical" ? "Critical board" : campaignPressure.tone === "heated" ? "Heated board" : "Stable board"}</h3>
          <p>${escapeHtml(campaignPressure.summary)}</p>
          <div class="briefing-tags">${campaignPressure.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        </article>
      </div>
      <div class="briefing-summary-grid">
        <div class="briefing-summary"><span>Total runs</span><strong>${profile.totalRuns}</strong></div>
        <div class="briefing-summary"><span>Successful lifts</span><strong>${profile.successfulRuns}</strong></div>
        <div class="briefing-summary"><span>Best assessment</span><strong>${escapeHtml(profile.bestAssessment ?? "Pending")}</strong></div>
        <div class="briefing-summary"><span>Fastest exit</span><strong>${escapeHtml(formatDuration(profile.bestTimeSeconds))}</strong></div>
      </div>
      ${this.renderCampaignPressureBlock(campaignPressure)}
      <button class="button button--primary js-inline-deploy" type="button">${this.deployLabel()}</button>
    `;
  }

  private renderOperationsPanel(): string {
    const selectedId = this.briefingState?.operation.id;
    const step = this.briefingState?.profile.campaignStep ?? 0;
    const cleared = this.briefingState?.profile.campaignCleared ?? false;
    return `
      <div class="briefing-grid">
        ${OPERATIONS.map((operation, index) => {
          const locked = !cleared && index > step;
          const current = CAMPAIGN_ORDER[index] === operation.id && index === step && !cleared;
          return `
            <button class="briefing-option${operation.id === selectedId ? " is-selected" : ""}" data-operation-id="${locked ? "" : operation.id}" type="button"${locked ? " disabled" : ""}>
              <p class="briefing-card__eyebrow">${escapeHtml(operation.risk)} risk${current ? " / next" : ""}</p>
              <h3>${escapeHtml(operation.name)}</h3>
              <p>${escapeHtml(operation.summary)}</p>
              <div class="briefing-tags">${operation.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}${locked ? "<span>Locked</span>" : ""}</div>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  private renderLoadoutPanel(): string {
    const briefingState = this.briefingState as BriefingState;
    const selectedId = briefingState.loadout.id;
    return `
      <div class="briefing-grid">
        ${LOADOUTS.map(
          (loadout) => `
            <button class="briefing-option${loadout.id === selectedId ? " is-selected" : ""}" data-loadout-id="${loadout.id}" type="button">
              <p class="briefing-card__eyebrow">${escapeHtml(loadout.role)}</p>
              <h3>${escapeHtml(loadout.name)}</h3>
              <p>${escapeHtml(loadout.summary)}</p>
              <div class="briefing-tags">${loadout.perks.map((perk) => `<span>${escapeHtml(perk)}</span>`).join("")}</div>
            </button>
          `,
        ).join("")}
      </div>
      <div class="briefing-section">
        <p class="briefing-card__eyebrow">Operator lattice</p>
        <p class="briefing-copy">
          Spend recovered seeds to unlock permanent upgrades across infiltration, combat, cyberwarfare, and mobility.
          Available points: <strong>${briefingState.availableSkillPoints}</strong>
        </p>
        <div class="skill-grid">
          ${SKILLS.map((skill) => this.renderSkillButton(skill, briefingState)).join("")}
        </div>
      </div>
    `;
  }

  private renderIntelPanel(): string {
    const { profile, skills, availableSkillPoints, campaignPressure, consequenceReports } = this.briefingState as BriefingState;
    const operationRecords = OPERATIONS.map((operation) => {
      const record = profile.operationRecords[operation.id];
      return `
        <div class="briefing-record">
          <strong>${escapeHtml(operation.name)}</strong>
          <span>${record.completions}/${record.runs} clear</span>
          <span>Best ${escapeHtml(formatDuration(record.bestTimeSeconds))}</span>
        </div>
      `;
    }).join("");

    const reports =
      profile.recentReports.length > 0
        ? profile.recentReports
            .map(
              (report) => `
                <div class="briefing-report">
                  <strong>${escapeHtml(report.operationName)}</strong>
                  <span>${escapeHtml(report.loadoutName)}</span>
                  <span>${escapeHtml(report.assessment)} / ${escapeHtml(formatDuration(report.elapsedSeconds))}</span>
                </div>
              `,
            )
            .join("")
        : `<p class="briefing-empty">No career reports yet. Clear a run and the safehouse log will start filling out.</p>`;

    const consequenceLog =
      consequenceReports.length > 0
        ? consequenceReports
            .map(
              (report) => `
                <div class="briefing-report briefing-report--${report.tone}">
                  <strong>${escapeHtml(report.title)}</strong>
                  <span>${escapeHtml(report.body)}</span>
                </div>
              `,
            )
            .join("")
        : `<p class="briefing-empty">No consequence reports yet. The board will start tracking faction pressure after the next deployment.</p>`;

    return `
      <div class="briefing-summary-grid">
        <div class="briefing-summary"><span>Recovered seeds</span><strong>${profile.seedsRecovered}</strong></div>
        <div class="briefing-summary"><span>Contracts cleared</span><strong>${profile.successfulRuns}</strong></div>
        <div class="briefing-summary"><span>Best extraction</span><strong>${escapeHtml(profile.bestAssessment ?? "Pending")}</strong></div>
        <div class="briefing-summary"><span>Fastest route</span><strong>${escapeHtml(formatDuration(profile.bestTimeSeconds))}</strong></div>
        <div class="briefing-summary"><span>Unlocked skills</span><strong>${skills.length}</strong></div>
        <div class="briefing-summary"><span>Upgrade points</span><strong>${availableSkillPoints}</strong></div>
      </div>
      ${this.renderCampaignPressureBlock(campaignPressure)}
      <div class="briefing-section">
        <p class="briefing-card__eyebrow">Contract records</p>
        <div class="briefing-stack">${operationRecords}</div>
      </div>
      <div class="briefing-section">
        <p class="briefing-card__eyebrow">Unlocked lattice</p>
        <div class="briefing-tags">
          ${skills.length > 0 ? skills.map((skill) => `<span>${escapeHtml(skill.name)}</span>`).join("") : "<span>No nodes unlocked</span>"}
        </div>
      </div>
      <div class="briefing-section">
        <p class="briefing-card__eyebrow">Consequence log</p>
        <div class="briefing-stack">${consequenceLog}</div>
      </div>
      <div class="briefing-section">
        <p class="briefing-card__eyebrow">Recent reports</p>
        <div class="briefing-stack">${reports}</div>
      </div>
    `;
  }

  private renderOptionsPanel(): string {
    return `
      <div class="briefing-section">
        <p class="briefing-card__eyebrow">Controls</p>
        <div class="briefing-tags">
          <span>WASD move or fly</span>
          <span>Shift sprint</span>
          <span>Q scan</span>
          <span>E interact</span>
          <span>F fire</span>
          <span>Esc pause</span>
          <span>Tab or I intel</span>
        </div>
      </div>
      <div class="briefing-section">
        <p class="briefing-card__eyebrow">Campaign</p>
        <p class="briefing-copy">
          Starfall Protocol is these three missions and no further ones. Finish them in order from this board. Clearing Cinder Vector wins the game. Hitting zero vitals, or zero skiff hull on the last mission, loses the session.
        </p>
      </div>
      <div class="briefing-section">
        <p class="briefing-card__eyebrow">Persistence</p>
        <p class="briefing-copy">
          Career stats, selected contract/loadout, unlocked nodes, and consequence state are stored locally in this browser so the safehouse remembers how the operator lane is evolving.
        </p>
      </div>
    `;
  }

  private renderCampaignPressureBlock(campaignPressure: CampaignPressure): string {
    return `
      <div class="briefing-section">
        <p class="briefing-card__eyebrow">Current directive</p>
        <p class="briefing-copy">${escapeHtml(campaignPressure.directive)}</p>
        <div class="campaign-grid">
          ${this.renderCampaignPressureCard("Black Glass heat", campaignPressure.blackGlassHeat, "danger")}
          ${this.renderCampaignPressureCard("Lane stability", campaignPressure.evacuationLaneStability, "good")}
          ${this.renderCampaignPressureCard("Safehouse exposure", campaignPressure.safehouseExposure, "warn")}
        </div>
      </div>
    `;
  }

  private renderCampaignPressureCard(label: string, value: number, accent: "danger" | "good" | "warn"): string {
    return `
      <div class="campaign-card campaign-card--${accent}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(formatPressure(value))}</strong>
        <div class="campaign-meter">
          <div class="campaign-meter__fill campaign-meter__fill--${accent}" style="width: ${Math.max(6, value)}%"></div>
        </div>
      </div>
    `;
  }

  private renderSkillButton(skill: SkillDefinition, briefingState: BriefingState): string {
    const unlocked = briefingState.profile.unlockedSkillIds.includes(skill.id);
    const unlockable = canUnlockSkill(briefingState.profile, skill.id);
    const blocked = !unlocked && !unlockable;
    const requirementText =
      skill.requirements.length > 0
        ? `Requires ${skill.requirements
            .map((requirement) => SKILLS.find((entry) => entry.id === requirement)?.name ?? requirement)
            .join(" + ")}`
        : "Available from the start";

    return `
      <button
        class="skill-card${unlocked ? " is-unlocked" : unlockable ? " is-unlockable" : " is-locked"}"
        data-skill-id="${skill.id}"
        type="button"
        ${blocked ? "disabled" : ""}
      >
        <p class="briefing-card__eyebrow">${escapeHtml(skill.track)} / Tier ${skill.tier}</p>
        <h3>${escapeHtml(skill.name)}</h3>
        <p>${escapeHtml(skill.summary)}</p>
        <div class="briefing-tags">
          <span>${escapeHtml(requirementText)}</span>
          <span>${escapeHtml(unlocked ? "Unlocked" : unlockable ? `Spend ${skill.cost} point` : "Locked")}</span>
        </div>
      </button>
    `;
  }

  private populateMetrics(state: SimulationState, success: boolean) {
    const setMetric = (selector: string, value: string) => {
      const element = this.resultMetrics.querySelector(selector);
      if (element) {
        element.textContent = value;
      }
    };

    setMetric(".js-metric-grade", getRunAssessment(state.stats, success));
    setMetric(".js-metric-time", `${state.elapsed.toFixed(1)}s`);
    setMetric(".js-metric-scans", String(state.stats.scansUsed));
    setMetric(".js-metric-shots", String(state.stats.shotsFired));
    setMetric(".js-metric-kills", String(state.stats.enemiesNeutralized));
    setMetric(".js-metric-damage", String(state.stats.damageTaken));
    setMetric(".js-metric-alarms", String(state.stats.alarmsTriggered));
  }

  private syncObjectiveSteps(state: SimulationState) {
    if (state.missionKind === "recovery") {
      const westDown = state.relays.find((relay) => relay.id === "relay-west")?.destroyed === true;
      const eastDown = state.relays.find((relay) => relay.id === "relay-east")?.destroyed === true;
      const active = state.objective === "extract" ? "extract" : !westDown ? "relay-west" : !eastDown ? "relay-east" : "turret";
      this.renderSteps(
        [
          ["relay-west", "Silence the west relay", westDown],
          ["relay-east", "Silence the east relay", eastDown],
          ["turret", "Drop the ceiling gun", state.turret.destroyed],
          ["extract", "Board the skiff", state.phase === "complete"],
        ],
        state.phase === "briefing" ? null : active,
      );
      return;
    }

    if (state.missionKind === "escape") {
      this.renderSteps(
        [
          ["lane", "Fly the storm lane", false],
          ["extract", "Clear the storm gate", state.phase === "complete"],
        ],
        state.phase === "briefing" ? null : state.phase === "complete" ? "extract" : "lane",
      );
      return;
    }

    const completed = new Set<string>();
    if (state.insertionComplete) completed.add("insert");
    if (state.scanComplete) completed.add("survey");
    if (state.hackComplete) completed.add("hack");
    if (state.coreCollected) completed.add("collect");
    if (state.combatComplete) completed.add("combat");
    if (state.phase === "complete") completed.add("extract");

    this.renderSteps(
      [
        ["insert", "Stabilize insertion", completed.has("insert")],
        ["survey", "Sweep the overlook", completed.has("survey")],
        ["hack", "Breach the archive door", completed.has("hack")],
        ["collect", "Secure the navigation seed", completed.has("collect")],
        ["combat", "Break the lockdown", completed.has("combat")],
        ["extract", "Board the extraction skiff", completed.has("extract")],
      ],
      state.phase === "briefing" ? null : state.objective,
    );
  }

  private renderSteps(steps: Array<[string, string, boolean]>, activeId: string | null) {
    this.stepHost.innerHTML = steps
      .map(
        ([id, label, complete], index) => `
          <div class="drawer__step${complete ? " is-complete" : ""}${activeId === id ? " is-active" : ""}" data-step="${id}">
            <span>${String(index).padStart(2, "0")}</span><strong>${label}</strong>
          </div>
        `,
      )
      .join("");
  }

  private buildAftermathLine(state: SimulationState, success: boolean): string {
    if (success) {
      if (state.stats.alarmsTriggered === 0 && state.stats.damageTaken < 10) {
        return "After-action: Black Glass has no visual trace. The safehouse lane stabilizes.";
      }
      if (state.stats.alarmsTriggered >= 2 || state.stats.damageTaken > 40) {
        return "After-action: The dock logged the breach. Expect hotter patrol pressure on the next run.";
      }
      return "After-action: The corridor stays open, but the Combine will answer fast.";
    }
    if (state.stats.alarmsTriggered >= 2) {
      return "After-action: Black Glass is fully alerted. Reset the insertion and tighten the route.";
    }
    return "After-action: The lane held, but the route broke. Reset and re-enter cleanly.";
  }
}
