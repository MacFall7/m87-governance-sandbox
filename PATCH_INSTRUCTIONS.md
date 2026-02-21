# PATCH_INSTRUCTIONS.md — Frozen File Restore

## Context

The canonical `injections.ts` and `failureMatrix.ts` have been restored.
These are the governance contract. They are FROZEN. Do not modify them.

Tests may be failing because the reducer and/or test file were written against
a paraphrased version of these files. Your job is to make the reducer and tests
match the canonical frozen files — NOT the other way around.

## What Changed

### `failureMatrix.ts` — Original Contract Shape

The canonical failure matrix uses **prose-based specs**, not programmatic lookups:

```typescript
interface FailureCaseSpec {
  id: string;
  injection: string;      // human-readable fault description
  expected: string;        // human-readable expected behavior
  failure_if: string;      // human-readable failure condition
  category: "architect" | "relay" | "specialist" | "stride" | "cross";
}
```

There is NO `expectedTrigger`, `expectedSeverity`, or `invariant` field.
If your tests import these fields, they need to be rewritten.

The tests should validate behavior (state transitions + escalation presence)
based on the `expected` prose — not by looking up a trigger name from the matrix.

### `injections.ts` — Original Injection Architecture

The canonical injections are **state mutators**, not state builders:

```typescript
interface Injection {
  id: string;
  apply: (s: SystemState) => SystemState;
}
```

Key design details:
- Each `apply()` takes existing state and corrupts one specific thing
- `FA_002`, `FR_002`, `FS_003`, `FC_001`, `FC_002`, `FC_003` are **identity functions** (`apply: (s) => s`)
  — these scenarios are triggered by event sequence, not state corruption
- Injections import `SystemState` from `"./types.js"` (note the `.js` extension for ESM compatibility)
- There are no helper functions like `withTicket` or `withManifest` in the injections file itself

### `types.ts` — Required Shape

The canonical `types.ts` has 234 lines. Key points for compatibility:

- `EscalationTrigger` is a union of 20 specific trigger strings (not generic)
- `Event` is a discriminated union of 16 event types including `ARCHITECT_SET_MODE`
- `SystemState` includes `strideSim` object with 5 boolean flags
- `SystemState` includes `lastTranslationCompressed: boolean`
- `SystemState` includes `missedCommitments: number`
- `Manifest` includes `cold_start_required?: boolean`

If your `types.ts` has different field names or missing members, the frozen files
won't compile. Fix `types.ts` to match (additive changes only — don't remove members
your reducer already uses, just add what's missing).

## Rules

1. **NEVER modify `injections.ts` or `failureMatrix.ts`**
2. Fix `types.ts` to be compatible with frozen file imports (additive only)
3. Fix `reducer.ts` to handle the state shapes the injections produce
4. Fix `test/governanceReducer.test.ts` to work with the prose-based failure matrix
5. All 22 failure matrix tests + structural tests must pass
6. `tsc --noEmit` must pass with zero errors
7. Zero `as any` in `reducer.ts`

## Test Pattern for Prose-Based Matrix

Since the matrix doesn't have `expectedTrigger`, tests should follow this pattern:

```typescript
// For each failure matrix entry:
// 1. Build up precondition state through the reducer (dispatch events)
// 2. Apply injection to corrupt state
// 3. Dispatch the trigger event
// 4. Assert state transition matches the prose `expected` description
// 5. Assert escalation presence/absence matches the prose `failure_if`

it("FA_001 — missing artifact definition", () => {
  let state = cleanState();
  // Build up: submit a ticket
  state = governanceReducer(state, {
    type: "ARCHITECT_SUBMIT_TICKET",
    payload: makeTicket()
  });
  // Inject: strip artifact_definition
  state = getInjection("FA_001").apply(state);
  // Trigger: RELAY validates
  state = governanceReducer(state, { type: "RELAY_VALIDATE_TICKET" });

  // Assert per matrix: "RELAY rejects. Ticket stays OPEN."
  expect(state.state).toBe("OPEN");
  // Assert per matrix failure_if: "RELAY forwards to Specialist"
  // → escalation should exist with relevant trigger
  expect(state.escalations.length).toBeGreaterThan(0);
});
```

## Commit

After all tests pass:
```
git add -A
git commit -m "fix: restore canonical frozen files, align reducer and tests"
```
