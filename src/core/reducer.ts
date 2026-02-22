// M87 Governance Sandbox — Governance State Machine Reducer
// No `as any` allowed. All functions are fully typed.

import type {
  SystemState,
  Event,
  EscalationTrigger,
  EscalationSeverity,
  Role,
  AssertionType,
  Escalation,
  EventLogEntry,
  Assertion,
  GovernanceMode,
  StrideSimState,
} from "./types.js";
import { isMeasurableAcceptance, modeCoversRisk } from "./helpers.js";

// ─── Internal Helpers ────────────────────────────────────────────────────────

function escalate(
  state: SystemState,
  trigger: EscalationTrigger,
  severity: EscalationSeverity,
  message: string
): SystemState {
  const escalation: Escalation = {
    trigger,
    severity,
    message,
    timestamp: Date.now(),
  };
  return {
    ...state,
    escalations: [...state.escalations, escalation],
  };
}

function pushEvent(
  state: SystemState,
  from: Role,
  to: Role,
  label: string
): SystemState {
  const entry: EventLogEntry = {
    from,
    to,
    label,
    timestamp: Date.now(),
  };
  return {
    ...state,
    eventLog: [...state.eventLog, entry],
  };
}

function addAssertion(
  state: SystemState,
  kind: AssertionType,
  message: string,
  passed: boolean
): SystemState {
  const assertion: Assertion = { kind, message, passed };
  return {
    ...state,
    assertions: [...state.assertions, assertion],
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function governanceReducer(
  state: SystemState,
  event: Event
): SystemState {
  switch (event.type) {
    // ── ARCHITECT_SUBMIT_TICKET ────────────────────────────────────────────
    case "ARCHITECT_SUBMIT_TICKET": {
      if (state.ticket !== null) {
        const s1 = escalate(state, "duplicate_ticket", "medium", "Ticket already exists — duplicate submit blocked");
        return addAssertion(s1, "invariant", "No duplicate tickets", false);
      }
      const s1 = pushEvent(state, event.payload.ticket.createdBy, "RELAY", `Ticket submitted: ${event.payload.ticket.id}`);
      const s2: SystemState = { ...s1, ticket: event.payload.ticket, state: "OPEN" };
      return addAssertion(s2, "postcondition", "Ticket created", true);
    }

    // ── RELAY_VALIDATE_TICKET ──────────────────────────────────────────────
    case "RELAY_VALIDATE_TICKET": {
      if (!state.ticket) {
        const s1 = escalate(state, "missing_ticket", "high", "Cannot validate — no active ticket");
        return addAssertion(s1, "precondition", "Ticket must exist for validation", false);
      }
      // Check artifact_definition
      if (!state.ticket.artifact_definition) {
        const s1 = escalate(state, "missing_artifact_definition", "high", "Ticket missing artifact_definition");
        return addAssertion(s1, "invariant", "Artifact definition required", false);
      }
      const s1 = pushEvent(state, "RELAY", "ARCHITECT", `Ticket validated: ${state.ticket.id}`);
      return addAssertion(s1, "postcondition", "Ticket validated", true);
    }

    // ── RELAY_FORWARD_TICKET ───────────────────────────────────────────────
    case "RELAY_FORWARD_TICKET": {
      // State guard: no forwarding on CLOSED
      if (state.state === "CLOSED") {
        const s1 = escalate(state, "action_on_closed", "medium", "Cannot forward — state is CLOSED");
        return addAssertion(s1, "precondition", "Cannot forward in CLOSED state", false);
      }
      // State guard: no forwarding on HALTED
      if (state.state === "HALTED") {
        const s1 = escalate(state, "action_on_halted", "critical", "Cannot forward — state is HALTED");
        return addAssertion(s1, "precondition", "Cannot forward in HALTED state", false);
      }
      if (!state.ticket) {
        const s1 = escalate(state, "forward_without_ticket", "high", "Cannot forward — no active ticket");
        return addAssertion(s1, "precondition", "Ticket must exist for forwarding", false);
      }
      // IDLE → must validate first
      if (state.state === "IDLE") {
        const s1 = escalate(state, "forward_without_ticket", "high", "Cannot forward from IDLE — ticket not validated");
        return addAssertion(s1, "precondition", "Ticket must be validated before forwarding", false);
      }
      // Role boundary: only ARCHITECT or RELAY can forward
      if (event.payload.from !== "ARCHITECT" && event.payload.from !== "RELAY") {
        const s1 = escalate(state, "role_boundary_violation", "high", `${event.payload.from} cannot forward tickets`);
        return addAssertion(s1, "boundary", "Only ARCHITECT or RELAY can forward", false);
      }
      const s1 = pushEvent(state, event.payload.from, event.payload.to, `Ticket forwarded`);
      const s2: SystemState = { ...s1, state: "IN_PROGRESS" };
      return addAssertion(s2, "postcondition", "Ticket forwarded", true);
    }

    // ── ARCHITECT_SUBMIT_MANIFEST ──────────────────────────────────────────
    case "ARCHITECT_SUBMIT_MANIFEST": {
      if (!state.ticket) {
        const s1 = escalate(state, "manifest_without_ticket", "high", "Cannot submit manifest — no active ticket");
        return addAssertion(s1, "precondition", "Ticket must exist for manifest", false);
      }
      // Role boundary: only ARCHITECT or RELAY can submit manifests
      if (event.payload.manifest.approvedBy !== "ARCHITECT" && event.payload.manifest.approvedBy !== "RELAY") {
        const s1 = escalate(state, "role_boundary_violation", "high", `${event.payload.manifest.approvedBy} cannot submit manifests`);
        return addAssertion(s1, "boundary", "Only ARCHITECT or RELAY can submit manifests", false);
      }
      // Set manifest, then check ticket mismatch
      const withManifest: SystemState = { ...state, manifest: event.payload.manifest };
      if (event.payload.manifest.ticketId !== state.ticket.id) {
        const s1 = escalate(withManifest, "manifest_ticket_mismatch", "high",
          `Manifest references ${event.payload.manifest.ticketId} but active ticket is ${state.ticket.id}`);
        return addAssertion(s1, "invariant", "Manifest must reference active ticket", false);
      }
      const s1 = pushEvent(withManifest, event.payload.manifest.approvedBy, "SPECIALIST",
        `Manifest submitted for ${event.payload.manifest.ticketId}`);
      const s2: SystemState = { ...s1, state: "IN_PROGRESS" };
      return addAssertion(s2, "postcondition", "Manifest submitted and validated", true);
    }

    // ── SPECIALIST_EXECUTE ─────────────────────────────────────────────────
    case "SPECIALIST_EXECUTE": {
      // State guard: no execution on HALTED
      if (state.state === "HALTED") {
        const s1 = escalate(state, "action_on_halted", "critical", "Cannot execute — state is HALTED");
        return addAssertion(s1, "precondition", "Cannot execute in HALTED state", false);
      }
      if (!state.ticket) {
        const s1 = escalate(state, "execute_without_ticket", "high", "Cannot execute — no active ticket");
        return addAssertion(s1, "precondition", "Ticket must exist for execution", false);
      }
      if (!state.manifest) {
        const s1 = escalate(state, "execute_without_manifest", "high", "Cannot execute — no manifest");
        return addAssertion(s1, "precondition", "Manifest must exist for execution", false);
      }
      if (state.manifest.ticketId !== state.ticket.id) {
        const s1 = escalate(state, "execute_manifest_ticket_mismatch", "high",
          `Manifest ticket ${state.manifest.ticketId} does not match active ticket ${state.ticket.id}`);
        return addAssertion(s1, "invariant", "Manifest must reference active ticket for execution", false);
      }
      const s1 = pushEvent(state, "SPECIALIST", "RELAY", `Execution started for ${event.payload.ticketId}`);
      const s2: SystemState = { ...s1, state: "IN_PROGRESS" };
      return addAssertion(s2, "postcondition", "Execution started", true);
    }

    // ── SPECIALIST_RETURN_RECEIPT ──────────────────────────────────────────
    case "SPECIALIST_RETURN_RECEIPT": {
      if (!state.ticket || !state.manifest) {
        const s1 = escalate(state, "receipt_without_ticket_or_manifest", "high", "Cannot return receipt — missing ticket or manifest");
        return addAssertion(s1, "precondition", "Ticket and manifest must exist for receipt", false);
      }
      if (event.payload.receipt.ticketId !== state.ticket.id) {
        const s1 = escalate(state, "receipt_ticket_mismatch", "high",
          `Receipt ticket ${event.payload.receipt.ticketId} does not match active ticket ${state.ticket.id}`);
        return addAssertion(s1, "invariant", "Receipt must reference active ticket", false);
      }
      if (event.payload.receipt.manifestTicketId !== state.manifest.ticketId) {
        const s1 = escalate(state, "receipt_ticket_mismatch", "high",
          `Receipt manifest ticket ${event.payload.receipt.manifestTicketId} does not match manifest ${state.manifest.ticketId}`);
        return addAssertion(s1, "invariant", "Receipt must reference correct manifest ticket", false);
      }
      const s1 = pushEvent(state, event.payload.receipt.completedBy, "RELAY",
        `Receipt returned for ${event.payload.receipt.ticketId}`);
      const s2: SystemState = { ...s1, receipt: event.payload.receipt };
      return addAssertion(s2, "postcondition", "Receipt recorded", true);
    }

    // ── ARCHITECT_CLOSE_TICKET ─────────────────────────────────────────────
    case "ARCHITECT_CLOSE_TICKET": {
      if (state.state === "CLOSED") {
        const s1 = escalate(state, "action_on_closed", "medium", "Cannot close — ticket already closed");
        return addAssertion(s1, "precondition", "Cannot close already closed ticket", false);
      }
      if (!isMeasurableAcceptance(state)) {
        const s1 = escalate(state, "close_without_artifacts", "high", "Cannot close — measurable acceptance criteria not met");
        return addAssertion(s1, "invariant", "Measurable acceptance required for close", false);
      }
      const s1 = pushEvent(state, "ARCHITECT", "RELAY", "Ticket closed");
      const s2: SystemState = { ...s1, state: "CLOSED" };
      return addAssertion(s2, "postcondition", "Ticket closed with measurable acceptance", true);
    }

    // ── ARCHITECT_SET_MODE ─────────────────────────────────────────────────
    case "ARCHITECT_SET_MODE": {
      const s1 = pushEvent(state, "ARCHITECT", "RELAY", `Mode changed to ${event.payload.mode}`);
      const s2: SystemState = { ...s1, mode: event.payload.mode };
      return addAssertion(s2, "postcondition", "Governance mode updated", true);
    }

    // ── STRIDE_COLD_START ──────────────────────────────────────────────────
    case "STRIDE_COLD_START": {
      if (!event.payload.success) {
        const s1 = escalate(state, "stride_cold_start_failed", "critical", "STRIDE cold start failed");
        const s2: SystemState = { ...s1, strideOnline: false, state: "HALTED" };
        return addAssertion(s2, "invariant", "STRIDE must be online", false);
      }
      const s1 = pushEvent(state, "STRIDE", "RELAY", "STRIDE cold start succeeded");
      const s2: SystemState = { ...s1, strideOnline: true };
      return addAssertion(s2, "postcondition", "STRIDE online", true);
    }

    // ── STRIDE_RUN_SIM ─────────────────────────────────────────────────────
    case "STRIDE_RUN_SIM": {
      const category = event.payload.category;
      const newSim: StrideSimState = { ...state.strideSim, [category]: event.payload.result };
      const s1: SystemState = { ...state, strideSim: newSim };
      if (event.payload.result) {
        // Threat detected
        const s2 = escalate(s1, "stride_cold_start_failed", "high", `STRIDE threat detected: ${category}`);
        const s3: SystemState = { ...s2, state: "BLOCKED" };
        return addAssertion(s3, "invariant", `STRIDE ${category} threat detected`, false);
      }
      return addAssertion(s1, "postcondition", `STRIDE ${category} sim passed`, true);
    }

    // ── RELAY_COMPRESS_TRANSLATION ─────────────────────────────────────────
    case "RELAY_COMPRESS_TRANSLATION": {
      const s1: SystemState = { ...state, lastTranslationCompressed: true };
      return addAssertion(s1, "postcondition", "Translation compressed", true);
    }

    // ── RELAY_DECOMPRESS_TRANSLATION ───────────────────────────────────────
    case "RELAY_DECOMPRESS_TRANSLATION": {
      if (state.lastTranslationCompressed) {
        const s1 = escalate(state, "translation_integrity_failure", "high", "Translation was compressed — integrity check failed");
        return addAssertion(s1, "invariant", "Translation integrity required", false);
      }
      return addAssertion(state, "postcondition", "Translation decompression check passed", true);
    }

    // ── SPECIALIST_REPORT_COMMITMENT ───────────────────────────────────────
    case "SPECIALIST_REPORT_COMMITMENT": {
      const newCount = event.payload.met ? 0 : state.missedCommitments + 1;
      const s1: SystemState = { ...state, missedCommitments: newCount };
      if (newCount >= 3) {
        const s2 = escalate(s1, "missed_commitment_threshold", "high", `Missed commitments: ${newCount}`);
        const s3: SystemState = { ...s2, state: "BLOCKED" };
        return addAssertion(s3, "invariant", "Missed commitment threshold exceeded", false);
      }
      return addAssertion(s1, "postcondition", "Commitment reported", true);
    }

    // ── ARCHITECT_ESCALATE ─────────────────────────────────────────────────
    case "ARCHITECT_ESCALATE": {
      const s1 = escalate(state, event.payload.trigger, event.payload.severity, event.payload.message);
      return addAssertion(s1, "postcondition", "Manual escalation recorded", true);
    }

    // ── RELAY_CHECK_MODE_RISK ──────────────────────────────────────────────
    case "RELAY_CHECK_MODE_RISK": {
      if (!modeCoversRisk(state.mode, state.riskClass)) {
        const s1 = escalate(state, "mode_risk_mismatch", "high",
          `Mode ${state.mode} insufficient for risk ${state.riskClass}`);
        const s2: SystemState = { ...s1, state: "BLOCKED" };
        return addAssertion(s2, "invariant", "Mode must cover risk class", false);
      }
      return addAssertion(state, "postcondition", "Mode covers risk — OK", true);
    }

    // ── INJECT_FAULT ───────────────────────────────────────────────────────
    case "INJECT_FAULT": {
      return state;
    }

    default: {
      const _exhaustiveCheck: never = event;
      void _exhaustiveCheck;
      const next = escalate(state, "unknown_event_type", "high", "Unrecognized event type");
      return { ...next, state: "HALTED" };
    }
  }
}
