import { describe, it, expect } from "vitest";
import { governanceReducer } from "../src/core/reducer";
import { createInitialState } from "../src/core/types";
import type { SystemState, Event, Ticket, Manifest, Receipt } from "../src/core/types";
import { failureMatrix } from "../src/core/failureMatrix";
import { injections, getInjection } from "../src/core/injections";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeTicket(id = "TKT-001"): Ticket {
  return {
    id,
    title: "Test Ticket",
    description: "A test ticket",
    riskClass: "medium",
    createdBy: "ARCHITECT",
    artifact_definition: "Artifact spec for testing",
  };
}

function makeManifest(ticketId = "TKT-001"): Manifest {
  return {
    ticketId,
    steps: ["Step 1", "Step 2"],
    approvedBy: "ARCHITECT",
  };
}

function makeReceipt(ticketId = "TKT-001", manifestTicketId = "TKT-001"): Receipt {
  return {
    ticketId,
    manifestTicketId,
    completedBy: "SPECIALIST",
    result: "success",
  };
}

/** Build a clean state with a submitted ticket via the reducer. */
function stateWithTicket(id = "TKT-001"): SystemState {
  const s0 = createInitialState();
  return governanceReducer(s0, {
    type: "ARCHITECT_SUBMIT_TICKET",
    payload: { ticket: makeTicket(id) },
  });
}

/** Build state through ticket + validate + forward + manifest. */
function stateWithManifest(ticketId = "TKT-001"): SystemState {
  let s = stateWithTicket(ticketId);
  s = governanceReducer(s, { type: "RELAY_VALIDATE_TICKET" });
  s = governanceReducer(s, { type: "RELAY_FORWARD_TICKET", payload: { from: "RELAY", to: "SPECIALIST" } });
  s = governanceReducer(s, {
    type: "ARCHITECT_SUBMIT_MANIFEST",
    payload: { manifest: makeManifest(ticketId) },
  });
  return s;
}

/** Build state through full lifecycle up to receipt. */
function stateWithReceipt(ticketId = "TKT-001"): SystemState {
  let s = stateWithManifest(ticketId);
  s = governanceReducer(s, {
    type: "SPECIALIST_EXECUTE",
    payload: { ticketId, manifestTicketId: ticketId },
  });
  s = governanceReducer(s, {
    type: "SPECIALIST_RETURN_RECEIPT",
    payload: { receipt: makeReceipt(ticketId) },
  });
  return s;
}

// ─── Failure Matrix Tests (22 cases) ────────────────────────────────────────

