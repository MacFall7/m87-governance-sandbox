# DEBUG_REPORT.md — Governance Artifact

## Purpose

This document records the debugging and hardening provenance of the M87 Governance Sandbox. The failure matrix drove the debug session, and now drives continuous enforcement.

## What Was Built

A pure-function governance reducer (`src/core/reducer.ts`) that implements a state machine for M87 Studio's ticket lifecycle. The reducer enforces 7 architectural invariants:

1. **No action without a ticket** — All operations require an active ticket
2. **Manifest must reference active ticket** — Manifests are bound to tickets
3. **No execution without manifest** — Execution requires an approved manifest
4. **No receipt without prior artifacts** — Receipts require ticket + manifest
5. **STRIDE must be online** — STRIDE cold start failure halts the system
6. **Measurable acceptance required** — Close requires ticket + manifest + successful receipt
7. **Role boundaries enforced** — Only authorized roles can perform lane-specific actions

## Failure Matrix (22 Cases)

| ID | Scenario | Expected Trigger | Severity | Invariant |
|----|----------|-----------------|----------|-----------|
| INJ-01 | Forward without ticket | forward_without_ticket | high | No action without a ticket |
| INJ-02 | Manifest without ticket | manifest_without_ticket | high | No action without a ticket |
| INJ-03 | Manifest ticket mismatch | manifest_ticket_mismatch | high | Manifest must reference active ticket |
| INJ-04 | Execute without ticket | execute_without_ticket | high | No action without a ticket |
| INJ-05 | Execute without manifest | execute_without_manifest | high | No execution without manifest |
| INJ-06 | Execute manifest-ticket mismatch | execute_manifest_ticket_mismatch | high | Execution manifest must match ticket |
| INJ-07 | Receipt without ticket or manifest | receipt_without_ticket_or_manifest | high | No receipt without prior artifacts |
| INJ-08 | Receipt ticket mismatch | receipt_ticket_mismatch | high | Receipt must reference active ticket |
| INJ-09 | STRIDE cold start failed | stride_cold_start_failed | critical | STRIDE must be online |
| INJ-10 | Close without artifacts | close_without_artifacts | high | Measurable acceptance required |
| INJ-11 | Close without manifest | close_without_artifacts | high | Measurable acceptance required |
| INJ-12 | Close without receipt | close_without_artifacts | high | Measurable acceptance required |
| INJ-13 | Close with failed receipt | close_without_artifacts | high | Measurable acceptance required |
| INJ-14 | Forward from SPECIALIST | role_boundary_violation | high | Role boundaries enforced |
| INJ-15 | Manifest by SPECIALIST | role_boundary_violation | high | Role boundaries enforced |
| INJ-16 | Execute by ARCHITECT | role_boundary_violation | high | Role boundaries enforced |
| INJ-17 | Double submit ticket | missing_ticket | medium | No duplicate tickets |
| INJ-18 | Close already closed | close_without_artifacts | medium | No action on closed ticket |
| INJ-19 | Execute on HALTED | execute_without_ticket | critical | No action on HALTED state |
| INJ-20 | Forward on CLOSED | forward_without_ticket | medium | No action on CLOSED state |
| INJ-21 | Validate without ticket | missing_ticket | high | No action without a ticket |
| INJ-22 | Receipt manifest-ticket mismatch | receipt_ticket_mismatch | high | Receipt must match manifest ticket |

## Bugs Found and Fixed

### BUG-01: Duplicate Code Block
**Symptom:** Brace imbalance in reducer causing parse failure.
**Root cause:** Copy-paste error duplicating a case block.
**Fix:** Removed duplicate block, verified brace balance.

### BUG-02: Untyped State Access
**Symptom:** `const s = state as any` allowing field access bugs to pass silently.
**Root cause:** Initial prototype used `any` cast to bypass type checking.
**Fix:** Removed all `as any` casts. All state access is now fully typed through `GovernanceState`.

### BUG-03: Missing Event in Discriminated Union
**Symptom:** `ARCHITECT_SET_MODE` dispatched but not in Event union, causing default case to fire.
**Root cause:** Event added to reducer switch but not to type definition.
**Fix:** Added `ARCHITECT_SET_MODE` to the `Event` discriminated union in `types.ts`.

### BUG-04: Open Default Case
**Symptom:** Unknown event types returned state unchanged — silent pass-through.
**Root cause:** `default: return s` with no escalation.
**Fix:** Default case now escalates with `unknown_event_type` trigger and sets state to `HALTED`.

## Structural Tests Added

Beyond the 22 failure matrix tests:

1. **Matrix completeness** — Every `failureMatrix` entry has a corresponding injection
2. **Injection coverage** — Every injection ID is referenced in the failure matrix
3. **Happy-path lifecycle** — Full OPEN → IN_PROGRESS → CLOSED with zero escalations
4. **Unknown event type** — Verifies fail-closed behavior
5. **Reverse role boundary** — SPECIALIST dispatching ARCHITECT-lane event

## Provenance

- Debug session: Prior to repo creation
- Hardening session: This repo
- All 27 tests passing at commit time
- Zero `as any` in reducer
- `tsc --noEmit` clean
