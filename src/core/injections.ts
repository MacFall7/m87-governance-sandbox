// M87 Governance Sandbox — Fault Injection Library
// FROZEN: Do not modify without explicit approval.

import type { GovernanceState, InjectionDefinition } from "./types";
import { createInitialState } from "./types";

function withTicket(state: GovernanceState): GovernanceState {
  return {
    ...state,
    state: "OPEN",
    ticket: {
      id: "TKT-001",
      title: "Test Ticket",
      description: "A test ticket for injection",
      riskClass: "medium",
      createdBy: "ARCHITECT",
    },
  };
}

function withManifest(state: GovernanceState): GovernanceState {
  return {
    ...state,
    state: "IN_PROGRESS",
    manifest: {
      ticketId: "TKT-001",
      steps: ["Step 1", "Step 2"],
      approvedBy: "ARCHITECT",
    },
  };
}

function withReceipt(state: GovernanceState): GovernanceState {
  return {
    ...state,
    receipt: {
      ticketId: "TKT-001",
      manifestTicketId: "TKT-001",
      completedBy: "SPECIALIST",
      result: "success",
    },
  };
}

export const injections: InjectionDefinition[] = [
  // 1. Forward without ticket
  { id: "INJ-01", name: "Forward without ticket", apply: (s) => ({ ...createInitialState() }) },
  // 2. Manifest without ticket
  { id: "INJ-02", name: "Manifest without ticket", apply: (s) => ({ ...createInitialState() }) },
  // 3. Manifest ticket mismatch
  { id: "INJ-03", name: "Manifest ticket mismatch", apply: (s) => ({ ...withTicket(createInitialState()), manifest: { ticketId: "TKT-WRONG", steps: ["Step 1"], approvedBy: "ARCHITECT" } }) },
  // 4. Execute without ticket
  { id: "INJ-04", name: "Execute without ticket", apply: (s) => ({ ...createInitialState(), manifest: { ticketId: "TKT-001", steps: ["Step 1"], approvedBy: "ARCHITECT" } }) },
  // 5. Execute without manifest
  { id: "INJ-05", name: "Execute without manifest", apply: (s) => withTicket(createInitialState()) },
  // 6. Execute manifest-ticket mismatch
  { id: "INJ-06", name: "Execute manifest-ticket mismatch", apply: (s) => ({ ...withTicket(createInitialState()), state: "IN_PROGRESS" as const, manifest: { ticketId: "TKT-WRONG", steps: ["Step 1"], approvedBy: "ARCHITECT" } }) },
  // 7. Receipt without ticket or manifest
  { id: "INJ-07", name: "Receipt without ticket or manifest", apply: (s) => ({ ...createInitialState() }) },
  // 8. Receipt ticket mismatch
  { id: "INJ-08", name: "Receipt ticket mismatch", apply: (s) => ({ ...withManifest(withTicket(createInitialState())), receipt: { ticketId: "TKT-WRONG", manifestTicketId: "TKT-001", completedBy: "SPECIALIST", result: "success" as const } }) },
  // 9. STRIDE cold start failed
  { id: "INJ-09", name: "STRIDE cold start failed", apply: (s) => ({ ...createInitialState(), strideOnline: false }) },
  // 10. Close without artifacts
  { id: "INJ-10", name: "Close without artifacts", apply: (s) => withTicket(createInitialState()) },
  // 11. Close without manifest
  { id: "INJ-11", name: "Close without manifest", apply: (s) => ({ ...withTicket(createInitialState()), receipt: { ticketId: "TKT-001", manifestTicketId: "TKT-001", completedBy: "SPECIALIST", result: "success" as const } }) },
  // 12. Close without receipt
  { id: "INJ-12", name: "Close without receipt", apply: (s) => withManifest(withTicket(createInitialState())) },
  // 13. Close with failed receipt
  { id: "INJ-13", name: "Close with failed receipt", apply: (s) => ({ ...withManifest(withTicket(createInitialState())), receipt: { ticketId: "TKT-001", manifestTicketId: "TKT-001", completedBy: "SPECIALIST", result: "failure" as const } }) },
  // 14. Forward from wrong role
  { id: "INJ-14", name: "Forward from SPECIALIST (wrong role)", apply: (s) => withTicket(createInitialState()) },
  // 15. Manifest from wrong role
  { id: "INJ-15", name: "Manifest submitted by SPECIALIST", apply: (s) => withTicket(createInitialState()) },
  // 16. Execute by ARCHITECT (wrong role)
  { id: "INJ-16", name: "Execute by ARCHITECT", apply: (s) => withManifest(withTicket(createInitialState())) },
  // 17. Double submit ticket
  { id: "INJ-17", name: "Double submit ticket", apply: (s) => withTicket(createInitialState()) },
  // 18. Close already closed
  { id: "INJ-18", name: "Close already closed ticket", apply: (s) => ({ ...withReceipt(withManifest(withTicket(createInitialState()))), state: "CLOSED" as const }) },
  // 19. Execute on HALTED state
  { id: "INJ-19", name: "Execute on HALTED state", apply: (s) => ({ ...withManifest(withTicket(createInitialState())), state: "HALTED" as const }) },
  // 20. Forward on CLOSED state
  { id: "INJ-20", name: "Forward on CLOSED state", apply: (s) => ({ ...withTicket(createInitialState()), state: "CLOSED" as const }) },
  // 21. Missing ticket on validate
  { id: "INJ-21", name: "Validate without ticket", apply: (s) => ({ ...createInitialState() }) },
  // 22. Receipt manifest-ticket mismatch
  { id: "INJ-22", name: "Receipt manifest-ticket mismatch", apply: (s) => ({ ...withManifest(withTicket(createInitialState())), receipt: { ticketId: "TKT-001", manifestTicketId: "TKT-WRONG", completedBy: "SPECIALIST", result: "success" as const } }) },
];

export function getInjection(id: string): InjectionDefinition | undefined {
  return injections.find((i) => i.id === id);
}