describe("Failure Matrix — 22 Injection Scenarios", () => {
  // FA_001: Strip artifact_definition from ticket
  it("FA_001 — missing artifact_definition → RELAY rejects, escalation", () => {
    let state = stateWithTicket();
    state = getInjection("FA_001").apply(state);
    // Trigger: RELAY validates
    state = governanceReducer(state, { type: "RELAY_VALIDATE_TICKET" });
    // Expected: RELAY rejects. Ticket stays OPEN. Escalation with missing_artifact_definition.
    expect(state.state).toBe("OPEN");
    expect(state.escalations.length).toBeGreaterThan(0);
    expect(state.escalations.some(e => e.trigger === "missing_artifact_definition")).toBe(true);
  });

  // FA_002: Duplicate ticket (identity injection, event-sequence trigger)
  it("FA_002 — duplicate ticket submit → rejected, escalation", () => {
    let state = stateWithTicket();
    state = getInjection("FA_002").apply(state); // identity
    // Trigger: submit another ticket
    state = governanceReducer(state, {
      type: "ARCHITECT_SUBMIT_TICKET",
      payload: { ticket: makeTicket("TKT-002") },
    });
    expect(state.escalations.some(e => e.trigger === "duplicate_ticket")).toBe(true);
  });

  // FA_003: mode=standard but riskClass=critical
  it("FA_003 — mode-risk mismatch → BLOCKED, escalation", () => {
    let state = stateWithTicket();
    state = getInjection("FA_003").apply(state);
    // Trigger: RELAY checks mode-risk
    state = governanceReducer(state, { type: "RELAY_CHECK_MODE_RISK" });
    expect(state.state).toBe("BLOCKED");
    expect(state.escalations.some(e => e.trigger === "mode_risk_mismatch")).toBe(true);
  });

  // FA_004: Corrupt manifest approvedBy to SPECIALIST
  it("FA_004 — manifest with unauthorized approver → role_boundary_violation", () => {
    let state = stateWithTicket();
    state = governanceReducer(state, { type: "RELAY_VALIDATE_TICKET" });
    state = governanceReducer(state, { type: "RELAY_FORWARD_TICKET", payload: { from: "RELAY", to: "SPECIALIST" } });
    // Submit a manifest, then corrupt it and re-submit
    const corruptManifest = { ...makeManifest(), approvedBy: "SPECIALIST" as const };
    state = governanceReducer(state, {
      type: "ARCHITECT_SUBMIT_MANIFEST",
      payload: { manifest: corruptManifest },
    });
    expect(state.escalations.some(e => e.trigger === "role_boundary_violation")).toBe(true);
  });

  // FR_001: Null out ticket
  it("FR_001 — ticket nulled mid-flow → missing_ticket on next action", () => {
    let state = stateWithTicket();
    state = getInjection("FR_001").apply(state);
    // Trigger: try to validate
    state = governanceReducer(state, { type: "RELAY_VALIDATE_TICKET" });
    expect(state.escalations.some(e => e.trigger === "missing_ticket")).toBe(true);
  });

  // FR_002: Forward without validation (identity, event-sequence trigger)
  it("FR_002 — forward from IDLE → forward_without_ticket", () => {
    const state = createInitialState();
    // No ticket, just try to forward from IDLE
    const result = governanceReducer(state, {
      type: "RELAY_FORWARD_TICKET",
      payload: { from: "RELAY", to: "SPECIALIST" },
    });
    expect(result.escalations.some(e => e.trigger === "forward_without_ticket")).toBe(true);
  });

  // FR_003: lastTranslationCompressed=true
  it("FR_003 — compressed translation → translation_integrity_failure on decompress", () => {
    let state = stateWithTicket();
    state = getInjection("FR_003").apply(state);
    // Trigger: decompress
    state = governanceReducer(state, { type: "RELAY_DECOMPRESS_TRANSLATION" });
    expect(state.escalations.some(e => e.trigger === "translation_integrity_failure")).toBe(true);
  });

  // FR_004: Corrupt manifest ticketId to TKT-WRONG
  it("FR_004 — manifest ticketId corrupted → execute_manifest_ticket_mismatch", () => {
    let state = stateWithManifest();
    state = getInjection("FR_004").apply(state);
    // Trigger: execute
    state = governanceReducer(state, {
      type: "SPECIALIST_EXECUTE",
      payload: { ticketId: "TKT-001", manifestTicketId: "TKT-WRONG" },
    });
    expect(state.escalations.some(e => e.trigger === "execute_manifest_ticket_mismatch")).toBe(true);
  });

  // FS_001: Null out manifest
  it("FS_001 — manifest nulled → execute_without_manifest", () => {
    let state = stateWithManifest();
    state = getInjection("FS_001").apply(state);
    state = governanceReducer(state, {
      type: "SPECIALIST_EXECUTE",
      payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001" },
    });
    expect(state.escalations.some(e => e.trigger === "execute_without_manifest")).toBe(true);
  });

  // FS_002: Corrupt manifest ticketId to TKT-MISMATCH
  it("FS_002 — manifest ticketId mismatch → execute_manifest_ticket_mismatch", () => {
    let state = stateWithManifest();
    state = getInjection("FS_002").apply(state);
    state = governanceReducer(state, {
      type: "SPECIALIST_EXECUTE",
      payload: { ticketId: "TKT-001", manifestTicketId: "TKT-MISMATCH" },
    });
    expect(state.escalations.some(e => e.trigger === "execute_manifest_ticket_mismatch")).toBe(true);
  });

  // FS_003: Receipt without artifacts (identity, event-sequence trigger)
  it("FS_003 — receipt on bare state → receipt_without_ticket_or_manifest", () => {
    let state = createInitialState();
    state = getInjection("FS_003").apply(state); // identity
    state = governanceReducer(state, {
      type: "SPECIALIST_RETURN_RECEIPT",
      payload: { receipt: makeReceipt() },
    });
    expect(state.escalations.some(e => e.trigger === "receipt_without_ticket_or_manifest")).toBe(true);
  });

  // FS_004: Corrupt receipt ticketId
  it("FS_004 — receipt ticketId corrupted → receipt_ticket_mismatch", () => {
    let state = stateWithManifest();
    // Execute first to have a valid execution context
    state = governanceReducer(state, {
      type: "SPECIALIST_EXECUTE",
      payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001" },
    });
    // Return receipt with wrong ticketId
    state = governanceReducer(state, {
      type: "SPECIALIST_RETURN_RECEIPT",
      payload: { receipt: { ...makeReceipt(), ticketId: "TKT-WRONG" } },
    });
    expect(state.escalations.some(e => e.trigger === "receipt_ticket_mismatch")).toBe(true);
  });

  // FST_001: STRIDE offline
  it("FST_001 — STRIDE offline → cold start fails, HALTED", () => {
    let state = createInitialState();
    state = getInjection("FST_001").apply(state);
    state = governanceReducer(state, { type: "STRIDE_COLD_START", payload: { success: false } });
    expect(state.state).toBe("HALTED");
    expect(state.escalations.some(e => e.trigger === "stride_cold_start_failed")).toBe(true);
  });

  // FST_002: strideSim.spoofing=true
  it("FST_002 — spoofing detected → BLOCKED, escalation", () => {
    let state = createInitialState();
    state = getInjection("FST_002").apply(state);
    state = governanceReducer(state, { type: "STRIDE_RUN_SIM", payload: { category: "spoofing", result: true } });
    expect(state.state).toBe("BLOCKED");
    expect(state.escalations.length).toBeGreaterThan(0);
  });

  // FST_003: strideSim.tampering=true
  it("FST_003 — tampering detected → BLOCKED, escalation", () => {
    let state = createInitialState();
    state = getInjection("FST_003").apply(state);
    state = governanceReducer(state, { type: "STRIDE_RUN_SIM", payload: { category: "tampering", result: true } });
    expect(state.state).toBe("BLOCKED");
    expect(state.escalations.length).toBeGreaterThan(0);
  });

  // FST_004: strideSim.denialOfService=true
  it("FST_004 — DoS detected → BLOCKED, escalation", () => {
    let state = createInitialState();
    state = getInjection("FST_004").apply(state);
    state = governanceReducer(state, { type: "STRIDE_RUN_SIM", payload: { category: "denialOfService", result: true } });
    expect(state.state).toBe("BLOCKED");
    expect(state.escalations.length).toBeGreaterThan(0);
  });

  // FC_001: Close without artifacts (identity, event-sequence trigger)
  it("FC_001 — close without measurable acceptance → close_without_artifacts", () => {
    let state = stateWithTicket();
    state = getInjection("FC_001").apply(state); // identity
    state = governanceReducer(state, { type: "ARCHITECT_CLOSE_TICKET" });
    expect(state.escalations.some(e => e.trigger === "close_without_artifacts")).toBe(true);
  });

  // FC_002: Close already-CLOSED (identity, event-sequence trigger)
  it("FC_002 — close already-closed ticket → action_on_closed", () => {
    let state = stateWithReceipt();
    // Close once (should succeed)
    state = governanceReducer(state, { type: "ARCHITECT_CLOSE_TICKET" });
    expect(state.state).toBe("CLOSED");
    // Apply identity injection
    state = getInjection("FC_002").apply(state);
    // Try to close again
    state = governanceReducer(state, { type: "ARCHITECT_CLOSE_TICKET" });
    expect(state.escalations.some(e => e.trigger === "action_on_closed")).toBe(true);
  });

  // FC_003: Execute on HALTED (identity, event-sequence trigger)
  it("FC_003 — execute on HALTED state → action_on_halted", () => {
    let state = stateWithManifest();
    // HALT the system via failed STRIDE cold start
    state = governanceReducer(state, { type: "STRIDE_COLD_START", payload: { success: false } });
    expect(state.state).toBe("HALTED");
    state = getInjection("FC_003").apply(state); // identity
    state = governanceReducer(state, {
      type: "SPECIALIST_EXECUTE",
      payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001" },
    });
    expect(state.escalations.some(e => e.trigger === "action_on_halted")).toBe(true);
  });

  // FC_004: Corrupt receipt manifestTicketId
  it("FC_004 — receipt manifest mismatch → receipt_ticket_mismatch", () => {
    let state = stateWithManifest();
    state = governanceReducer(state, {
      type: "SPECIALIST_EXECUTE",
      payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001" },
    });
    // Return receipt then corrupt it
    state = governanceReducer(state, {
      type: "SPECIALIST_RETURN_RECEIPT",
      payload: { receipt: { ...makeReceipt(), manifestTicketId: "TKT-WRONG" } },
    });
    expect(state.escalations.some(e => e.trigger === "receipt_ticket_mismatch")).toBe(true);
  });

  // FC_005: Receipt result=failure
  it("FC_005 — failed receipt → close_without_artifacts on close attempt", () => {
    let state = stateWithManifest();
    state = governanceReducer(state, {
      type: "SPECIALIST_EXECUTE",
      payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001" },
    });
    state = governanceReducer(state, {
      type: "SPECIALIST_RETURN_RECEIPT",
      payload: { receipt: { ...makeReceipt(), result: "failure" } },
    });
    // Try to close
    state = governanceReducer(state, { type: "ARCHITECT_CLOSE_TICKET" });
    expect(state.escalations.some(e => e.trigger === "close_without_artifacts")).toBe(true);
  });

  // FC_006: missedCommitments=10
  it("FC_006 — excessive missed commitments → BLOCKED, missed_commitment_threshold", () => {
    let state = stateWithTicket();
    state = getInjection("FC_006").apply(state);
    // Trigger: report another missed commitment
    state = governanceReducer(state, {
      type: "SPECIALIST_REPORT_COMMITMENT",
      payload: { met: false },
    });
    expect(state.state).toBe("BLOCKED");
    expect(state.escalations.some(e => e.trigger === "missed_commitment_threshold")).toBe(true);
  });
});

