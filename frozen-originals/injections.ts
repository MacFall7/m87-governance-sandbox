// M87 Governance Sandbox — 22 Fault Injection Definitions
// FROZEN: Do not modify without explicit approval.

import type { SystemState, Injection } from "./types.js";

export const injections: Injection[] = [
  // ─── Architect faults (FA) ─────────────────────────────────────────────────
  {
    id: "FA_001",
    apply: (s) => ({
      ...s,
      ticket: s.ticket ? { ...s.ticket, artifact_definition: undefined } : s.ticket,
    }),
  },
  {
    id: "FA_002",
    apply: (s) => s, // identity — triggered by event sequence (duplicate ticket)
  },
  {
    id: "FA_003",
    apply: (s) => ({
      ...s,
      mode: "standard" as const,
      riskClass: "critical" as const,
    }),
  },
  {
    id: "FA_004",
    apply: (s) => ({
      ...s,
      manifest: s.manifest
        ? { ...s.manifest, approvedBy: "SPECIALIST" as const }
        : s.manifest,
    }),
  },

  // ─── Relay faults (FR) ─────────────────────────────────────────────────────
  {
    id: "FR_001",
    apply: (s) => ({
      ...s,
      ticket: null,
    }),
  },
  {
    id: "FR_002",
    apply: (s) => s, // identity — triggered by event sequence (forward without validation)
  },
  {
    id: "FR_003",
    apply: (s) => ({
      ...s,
      lastTranslationCompressed: true,
    }),
  },
  {
    id: "FR_004",
    apply: (s) => ({
      ...s,
      manifest: s.manifest ? { ...s.manifest, ticketId: "TKT-WRONG" } : s.manifest,
    }),
  },

  // ─── Specialist faults (FS) ────────────────────────────────────────────────
  {
    id: "FS_001",
    apply: (s) => ({
      ...s,
      manifest: null,
    }),
  },
  {
    id: "FS_002",
    apply: (s) => ({
      ...s,
      manifest: s.manifest
        ? { ...s.manifest, ticketId: "TKT-MISMATCH" }
        : s.manifest,
    }),
  },
  {
    id: "FS_003",
    apply: (s) => s, // identity — triggered by event sequence (receipt without artifacts)
  },
  {
    id: "FS_004",
    apply: (s) => ({
      ...s,
      receipt: s.receipt ? { ...s.receipt, ticketId: "TKT-WRONG" } : s.receipt,
    }),
  },

  // ─── STRIDE faults (FST) ──────────────────────────────────────────────────
  {
    id: "FST_001",
    apply: (s) => ({
      ...s,
      strideOnline: false,
    }),
  },
  {
    id: "FST_002",
    apply: (s) => ({
      ...s,
      strideSim: { ...s.strideSim, spoofing: true },
    }),
  },
  {
    id: "FST_003",
    apply: (s) => ({
      ...s,
      strideSim: { ...s.strideSim, tampering: true },
    }),
  },
  {
    id: "FST_004",
    apply: (s) => ({
      ...s,
      strideSim: { ...s.strideSim, denialOfService: true },
    }),
  },

  // ─── Cross-cutting faults (FC) ─────────────────────────────────────────────
  {
    id: "FC_001",
    apply: (s) => s, // identity — triggered by event sequence (close without artifacts)
  },
  {
    id: "FC_002",
    apply: (s) => s, // identity — triggered by event sequence (close already closed)
  },
  {
    id: "FC_003",
    apply: (s) => s, // identity — triggered by event sequence (action on HALTED)
  },
  {
    id: "FC_004",
    apply: (s) => ({
      ...s,
      receipt: s.receipt
        ? { ...s.receipt, manifestTicketId: "TKT-WRONG" }
        : s.receipt,
    }),
  },
  {
    id: "FC_005",
    apply: (s) => ({
      ...s,
      receipt: s.receipt
        ? { ...s.receipt, result: "failure" as const }
        : s.receipt,
    }),
  },
  {
    id: "FC_006",
    apply: (s) => ({
      ...s,
      missedCommitments: 10,
    }),
  },
];

export function getInjection(id: string): Injection {
  const inj = injections.find((i) => i.id === id);
  if (!inj) throw new Error(`Unknown injection: ${id}`);
  return inj;
}
