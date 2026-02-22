import React from "react";
import { useGovernance } from "../../context/GovernanceContext";

export function StrideColumn() {
  const { state, dispatch } = useGovernance();

  const handleExecute = () => {
    dispatch({ type: "STRIDE_EXECUTE" });
  };

  const simFlags = state.strideSim;
  const anyThreat = simFlags.attemptOutsideManifest || simFlags.persistentLeak ||
    simFlags.notAllowlistedDomain || simFlags.scopeExpansion || simFlags.silentDivergence;

  return (
    <div className="column">
      <h2>STRIDE</h2>
      <div className={`item ${!anyThreat ? "active" : ""}`}>
        <strong>Sim:</strong> {anyThreat ? "THREAT DETECTED" : "CLEAN"}
      </div>
      <div className="item">
        <strong>Risk:</strong> {state.riskClass ?? "—"}
      </div>
      <div className="item">
        <strong>Missed:</strong> {state.missedCommitments}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="injection-btn" onClick={handleExecute}>STRIDE Execute</button>
      </div>
    </div>
  );
}
