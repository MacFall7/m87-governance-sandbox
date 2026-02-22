// M87 Governance Sandbox — Governance State Machine Reducer
// No `as any` allowed. All functions are fully typed.

import type {
  Event,
  SystemState,
  EscalationTrigger,
  Escalation,
  AssertionType,
  Assertion,
  Role,
  EventRecord,
  Manifest,
  ManifestOperation,
  Receipt,
} from "./types.js";

// ─── Internal Helpers (fully typed) ──────────────────────────────────────────

function now(): string {
  return "T+0";
}

function pushEvent(state: SystemState, from: Role, to: Role, label: string): SystemState {
  const entry: EventRecord = { ts: now(), from, to, event: label };
  return { ...state, eventLog: [...state.eventLog, entry] };
}

function escalate(state: SystemState, trigger: EscalationTrigger, severity: Escalation["severity"], details: string): SystemState {
  const esc: Escalation = { trigger, routed_to: "ARCHITECT", severity, details };
  return { ...state, escalations: [...state.escalations, esc] };
}

function addAssertion(state: SystemState, type: AssertionType, raw_text: string, flagged: boolean): SystemState {
  const a: Assertion = { type, raw_text, flagged, detected_at: now() };
  return { ...state, assertions: [...state.assertions, a] };
}

function shouldFlagAssertion(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  const patterns = ["almost done", "nothing outstanding", "none outstanding", "all set", "completed", "finished", "done", "ready"];
  return patterns.some((p) => t.includes(p));
}

function isMeasurableAcceptance(statement: string): boolean {
  const s = statement.toLowerCase();
  const hasDigits = /\d/.test(s);
  const hasComparator = /(>=|<=|==|!=|>|<)/.test(statement);
  const hasUnits = /(ms|seconds|sec|%|sha|checksum|hash|matches|must|true|false|within)/.test(s);
  return hasDigits || hasComparator || hasUnits;
}

interface LintResult {
  ok: boolean;
  errors: Array<{ trigger: EscalationTrigger; message: string }>;
}

