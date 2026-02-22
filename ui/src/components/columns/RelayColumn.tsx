import React from "react";
import { useGovernance } from "../../context/GovernanceContext";

export function RelayColumn() {
  const { state, dispatch } = useGovernance();

  const handleValidate = () => {
    dispatch({ type: "RELAY_VALIDATE_TICKET" });
  };

  const handleForward = () => {
    dispatch({ type: "RELAY_FORWARD_TO_SPECIALIST" });
  };

  const handleLintManifest = () => {
    dispatch({ type: "RELAY_LINT_MANIFEST" });
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
          <span> ({state.assertions.filter(a => a.flagged).length} flagged)</span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="injection-btn" onClick={handleValidate}>Validate Ticket</button>
        <button className="injection-btn" onClick={handleForward}>Forward to Specialist</button>
        <button className="injection-btn" onClick={handleLintManifest}>Lint Manifest</button>
      </div>
    </div>
  );
}
