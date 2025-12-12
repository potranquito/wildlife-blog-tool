#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${GITHUB_REPO_NAME:-wildlife-blogger}"
VISIBILITY="${GITHUB_VISIBILITY:-public}" # or: private
DEFAULT_BRANCH="${GITHUB_DEFAULT_BRANCH:-main}"

GH_BIN="${GH_BIN:-gh}"

if ! command -v "$GH_BIN" >/dev/null 2>&1 && [ ! -x "$GH_BIN" ]; then
  echo "gh CLI not found. Install GitHub CLI first: https://cli.github.com/" >&2
  exit 1
fi

# In some sandboxed/container setups, the Snap launcher at /snap/bin/gh fails
# with: "cannot set privileged capabilities: Operation not permitted".
# Fall back to the real binary inside the snap if available.
if ! "$GH_BIN" --version >/dev/null 2>&1; then
  if [ -x /snap/gh/current/gh ]; then
    GH_BIN=/snap/gh/current/gh
    export GH_CONFIG_DIR="${GH_CONFIG_DIR:-$HOME/snap/gh/current/.config/gh}"
  fi
fi

if ! "$GH_BIN" auth status >/dev/null 2>&1; then
  if [ -n "${GH_CONFIG_DIR:-}" ]; then
    echo "Not logged into GitHub. Run: GH_CONFIG_DIR=\"$GH_CONFIG_DIR\" $GH_BIN auth login" >&2
  else
    echo "Not logged into GitHub. Run: $GH_BIN auth login" >&2
  fi
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
"$GH_BIN" repo create "$REPO_NAME" "--$VISIBILITY" --source . --remote origin --push
