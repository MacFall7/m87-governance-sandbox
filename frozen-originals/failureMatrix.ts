// M87 Governance Sandbox — 22-Case Failure Matrix (Prose-Based Spec)
// FROZEN: Do not modify without explicit approval.

import type { FailureCaseSpec } from "./types.js";

export const failureMatrix: FailureCaseSpec[] = [
  // ─── Architect faults ──────────────────────────────────────────────────────
  {
    id: "FA_001",
    injection: "Strip artifact_definition from ticket",
    expected: "RELAY rejects. Ticket stays OPEN. Escalation with missing_artifact_definition.",
    failure_if: "RELAY forwards to Specialist without artifact_definition",
    category: "architect",
  },
  {
    id: "FA_002",
    injection: "Submit duplicate ticket (identity — event-sequence trigger)",
    expected: "Reducer rejects second submit. State unchanged. Escalation with duplicate_ticket.",
    failure_if: "Second ticket overwrites the first",
    category: "architect",
  },
  {
    id: "FA_003",
    injection: "Set mode=standard but riskClass=critical (mode-risk mismatch)",
    expected: "RELAY_CHECK_MODE_RISK escalates mode_risk_mismatch. State goes BLOCKED.",
    failure_if: "System allows critical-risk work under standard mode",
    category: "architect",
  },
  {
    id: "FA_004",
    injection: "Corrupt manifest approvedBy to SPECIALIST",
    expected: "Reducer rejects manifest. Escalation with role_boundary_violation.",
    failure_if: "Manifest accepted with unauthorized approver",
    category: "architect",
  },

  // ─── Relay faults ──────────────────────────────────────────────────────────
  {
    id: "FR_001",
    injection: "Null out ticket (relay drops ticket mid-flow)",
    expected: "Next action fails precondition. Escalation with missing_ticket.",
    failure_if: "System proceeds without a ticket",
    category: "relay",
  },
  {
    id: "FR_002",
    injection: "Forward without validation (identity — event-sequence trigger)",
    expected: "RELAY_FORWARD_TICKET on IDLE state. Escalation with forward_without_ticket.",
    failure_if: "Ticket forwarded from IDLE state",
    category: "relay",
  },
  {
    id: "FR_003",
    injection: "Set lastTranslationCompressed=true (translation corrupted)",
    expected: "RELAY_DECOMPRESS_TRANSLATION detects compressed flag. Escalation with translation_integrity_failure.",
    failure_if: "System uses compressed translation without decompressing",
    category: "relay",
  },
  {
    id: "FR_004",
    injection: "Corrupt manifest ticketId to TKT-WRONG",
    expected: "SPECIALIST_EXECUTE detects mismatch. Escalation with execute_manifest_ticket_mismatch.",
    failure_if: "Execution proceeds with mismatched manifest",
    category: "relay",
  },

  // ─── Specialist faults ─────────────────────────────────────────────────────
  {
    id: "FS_001",
    injection: "Null out manifest (specialist loses manifest)",
    expected: "SPECIALIST_EXECUTE fails precondition. Escalation with execute_without_manifest.",
    failure_if: "Execution proceeds without manifest",
    category: "specialist",
  },
  {
    id: "FS_002",
    injection: "Corrupt manifest ticketId to TKT-MISMATCH",
    expected: "SPECIALIST_EXECUTE detects mismatch. Escalation with execute_manifest_ticket_mismatch.",
    failure_if: "Execution proceeds with wrong manifest",
    category: "specialist",
  },
  {
    id: "FS_003",
    injection: "Return receipt on bare state (identity — event-sequence trigger)",
    expected: "SPECIALIST_RETURN_RECEIPT without ticket/manifest. Escalation with receipt_without_ticket_or_manifest.",
    failure_if: "Receipt accepted without prior artifacts",
    category: "specialist",
  },
  {
    id: "FS_004",
    injection: "Corrupt receipt ticketId to TKT-WRONG",
    expected: "Receipt ticketId doesn't match active ticket. Escalation with receipt_ticket_mismatch.",
    failure_if: "Receipt accepted with wrong ticket reference",
    category: "specialist",
  },

  // ─── STRIDE faults ─────────────────────────────────────────────────────────
  {
    id: "FST_001",
    injection: "Set strideOnline=false (STRIDE offline)",
    expected: "STRIDE_COLD_START with success=false. State goes HALTED. Escalation with stride_cold_start_failed.",
    failure_if: "System continues with STRIDE offline",
    category: "stride",
  },
  {
    id: "FST_002",
    injection: "Set strideSim.spoofing=true (spoofing detected)",
    expected: "STRIDE_RUN_SIM detects spoofing. State goes BLOCKED. Escalation present.",
    failure_if: "System ignores spoofing threat",
    category: "stride",
  },
  {
    id: "FST_003",
    injection: "Set strideSim.tampering=true (tampering detected)",
    expected: "STRIDE_RUN_SIM detects tampering. State goes BLOCKED. Escalation present.",
    failure_if: "System ignores tampering threat",
    category: "stride",
  },
  {
    id: "FST_004",
    injection: "Set strideSim.denialOfService=true (DoS detected)",
    expected: "STRIDE_RUN_SIM detects DoS. State goes BLOCKED. Escalation present.",
    failure_if: "System ignores DoS threat",
    category: "stride",
  },

  // ─── Cross-cutting faults ──────────────────────────────────────────────────
  {
    id: "FC_001",
    injection: "Close without ticket/manifest/receipt (identity — event-sequence trigger)",
    expected: "ARCHITECT_CLOSE_TICKET fails. Escalation with close_without_artifacts.",
    failure_if: "Ticket closed without measurable acceptance",
    category: "cross",
  },
  {
    id: "FC_002",
    injection: "Close already-CLOSED ticket (identity — event-sequence trigger)",
    expected: "ARCHITECT_CLOSE_TICKET on CLOSED state. Escalation with action_on_closed.",
    failure_if: "Double close succeeds",
    category: "cross",
  },
  {
    id: "FC_003",
    injection: "Execute on HALTED state (identity — event-sequence trigger)",
    expected: "SPECIALIST_EXECUTE on HALTED state. Escalation with action_on_halted.",
    failure_if: "Execution proceeds despite HALTED state",
    category: "cross",
  },
  {
    id: "FC_004",
    injection: "Corrupt receipt manifestTicketId to TKT-WRONG",
    expected: "Receipt manifest mismatch detected. Escalation with receipt_ticket_mismatch.",
    failure_if: "Receipt accepted with wrong manifest reference",
    category: "cross",
  },
  {
    id: "FC_005",
    injection: "Set receipt result to failure",
    expected: "ARCHITECT_CLOSE_TICKET fails. Escalation with close_without_artifacts.",
    failure_if: "Ticket closed despite failed receipt",
    category: "cross",
  },
  {
    id: "FC_006",
    injection: "Set missedCommitments to 10 (threshold exceeded)",
    expected: "SPECIALIST_REPORT_COMMITMENT detects threshold. Escalation with missed_commitment_threshold. State goes BLOCKED.",
    failure_if: "System ignores excessive missed commitments",
    category: "cross",
  },
];
