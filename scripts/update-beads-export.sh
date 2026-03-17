#!/usr/bin/env bash
# Export beads issues to JSONL for the bv static site viewer.
# Run this whenever beads data changes and you want to update the GitHub Pages site.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
JSONL_OUT="$REPO_ROOT/.beads/issues.jsonl"

command -v bd >/dev/null 2>&1 || { echo "Error: bd not found in PATH"; exit 1; }

TMP=$(mktemp)
bd export --scrub -o "$TMP"

# Deduplicate by ID (keep last occurrence)
python3 -c "
import json, sys
seen = {}
with open('$TMP') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        seen[obj['id']] = line
with open('$JSONL_OUT', 'w') as f:
    for line in seen.values():
        f.write(line + '\n')
print(f'Exported {len(seen)} unique issues to $JSONL_OUT')
"

rm -f "$TMP"
