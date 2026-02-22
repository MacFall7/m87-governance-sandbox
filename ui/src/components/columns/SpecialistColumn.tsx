import React from "react";
import { useGovernance } from "../../context/GovernanceContext";

export function SpecialistColumn() {
  const { state, dispatch } = useGovernance();

  const handleDeclareDone = () => {
    dispatch({ type: "SPECIALIST_DECLARE_DONE", payload: { text: "Work complete" } });
  };

  return (
    <div className="column">
      <h2>Specialist</h2>
      <div className="item active">
        <strong>Manifest:</strong> {state.manifest ? `${state.manifest.operations.length} ops` : "None"}
      </div>
      <div className="item">
        <strong>Receipt:</strong> {state.receipt ? (state.receipt.cold_start_verified ? "Verified" : "Unverified") : "None"}
      </div>
      <div className="item">
        <strong>Receipt Bundle:</strong> {state.receiptBundlePresent ? "Present" : "Missing"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="injection-btn" onClick={handleDeclareDone}>Declare Done</button>
      </div>
    </div>
  );
}
