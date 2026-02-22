// M87 Governance Sandbox — Canonical Type Definitions
// This file is additive only. Never remove or rename existing members.

export type GovernanceMode = "exploration" | "production";

export type RiskClass = "low" | "medium" | "high" | "critical";

export type TicketState =
  | "OPEN"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "PENDING_VERIFICATION"
  | "REJECTED_INCOMPLETE"
  | "HALTED"
  | "CLOSED";

export type Role = "ARCHITECT" | "RELAY" | "SPECIALIST" | "STRIDE" | "HUMAN";

export type AssertionType =
  | "completion_claim"
  | "commitment_language"
  | "status_statement"
  | "assumption_statement"
  | "context_compression";

export interface Assertion {
  type: AssertionType;
  raw_text: string;
  flagged: boolean;
  detected_at: string; // deterministic timestamp
}

export type EscalationTrigger =
  | "missing_artifact_definition"
  | "missing_governance_mode"
  | "ambiguous_acceptance_criteria"
  | "missing_receipt_bundle"
  | "none_outstanding_flag"
  | "second_missed_commitment"
  | "manifest_lint_fail"
  | "context_compression_flag"
  | "capability_scope_mismatch"
  | "prod_egress_violation"
  | "missing_rollback"
  | "assumption_unverifiable_in_prod"
  | "stride_outside_manifest"
  | "stride_network_not_allowlisted"
  | "stride_scope_expansion"
  | "stride_cold_start_failed"
  | "stride_silent_divergence"
  | "mode_switch_mid_ticket"
  | "risk_escalation_requires_resign"
  | "role_boundary_violation";

export interface Escalation {
  trigger: EscalationTrigger;
  routed_to: "ARCHITECT";
  severity: "low" | "medium" | "high" | "critical";
  details: string;
}

export interface TicketAcceptanceCriterion {
  id: string;
  statement: string;
  verifiable: boolean;
  verification_method:
    | "preflight_check"
    | "config_read"
    | "runtime_probe"
    | "manual_attestation"
    | "reproduction_test";
}

export interface Ticket {
  ticket_id: string;
  governance_mode?: GovernanceMode;
  governance_mode_rationale?: string;
  risk_class?: RiskClass;
  acceptance_criteria: TicketAcceptanceCriterion[];
  artifact_definition?: Record<string, unknown>;
  environment_assumptions: Array<{
    id: string;
    statement: string;
    verifiable: boolean;
    verification_method:
      | "preflight_check"
      | "config_read"
      | "runtime_probe"
      | "manual_attestation";
  }>;
  known_failure_classes?: string[];
}

export type EnvironmentTarget = "local_sandbox" | "ci_sandbox" | "staging" | "production";

export type NetworkEgress = "none" | "allowlisted" | "open";

export type Persistence = "none" | "workspace" | "volume" | "database";

export type Isolation = "ephemeral" | "persistent";

export type FsWriteScope = "none" | "sandbox" | "repo_only" | "staging" | "prod";

export interface ManifestOperation {
  op_id: string;
  op_type:
    | "run_command"
    | "run_tests"
    | "edit_file"
    | "generate_file"
    | "build"
    | "docker"
    | "http_request"
    | "deploy"
    | "database";
  description: string;
  required_capability?: Capability;
  expected_effects: Array<
    | "no_side_effects"
    | "modifies_repo"
    | "modifies_runtime"
    | "modifies_environment"
    | "network_egress"
    | "writes_persistent_storage"
  >;
  rollback_strategy: "none" | "git_revert" | "restore_backup" | "redeploy_previous" | "manual";
  params: Record<string, unknown>;
}

export type Capability =
  | "read_repo"
  | "write_repo"
  | "run_tests"
  | "build_artifact"
  | "start_service"
  | "stop_service"
  | "http_request_allowlisted"
  | "http_request_none"
  | "file_read_sandbox"
  | "file_write_sandbox"
  | "docker_build"
  | "docker_run"
  | "deploy_staging"
  | "deploy_production"
  | "db_migrate"
  | "db_read"
  | "db_write";

export interface Manifest {
  manifest_id: string;
  ticket_id: string;
  governance_mode: GovernanceMode;
  risk_class: RiskClass;
  // Phase 1 addition: first-class cold start requirement
  cold_start_required?: boolean;
  environment_required: {
    target: EnvironmentTarget;
    isolation: Isolation;
    persistence: Persistence;
    network_egress: NetworkEgress;
    filesystem_write_scope: FsWriteScope;
  };
  assumptions: Array<{
    id: string;
    statement: string;
    verifiable: boolean;
    verification_method: "preflight_check" | "config_read" | "runtime_probe" | "manual_attestation";
  }>;
  capability_scope: Capability[];
  operations: ManifestOperation[];
  constraints?: {
    allowed_domains?: string[];
  };
}

export interface Receipt {
  receipt_id: string;
  manifest_id: string;
  ticket_id: string;
  cold_start_verified: boolean;
  divergences: Array<{ severity: "minor" | "major" | "critical"; description: string; op_id?: string }>;
}

export interface EventRecord {
  ts: string;
  from: Role;
  to: Role;
  event: string;
  details?: string;
}

export interface SystemState {
  ticket: Ticket | null;
  manifest: Manifest | null;
  receipt: Receipt | null;
  state: TicketState;
  mode: GovernanceMode | null;
  riskClass: RiskClass | null;
  assertions: Assertion[];
  escalations: Escalation[];
  eventLog: EventRecord[];
  receiptBundlePresent: boolean;
  missedCommitments: number;
  strideSim: {
    attemptOutsideManifest: boolean;
    persistentLeak: boolean;
    notAllowlistedDomain: boolean;
    scopeExpansion: boolean;
    silentDivergence: boolean;
  };
  lastTranslationCompressed: boolean;
}

export type Event =
  | { type: "ARCHITECT_SUBMIT_TICKET"; payload: Ticket }
  | { type: "RELAY_VALIDATE_TICKET" }
  | { type: "RELAY_FORWARD_TO_SPECIALIST" }
  | { type: "SPECIALIST_SUBMIT_MANIFEST"; payload: Manifest }
  | { type: "RELAY_LINT_MANIFEST" }
  | { type: "RELAY_RECORD_ASSERTION"; payload: { text: string } }
  | { type: "RELAY_TRANSLATE"; payload: { text: string; compressed: boolean } }
  | { type: "RELAY_MISSED_COMMITMENT" }
  | { type: "RELAY_FORWARD_COMPLETION_CLAIM"; payload: { text: string } }
  | { type: "SPECIALIST_DECLARE_DONE"; payload: { text: string } }
  | { type: "STRIDE_EXECUTE" }
  | { type: "STRIDE_RETURN_RECEIPT"; payload: Receipt }
  | { type: "ARCHITECT_ATTEMPT_CLOSE" }
  | { type: "ARCHITECT_SET_MODE"; payload: { mode: GovernanceMode } }
  | { type: "ARCHITECT_SET_RISK"; payload: { risk: RiskClass } }
  | { type: "ARCHITECT_EDIT_MANIFEST" };

// ─── Failure Case Spec (prose-based, frozen) ─────────────────────────────────

export interface FailureCaseSpec {
  id: string;
  injection: string;
  expected: string;
  failure_if: string;
  category: "architect" | "relay" | "specialist" | "stride" | "cross";
}
