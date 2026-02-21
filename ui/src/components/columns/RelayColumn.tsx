import React from "react";
import { useGovernance } from "../../context/GovernanceContext";

export function RelayColumn() {
  const { state, dispatch } = useGovernance();

  const handleValidate = () => {
    if (!state.ticket) return;
    dispatch({
      type: "VALIDATE_TICKET",
      payload: { ticketId: state.ticket.id, role: "RELAY" },
    });
  };

  return (
    <div className="column">
      <h2>Relay</h2>
      <div className="item active">
        <strong>State:</strong> {state.state}
      </div>
      <div className="item">
        <strong>Events:</strong> {state.eventLog.length}
      </div>
      <div className="item">
        <strong>Assertions:</strong> {state.assertions.length}
        {state.assertions.length > 0 && (
          <span> ({state.assertions.filter(a => a.passed).length} passed)</span>
        )}
      </div>
      <button className="injection-btn" onClick={handleValidate}>Validate Ticket</button>
    </div>
  );
}
