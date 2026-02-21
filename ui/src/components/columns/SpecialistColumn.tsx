import React from "react";
import { useGovernance } from "../../context/GovernanceContext";

export function SpecialistColumn() {
  const { state, dispatch } = useGovernance();

  const handleExecute = () => {
    if (!state.ticket || !state.manifest) return;
    dispatch({
      type: "EXECUTE",
      payload: {
        ticketId: state.ticket.id,
        manifestTicketId: state.manifest.ticketId,
        role: "SPECIALIST",
      },
    });
  };

  const handleReturnReceipt = () => {
    if (!state.ticket || !state.manifest) return;
    dispatch({
      type: "RETURN_RECEIPT",
      payload: {
        receipt: {
          ticketId: state.ticket.id,
          manifestTicketId: state.manifest.ticketId,
          completedBy: "SPECIALIST",
          result: "success",
        },
      },
    });
  };

  return (
    <div className="column">
      <h2>Specialist</h2>
      <div className="item active">
        <strong>Manifest:</strong> {state.manifest ? `${state.manifest.steps.length} steps` : "None"}
      </div>
      <div className="item">
        <strong>Receipt:</strong> {state.receipt ? state.receipt.result : "None"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="injection-btn" onClick={handleExecute}>Execute</button>
        <button className="injection-btn" onClick={handleReturnReceipt}>Return Receipt</button>
      </div>
    </div>
  );
}
