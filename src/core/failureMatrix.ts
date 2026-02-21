// M87 Governance Sandbox — 22-Case Failure Matrix (Declarative Spec)
// FROZEN: Do not modify without explicit approval.

import type { FailureMatrixEntry } from "./types";

export const failureMatrix: FailureMatrixEntry[] = [
  { id: "INJ-01", name: "Forward without ticket", injection: "INJ-01", expectedTrigger: "forward_without_ticket", expectedSeverity: "high", invariant: "No action without a ticket" },
  { id: "INJ-02", name: "Manifest without ticket", injection: "INJ-02", expectedTrigger: "manifest_without_ticket", expectedSeverity: "high", invariant: "No action without a ticket" },
  { id: "INJ-03", name: "Manifest ticket mismatch", injection: "INJ-03", expectedTrigger: "manifest_ticket_mismatch", expectedSeverity: "high", invariant: "Manifest must reference active ticket" },
  { id: "INJ-04", name: "Execute without ticket", injection: "INJ-04", expectedTrigger: "execute_without_ticket", expectedSeverity: "high", invariant: "No action without a ticket" },
  { id: "INJ-05", name: "Execute without manifest", injection: "INJ-05", expectedTrigger: "execute_without_manifest", expectedSeverity: "high", invariant: "No execution without manifest" },
  { id: "INJ-06", name: "Execute manifest-ticket mismatch", injection: "INJ-06", expectedTrigger: "execute_manifest_ticket_mismatch", expectedSeverity: "high", invariant: "Execution manifest must match ticket" },
  { id: "INJ-07", name: "Receipt without ticket or manifest", injection: "INJ-07", expectedTrigger: "receipt_without_ticket_or_manifest", expectedSeverity: "high", invariant: "No receipt without prior artifacts" },
  { id: "INJ-08", name: "Receipt ticket mismatch", injection: "INJ-08", expectedTrigger: "receipt_ticket_mismatch", expectedSeverity: "high", invariant: "Receipt must reference active ticket" },
  { id: "INJ-09", name: "STRIDE cold start failed", injection: "INJ-09", expectedTrigger: "stride_cold_start_failed", expectedSeverity: "critical", invariant: "STRIDE must be online" },
  { id: "INJ-10", name: "Close without artifacts", injection: "INJ-10", expectedTrigger: "close_without_artifacts", expectedSeverity: "high", invariant: "Measurable acceptance required" },
  { id: "INJ-11", name: "Close without manifest", injection: "INJ-11", expectedTrigger: "close_without_artifacts", expectedSeverity: "high", invariant: "Measurable acceptance required" },
  { id: "INJ-12", name: "Close without receipt", injection: "INJ-12", expectedTrigger: "close_without_artifacts", expectedSeverity: "high", invariant: "Measurable acceptance required" },
  { id: "INJ-13", name: "Close with failed receipt", injection: "INJ-13", expectedTrigger: "close_without_artifacts", expectedSeverity: "high", invariant: "Measurable acceptance required" },
  { id: "INJ-14", name: "Forward from SPECIALIST (wrong role)", injection: "INJ-14", expectedTrigger: "role_boundary_violation", expectedSeverity: "high", invariant: "Role boundaries enforced" },
  { id: "INJ-15", name: "Manifest submitted by SPECIALIST", injection: "INJ-15", expectedTrigger: "role_boundary_violation", expectedSeverity: "high", invariant: "Role boundaries enforced" },
  { id: "INJ-16", name: "Execute by ARCHITECT", injection: "INJ-16", expectedTrigger: "role_boundary_violation", expectedSeverity: "high", invariant: "Role boundaries enforced" },
  { id: "INJ-17", name: "Double submit ticket", injection: "INJ-17", expectedTrigger: "missing_ticket", expectedSeverity: "medium", invariant: "No duplicate tickets" },
  { id: "INJ-18", name: "Close already closed ticket", injection: "INJ-18", expectedTrigger: "close_without_artifacts", expectedSeverity: "medium", invariant: "No action on closed ticket" },
  { id: "INJ-19", name: "Execute on HALTED state", injection: "INJ-19", expectedTrigger: "execute_without_ticket", expectedSeverity: "critical", invariant: "No action on HALTED state" },
  { id: "INJ-20", name: "Forward on CLOSED state", injection: "INJ-20", expectedTrigger: "forward_without_ticket", expectedSeverity: "medium", invariant: "No action on CLOSED state" },
  { id: "INJ-21", name: "Validate without ticket", injection: "INJ-21", expectedTrigger: "missing_ticket", expectedSeverity: "high", invariant: "No action without a ticket" },
  { id: "INJ-22", name: "Receipt manifest-ticket mismatch", injection: "INJ-22", expectedTrigger: "receipt_ticket_mismatch", expectedSeverity: "high", invariant: "Receipt must match manifest ticket" },
];
