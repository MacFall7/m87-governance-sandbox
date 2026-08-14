import { describe, expect, it } from "vitest";
import { cleanState } from "../src/core/helpers.js";
import { failureMatrix } from "../src/core/failureMatrix.js";
import { getInjection } from "../src/core/injections.js";
import { governanceReducer } from "../src/core/reducer.js";
import type { Manifest, Ticket } from "../src/core/types.js";

function seedTicket(): Ticket {
  return {
    ticket_id: "T_001",
    governance_mode: "exploration",
    governance_mode_rationale: "Low-stakes sandbox change. Reversible.",
    risk_class: "low",
    acceptance_criteria: [
      { id: "AC_1", statement: "Must match checksum sha256", verifiable: true, verification_method: "runtime_probe" }
    ],
    artifact_definition: { receipt_bundle: true },
    environment_assumptions: [
      { id: "EA_1", statement: "Sandbox is ephemeral", verifiable: true, verification_method: "runtime_probe" }
    ],
    known_failure_classes: []
  };
}

function seedManifest(): Manifest {
  return {
    manifest_id: "M_001",
    ticket_id: "T_001",
    governance_mode: "exploration",
    risk_class: "low",
    cold_start_required: false,
    environment_required: {
      target: "local_sandbox",
      isolation: "ephemeral",
      persistence: "none",
      network_egress: "allowlisted",
      filesystem_write_scope: "sandbox"
    },
    assumptions: [{ id: "A1", statement: "No persistence", verifiable: true, verification_method: "runtime_probe" }],
    capability_scope: ["read_repo", "run_tests", "http_request_allowlisted"],
    operations: [
      {
        op_id: "OP1",
        op_type: "run_tests",
        description: "Run tests",
        required_capability: "run_tests",
        expected_effects: ["no_side_effects"],
        rollback_strategy: "none",
        params: {}
      }
    ],
    constraints: { allowed_domains: ["example.com"] }
  };
}

/** Helper: seed a state with ticket already submitted */
function stateWithTicket() {
  const s = cleanState();
  return governanceReducer(s, { type: "ARCHITECT_SUBMIT_TICKET", payload: seedTicket() });
}

/** Helper: seed a state with ticket + manifest */
function stateWithManifest() {
  const s = stateWithTicket();
  return governanceReducer(s, { type: "SPECIALIST_SUBMIT_MANIFEST", payload: seedManifest() });
}

describe("Matrix sanity", () => {
  it("failureMatrix count matches approved spec (23)", () => {
    expect(failureMatrix.length).toBe(23);
  });
});

