# M87 Governance Sandbox

Internal tool proving that M87 Studio's 7 architectural invariants hold under adversarial conditions. Runs 22 failure injection scenarios through a pure-function governance reducer.

## Quick Start

```bash
npm install
npm test              # 27 tests (22 failure matrix + 5 structural)
npm run typecheck     # tsc --noEmit
```

## Project Structure

```
src/core/
  types.ts          — Canonical type definitions
  reducer.ts        — Governance state machine (pure function)
  helpers.ts        — Pure utility functions
  injections.ts     — 22 fault injection definitions (frozen)
  failureMatrix.ts  — Declarative spec linking injections to invariants (frozen)
test/
  governanceReducer.test.ts — Full failure matrix + structural tests
ui/                 — React sandbox UI (4-column governance visualizer)
```

## Failure Matrix

The 22-case failure matrix (`src/core/failureMatrix.ts`) is the governance contract. Each entry defines:
- An injection scenario
- Expected escalation trigger and severity
- The architectural invariant being tested

## UI

```bash
cd ui && npm install && npm run dev
```

Four-column layout: ARCHITECT | RELAY | SPECIALIST | STRIDE. Injection panel triggers any of the 22 scenarios. State transitions are visually traceable.

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | Type check + tests |

## CI

Push or PR triggers GitHub Actions: `npm ci → test → typecheck`.
