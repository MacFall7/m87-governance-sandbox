// M87 Governance Sandbox — Pure Utility Functions

import type { SystemState, Manifest, RiskClass, GovernanceMode } from "./types.js";

/**
 * Checks if measurable acceptance criteria exist for a ticket close.
 * A ticket can only close if it has a valid receipt and manifest.
 */
export function isMeasurableAcceptance(state: SystemState): boolean {
  return (
    state.ticket !== null &&
    state.manifest !== null &&
    state.receipt !== null &&
    state.receipt.result === "success"
  );
}

/**
 * Validates that a manifest's steps are non-empty and well-formed.
 */
export function isValidManifest(manifest: Manifest): boolean {
  return (
    manifest.ticketId.length > 0 &&
    manifest.steps.length > 0 &&
    manifest.steps.every((s) => s.trim().length > 0)
  );
}

/**
 * Returns the minimum governance mode required for a given risk class.
 */
export function minimumModeForRisk(risk: RiskClass): GovernanceMode {
  switch (risk) {
    case "low":
      return "standard";
    case "medium":
      return "enhanced";
    case "high":
    case "critical":
      return "lockdown";
  }
}

/**
 * Returns true if the current mode meets or exceeds the minimum for the risk.
 */
export function modeCoversRisk(mode: GovernanceMode, risk: RiskClass): boolean {
  const levels: Record<GovernanceMode, number> = { standard: 0, enhanced: 1, lockdown: 2 };
  const current = levels[mode];
  const required = levels[minimumModeForRisk(risk)];
  return current >= required;
}
