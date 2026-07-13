#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || -z "${1// }" ]]; then
  echo "Usage: $0 \"commit message\""
  exit 1
fi

MESSAGE="$1"

if [[ -z "$(git status --porcelain)" ]]; then
  echo "Nothing to commit."
  exit 0
fi

git add -A
git commit -m "$MESSAGE"
git push

echo "Done."
