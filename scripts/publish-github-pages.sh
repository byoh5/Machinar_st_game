#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
VISIBILITY="${VISIBILITY:-public}" # public | private
REPO_NAME="${REPO_NAME:-$(basename "$ROOT_DIR" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-chore: setup game and github pages deploy}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[deploy] git repo not found. initializing..."
  git init -b "$DEFAULT_BRANCH"
fi

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
else
  current_branch="$(git symbolic-ref --quiet --short HEAD || printf '%s' "$DEFAULT_BRANCH")"
fi
if [ "$current_branch" != "$DEFAULT_BRANCH" ]; then
  git checkout -B "$DEFAULT_BRANCH"
fi

echo "[deploy] running build check..."
npm run build

git add -A
if ! git diff --cached --quiet; then
  echo "[deploy] creating commit..."
  git commit -m "$COMMIT_MESSAGE"
else
  echo "[deploy] no local file changes to commit."
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    echo "[deploy] creating github repo via gh cli..."
    gh repo create "$REPO_NAME" --"$VISIBILITY" --source=. --remote=origin >/dev/null
  else
    echo "[deploy] no origin remote and gh is not authenticated."
    echo "[deploy] run: gh auth login"
    echo "[deploy] then re-run: npm run deploy:pages"
    exit 1
  fi
fi

echo "[deploy] pushing $DEFAULT_BRANCH..."
git push -u origin "$DEFAULT_BRANCH"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "[deploy] triggering GitHub Pages workflow..."
  gh workflow run deploy-pages.yml >/dev/null 2>&1 || true
fi

origin_url="$(git remote get-url origin)"
slug="$(printf '%s' "$origin_url" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"
owner="${slug%%/*}"
repo="${slug##*/}"

if [[ "$repo" == *.github.io ]]; then
  page_url="https://${repo}/"
else
  page_url="https://${owner}.github.io/${repo}/"
fi

echo "[deploy] expected pages url: $page_url"
echo "[deploy] after first push, check Actions tab for deploy-pages workflow status."
