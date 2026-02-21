#!/bin/bash
set -euo pipefail
# M87 Governance Sandbox — Canonical Frozen File Restore
# Run this from the repo root after checking out the Claude Code branch.
#
# Usage:
#   cd m87-governance-sandbox
#   git checkout claude/setup-project-structure-aDeF5
#   bash restore.sh

echo "=== Restoring canonical frozen files ==="

# Backup Claude Code's versions
mkdir -p .backup
cp src/core/injections.ts .backup/injections.ts.cc-version
cp src/core/failureMatrix.ts .backup/failureMatrix.ts.cc-version

# Drop canonical versions
cp frozen-originals/injections.ts src/core/injections.ts
cp frozen-originals/failureMatrix.ts src/core/failureMatrix.ts

echo "=== Frozen files restored. Running verification ==="

# Type check
echo "--- tsc --noEmit ---"
npx tsc --noEmit 2>&1 || { echo "TYPE CHECK FAILED — frozen files have type mismatches with Claude Code's types.ts"; exit 1; }

# Test run
echo "--- vitest run ---"
npx vitest run 2>&1
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  echo ""
  echo "=== TEST FAILURES DETECTED ==="
  echo "These failures show where Claude Code's reducer/tests assumed"
  echo "a different contract than the canonical frozen files define."
  echo ""
  echo "Options:"
  echo "  1. Feed this output to Claude Code with PATCH_INSTRUCTIONS.md"
  echo "  2. Fix manually"
  echo ""
  echo "Backups of Claude Code's versions are in .backup/"
  exit 1
fi

echo ""
echo "=== ALL TESTS PASS WITH CANONICAL FROZEN FILES ==="
echo "Safe to commit:"
echo "  git add src/core/injections.ts src/core/failureMatrix.ts"
echo "  git commit -m 'fix: restore canonical frozen files from original spec'"
echo "  git push"
