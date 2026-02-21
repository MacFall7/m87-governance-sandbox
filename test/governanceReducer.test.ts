import { describe, it, expect } from "vitest";
import { governanceReducer } from "../src/core/reducer";
import { createInitialState } from "../src/core/types";
import type { GovernanceState, Event } from "../src/core/types";
import { failureMatrix } from "../src/core/failureMatrix";
import { injections, getInjection } from "../src/core/injections";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeTicket(id = "TKT-001") {
  return {
    id,
    title: "Test Ticket",
    description: "A test ticket",
    riskClass: "medium" as const,
    createdBy: "ARCHITECT" as const,
  };
}

function makeManifest(ticketId = "TKT-001") {
  return {
    ticketId,
    steps: ["Step 1", "Step 2"],
    approvedBy: "ARCHITECT" as const,
  };
}

function makeReceipt(ticketId = "TKT-001", manifestTicketId = "TKT-001") {
  return {
    ticketId,
    manifestTicketId,
    completedBy: "SPECIALIST" as const,
    result: "success" as const,
  };
}

function stateWithTicket(id = "TKT-001"): GovernanceState {
  return {
    ...createInitialState(),
    state: "OPEN",
    ticket: makeTicket(id),
  };
}

function stateWithManifest(ticketId = "TKT-001"): GovernanceState {
  return {
    ...stateWithTicket(ticketId),
    state: "IN_PROGRESS",
    manifest: makeManifest(ticketId),
  };
}

function stateWithReceipt(ticketId = "TKT-001"): GovernanceState {
  return {
    ...stateWithManifest(ticketId),
    receipt: makeReceipt(ticketId),
  };
}

// ─── Failure Matrix Tests (22 cases) ────────────────────────────────────────

