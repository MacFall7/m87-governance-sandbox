# M87 Governance Sandbox

[![CI](https://github.com/MacFall7/m87-governance-sandbox/actions/workflows/ci.yml/badge.svg)](https://github.com/MacFall7/m87-governance-sandbox/actions/workflows/ci.yml)

```
 24 tests | 23 failure-matrix injections | 0 type errors
 ✓ test/governanceReducer.test.ts  (24 tests) — all green
```

A pure-function state machine that proves 7 architectural invariants hold under 23 adversarial injection scenarios.

Built by [M87 Studio](https://m87studio.net) to verify governance guarantees before they reach production.

> **Repository role:** Reference/conformance test harness — a standalone TypeScript state machine that proves 7 governance invariants hold under 23 adversarial injection scenarios. Not a runtime kernel; doesn't share code or a wire format with [spine-lite-python](https://github.com/MacFall7/spine-lite-python), [M87-Spine-lite](https://github.com/MacFall7/M87-Spine-lite), or [m87-governed-swarm](https://github.com/MacFall7/m87-governed-swarm) — it's an independent proof of the same architectural pattern.
> **Status:** CI-green, frozen failure matrix (`src/core/failureMatrix.ts`, `src/core/injections.ts`).

**Proof entry point:** [`test/governanceReducer.test.ts`](./test/governanceReducer.test.ts) — runs every injection from the frozen failure matrix against the reducer and asserts the correct escalation fires.

## What It Proves

The governance reducer is a deterministic `(state, event) → state` function. The failure matrix defines 23 fault injections — each targeting a specific invariant — and the test suite confirms every injection triggers the correct behavior at the correct severity.

| Invariant | Example Injection |
|-----------|-------------------|
| Manifest completeness | Missing required fields, invalid acceptance criteria |
| Role boundary enforcement | Unauthorized scope changes, reverse-role operations |
| Escalation routing | Suppressed warnings, misrouted critical failures |
| STRIDE coverage | Threat categories missing from acceptance |
| Cold start / persistence | Persistence claimed without cold-start flag |
| Drift detection | Post-approval scope mutations |
| Compliance gating | Incomplete audits passed as complete |

All 23 scenarios are defined in `src/core/failureMatrix.ts` (frozen). The injection definitions live in `src/core/injections.ts` (also frozen). Neither file should be modified without an approved contract revision — they are the governance contract. The FC_002b revision documents the authorization path for the first matrix expansion.

## Quick Start

```bash
npm install
npm test              # 24 tests (23 failure matrix + 1 structural)
npm run typecheck     # tsc --noEmit — must be 0 errors
npm run lint          # typecheck + tests
```

## Project Structure

```
src/core/
  types.ts          — All type definitions, createInitialState()
  reducer.ts        — governanceReducer(state, event) — the state machine
  helpers.ts        — Pure utility functions (pushEvent, escalate, etc.)
  injections.ts     — 23 fault injection definitions (frozen)
  failureMatrix.ts  — Maps injections → expected triggers/invariants (frozen)
test/
  governanceReducer.test.ts — Full failure matrix + structural sanity check
ui/                 — React sandbox (4-column governance visualizer)
```

## Design Note: Deterministic Timestamps

All timestamps in the event log are the fixed string `"T+0"`. This is intentional — the reducer is a pure function `(state, event) → state` with no side effects, so `Date.now()` is forbidden. Determinism makes every test run reproducible regardless of environment.

## UI Sandbox

```bash
cd ui && npm install && npm run dev
```

Four-column layout: **ARCHITECT | RELAY | SPECIALIST | STRIDE**. The injection panel triggers any of the 23 scenarios. State transitions are visually traceable through the event log.

## CI

Push or PR triggers GitHub Actions: `npm ci → test → typecheck`.

## License

Business Source License 1.1 (Modified — M87 Spine Governance License v1.0) — see [LICENSE](./LICENSE).
Internal production use permitted. Commercial Governance Service use prohibited.
