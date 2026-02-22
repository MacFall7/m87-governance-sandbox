// M87 Governance Sandbox — Pure Utility Functions

import { AssertionType, Escalation, EscalationTrigger, Role, SystemState } from "./types.js";

export function now(): string {
  return "T+0";
}

export function pushEvent(state: SystemState, from: Role, to: Role, event: string, details?: string): SystemState {
  return {
    ...state,
    eventLog: [...state.eventLog, { ts: now(), from, to, event, details }]
  };
}

export function escalate(state: SystemState, trigger: EscalationTrigger, severity: Escalation["severity"], details: string): SystemState {
  const esc: Escalation = { trigger, routed_to: "ARCHITECT", severity, details };
  return { ...state, escalations: [...state.escalations, esc] };
}

export function addAssertion(
  state: SystemState,
  type: AssertionType,
  raw_text: string,
  flagged: boolean
): SystemState {
  return {
    ...state,
    assertions: [...state.assertions, { type, raw_text, flagged, detected_at: now() }]
  };
}

export function cleanState(): SystemState {
  return {
    ticket: null,
    manifest: null,
    receipt: null,
    state: "OPEN",
    mode: null,
    riskClass: null,
    assertions: [],
    escalations: [],
    eventLog: [],
    receiptBundlePresent: false,
    missedCommitments: 0,
    strideSim: {
      attemptOutsideManifest: false,
      persistentLeak: false,
      notAllowlistedDomain: false,
      scopeExpansion: false,
      silentDivergence: false
    },
    lastTranslationCompressed: false
  };
}

export function isMeasurableAcceptance(statement: string): boolean {
  const s = statement.toLowerCase();
  const hasDigits = /\d/.test(s);
  const hasComparator = /(>=|<=|==|!=|>|<)/.test(statement);
  const hasUnits = /(ms|seconds|sec|%|sha|checksum|hash|matches|must|true|false|within)/.test(s);
  return hasDigits || hasComparator || hasUnits;
}
