import type { MissionStats } from "../simulation/types";

export function getRunAssessment(stats: MissionStats, success: boolean): string {
  if (!success) {
    return stats.alarmsTriggered === 0 ? "Broken insertion" : "Compromised";
  }

  if (stats.alarmsTriggered === 0 && stats.damageTaken === 0 && stats.shotsFired <= 4) {
    return "Ghost clean";
  }

  if (stats.damageTaken <= 24 && stats.alarmsTriggered <= 1) {
    return "Cold extraction";
  }

  if (stats.damageTaken <= 48) {
    return "Hard exit";
  }

  return "Barely aboard";
}
