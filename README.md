# M87 Governance Sandbox

A pure-function state machine that proves 7 architectural invariants hold under 22 adversarial injection scenarios.

Built by [M87 Studio](https://m87.studio) to verify governance guarantees before they reach production.

## What It Proves

The governance reducer is a deterministic `(state, event) → state` function. The failure matrix defines 22 fault injections — each targeting a specific invariant — and the test suite confirms every injection triggers the correct escalation at the correct severity.

| Invariant | Example Injection |
|-----------|-------------------|
| Manifest completeness | Missing required fields, invalid acceptance criteria |
| Role boundary enforcement | Unauthorized scope changes, reverse-role operations |
| Escalation routing | Suppressed warnings, misrouted critical failures |
| STRIDE coverage | Threat categories missing from acceptance |
| Cold start / persistence | Persistence claimed without cold-start flag |
| Drift detection | Post-approval scope mutations |
| Compliance gating | Incomplete audits passed as complete |

All 22 scenarios are defined in `src/core/failureMatrix.ts` (frozen). The injection definitions live in `src/core/injections.ts` (also frozen). Neither file should be modified — they are the governance contract.

## Quick Start

```bash
npm install
npm test              # 23 tests (22 failure matrix + 1 structural)
npm run typecheck     # tsc --noEmit — must be 0 errors
npm run lint          # typecheck + tests
```

## Project Structure

```
src/core/
  types.ts          — All type definitions, createInitialState()
  reducer.ts        — governanceReducer(state, event) — the state machine
  helpers.ts        — Pure utility functions (pushEvent, escalate, etc.)
  injections.ts     — 22 fault injection definitions (frozen)
  failureMatrix.ts  — Maps injections → expected triggers/invariants (frozen)
test/
  governanceReducer.test.ts — Full failure matrix + structural sanity check
ui/                 — React sandbox (4-column governance visualizer)
```

## UI Sandbox

```bash
cd ui && npm install && npm run dev
```

Four-column layout: **ARCHITECT | RELAY | SPECIALIST | STRIDE**. The injection panel triggers any of the 22 scenarios. State transitions are visually traceable through the event log.

## CI

Push or PR triggers GitHub Actions: `npm ci → test → typecheck`.

## License

MIT — see [LICENSE](./LICENSE).
