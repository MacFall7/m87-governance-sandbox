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

// ─── Escalation Triggers (20 canonical triggers) ────────────────────────────

export type EscalationTrigger =
  | "missing_artifact_definition"
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
  | "role_boundary_violation"
  | "mode_risk_mismatch"
  | "translation_integrity_failure"
  | "duplicate_ticket"
  | "action_on_closed"
  | "action_on_halted"
  | "missed_commitment_threshold";

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
  artifact_definition?: string;
}

// ─── Manifest ────────────────────────────────────────────────────────────────

export interface Manifest {
  ticketId: string;
  steps: string[];
  approvedBy: Role;
  cold_start_required?: boolean;
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

export interface Receipt {
  ticketId: string;
  manifestTicketId: string;
  completedBy: Role;
  result: "success" | "failure";
}

// ─── STRIDE Simulation State ─────────────────────────────────────────────────

export interface StrideSimState {
  spoofing: boolean;
  tampering: boolean;
  repudiation: boolean;
  informationDisclosure: boolean;
  denialOfService: boolean;
}

// ─── System State (canonical) ────────────────────────────────────────────────

export interface SystemState {
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
  strideSim: StrideSimState;
  lastTranslationCompressed: boolean;
  missedCommitments: number;
}

// ─── Legacy alias ────────────────────────────────────────────────────────────

export type GovernanceState = SystemState;

// ─── Events (Discriminated Union — 16 canonical event types) ────────────────

export type Event =
  | { type: "ARCHITECT_SUBMIT_TICKET"; payload: { ticket: Ticket } }
  | { type: "RELAY_VALIDATE_TICKET" }
  | { type: "RELAY_FORWARD_TICKET"; payload: { from: Role; to: Role } }
  | { type: "ARCHITECT_SUBMIT_MANIFEST"; payload: { manifest: Manifest } }
  | { type: "SPECIALIST_EXECUTE"; payload: { ticketId: string; manifestTicketId: string } }
  | { type: "SPECIALIST_RETURN_RECEIPT"; payload: { receipt: Receipt } }
  | { type: "ARCHITECT_CLOSE_TICKET" }
  | { type: "ARCHITECT_SET_MODE"; payload: { mode: GovernanceMode } }
  | { type: "STRIDE_COLD_START"; payload: { success: boolean } }
  | { type: "STRIDE_RUN_SIM"; payload: { category: keyof StrideSimState; result: boolean } }
  | { type: "RELAY_COMPRESS_TRANSLATION" }
  | { type: "RELAY_DECOMPRESS_TRANSLATION" }
  | { type: "SPECIALIST_REPORT_COMMITMENT"; payload: { met: boolean } }
  | { type: "ARCHITECT_ESCALATE"; payload: { trigger: EscalationTrigger; severity: EscalationSeverity; message: string } }
  | { type: "RELAY_CHECK_MODE_RISK" }
  | { type: "INJECT_FAULT"; payload: { injectionId: string } };

// ─── Failure Case Spec (prose-based, canonical) ─────────────────────────────

export interface FailureCaseSpec {
  id: string;
  injection: string;
  expected: string;
  failure_if: string;
  category: "architect" | "relay" | "specialist" | "stride" | "cross";
}

// ─── Injection Definition (state mutator, canonical) ─────────────────────────

export interface Injection {
  id: string;
  apply: (s: SystemState) => SystemState;
}

// ─── Legacy interfaces (kept for compatibility) ──────────────────────────────

export interface FailureMatrixEntry {
  id: string;
  name: string;
  injection: string;
  expectedTrigger: EscalationTrigger;
  expectedSeverity: EscalationSeverity;
  invariant: string;
}

export interface InjectionDefinition {
  id: string;
  name: string;
  apply: (state: SystemState) => SystemState;
}

// ─── Initial State Factory ───────────────────────────────────────────────────

export function createInitialState(): SystemState {
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
    strideSim: {
      spoofing: false,
      tampering: false,
      repudiation: false,
      informationDisclosure: false,
      denialOfService: false,
    },
    lastTranslationCompressed: false,
    missedCommitments: 0,
  };
}