// ─── Structural Tests ────────────────────────────────────────────────────────

describe("Structural Tests", () => {
  it("Matrix completeness: every failureMatrix entry has a corresponding injection", () => {
    for (const entry of failureMatrix) {
      const injection = getInjection(entry.id);
      expect(injection, `Missing injection for ${entry.id}`).toBeDefined();
    }
  });

  it("Injection coverage: every injection ID is referenced in failureMatrix", () => {
    for (const inj of injections) {
      const matrixEntry = failureMatrix.find(m => m.id === inj.id);
      expect(matrixEntry, `Injection ${inj.id} not in failure matrix`).toBeDefined();
    }
  });

  it("Happy path: full lifecycle with zero escalations", () => {
    let state = createInitialState();

    // Submit ticket
    state = governanceReducer(state, {
      type: "ARCHITECT_SUBMIT_TICKET",
      payload: { ticket: makeTicket() },
    });
    expect(state.state).toBe("OPEN");
    expect(state.ticket).not.toBeNull();

    // Validate ticket
    state = governanceReducer(state, { type: "RELAY_VALIDATE_TICKET" });

    // Forward ticket
    state = governanceReducer(state, {
      type: "RELAY_FORWARD_TICKET",
      payload: { from: "RELAY", to: "SPECIALIST" },
    });
    expect(state.state).toBe("IN_PROGRESS");

    // Submit manifest
    state = governanceReducer(state, {
      type: "ARCHITECT_SUBMIT_MANIFEST",
      payload: { manifest: makeManifest() },
    });
    expect(state.state).toBe("IN_PROGRESS");

    // Execute
    state = governanceReducer(state, {
      type: "SPECIALIST_EXECUTE",
      payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001" },
    });
    expect(state.state).toBe("IN_PROGRESS");

    // Return receipt
    state = governanceReducer(state, {
      type: "SPECIALIST_RETURN_RECEIPT",
      payload: { receipt: makeReceipt() },
    });

    // Close ticket
    state = governanceReducer(state, { type: "ARCHITECT_CLOSE_TICKET" });
    expect(state.state).toBe("CLOSED");

    // Zero escalations
    expect(state.escalations).toHaveLength(0);
  });

  it("Unknown event type → HALTED + escalation", () => {
    const state = createInitialState();
    const event = { type: "NONSENSE" } as unknown as Event;
    const result = governanceReducer(state, event);
    expect(result.state).toBe("HALTED");
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations[0].trigger).toBe("unknown_event_type");
  });

  it("Reverse role boundary: SPECIALIST dispatches ARCHITECT-lane event → escalation", () => {
    const state = stateWithTicket();
    // Validate then try forwarding from SPECIALIST
    const s1 = governanceReducer(state, { type: "RELAY_VALIDATE_TICKET" });
    const s2 = governanceReducer(s1, {
      type: "RELAY_FORWARD_TICKET",
      payload: { from: "RELAY", to: "SPECIALIST" },
    });
    // Now SPECIALIST tries to submit a manifest (ARCHITECT-lane)
    const result = governanceReducer(s2, {
      type: "ARCHITECT_SUBMIT_MANIFEST",
      payload: { manifest: { ...makeManifest(), approvedBy: "SPECIALIST" } },
    });
    expect(result.escalations.length).toBeGreaterThan(0);
    expect(result.escalations.some(e => e.trigger === "role_boundary_violation")).toBe(true);
  });
});
