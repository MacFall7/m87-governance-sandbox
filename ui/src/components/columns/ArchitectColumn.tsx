import React from "react";
import { useGovernance } from "../../context/GovernanceContext";
import type { GovernanceMode } from "../../../../src/core/types";

export function ArchitectColumn() {
  const { state, dispatch } = useGovernance();

  const handleSubmitTicket = () => {
    dispatch({
      type: "ARCHITECT_SUBMIT_TICKET",
      payload: {
        ticket_id: `TKT-${Date.now().toString(36).toUpperCase()}`,
        governance_mode: "exploration",
        governance_mode_rationale: "Submitted via sandbox UI",
        risk_class: "low",
        acceptance_criteria: [
          { id: "AC_1", statement: "Must match checksum sha256", verifiable: true, verification_method: "runtime_probe" },
        ],
        artifact_definition: { receipt_bundle: true },
        environment_assumptions: [
          { id: "EA_1", statement: "Sandbox is ephemeral", verifiable: true, verification_method: "runtime_probe" },
        ],
        known_failure_classes: [],
      },
    });
  };

  const handleSetMode = (mode: GovernanceMode) => {
    dispatch({ type: "ARCHITECT_SET_MODE", payload: { mode } });
  };

  const handleClose = () => {
    dispatch({ type: "ARCHITECT_ATTEMPT_CLOSE" });
  };

  return (
    <div className="column">
      <h2>Architect</h2>
      <div className="item active">
        <strong>Ticket:</strong> {state.ticket ? state.ticket.ticket_id : "None"}
      </div>
      <div className="item">
        <strong>Mode:</strong> {state.mode ?? "—"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="injection-btn" onClick={handleSubmitTicket}>Submit Ticket</button>
        <button className="injection-btn" onClick={handleClose}>Close Ticket</button>
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <button className="injection-btn" style={{ fontSize: 10, padding: "3px 6px" }} onClick={() => handleSetMode("exploration")}>EXP</button>
          <button className="injection-btn" style={{ fontSize: 10, padding: "3px 6px" }} onClick={() => handleSetMode("production")}>PRD</button>
        </div>
      </div>
    </div>
  );
}