function lintManifest(manifest: Manifest): LintResult {
  const errors: Array<{ trigger: EscalationTrigger; message: string }> = [];

  if (!manifest.manifest_id) errors.push({ trigger: "manifest_lint_fail", message: "manifest.manifest_id missing" });
  if (!manifest.ticket_id) errors.push({ trigger: "manifest_lint_fail", message: "manifest.ticket_id missing" });
  if (!manifest.governance_mode) errors.push({ trigger: "manifest_lint_fail", message: "manifest.governance_mode missing" });
  if (!manifest.risk_class) errors.push({ trigger: "manifest_lint_fail", message: "manifest.risk_class missing" });
  if (!manifest.environment_required) errors.push({ trigger: "manifest_lint_fail", message: "manifest.environment_required missing" });

  const requiresPersistence = JSON.stringify(manifest).toLowerCase().includes("persistence");
  if (requiresPersistence && manifest.cold_start_required !== true) {
    errors.push({ trigger: "manifest_lint_fail", message: "COLD_START_REQUIRED_FOR_PERSISTENCE: manifest.cold_start_required must be true when persistence is claimed." });
  }

  // Capability scope vs operation requirements
  const scope: string[] = manifest.capability_scope ?? [];
  const ops: ManifestOperation[] = manifest.operations ?? [];
  for (const op of ops) {
    if (op.required_capability && !scope.includes(op.required_capability)) {
      errors.push({ trigger: "capability_scope_mismatch", message: `Operation ${op.op_id} requires "${op.required_capability}" not in scope.` });
    }
  }

  // Production + open egress
  const env = manifest.environment_required;
  if (env?.target === "production" && env?.network_egress === "open") {
    errors.push({ trigger: "prod_egress_violation", message: "Production target with open network egress is not allowed." });
  }

  // Env-modifying ops must have rollback
  for (const op of ops) {
    const effects: string[] = op.expected_effects ?? [];
    if (effects.includes("modifies_environment") && op.rollback_strategy === "none") {
      errors.push({ trigger: "missing_rollback", message: `Operation ${op.op_id} modifies environment but has no rollback.` });
    }
  }

  // Unverifiable assumptions in production
  if (manifest.governance_mode === "production") {
    const assumptions = manifest.assumptions ?? [];
    for (const a of assumptions) {
      if (a.verifiable === false) {
        errors.push({ trigger: "assumption_unverifiable_in_prod", message: `Assumption "${a.statement}" not verifiable in production.` });
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function failStride(state: SystemState, trigger: EscalationTrigger, msg: string): SystemState {
  let next = escalate(state, trigger, "high", msg);
  next = pushEvent(next, "STRIDE", "ARCHITECT", `STRIDE_FAIL_${trigger}`);
  return { ...next, state: "HALTED" };
}

function failStrideColdStart(state: SystemState): SystemState {
  const receipt: Receipt = {
    receipt_id: `RECEIPT_COLDSTART_FAIL`,
    manifest_id: state.manifest?.manifest_id ?? "",
    ticket_id: state.ticket?.ticket_id ?? "",
    cold_start_verified: false,
    divergences: [{ severity: "critical", description: "Persistent state leak - cold start not verified." }],
  };
  let next: SystemState = { ...state, receipt, receiptBundlePresent: false };
  next = escalate(next, "stride_cold_start_failed", "high", "Persistent state survived cold start.");
  next = pushEvent(next, "STRIDE", "ARCHITECT", "STRIDE_FAIL_COLD_START");
  return { ...next, state: "BLOCKED" };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function governanceReducer(state: SystemState, event: Event): SystemState {
  switch (event.type) {
    case "ARCHITECT_SET_RISK": {
      const nextRisk = event.payload.risk;
      const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      const isEscalation =
        state.manifest != null &&
        riskOrder[nextRisk] > riskOrder[state.riskClass ?? "low"];
      if (isEscalation) {
        let next: SystemState = { ...state, riskClass: nextRisk, manifest: null, receipt: null, receiptBundlePresent: false };
        next = escalate(
          next,
          "risk_escalation_requires_resign",
          "high",
          "Risk escalated after manifest creation. Manifest invalidated; Specialist must re-submit under new risk."
        );
        next = pushEvent(next, "ARCHITECT", "RELAY", "ARCHITECT_SET_RISK_ESCALATED_INVALIDATES_MANIFEST");
        return { ...next, state: "BLOCKED" };
      }
      const next: SystemState = { ...state, riskClass: nextRisk };
      return pushEvent(next, "ARCHITECT", "RELAY", "ARCHITECT_SET_RISK");
    }

    case "ARCHITECT_SET_MODE": {
      const nextMode = event.payload.mode;
      if (state.ticket && state.mode && state.mode !== nextMode) {
        let next: SystemState = { ...state, mode: nextMode };
        next = escalate(
          next,
          "mode_switch_mid_ticket",
          "high",
          `Mode switched mid-ticket from ${state.mode} to ${nextMode}. In-progress work must be re-evaluated.`
        );
        next = pushEvent(next, "ARCHITECT", "RELAY", "ARCHITECT_SET_MODE_MID_TICKET");
        return { ...next, state: "BLOCKED" };
      }
      const next: SystemState = { ...state, mode: nextMode };
      return pushEvent(next, "ARCHITECT", "RELAY", "ARCHITECT_SET_MODE");
    }

    case "ARCHITECT_SUBMIT_TICKET": {
      const next: SystemState = {
        ...state,
        ticket: event.payload,
        mode: event.payload.governance_mode ?? state.mode ?? null,
        riskClass: event.payload.risk_class ?? state.riskClass ?? null,
        state: "IN_PROGRESS",
        manifest: null,
        receipt: null,
        receiptBundlePresent: false,
        missedCommitments: 0,
        assertions: state.assertions ?? [],
        escalations: state.escalations ?? [],
      };
      return pushEvent(next, "ARCHITECT", "RELAY", "ARCHITECT_SUBMIT_TICKET");
    }

    case "RELAY_VALIDATE_TICKET": {
      if (!state.ticket) {
        const next = escalate(state, "missing_governance_mode", "high", "No ticket present.");
        return pushEvent({ ...next, state: "OPEN" }, "RELAY", "ARCHITECT", "RELAY_VALIDATE_TICKET_FAIL");
      }
      if (!state.mode || !state.ticket.governance_mode) {
        const next = escalate(state, "missing_governance_mode", "high", "Governance mode must be declared by ARCHITECT.");
        return pushEvent({ ...next, state: "OPEN" }, "RELAY", "ARCHITECT", "RELAY_VALIDATE_TICKET_FAIL");
      }
      if (!state.riskClass) {
        const next = escalate(state, "missing_governance_mode", "high", "Risk class must be declared by ARCHITECT.");
        return pushEvent({ ...next, state: "OPEN" }, "RELAY", "ARCHITECT", "RELAY_VALIDATE_TICKET_FAIL");
      }
      if (!state.ticket.artifact_definition) {
        const next = escalate(state, "missing_artifact_definition", "high", "Ticket missing artifact_definition.");
        return pushEvent({ ...next, state: "OPEN" }, "RELAY", "ARCHITECT", "RELAY_VALIDATE_TICKET_FAIL");
      }
      const criteria = state.ticket.acceptance_criteria ?? [];
      const hasAmbiguous = criteria.some((c) => !isMeasurableAcceptance(c.statement));
      if (hasAmbiguous) {
        const next = escalate(state, "ambiguous_acceptance_criteria", "high", "Acceptance criteria contain ambiguous (non-measurable) statements.");
        return pushEvent({ ...next, state: "OPEN" }, "RELAY", "ARCHITECT", "RELAY_VALIDATE_TICKET_FAIL");
      }
      return pushEvent({ ...state, state: "IN_PROGRESS" }, "RELAY", "RELAY", "RELAY_VALIDATE_TICKET_OK");
    }

    case "RELAY_FORWARD_TO_SPECIALIST": {
      if (!state.ticket) {
        const next = escalate(state, "missing_governance_mode", "high", "Cannot forward without a ticket.");
        return pushEvent({ ...next, state: "REJECTED_INCOMPLETE" }, "RELAY", "ARCHITECT", "RELAY_FORWARD_FAIL");
      }
      return pushEvent({ ...state }, "RELAY", "SPECIALIST", "RELAY_FORWARD_TO_SPECIALIST");
    }

    case "SPECIALIST_SUBMIT_MANIFEST": {
      if (!state.ticket) {
        let next = escalate(state, "manifest_lint_fail", "high", "Manifest submitted with no active ticket.");
        next = pushEvent(next, "SPECIALIST", "RELAY", "SPECIALIST_SUBMIT_MANIFEST_REJECTED_NO_TICKET");
        return { ...next, state: "REJECTED_INCOMPLETE" };
      }
      if (event.payload.ticket_id !== state.ticket.ticket_id) {
        let next = escalate(
          state,
          "manifest_lint_fail",
          "high",
          `Manifest ticket_id (${event.payload.ticket_id}) does not match active ticket (${state.ticket.ticket_id}).`
        );
        next = pushEvent(next, "SPECIALIST", "ARCHITECT", "SPECIALIST_SUBMIT_MANIFEST_REJECTED_MISMATCH");
        return { ...next, state: "REJECTED_INCOMPLETE" };
      }
      const next: SystemState = {
        ...state,
        manifest: event.payload,
        receipt: null,
        receiptBundlePresent: false,
      };
      return pushEvent(next, "SPECIALIST", "RELAY", "SPECIALIST_SUBMIT_MANIFEST_ACCEPTED");
    }

    case "RELAY_LINT_MANIFEST": {
      if (!state.manifest) {
        const next = escalate(state, "manifest_lint_fail", "high", "No manifest to lint.");
        return pushEvent({ ...next, state: "REJECTED_INCOMPLETE" }, "RELAY", "ARCHITECT", "RELAY_LINT_MANIFEST_FAIL");
      }
      if (!state.ticket || state.manifest.ticket_id !== state.ticket.ticket_id) {
        const next = escalate(
          state,
          "manifest_lint_fail",
          "high",
          "Manifest ticket_id does not match active ticket during lint."
        );
        return pushEvent({ ...next, state: "REJECTED_INCOMPLETE" }, "RELAY", "ARCHITECT", "RELAY_LINT_MANIFEST_FAIL");
      }
      const lint = lintManifest(state.manifest);
      if (!lint.ok) {
        let next: SystemState = state;
        for (const err of lint.errors) next = escalate(next, err.trigger, "high", err.message);
        next = pushEvent(next, "RELAY", "ARCHITECT", "RELAY_LINT_MANIFEST_FAIL");
        return { ...next, state: "REJECTED_INCOMPLETE" };
      }
      return pushEvent({ ...state, state: "IN_PROGRESS" }, "RELAY", "RELAY", "RELAY_LINT_MANIFEST_OK");
    }

    case "RELAY_RECORD_ASSERTION": {
      const flagged = shouldFlagAssertion(event.payload.text);
      let next = addAssertion(state, "assumption_statement", event.payload.text, flagged);
      if (flagged) {
        next = escalate(next, "none_outstanding_flag", "high", `Flagged assertion detected: "${event.payload.text}"`);
      }
      return pushEvent(next, "RELAY", "RELAY", "RELAY_RECORD_ASSERTION");
    }

    case "RELAY_TRANSLATE": {
      if (event.payload.compressed) {
        let next = addAssertion(state, "context_compression", event.payload.text, true);
        next = escalate(next, "context_compression_flag", "high", "Context compression detected during translation.");
        next = pushEvent(next, "RELAY", "ARCHITECT", "RELAY_TRANSLATE_COMPRESSED");
        return next;
      }
      const next: SystemState = { ...state, lastTranslationCompressed: false };
      return pushEvent(next, "RELAY", "RELAY", "RELAY_TRANSLATE_CLEAN");
    }

    case "RELAY_MISSED_COMMITMENT": {
      const count = (state.missedCommitments ?? 0) + 1;
      let next: SystemState = { ...state, missedCommitments: count };
      if (count >= 2) {
        next = escalate(next, "second_missed_commitment", "high", `Missed commitment #${count}. Escalating to Architect.`);
      }
      return pushEvent(next, "RELAY", "ARCHITECT", "RELAY_MISSED_COMMITMENT");
    }

    case "RELAY_FORWARD_COMPLETION_CLAIM": {
      if (!state.receiptBundlePresent) {
        let next = addAssertion(state, "completion_claim", event.payload.text, true);
        next = escalate(next, "missing_receipt_bundle", "high", "Completion claim without receipt bundle.");
        next = pushEvent(next, "RELAY", "ARCHITECT", "RELAY_FORWARD_COMPLETION_REJECTED");
        return { ...next, state: "REJECTED_INCOMPLETE" };
      }
      const next = addAssertion(state, "completion_claim", event.payload.text, shouldFlagAssertion(event.payload.text));
      return pushEvent(next, "RELAY", "ARCHITECT", "RELAY_FORWARD_COMPLETION_CLAIM");
    }

    case "SPECIALIST_DECLARE_DONE": {
      let next = addAssertion(state, "status_statement", event.payload.text, shouldFlagAssertion(event.payload.text));
      next = { ...next, state: "PENDING_VERIFICATION" as const };
      if (!state.receiptBundlePresent) {
        next = escalate(next, "missing_receipt_bundle", "high", "Specialist declared done but no receipt bundle present.");
      }
      return pushEvent(next, "SPECIALIST", "RELAY", "SPECIALIST_DECLARE_DONE");
    }

    case "STRIDE_EXECUTE": {
      if (!state.ticket) {
        let next = escalate(state, "stride_outside_manifest", "high", "STRIDE attempted execution with no ticket.");
        next = pushEvent(next, "STRIDE", "ARCHITECT", "STRIDE_EXECUTE_REJECTED_NO_TICKET");
        return { ...next, state: "HALTED" };
      }
      if (!state.manifest) {
        let next = escalate(state, "stride_outside_manifest", "high", "STRIDE attempted execution with no manifest.");
        next = pushEvent(next, "STRIDE", "RELAY", "STRIDE_EXECUTE_REJECTED_NO_MANIFEST");
        return { ...next, state: "HALTED" };
      }
      if (state.manifest.ticket_id !== state.ticket.ticket_id) {
        let next = escalate(
          state,
          "stride_outside_manifest",
          "high",
          `Execution blocked: manifest.ticket_id (${state.manifest.ticket_id}) != ticket.ticket_id (${state.ticket.ticket_id}).`
        );
        next = pushEvent(next, "STRIDE", "ARCHITECT", "STRIDE_EXECUTE_REJECTED_MISMATCH");
        return { ...next, state: "HALTED" };
      }

      const sim = state.strideSim;
      if (sim.attemptOutsideManifest) return failStride(state, "stride_outside_manifest", "STRIDE executing outside manifest.");
      if (sim.persistentLeak) return failStrideColdStart(state);
      if (sim.notAllowlistedDomain) return failStride(state, "stride_network_not_allowlisted", "Network call not allowlisted.");
      if (sim.scopeExpansion) return failStride(state, "stride_scope_expansion", "Scope expansion mid-exec.");
      if (sim.silentDivergence) {
        let next = escalate(state, "stride_silent_divergence", "high", "Partial success with silent divergence.");
        next = pushEvent(next, "STRIDE", "ARCHITECT", "STRIDE_FAIL_SILENT_DIVERGENCE");
        return { ...next, state: "BLOCKED" };
      }

      return pushEvent({ ...state, state: "IN_PROGRESS" }, "STRIDE", "RELAY", "STRIDE_EXECUTE");
    }

    case "STRIDE_RETURN_RECEIPT": {
      if (!state.ticket || !state.manifest) {
        let next = escalate(state, "missing_receipt_bundle", "high", "Receipt returned without ticket/manifest.");
        next = pushEvent(next, "STRIDE", "ARCHITECT", "STRIDE_RETURN_RECEIPT_REJECTED");
        return { ...next, state: "BLOCKED" };
      }
      if (event.payload.ticket_id !== state.ticket.ticket_id) {
        let next = escalate(state, "missing_receipt_bundle", "high", "Receipt ticket_id mismatch.");
        next = pushEvent(next, "STRIDE", "ARCHITECT", "STRIDE_RETURN_RECEIPT_REJECTED");
        return { ...next, state: "BLOCKED" };
      }
      const next: SystemState = {
        ...state,
        receipt: event.payload,
        receiptBundlePresent: true,
        state: "IN_PROGRESS",
      };
      return pushEvent(next, "STRIDE", "RELAY", "STRIDE_RETURN_RECEIPT");
    }

    case "ARCHITECT_ATTEMPT_CLOSE": {
      if (!state.ticket || !state.manifest || !state.receipt || !state.receiptBundlePresent) {
        let next = escalate(state, "missing_receipt_bundle", "high", "Cannot close without ticket+manifest+receipt bundle.");
        next = pushEvent(next, "ARCHITECT", "RELAY", "ARCHITECT_CLOSE_REJECTED");
        return { ...next, state: "REJECTED_INCOMPLETE" };
      }
      const hasHigh = (state.escalations ?? []).some((e) => e.severity === "high");
      if (hasHigh) {
        const next = pushEvent(state, "ARCHITECT", "RELAY", "ARCHITECT_CLOSE_BLOCKED_ESCALATION");
        return { ...next, state: "BLOCKED" };
      }
      const next: SystemState = { ...state, state: "CLOSED" };
      return pushEvent(next, "ARCHITECT", "RELAY", "ARCHITECT_ATTEMPT_CLOSE");
    }

    case "ARCHITECT_EDIT_MANIFEST": {
      let next = escalate(state, "role_boundary_violation", "high", "Architect entered Specialist lane (manifest edit).");
      next = pushEvent(next, "ARCHITECT", "RELAY", "ARCHITECT_EDIT_MANIFEST_BLOCKED");
      return { ...next, state: "BLOCKED" };
    }

    default: {
      const _exhaustive: never = event;
      void _exhaustive;
      return { ...state, state: "HALTED" };
    }
  }
}
