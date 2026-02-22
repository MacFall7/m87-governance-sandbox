import React, { createContext, useContext, useReducer, useCallback } from "react";
import { governanceReducer } from "../../../src/core/reducer";
import { cleanState } from "../../../src/core/helpers";
import type { SystemState, Event } from "../../../src/core/types";
import { injections } from "../../../src/core/injections";

// Extended action type for UI-level actions
type UIAction =
  | { kind: "event"; event: Event }
  | { kind: "inject"; injectionId: string }
  | { kind: "reset" };

interface GovernanceContextValue {
  state: SystemState;
  dispatch: (event: Event) => void;
  applyInjection: (injectionId: string) => void;
  reset: () => void;
}

const GovernanceContext = createContext<GovernanceContextValue | null>(null);

function uiReducer(state: SystemState, action: UIAction): SystemState {
  switch (action.kind) {
    case "event":
      return governanceReducer(state, action.event);

    case "inject": {
      const injection = injections.find(i => i.id === action.injectionId);
      if (!injection) return state;
      // Apply injection as a state mutator (canonical pattern)
      return injection.apply(state);
    }

    case "reset":
      return cleanState();
  }
}

export function GovernanceProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(uiReducer, undefined, cleanState);

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
