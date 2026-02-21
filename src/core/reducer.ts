// M87 Governance Sandbox — Governance State Machine Reducer
// No `as any` allowed. All functions are fully typed.

import type {
  GovernanceState,
  Event,
  EscalationTrigger,
  EscalationSeverity,
  Role,
  AssertionType,
  Escalation,
  EventLogEntry,
  Assertion,
} from "./types";
import { isMeasurableAcceptance } from "./helpers";

// ─── Internal Helpers ────────────────────────────────────────────────────────

function escalate(
  state: GovernanceState,
  trigger: EscalationTrigger,
  severity: EscalationSeverity,
  message: string
): GovernanceState {
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
  state: GovernanceState,
  from: Role,
  to: Role,
  label: string
): GovernanceState {
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
  state: GovernanceState,
  kind: AssertionType,
  message: string,
  passed: boolean
): GovernanceState {
  const assertion: Assertion = { kind, message, passed };
  return {
    ...state,
    assertions: [...state.assertions, assertion],
  };
}

function lintManifest(
  state: GovernanceState
): { trigger: EscalationTrigger; message: string }[] {
  const errors: { trigger: EscalationTrigger; message: string }[] = [];

  if (!state.ticket) {
    errors.push({ trigger: "manifest_without_ticket", message: "No active ticket for manifest" });
    return errors;
  }

  if (!state.manifest) {
    return errors;
  }

  if (state.manifest.ticketId !== state.ticket.id) {
    errors.push({
      trigger: "manifest_ticket_mismatch",
      message: `Manifest references ${state.manifest.ticketId} but active ticket is ${state.ticket.id}`,
    });
  }

  if (state.manifest.steps.length === 0) {
    errors.push({
      trigger: "manifest_without_ticket",
      message: "Manifest has no steps",
    });
  }

  return errors;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function governanceReducer(
  state: GovernanceState,
  event: Event
): GovernanceState {
  switch (event.type) {
    case "SUBMIT_TICKET": {
      // Double submit guard
      if (state.ticket !== null) {
        const s1 = escalate(state, "missing_ticket", "medium", "Ticket already exists — duplicate submit blocked");
        return addAssertion(s1, "invariant", "No duplicate tickets", false);
      }
      const s1 = pushEvent(state, event.payload.ticket.createdBy, "RELAY", `Ticket submitted: ${event.payload.ticket.id}`);
      const s2 = { ...s1, ticket: event.payload.ticket, state: "OPEN" as const };
      return addAssertion(s2, "postcondition", "Ticket created", true);
    }

    case "VALIDATE_TICKET": {
      if (!state.ticket) {
        const s1 = escalate(state, "missing_ticket", "high", "Cannot validate — no active ticket");
        return addAssertion(s1, "precondition", "Ticket must exist for validation", false);
      }
      const s1 = pushEvent(state, event.payload.role, "RELAY", `Ticket validated: ${event.payload.ticketId}`);
      return addAssertion(s1, "postcondition", "Ticket validated", true);
    }

    case "FORWARD_TICKET": {
      // State guard: no forwarding on CLOSED or HALTED
      if (state.state === "CLOSED" || state.state === "HALTED") {
        const s1 = escalate(state, "forward_without_ticket", "medium", `Cannot forward — state is ${state.state}`);
        return addAssertion(s1, "precondition", "Cannot forward in terminal state", false);
      }
      if (!state.ticket) {
        const s1 = escalate(state, "forward_without_ticket", "high", "Cannot forward — no active ticket");
        return addAssertion(s1, "precondition", "Ticket must exist for forwarding", false);
      }
      // Role boundary: only ARCHITECT or RELAY can forward
      if (event.payload.from !== "ARCHITECT" && event.payload.from !== "RELAY") {
        const s1 = escalate(state, "role_boundary_violation", "high", `${event.payload.from} cannot forward tickets`);
        return addAssertion(s1, "boundary", "Only ARCHITECT or RELAY can forward", false);
      }
      const s1 = pushEvent(state, event.payload.from, event.payload.to, `Ticket forwarded: ${event.payload.ticketId}`);
      const s2 = { ...s1, state: "IN_PROGRESS" as const };
      return addAssertion(s2, "postcondition", "Ticket forwarded", true);
    }

    case "SUBMIT_MANIFEST": {
      if (!state.ticket) {
        const s1 = escalate(state, "manifest_without_ticket", "high", "Cannot submit manifest — no active ticket");
        return addAssertion(s1, "precondition", "Ticket must exist for manifest", false);
      }
      // Role boundary: only ARCHITECT can submit manifests
      if (event.payload.manifest.approvedBy !== "ARCHITECT" && event.payload.manifest.approvedBy !== "RELAY") {
        const s1 = escalate(state, "role_boundary_violation", "high", `${event.payload.manifest.approvedBy} cannot submit manifests`);
        return addAssertion(s1, "boundary", "Only ARCHITECT or RELAY can submit manifests", false);
      }
      // Set manifest first so lintManifest can check it
      let s1: GovernanceState = { ...state, manifest: event.payload.manifest };
      // Lint the manifest
      const lintErrors = lintManifest(s1);
      if (lintErrors.length > 0) {
        for (const err of lintErrors) {
          s1 = escalate(s1, err.trigger, "high", err.message);
        }
        return addAssertion(s1, "invariant", "Manifest lint failed", false);
      }
      const s2 = pushEvent(s1, event.payload.manifest.approvedBy, "SPECIALIST", `Manifest submitted for ${event.payload.manifest.ticketId}`);
      const s3 = { ...s2, state: "IN_PROGRESS" as const };
      return addAssertion(s3, "postcondition", "Manifest submitted and validated", true);
    }

    case "EXECUTE": {
      // State guard: no execution on HALTED
      if (state.state === "HALTED") {
        const s1 = escalate(state, "execute_without_ticket", "critical", "Cannot execute — state is HALTED");
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
        const s1 = escalate(state, "execute_manifest_ticket_mismatch", "high", `Manifest ticket ${state.manifest.ticketId} does not match active ticket ${state.ticket.id}`);
        return addAssertion(s1, "invariant", "Manifest must reference active ticket for execution", false);
      }
      // Role boundary: only SPECIALIST can execute
      if (event.payload.role !== "SPECIALIST") {
        const s1 = escalate(state, "role_boundary_violation", "high", `${event.payload.role} cannot execute — only SPECIALIST`);
        return addAssertion(s1, "boundary", "Only SPECIALIST can execute", false);
      }
      const s1 = pushEvent(state, event.payload.role, "RELAY", `Execution started for ${event.payload.ticketId}`);
      const s2 = { ...s1, state: "IN_PROGRESS" as const };
      return addAssertion(s2, "postcondition", "Execution started", true);
    }

    case "RETURN_RECEIPT": {
      if (!state.ticket || !state.manifest) {
        const s1 = escalate(state, "receipt_without_ticket_or_manifest", "high", "Cannot return receipt — missing ticket or manifest");
        return addAssertion(s1, "precondition", "Ticket and manifest must exist for receipt", false);
      }
      if (event.payload.receipt.ticketId !== state.ticket.id) {
        const s1 = escalate(state, "receipt_ticket_mismatch", "high", `Receipt ticket ${event.payload.receipt.ticketId} does not match active ticket ${state.ticket.id}`);
        return addAssertion(s1, "invariant", "Receipt must reference active ticket", false);
      }
      if (event.payload.receipt.manifestTicketId !== state.manifest.ticketId) {
        const s1 = escalate(state, "receipt_ticket_mismatch", "high", `Receipt manifest ticket ${event.payload.receipt.manifestTicketId} does not match manifest ${state.manifest.ticketId}`);
        return addAssertion(s1, "invariant", "Receipt must reference correct manifest ticket", false);
      }
      const s1 = pushEvent(state, event.payload.receipt.completedBy, "RELAY", `Receipt returned for ${event.payload.receipt.ticketId}`);
      const s2 = { ...s1, receipt: event.payload.receipt };
      return addAssertion(s2, "postcondition", "Receipt recorded", true);
    }

    case "CLOSE_TICKET": {
      // Close on already-closed
      if (state.state === "CLOSED") {
        const s1 = escalate(state, "close_without_artifacts", "medium", "Cannot close — ticket already closed");
        return addAssertion(s1, "precondition", "Cannot close already closed ticket", false);
      }
      if (!isMeasurableAcceptance(state)) {
        const s1 = escalate(state, "close_without_artifacts", "high", "Cannot close — measurable acceptance criteria not met");
        return addAssertion(s1, "invariant", "Measurable acceptance required for close", false);
      }
      const s1 = pushEvent(state, event.payload.role, "RELAY", `Ticket closed: ${event.payload.ticketId}`);
      const s2 = { ...s1, state: "CLOSED" as const };
      return addAssertion(s2, "postcondition", "Ticket closed with measurable acceptance", true);
    }

    case "ARCHITECT_SET_MODE": {
      const s1 = pushEvent(state, "ARCHITECT", "RELAY", `Mode changed to ${event.payload.mode}`);
      const s2 = { ...s1, mode: event.payload.mode };
      return addAssertion(s2, "postcondition", "Governance mode updated", true);
    }

    case "STRIDE_COLD_START": {
      if (!event.payload.success) {
        const s1 = escalate(state, "stride_cold_start_failed", "critical", "STRIDE cold start failed");
        const s2 = { ...s1, strideOnline: false, state: "HALTED" as const };
        return addAssertion(s2, "invariant", "STRIDE must be online", false);
      }
      const s1 = pushEvent(state, "STRIDE", "RELAY", "STRIDE cold start succeeded");
      const s2 = { ...s1, strideOnline: true };
      return addAssertion(s2, "postcondition", "STRIDE online", true);
    }

    case "INJECT_FAULT": {
      // Fault injection is handled at a higher level — pass through
      return state;
    }

    default: {
      // Fail-closed: unknown event types halt the system
      const _exhaustiveCheck: never = event;
      const next = escalate(state, "unknown_event_type", "high", `Unrecognized event type: ${(event as { type: string }).type}`);
      return { ...next, state: "HALTED" };
    }
  }
}
