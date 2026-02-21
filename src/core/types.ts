// M87 Governance Sandbox — Canonical Type Definitions
// This file is additive only. Never remove or rename existing members.

// ─── Roles ───────────────────────────────────────────────────────────────────

export type Role =
  | "ARCHITECT"
  | "RELAY"
  | "SPECIALIST"
  | "STRIDE";

// ─── Governance Modes ────────────────────────────────────────────────────────

export type GovernanceMode =
  | "standard"
  | "enhanced"
  | "lockdown";

// ─── Risk Classification ─────────────────────────────────────────────────────

export type RiskClass =
  | "low"
  | "medium"
  | "high"
  | "critical";

// ─── Ticket States ───────────────────────────────────────────────────────────

export type TicketState =
  | "IDLE"
  | "OPEN"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "HALTED"
  | "CLOSED";

// ─── Escalation Severity ─────────────────────────────────────────────────────

export type EscalationSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

// ─── Escalation Triggers ─────────────────────────────────────────────────────

export type EscalationTrigger =
  | "missing_ticket"
  | "forward_without_ticket"
  | "manifest_without_ticket"
  | "manifest_ticket_mismatch"
  | "execute_without_ticket"
  | "execute_without_manifest"
  | "execute_manifest_ticket_mismatch"
  | "receipt_without_ticket_or_manifest"
  | "receipt_ticket_mismatch"
  | "stride_cold_start_failed"
  | "close_without_artifacts"
  | "unknown_event_type"
  | "role_boundary_violation";

// ─── Assertion Types ─────────────────────────────────────────────────────────

export type AssertionType =
  | "invariant"
  | "precondition"
  | "postcondition"
  | "boundary";

// ─── Escalation Record ───────────────────────────────────────────────────────

export interface Escalation {
  trigger: EscalationTrigger;
  severity: EscalationSeverity;
  message: string;
  timestamp: number;
}

// ─── Event Log Entry ─────────────────────────────────────────────────────────

export interface EventLogEntry {
  from: Role;
  to: Role;
  label: string;
  timestamp: number;
}

// ─── Assertion Record ────────────────────────────────────────────────────────

export interface Assertion {
  kind: AssertionType;
  message: string;
  passed: boolean;
}

// ─── Ticket ──────────────────────────────────────────────────────────────────

export interface Ticket {
  id: string;
  title: string;
  description: string;
  riskClass: RiskClass;
  createdBy: Role;
}

// ─── Manifest ────────────────────────────────────────────────────────────────

export interface Manifest {
  ticketId: string;
  steps: string[];
  approvedBy: Role;
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

export interface Receipt {
  ticketId: string;
  manifestTicketId: string;
  completedBy: Role;
  result: "success" | "failure";
}

// ─── Governance State ────────────────────────────────────────────────────────

export interface GovernanceState {
  state: TicketState;
  mode: GovernanceMode;
  riskClass: RiskClass;
  ticket: Ticket | null;
  manifest: Manifest | null;
  receipt: Receipt | null;
  escalations: Escalation[];
  eventLog: EventLogEntry[];
  assertions: Assertion[];
  strideOnline: boolean;
}

// ─── Events (Discriminated Union) ────────────────────────────────────────────

export type Event =
  | { type: "SUBMIT_TICKET"; payload: { ticket: Ticket } }
  | { type: "VALIDATE_TICKET"; payload: { ticketId: string; role: Role } }
  | { type: "FORWARD_TICKET"; payload: { ticketId: string; from: Role; to: Role } }
  | { type: "SUBMIT_MANIFEST"; payload: { manifest: Manifest } }
  | { type: "EXECUTE"; payload: { ticketId: string; manifestTicketId: string; role: Role } }
  | { type: "RETURN_RECEIPT"; payload: { receipt: Receipt } }
  | { type: "CLOSE_TICKET"; payload: { ticketId: string; role: Role } }
  | { type: "ARCHITECT_SET_MODE"; payload: { mode: GovernanceMode } }
  | { type: "STRIDE_COLD_START"; payload: { success: boolean } }
  | { type: "INJECT_FAULT"; payload: { injectionId: string } };

// ─── Failure Matrix Entry ────────────────────────────────────────────────────

export interface FailureMatrixEntry {
  id: string;
  name: string;
  injection: string;
  expectedTrigger: EscalationTrigger;
  expectedSeverity: EscalationSeverity;
  invariant: string;
}

// ─── Injection Definition ────────────────────────────────────────────────────

export interface InjectionDefinition {
  id: string;
  name: string;
  apply: (state: GovernanceState) => GovernanceState;
}

// ─── Initial State Factory ───────────────────────────────────────────────────

export function createInitialState(): GovernanceState {
  return {
    state: "IDLE",
    mode: "standard",
    riskClass: "low",
    ticket: null,
    manifest: null,
    receipt: null,
    escalations: [],
    eventLog: [],
    assertions: [],
    strideOnline: false,
  };
}
