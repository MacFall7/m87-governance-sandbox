// M87 Governance Sandbox — 22 Fault Injection Definitions
// FROZEN: Do not modify without explicit approval.

import { SystemState } from "./types.js";

export interface Injection {
  id: string;
  apply: (s: SystemState) => SystemState;
}

export const injections: Injection[] = [
  { id: "FA_001", apply: (s) => ({ ...s, ticket: s.ticket ? { ...s.ticket, artifact_definition: undefined } : s.ticket }) },
  { id: "FA_002", apply: (s) => s },
  {
    id: "FA_003",
    apply: (s) => ({
      ...s,
      ticket: s.ticket
        ? { ...s.ticket, acceptance_criteria: s.ticket.acceptance_criteria.map((c, i) => (i === 0 ? { ...c, statement: "Looks good" } : c)) }
        : s.ticket
    })
  },
  { id: "FA_004", apply: (s) => ({ ...s, ticket: s.ticket ? { ...s.ticket, governance_mode: undefined } : s.ticket }) },
  { id: "FR_001", apply: (s) => ({ ...s, receiptBundlePresent: false }) },
  { id: "FR_002", apply: (s) => s },
  { id: "FR_003", apply: (s) => ({ ...s, missedCommitments: 1 }) },
  {
    id: "FR_004",
    apply: (s) =>
      s.manifest
        ? { ...s, manifest: { ...s.manifest, environment_required: { ...s.manifest.environment_required, target: "production", network_egress: "open" } } }
        : s
  },
  { id: "FR_005", apply: (s) => ({ ...s, lastTranslationCompressed: true }) },
  {
    id: "FS_001",
    apply: (s) =>
      s.manifest
        ? {
            ...s,
            manifest: {
              ...s.manifest,
              capability_scope: s.manifest.capability_scope.filter((c) => c !== "deploy_production"),
              operations: s.manifest.operations.map((op, i) => (i === 0 ? { ...op, required_capability: "deploy_production" } : op))
            }
          }
        : s
  },
  { id: "FS_002", apply: (s) => (s.manifest ? { ...s, manifest: { ...s.manifest, environment_required: { ...s.manifest.environment_required, target: "production", network_egress: "open" } } } : s) },
  { id: "FS_003", apply: (s) => s },
  {
    id: "FS_004",
    apply: (s) =>
      s.manifest
        ? {
            ...s,
            manifest: {
              ...s.manifest,
              operations: s.manifest.operations.map((op, i) =>
                i === 0
                  ? { ...op, expected_effects: Array.from(new Set([...op.expected_effects, "modifies_environment"])), rollback_strategy: "none" }
                  : op
              )
            }
          }
        : s
  },
  {
    id: "FS_005",
    apply: (s) =>
      s.manifest
        ? {
            ...s,
            manifest: {
              ...s.manifest,
              governance_mode: "production",
              assumptions: [...s.manifest.assumptions.slice(0, 1), { id: "A_BAD", statement: "Trust me", verifiable: false, verification_method: "manual_attestation" }]
            }
          }
        : s
  },
  { id: "FX_001", apply: (s) => ({ ...s, strideSim: { ...s.strideSim, attemptOutsideManifest: true } }) },
  { id: "FX_002", apply: (s) => ({ ...s, strideSim: { ...s.strideSim, persistentLeak: true } }) },
  { id: "FX_003", apply: (s) => ({ ...s, strideSim: { ...s.strideSim, notAllowlistedDomain: true } }) },
  { id: "FX_004", apply: (s) => ({ ...s, strideSim: { ...s.strideSim, scopeExpansion: true } }) },
  { id: "FX_005", apply: (s) => ({ ...s, strideSim: { ...s.strideSim, silentDivergence: true } }) },
  { id: "FC_001", apply: (s) => s },
  { id: "FC_002", apply: (s) => s },
  { id: "FC_003", apply: (s) => s }
];

export function getInjection(id: string): Injection {
  const found = injections.find((x) => x.id === id);
  if (!found) throw new Error(`Unknown injection id: ${id}`);
  return found;
}
