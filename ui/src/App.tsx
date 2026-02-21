import React, { useState } from "react";
import { useGovernance } from "./context/GovernanceContext";
import { ArchitectColumn } from "./components/columns/ArchitectColumn";
import { RelayColumn } from "./components/columns/RelayColumn";
import { SpecialistColumn } from "./components/columns/SpecialistColumn";
import { StrideColumn } from "./components/columns/StrideColumn";
import { failureMatrix } from "../../src/core/failureMatrix";

export function App() {
  const { state, applyInjection, reset } = useGovernance();
  const [selectedInjection, setSelectedInjection] = useState(failureMatrix[0].id);

  return (
    <>
      {/* Status Bar */}
      <div className="status-bar">
        <span style={{ fontWeight: 700, color: "var(--accent)" }}>M87 GOVERNANCE</span>
        <span className={`badge state-${state.state}`}>{state.state}</span>
        <span className={`badge mode-${state.mode}`}>{state.mode}</span>
        <span className={`badge risk-${state.riskClass}`}>{state.riskClass}</span>
        <span style={{ color: "var(--text-dim)", marginLeft: "auto" }}>
          Escalations: {state.escalations.length}
        </span>
      </div>

      {/* 4-Column Grid */}
      <div className="columns">
        <ArchitectColumn />
        <RelayColumn />
        <SpecialistColumn />
        <StrideColumn />
      </div>

      {/* Bottom Panels */}
      <div className="panels">
        {/* Injection Panel */}
        <div className="panel">
          <h3>Fault Injection</h3>
          <select
            className="injection-select"
            value={selectedInjection}
            onChange={(e) => setSelectedInjection(e.target.value)}
          >
            {failureMatrix.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.id}: {entry.name}
              </option>
            ))}
          </select>
          <div>
            <button className="injection-btn" onClick={() => applyInjection(selectedInjection)}>
              Inject
            </button>
            <button className="injection-btn reset" onClick={reset}>
              Reset
            </button>
          </div>
          {failureMatrix.find(e => e.id === selectedInjection) && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)" }}>
              <div><strong>Trigger:</strong> {failureMatrix.find(e => e.id === selectedInjection)!.expectedTrigger}</div>
              <div><strong>Severity:</strong> {failureMatrix.find(e => e.id === selectedInjection)!.expectedSeverity}</div>
              <div><strong>Invariant:</strong> {failureMatrix.find(e => e.id === selectedInjection)!.invariant}</div>
            </div>
          )}
        </div>

        {/* Escalation Feed */}
        <div className="panel">
          <h3>Escalation Feed</h3>
          {state.escalations.length === 0 && (
            <div style={{ color: "var(--text-dim)", fontSize: 11 }}>No escalations</div>
          )}
          {[...state.escalations].reverse().map((esc, i) => (
            <div key={i} className={`escalation sev-${esc.severity}`}>
              <strong>[{esc.severity.toUpperCase()}]</strong> {esc.trigger}: {esc.message}
            </div>
          ))}
        </div>

        {/* Event Log */}
        <div className="panel">
          <h3>Event Log</h3>
          {state.eventLog.length === 0 && (
            <div style={{ color: "var(--text-dim)", fontSize: 11 }}>No events</div>
          )}
          {[...state.eventLog].reverse().map((evt, i) => (
            <div key={i} className="event-entry">
              <span className="from">{evt.from}</span>
              {" → "}
              <span className="to">{evt.to}</span>
              {": "}
              {evt.label}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
