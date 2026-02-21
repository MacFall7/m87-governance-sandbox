import React, { createContext, useContext, useReducer, useCallback } from "react";
import { governanceReducer } from "../../../src/core/reducer";
import { createInitialState } from "../../../src/core/types";
import type { GovernanceState, Event } from "../../../src/core/types";
import { failureMatrix } from "../../../src/core/failureMatrix";
import { injections } from "../../../src/core/injections";

// Extended action type for UI-level actions
type UIAction =
  | { kind: "event"; event: Event }
  | { kind: "inject"; injectionId: string }
  | { kind: "reset" };

interface GovernanceContextValue {
  state: GovernanceState;
  dispatch: (event: Event) => void;
  applyInjection: (injectionId: string) => void;
  reset: () => void;
}

const GovernanceContext = createContext<GovernanceContextValue | null>(null);

function uiReducer(state: GovernanceState, action: UIAction): GovernanceState {
  switch (action.kind) {
    case "event":
      return governanceReducer(state, action.event);

    case "inject": {
      const injection = injections.find(i => i.id === action.injectionId);
      if (!injection) return state;

      // Apply injection to get the precondition state
      const injectedState = injection.apply(createInitialState());

      // Map injection to the event that triggers the escalation
      const event = mapInjectionToEvent(action.injectionId);
      if (!event) return injectedState;

      // Run the event through the reducer with the injected precondition
      return governanceReducer(injectedState, event);
    }

    case "reset":
      return createInitialState();
  }
}

export function GovernanceProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(uiReducer, undefined, createInitialState);

  const dispatch = useCallback((event: Event) => {
    rawDispatch({ kind: "event", event });
  }, []);

  const applyInjection = useCallback((injectionId: string) => {
    rawDispatch({ kind: "inject", injectionId });
  }, []);

  const reset = useCallback(() => {
    rawDispatch({ kind: "reset" });
  }, []);

  return (
    <GovernanceContext.Provider value={{ state, dispatch, applyInjection, reset }}>
      {children}
    </GovernanceContext.Provider>
  );
}

export function useGovernance(): GovernanceContextValue {
  const ctx = useContext(GovernanceContext);
  if (!ctx) throw new Error("useGovernance must be used within GovernanceProvider");
  return ctx;
}

function mapInjectionToEvent(id: string): Event | null {
  switch (id) {
    case "INJ-01": return { type: "FORWARD_TICKET", payload: { ticketId: "TKT-001", from: "ARCHITECT", to: "SPECIALIST" } };
    case "INJ-02": return { type: "SUBMIT_MANIFEST", payload: { manifest: { ticketId: "TKT-001", steps: ["Step 1"], approvedBy: "ARCHITECT" } } };
    case "INJ-03": return { type: "SUBMIT_MANIFEST", payload: { manifest: { ticketId: "TKT-WRONG", steps: ["Step 1"], approvedBy: "ARCHITECT" } } };
    case "INJ-04": return { type: "EXECUTE", payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001", role: "SPECIALIST" } };
    case "INJ-05": return { type: "EXECUTE", payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001", role: "SPECIALIST" } };
    case "INJ-06": return { type: "EXECUTE", payload: { ticketId: "TKT-001", manifestTicketId: "TKT-WRONG", role: "SPECIALIST" } };
    case "INJ-07": return { type: "RETURN_RECEIPT", payload: { receipt: { ticketId: "TKT-001", manifestTicketId: "TKT-001", completedBy: "SPECIALIST", result: "success" } } };
    case "INJ-08": return { type: "RETURN_RECEIPT", payload: { receipt: { ticketId: "TKT-WRONG", manifestTicketId: "TKT-001", completedBy: "SPECIALIST", result: "success" } } };
    case "INJ-09": return { type: "STRIDE_COLD_START", payload: { success: false } };
    case "INJ-10": return { type: "CLOSE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    case "INJ-11": return { type: "CLOSE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    case "INJ-12": return { type: "CLOSE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    case "INJ-13": return { type: "CLOSE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    case "INJ-14": return { type: "FORWARD_TICKET", payload: { ticketId: "TKT-001", from: "SPECIALIST", to: "STRIDE" } };
    case "INJ-15": return { type: "SUBMIT_MANIFEST", payload: { manifest: { ticketId: "TKT-001", steps: ["Step 1"], approvedBy: "SPECIALIST" } } };
    case "INJ-16": return { type: "EXECUTE", payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001", role: "ARCHITECT" } };
    case "INJ-17": return { type: "SUBMIT_TICKET", payload: { ticket: { id: "TKT-002", title: "Dup", description: "Dup", riskClass: "low", createdBy: "ARCHITECT" } } };
    case "INJ-18": return { type: "CLOSE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    case "INJ-19": return { type: "EXECUTE", payload: { ticketId: "TKT-001", manifestTicketId: "TKT-001", role: "SPECIALIST" } };
    case "INJ-20": return { type: "FORWARD_TICKET", payload: { ticketId: "TKT-001", from: "ARCHITECT", to: "SPECIALIST" } };
    case "INJ-21": return { type: "VALIDATE_TICKET", payload: { ticketId: "TKT-001", role: "ARCHITECT" } };
    case "INJ-22": return { type: "RETURN_RECEIPT", payload: { receipt: { ticketId: "TKT-001", manifestTicketId: "TKT-WRONG", completedBy: "SPECIALIST", result: "success" } } };
    default: return null;
  }
}
