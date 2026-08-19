#!/usr/bin/env bash
# Deterministic check for phrases that signal placeholder/demo code an LLM
# left behind. Case-insensitive; scans tracked source files only.
#
# Player-facing PROSE rules will live in test-content.ts once the content
# graph exists - they need the graph, not a grep.
set -euo pipefail

PATTERNS=(
  'in a real app'
  'in a production app'
  'for demonstration purposes'
  'this is a simplified'
  'simplified version of'
  'you would typically'
  'left as an exercise'
  'as an AI'
  'YOUR_API_KEY'
  'lorem ipsum'
  'health bar'
  'healthBar'
  'hitPoints'
)
# HUNDRED ILLS additions: the fires are not a health bar (DECISIONS 66),
# and the door-god rule must not re-invert (DECISIONS 60/84, locked in
# test-wards.ts).

FILES=$(git ls-files '*.ts' '*.tsx' '*.js' '*.jsx' | grep -v -e '^scripts/ci/' || true)
[ -z "$FILES" ] && exit 0

STATUS=0
for p in "${PATTERNS[@]}"; do
  if MATCHES=$(echo "$FILES" | xargs grep -lni "$p" 2>/dev/null); then
    echo "BANNED PHRASE \"$p\" found in:"
    echo "$MATCHES"
    STATUS=1
  fi
done

exit $STATUS
