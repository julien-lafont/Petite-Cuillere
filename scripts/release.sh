#!/usr/bin/env bash
#
# Release Petite Cuillère. Full process: docs/release.md
#
#   ./scripts/release.sh status    where things stand, changes nothing
#   ./scripts/release.sh check     the guardrails alone, changes nothing
#   ./scripts/release.sh publish   guardrails, then CHANGELOG commit, tag, push
#
# The script writes nothing: that is the one part of the process requiring
# judgement, and it belongs to whoever knows what the release changes for a
# parent. The script's job is to refuse to publish a version missing from the
# CHANGELOG — which is what guarantees it is never forgotten.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

readonly BRANCH="main"
readonly CHANGELOG="CHANGELOG.md"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
ko() { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; }
die() {
  ko "$*"
  exit 1
}

# ── Version ──────────────────────────────────────────────────────────────────
# CalVer, several releases a day: 2026.08.08.1, then .2, .3…
# The rank comes from the highest existing tag of the day rather than the tag
# count, so that a deleted tag never causes a published number to be reused.

last_tag() { git tag --list 'v*' --sort=-version:refname | head -1; }

next_version() {
  local today rank
  today=$(date +%Y.%m.%d)
  rank=$(git tag --list "v$today.*" |
    sed "s/^v$today\.//" | grep -E '^[0-9]+$' |
    sort -n | tail -1 || true)
  echo "$today.$((${rank:-0} + 1))"
}

commits_since_last_tag() {
  local tag
  tag=$(last_tag)
  if [ -n "$tag" ]; then
    git log --pretty='  %h %s' "$tag"..HEAD
  else
    git log --pretty='  %h %s'
  fi
}

# `## 2026.08.08.1` as a section heading — the shape `publish` requires.
changelog_has() { grep -qE "^## +$1 *$" "$CHANGELOG"; }

# ── Guardrails ───────────────────────────────────────────────────────────────
# All blocking. A guardrail you work around on day one is worth nothing — if one
# of them ever becomes unbearable, remove it from this script rather than getting
# into the habit of stepping over it.

check() {
  local allow_changelog="${1:-no}"

  bold "Guardrails"

  local current
  current=$(git rev-parse --abbrev-ref HEAD)
  [ "$current" = "$BRANCH" ] || die "on branch '$current', not '$BRANCH' — $BRANCH is what Vercel deploys"
  ok "on $BRANCH"

  local dirty
  dirty=$(git status --porcelain)
  if [ "$allow_changelog" = "allow-changelog" ]; then
    dirty=$(printf '%s\n' "$dirty" | grep -v "$CHANGELOG" || true)
  fi
  [ -z "$(printf '%s' "$dirty" | tr -d '[:space:]')" ] ||
    die "uncommitted changes:"$'\n'"$dirty"
  ok "working tree clean"

  git fetch origin --quiet
  local behind
  behind=$(git rev-list --count "HEAD..origin/$BRANCH")
  [ "$behind" -eq 0 ] || die "$behind commit(s) behind origin/$BRANCH — pull them first"
  ok "up to date with origin/$BRANCH"

  [ -n "$(commits_since_last_tag)" ] || die "nothing new since $(last_tag) — no release to make"
  ok "commits to publish"

  printf '  … prettier\r'
  npx prettier --check . >/dev/null 2>&1 || die "prettier — run 'npm run format'"
  ok "prettier          "

  printf '  … typecheck\r'
  npx tsc --noEmit || die "typecheck"
  ok "typecheck         "

  printf '  … lint\r'
  npm run lint --silent || die "lint"
  ok "lint              "

  printf '  … build\r'
  npm run build >/tmp/petite-cuillere-build.log 2>&1 ||
    die "build — see /tmp/petite-cuillere-build.log"
  ok "build             "
}

# ── Commands ─────────────────────────────────────────────────────────────────

cmd_status() {
  local tag version
  tag=$(last_tag)
  version=$(next_version)
  bold "Release"
  printf '  latest        %s\n' "${tag:-none}"
  printf '  next          v%s\n' "$version"
  if changelog_has "$version"; then
    printf '  CHANGELOG     section "%s" present\n' "$version"
  else
    printf '  CHANGELOG     \033[33msection "%s" not written yet\033[0m\n' "$version"
  fi
  echo
  bold "To publish"
  local commits
  commits=$(commits_since_last_tag)
  echo "${commits:-  (nothing)}"
}

cmd_check() {
  check
  echo
  bold "Ready to publish v$(next_version)"
}

cmd_publish() {
  local version
  version=$(next_version)

  changelog_has "$version" ||
    die "$CHANGELOG has no '## $version' section — write it before publishing"

  check allow-changelog
  echo

  bold "Publishing v$version"
  # The CHANGELOG may already have been committed alongside the work: in that
  # case the tag goes straight onto HEAD, with no empty release commit.
  if git diff --quiet -- "$CHANGELOG" && git diff --cached --quiet -- "$CHANGELOG"; then
    ok "CHANGELOG already committed, tagging $(git rev-parse --short HEAD)"
  else
    git add "$CHANGELOG"
    git commit --quiet -m "release: $version"
    ok "CHANGELOG committed"
  fi
  git tag -a "v$version" -m "$version"
  ok "tagged v$version"
  git push --quiet origin "$BRANCH"
  git push --quiet origin "v$version"
  ok "pushed to origin/$BRANCH"

  echo
  bold "Vercel deploys from $BRANCH."
  echo "  Follow   https://vercel.com  (no CLI installed in this repo)"
  echo "  Verify   open https://petite-cuillere.fr on a phone"
}

case "${1:-status}" in
status) cmd_status ;;
check) cmd_check ;;
publish) cmd_publish ;;
*)
  echo "usage: $0 {status|check|publish}" >&2
  exit 2
  ;;
esac
