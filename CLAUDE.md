# CLAUDE.md — Agent Instructions

## Project

M87 Governance Sandbox — a pure-function state machine proving 7 architectural invariants hold under 22 adversarial injection scenarios.

## Commands

```bash
npm test          # Run all tests (must be 23/23)
npm run typecheck # tsc --noEmit (must be 0 errors)
npm run lint      # Both of the above
```

## Constraints

- **No new dependencies in `src/core/`.** Core stays dependency-free.
- **`failureMatrix.ts` and `injections.ts` are frozen.** Do not modify without explicit approval.
- **`types.ts` is additive only.** Add to unions, never remove or rename existing members.
- **No `as any` in `src/core/reducer.ts`.**
- **Every reducer change must pass all tests before commit.**
- **Commit messages in imperative mood:** `harden: ...`, `test: ...`, `fix: ...`

## Architecture

- `src/core/types.ts` — All type definitions, `createInitialState()`
- `src/core/reducer.ts` — `governanceReducer(state, event)` — the state machine
- `src/core/helpers.ts` — `isMeasurableAcceptance()`, `modeCoversRisk()`
- `src/core/injections.ts` — 22 fault injection definitions (frozen)
- `src/core/failureMatrix.ts` — Maps injections to expected triggers/invariants (frozen)
- `test/governanceReducer.test.ts` — 22 failure matrix tests + 5 structural tests
- `ui/` — React sandbox with 4-column governance visualizer
