import React from "react";
import { useGovernance } from "../../context/GovernanceContext";

export function StrideColumn() {
  const { state, dispatch } = useGovernance();

  const handleColdStart = (success: boolean) => {
    dispatch({ type: "STRIDE_COLD_START", payload: { success } });
  };

  return (
    <div className="column">
      <h2>STRIDE</h2>
      <div className={`item ${state.strideOnline ? "active" : ""}`}>
        <strong>Status:</strong> {state.strideOnline ? "ONLINE" : "OFFLINE"}
      </div>
      <div className="item">
        <strong>Risk:</strong> {state.riskClass}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="injection-btn" onClick={() => handleColdStart(true)}>Cold Start (OK)</button>
        <button className="injection-btn" style={{ background: "var(--red)" }} onClick={() => handleColdStart(false)}>Cold Start (FAIL)</button>
      </div>
    </div>
  );
}