describe("Failure injection matrix tests", () => {
  it("FA_001 — Omit artifact definition → RELAY rejects, stays OPEN", () => {
    let s = cleanState();
    s = governanceReducer(s, { type: "ARCHITECT_SUBMIT_TICKET", payload: seedTicket() });
    s = getInjection("FA_001").apply(s);
    s = governanceReducer(s, { type: "RELAY_VALIDATE_TICKET" });
    expect(s.state).toBe("OPEN");
    expect(s.escalations.some((e) => e.trigger === "missing_artifact_definition")).toBe(true);
  });

  it("FA_002 — Attempt close without receipt bundle → hard block", () => {
    let s = cleanState();
    s = governanceReducer(s, { type: "ARCHITECT_SUBMIT_TICKET", payload: seedTicket() });
    s = governanceReducer(s, { type: "ARCHITECT_ATTEMPT_CLOSE" });
    expect(s.state).toBe("REJECTED_INCOMPLETE");
    expect(s.escalations.some((e) => e.trigger === "missing_receipt_bundle")).toBe(true);
  });

  it("FA_003 — Ambiguous acceptance criteria → RELAY flags before forwarding", () => {
    let s = cleanState();
    s = governanceReducer(s, { type: "ARCHITECT_SUBMIT_TICKET", payload: seedTicket() });
    s = getInjection("FA_003").apply(s);
    s = governanceReducer(s, { type: "RELAY_VALIDATE_TICKET" });
    expect(s.state).toBe("OPEN");
    expect(s.escalations.some((e) => e.trigger === "ambiguous_acceptance_criteria")).toBe(true);
  });

  it("FA_004 — Omit governance_mode → RELAY rejects immediately", () => {
    let s = cleanState();
    const t = seedTicket();
    t.governance_mode = undefined;
    s = governanceReducer(s, { type: "ARCHITECT_SUBMIT_TICKET", payload: t });
    s = governanceReducer(s, { type: "RELAY_VALIDATE_TICKET" });
    expect(s.state).toBe("OPEN");
    expect(s.escalations.some((e) => e.trigger === "missing_governance_mode")).toBe(true);
  });

  it("FR_001 — Forward completion claim without receipt bundle → hard reject", () => {
    let s = cleanState();
    s = governanceReducer(s, { type: "ARCHITECT_SUBMIT_TICKET", payload: seedTicket() });
    s = getInjection("FR_001").apply(s);
    s = governanceReducer(s, { type: "RELAY_FORWARD_COMPLETION_CLAIM", payload: { text: "done" } });
    expect(s.state).toBe("REJECTED_INCOMPLETE");
    expect(s.escalations.some((e) => e.trigger === "missing_receipt_bundle")).toBe(true);
  });

  it("FR_002 — Insert 'none outstanding' assertion → immediate flag + escalation", () => {
    let s = cleanState();
    s = governanceReducer(s, { type: "RELAY_RECORD_ASSERTION", payload: { text: "none outstanding" } });
    expect(s.assertions.some((a) => a.flagged)).toBe(true);
    expect(s.escalations.some((e) => e.trigger === "none_outstanding_flag")).toBe(true);
  });

  it("FR_003 — Second missed commitment triggers escalation", () => {
    let s = cleanState();
    s = governanceReducer(s, { type: "RELAY_MISSED_COMMITMENT" });
    s = governanceReducer(s, { type: "RELAY_MISSED_COMMITMENT" });
    expect(s.missedCommitments).toBe(2);
    expect(s.escalations.some((e) => e.trigger === "second_missed_commitment")).toBe(true);
  });

  it("FR_004 — Forward manifest with lint failure → STRIDE never sees it (REJECTED_INCOMPLETE)", () => {
    let s = stateWithTicket();
    s = governanceReducer(s, { type: "SPECIALIST_SUBMIT_MANIFEST", payload: seedManifest() });
    s = getInjection("FR_004").apply(s);
    s = governanceReducer(s, { type: "RELAY_LINT_MANIFEST" });
    expect(s.state).toBe("REJECTED_INCOMPLETE");
    expect(s.escalations.length).toBeGreaterThan(0);
  });

  it("FR_005 — Strip context during translation → RELAY flags compression", () => {
    let s = cleanState();
    s = getInjection("FR_005").apply(s);
    s = governanceReducer(s, { type: "RELAY_TRANSLATE", payload: { text: "[context compressed]", compressed: true } });
    expect(s.escalations.some((e) => e.trigger === "context_compression_flag")).toBe(true);
    expect(s.assertions.some((a) => a.type === "context_compression" && a.flagged)).toBe(true);
  });

  it("FS_001 — Operation outside declared capability scope → lint rejects", () => {
    let s = stateWithManifest();
    s = getInjection("FS_001").apply(s);
    s = governanceReducer(s, { type: "RELAY_LINT_MANIFEST" });
    expect(s.state).toBe("REJECTED_INCOMPLETE");
    expect(s.escalations.some((e) => e.trigger === "capability_scope_mismatch")).toBe(true);
  });

  it("FS_002 — Production target with open network egress → critical reject", () => {
    let s = stateWithManifest();
    s = getInjection("FS_002").apply(s);
    s = governanceReducer(s, { type: "RELAY_LINT_MANIFEST" });
    expect(s.state).toBe("REJECTED_INCOMPLETE");
    expect(s.escalations.some((e) => e.trigger === "prod_egress_violation")).toBe(true);
  });

  it("FS_003 — Specialist self-approve completion → RELAY blocks (cannot close)", () => {
    let s = cleanState();
    s = governanceReducer(s, { type: "ARCHITECT_SUBMIT_TICKET", payload: seedTicket() });
    s = governanceReducer(s, { type: "SPECIALIST_DECLARE_DONE", payload: { text: "done" } });
    expect(s.state).toBe("PENDING_VERIFICATION");
    expect(s.escalations.some((e) => e.trigger === "missing_receipt_bundle")).toBe(true);
  });

  it("FS_004 — Omit rollback on env-modifying op → lint fires", () => {
    let s = stateWithManifest();
    s = getInjection("FS_004").apply(s);
    s = governanceReducer(s, { type: "RELAY_LINT_MANIFEST" });
    expect(s.state).toBe("REJECTED_INCOMPLETE");
    expect(s.escalations.some((e) => e.trigger === "missing_rollback")).toBe(true);
  });

  it("FS_005 — Unverifiable assumption in production → lint fires", () => {
    let s = stateWithManifest();
    s = getInjection("FS_005").apply(s);
    s = governanceReducer(s, { type: "RELAY_LINT_MANIFEST" });
    expect(s.state).toBe("REJECTED_INCOMPLETE");
    expect(s.escalations.some((e) => e.trigger === "assumption_unverifiable_in_prod")).toBe(true);
  });

  it("FX_001 — STRIDE executes outside manifest → HALTED", () => {
    let s = stateWithManifest();
    s = getInjection("FX_001").apply(s);
    s = governanceReducer(s, { type: "STRIDE_EXECUTE" });
    expect(s.state).toBe("HALTED");
  });

  it("FX_002 — Persistent state survives cold start → cold_start_verified=false, BLOCKED", () => {
    let s = stateWithTicket();
    const m = seedManifest();
    m.environment_required.persistence = "database";
    m.cold_start_required = true;
    s = governanceReducer(s, { type: "SPECIALIST_SUBMIT_MANIFEST", payload: m });
    s = getInjection("FX_002").apply(s);
    s = governanceReducer(s, { type: "STRIDE_EXECUTE" });
    expect(s.receipt?.cold_start_verified).toBe(false);
    expect(s.state).toBe("BLOCKED");
  });

  it("FX_003 — Network call not allowlisted → HALTED", () => {
    let s = stateWithManifest();
    s = getInjection("FX_003").apply(s);
    s = governanceReducer(s, { type: "STRIDE_EXECUTE" });
    expect(s.state).toBe("HALTED");
  });

  it("FX_004 — Scope expansion mid-exec → HALTED", () => {
    let s = stateWithManifest();
    s = getInjection("FX_004").apply(s);
    s = governanceReducer(s, { type: "STRIDE_EXECUTE" });
    expect(s.state).toBe("HALTED");
  });

  it("FX_005 — Partial success with silent divergence → divergence logged, BLOCKED + escalation", () => {
    let s = stateWithManifest();
    s = getInjection("FX_005").apply(s);
    s = governanceReducer(s, { type: "STRIDE_EXECUTE" });
    expect(s.state).toBe("BLOCKED");
    expect(s.escalations.some((e) => e.trigger === "stride_silent_divergence")).toBe(true);
  });

  it("FC_001 — Mode switch mid-ticket → BLOCKED + escalation", () => {
    let s = cleanState();
    s = governanceReducer(s, { type: "ARCHITECT_SUBMIT_TICKET", payload: seedTicket() });
    s = governanceReducer(s, { type: "RELAY_VALIDATE_TICKET" });
    s = governanceReducer(s, { type: "ARCHITECT_SET_MODE", payload: { mode: "production" } });
    expect(s.state).toBe("BLOCKED");
    expect(s.escalations.some((e) => e.trigger === "mode_switch_mid_ticket")).toBe(true);
  });

  it("FC_002 — Risk escalation after manifest exists → manifest invalidated + BLOCKED", () => {
    let s = stateWithManifest();
    s = governanceReducer(s, { type: "ARCHITECT_SET_RISK", payload: { risk: "high" } });
    expect(s.state).toBe("BLOCKED");
    expect(s.manifest).toBe(null);
    expect(s.escalations.some((e) => e.trigger === "risk_escalation_requires_resign")).toBe(true);
  });

  it("FC_002b — Risk decrease after manifest exists → manifest remains valid", () => {
    const ticket = seedTicket();
    ticket.risk_class = "medium";
    const manifest = seedManifest();
    manifest.risk_class = "medium";

    let s = cleanState();
    s = governanceReducer(s, { type: "ARCHITECT_SUBMIT_TICKET", payload: ticket });
    s = governanceReducer(s, { type: "SPECIALIST_SUBMIT_MANIFEST", payload: manifest });
    s = governanceReducer(s, { type: "ARCHITECT_SET_RISK", payload: { risk: "low" } });

    expect(s.state).toBe("IN_PROGRESS");
    expect(s.manifest).toBe(manifest);
    expect(s.riskClass).toBe("low");
    expect(s.escalations.some((e) => e.trigger === "risk_escalation_requires_resign")).toBe(false);
  });

  it("FC_003 — Architect enters Specialist lane → violation flagged", () => {
    let s = cleanState();
    s = governanceReducer(s, { type: "ARCHITECT_EDIT_MANIFEST" });
    expect(s.escalations.some((e) => e.trigger === "role_boundary_violation")).toBe(true);
  });
});