describe("Failure Matrix — 22 Injection Scenarios", () => {
  // INJ-01: Forward without ticket
  it("INJ-01: Forward without ticket → escalation", () => {
    const state = createInitialState();
    const event: Event = { type: "FORWARD_TICKET", payload: { ticketId: "TKT-001", from: "ARCHITECT", to: "SPECIALIST" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("forward_without_ticket");
    expect(result.escalations[0].severity).toBe("high");
  });

  // INJ-02: Manifest without ticket
  it("INJ-02: Manifest without ticket → escalation", () => {
    const state = createInitialState();
    const event: Event = { type: "SUBMIT_MANIFEST", payload: { manifest: makeManifest() } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("manifest_without_ticket");
  });

  // INJ-03: Manifest ticket mismatch
  it("INJ-03: Manifest ticket mismatch → escalation", () => {
    const state = stateWithTicket();
    const event: Event = { type: "SUBMIT_MANIFEST", payload: { manifest: { ...makeManifest(), ticketId: "TKT-WRONG" } } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations.some(e => e.trigger === "manifest_ticket_mismatch")).toBe(true);
  });

  // INJ-04: Execute without ticket
  it("INJ-04: Execute without ticket → escalation", () => {
    const state = { ...createInitialState(), manifest: makeManifest() };
    const event: Event = { type: "EXECUTE", payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001", role: "SPECIALIST" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("execute_without_ticket");
  });

  // INJ-05: Execute without manifest
  it("INJ-05: Execute without manifest → escalation", () => {
    const state = stateWithTicket();
    const event: Event = { type: "EXECUTE", payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001", role: "SPECIALIST" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("execute_without_manifest");
  });

  // INJ-06: Execute manifest-ticket mismatch
  it("INJ-06: Execute manifest-ticket mismatch → escalation", () => {
    const state: GovernanceState = {
      ...stateWithTicket(),
      state: "IN_PROGRESS",
      manifest: { ...makeManifest(), ticketId: "TKT-WRONG" },
    };
    const event: Event = { type: "EXECUTE", payload: { ticketId: "TKT-001", manifestTicketId: "TKT-WRONG", role: "SPECIALIST" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("execute_manifest_ticket_mismatch");
  });

  // INJ-07: Receipt without ticket or manifest
  it("INJ-07: Receipt without ticket or manifest → escalation", () => {
    const state = createInitialState();
    const event: Event = { type: "RETURN_RECEIPT", payload: { receipt: makeReceipt() } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("receipt_without_ticket_or_manifest");
  });

  // INJ-08: Receipt ticket mismatch
  it("INJ-08: Receipt ticket mismatch → escalation", () => {
    const state = stateWithManifest();
    const event: Event = { type: "RETURN_RECEIPT", payload: { receipt: { ...makeReceipt(), ticketId: "TKT-WRONG" } } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("receipt_ticket_mismatch");
  });

  // INJ-09: STRIDE cold start failed
  it("INJ-09: STRIDE cold start failed → escalation + HALTED", () => {
    const state = createInitialState();
    const event: Event = { type: "STRIDE_COLD_START", payload: { success: false } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("stride_cold_start_failed");
    expect(result.escalations[0].severity).toBe("critical");
    expect(result.state).toBe("HALTED");
  });

  // INJ-10: Close without artifacts (no manifest, no receipt)
  it("INJ-10: Close without artifacts → escalation", () => {
    const state = stateWithTicket();
    const event: Event = { type: "CLOSE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("close_without_artifacts");
  });

  // INJ-11: Close without manifest
  it("INJ-11: Close without manifest → escalation", () => {
    const state: GovernanceState = {
      ...stateWithTicket(),
      receipt: makeReceipt(),
    };
    const event: Event = { type: "CLOSE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("close_without_artifacts");
  });

  // INJ-12: Close without receipt
  it("INJ-12: Close without receipt → escalation", () => {
    const state = stateWithManifest();
    const event: Event = { type: "CLOSE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("close_without_artifacts");
  });

  // INJ-13: Close with failed receipt
  it("INJ-13: Close with failed receipt → escalation", () => {
    const state: GovernanceState = {
      ...stateWithManifest(),
      receipt: { ...makeReceipt(), result: "failure" },
    };
    const event: Event = { type: "CLOSE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("close_without_artifacts");
  });

  // INJ-14: Forward from SPECIALIST (wrong role)
  it("INJ-14: Forward from SPECIALIST → role boundary violation", () => {
    const state = stateWithTicket();
    const event: Event = { type: "FORWARD_TICKET", payload: { ticketId: "TKT-001", from: "SPECIALIST", to: "STRIDE" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("role_boundary_violation");
  });

  // INJ-15: Manifest submitted by SPECIALIST
  it("INJ-15: Manifest submitted by SPECIALIST → role boundary violation", () => {
    const state = stateWithTicket();
    const event: Event = { type: "SUBMIT_MANIFEST", payload: { manifest: { ...makeManifest(), approvedBy: "SPECIALIST" } } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("role_boundary_violation");
  });

  // INJ-16: Execute by ARCHITECT (wrong role)
  it("INJ-16: Execute by ARCHITECT → role boundary violation", () => {
    const state = stateWithManifest();
    const event: Event = { type: "EXECUTE", payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001", role: "ARCHITECT" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("role_boundary_violation");
  });

  // INJ-17: Double submit ticket
  it("INJ-17: Double submit ticket → escalation", () => {
    const state = stateWithTicket();
    const event: Event = { type: "SUBMIT_TICKET", payload: { ticket: makeTicket("TKT-002") } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("missing_ticket");
  });

  // INJ-18: Close already closed ticket
  it("INJ-18: Close already closed ticket → escalation", () => {
    const state: GovernanceState = {
      ...stateWithReceipt(),
      state: "CLOSED",
    };
    const event: Event = { type: "CLOSE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("close_without_artifacts");
  });

  // INJ-19: Execute on HALTED state
  it("INJ-19: Execute on HALTED state → escalation", () => {
    const state: GovernanceState = {
      ...stateWithManifest(),
      state: "HALTED",
    };
    const event: Event = { type: "EXECUTE", payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001", role: "SPECIALIST" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("execute_without_ticket");
  });

  // INJ-20: Forward on CLOSED state
  it("INJ-20: Forward on CLOSED state → escalation", () => {
    const state: GovernanceState = {
      ...stateWithTicket(),
      state: "CLOSED",
    };
    const event: Event = { type: "FORWARD_TICKET", payload: { ticketId: "TKT-001", from: "ARCHITECT", to: "SPECIALIST" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("forward_without_ticket");
  });

  // INJ-21: Validate without ticket
  it("INJ-21: Validate without ticket → escalation", () => {
    const state = createInitialState();
    const event: Event = { type: "VALIDATE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("missing_ticket");
  });

  // INJ-22: Receipt manifest-ticket mismatch
  it("INJ-22: Receipt manifest-ticket mismatch → escalation", () => {
    const state = stateWithManifest();
    const event: Event = { type: "RETURN_RECEIPT", payload: { receipt: { ...makeReceipt(), manifestTicketId: "TKT-WRONG" } } };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("receipt_ticket_mismatch");
  });
});

// ─── Structural Tests ────────────────────────────────────────────────────────

describe("Structural Tests", () => {
  it("Matrix completeness: every failureMatrix entry has a corresponding injection", () => {
    for (const entry of failureMatrix) {
      const injection = getInjection(entry.injection);
      expect(injection, `Missing injection for ${entry.id}: ${entry.name}`).toBeDefined();
    }
  });

  it("Injection coverage: every injection ID is referenced in failureMatrix", () => {
    for (const inj of injections) {
      const matrixEntry = failureMatrix.find(m => m.injection === inj.id);
      expect(matrixEntry, `Injection ${inj.id} not in failure matrix`).toBeDefined();
    }
  });

  it("Happy path: full lifecycle with zero escalations", () => {
    let state = createInitialState();

    // Submit ticket
    state = governanceReducer(state, {
      type: "SUBMIT_TICKET",
      payload: { ticket: makeTicket() },
    });
    expect(state.state).toBe("OPEN");
    expect(state.ticket).not.toBeNull();

    // Validate ticket
    state = governanceReducer(state, {
      type: "VALIDATE_TICKET",
      payload: { ticketId: "TKT-001", role: "ARCHITECT" },
    });

    // Forward ticket
    state = governanceReducer(state, {
      type: "FORWARD_TICKET",
      payload: { ticketId: "TKT-001", from: "ARCHITECT", to: "SPECIALIST" },
    });
    expect(state.state).toBe("IN_PROGRESS");

    // Submit manifest
    state = governanceReducer(state, {
      type: "SUBMIT_MANIFEST",
      payload: { manifest: makeManifest() },
    });
    expect(state.state).toBe("IN_PROGRESS");

    // Execute
    state = governanceReducer(state, {
      type: "EXECUTE",
      payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001", role: "SPECIALIST" },
    });
    expect(state.state).toBe("IN_PROGRESS");

    // Return receipt
    state = governanceReducer(state, {
      type: "RETURN_RECEIPT",
      payload: { receipt: makeReceipt() },
    });

    // Close ticket
    state = governanceReducer(state, {
      type: "CLOSE_TICKET",
      payload: { ticketId: "TKT-001", role: "ARCHITECT" },
    });
    expect(state.state).toBe("CLOSED");

    // Zero escalations
    expect(state.escalations).toHaveLength(0);
  });

  it("Unknown event type → HALTED + escalation", () => {
    const state = createInitialState();
    // Force an unknown event type through a cast
    const event = { type: "NONSENSE" } as unknown as Event;
    const result = governanceReducer(state, event);
    expect(result.state).toBe("HALTED");
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("unknown_event_type");
  });

  it("Reverse role boundary: SPECIALIST dispatches ARCHITECT-lane event → escalation", () => {
    const state = stateWithTicket();
    // SPECIALIST tries to forward (ARCHITECT-lane action)
    const event: Event = {
      type: "FORWARD_TICKET",
      payload: { ticketId: "TKT-001", from: "SPECIALIST", to: "STRIDE" },
    };
    const result = governanceReducer(state, event);
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("role_boundary_violation");
  });
});
