import React from "react";
import { useGovernance } from "../../context/GovernanceContext";

export function ArchitectColumn() {
  const { state, dispatch } = useGovernance();

  const handleSubmitTicket = () => {
    dispatch({
      type: "SUBMIT_TICKET",
      payload: {
        ticket: {
          id: `TKT-${Date.now().toString(36).toUpperCase()}`,
          title: "New Governance Ticket",
          description: "Submitted via sandbox UI",
          riskClass: "medium",
          createdBy: "ARCHITECT",
        },
      },
    });
  };

  const handleSetMode = (mode: "standard" | "enhanced" | "lockdown") => {
    dispatch({ type: "ARCHITECT_SET_MODE", payload: { mode } });
  };

  const handleForward = () => {
    if (!state.ticket) return;
    dispatch({
      type: "FORWARD_TICKET",
      payload: { ticketId: state.ticket.id, from: "ARCHITECT", to: "SPECIALIST" },
    });
  };

  const handleSubmitManifest = () => {
    if (!state.ticket) return;
    dispatch({
      type: "SUBMIT_MANIFEST",
      payload: {
        manifest: {
          ticketId: state.ticket.id,
          steps: ["Validate inputs", "Execute operation", "Verify outputs"],
          approvedBy: "ARCHITECT",
        },
      },
    });
  };

  const handleClose = () => {
    if (!state.ticket) return;
    dispatch({
      type: "CLOSE_TICKET",
      payload: { ticketId: state.ticket.id, role: "ARCHITECT" },
    });
  };

  return (
    <div className="column">
      <h2>Architect</h2>
      <div className="item active">
        <strong>Ticket:</strong> {state.ticket ? state.ticket.id : "None"}
      </div>
      <div className="item">
        <strong>Mode:</strong> {state.mode}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="injection-btn" onClick={handleSubmitTicket}>Submit Ticket</button>
        <button className="injection-btn" onClick={handleForward}>Forward to Specialist</button>
        <button className="injection-btn" onClick={handleSubmitManifest}>Submit Manifest</button>
        <button className="injection-btn" onClick={handleClose}>Close Ticket</button>
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <button className="injection-btn" style={{ fontSize: 10, padding: "3px 6px" }} onClick={() => handleSetMode("standard")}>STD</button>
          <button className="injection-btn" style={{ fontSize: 10, padding: "3px 6px" }} onClick={() => handleSetMode("enhanced")}>ENH</button>
          <button className="injection-btn" style={{ fontSize: 10, padding: "3px 6px" }} onClick={() => handleSetMode("lockdown")}>LCK</button>
        </div>
      </div>
    </div>
  );
}
