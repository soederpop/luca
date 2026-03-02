#!/usr/bin/env bash
set -euo pipefail

# Phrase that marks the start of the junk to remove
START_AT='Co-Authored-By'

# Safety: require a clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty; commit/stash first."
  exit 1
fi

# Ensure we are in a git repo
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Not inside a git repository."
  exit 1
}

echo "Rewriting commit messages: removing everything from '$START_AT' onward."
echo "This rewrites history (changes commit hashes)."

# Rewrite all refs (branches + tags)
git filter-branch -f --msg-filter "
  awk -v pat=\"\$START_AT\" '
    # When the pattern is seen, stop printing and exit (drops that line + rest)
    index(\$0, pat) { exit }
    { print }
  '
" -- --all

echo
echo "Done."
echo "Force-push if this is a shared remote:"
echo "  git push --force --all"
echo "  git push --force --tags"
