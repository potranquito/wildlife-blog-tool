#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${GITHUB_REPO_NAME:-wildlife-blogger}"
VISIBILITY="${GITHUB_VISIBILITY:-public}" # or: private
DEFAULT_BRANCH="${GITHUB_DEFAULT_BRANCH:-main}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install GitHub CLI first: https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged into GitHub. Run: gh auth login" >&2
  exit 1
fi

if [ ! -d .git ]; then
  git init -b "$DEFAULT_BRANCH"
fi

git add -A

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  git commit -m "Initial commit"
else
  git commit -m "Update" || true
fi

echo "Creating GitHub repo: $REPO_NAME ($VISIBILITY)"
gh repo create "$REPO_NAME" "--$VISIBILITY" --source . --remote origin --push

