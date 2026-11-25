#!/usr/bin/env bash
# Agent-agnostic pre-tool guard.
#
# Usage:
#   .agents/hooks/pre-tool-guard.sh <target-file-path>
#   echo '{"tool_input":{"file_path":"..."}}' | .agents/hooks/pre-tool-guard.sh
#
# Exit codes follow the most common agent-hook convention:
#   0 = allow, 2 = block (reason on stderr, which hosts feed back to the agent), 1 = usage error.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FEATURE_MAP="$REPO_ROOT/docs/feature-map.md"

block() {
  echo "BLOCKED: $*" >&2
  exit 2
}

# Collapses '.', '..' and duplicate slashes so 'src/../tools/calc-verify/x' cannot slip past the prefix checks.
normalize_path() {
  local input="$1" part
  local -a parts=() out=()
  IFS='/' read -r -a parts <<<"$input"
  for part in "${parts[@]}"; do
    case "$part" in
      '' | '.') ;;
      '..') ((${#out[@]})) && unset 'out[${#out[@]}-1]' ;;
      *) out+=("$part") ;;
    esac
  done
  local IFS='/'
  printf '%s' "${out[*]}"
}

TARGET_FILE="${1:-${TARGET_FILE:-}}"
READ_FROM_STDIN=0

if [[ -z "$TARGET_FILE" && ! -t 0 ]]; then
  READ_FROM_STDIN=1
  STDIN_DATA="$(cat)"
  TARGET_FILE="$(printf '%s' "$STDIN_DATA" | sed -nE 's/.*"(file_path|path)"[[:space:]]*:[[:space:]]*"([^"]+)".*/\2/p' | head -n 1)"
fi

if [[ -z "$TARGET_FILE" ]]; then
  # A hook payload without a file path (e.g. a shell or search tool) is not ours to judge.
  [[ "$READ_FROM_STDIN" == "1" ]] && exit 0
  echo "Usage: $0 <target-file-path>" >&2
  exit 1
fi

[[ "$TARGET_FILE" == /* ]] && ABS_PATH="$TARGET_FILE" || ABS_PATH="$PWD/$TARGET_FILE"
ABS_PATH="/$(normalize_path "$ABS_PATH")"
REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"

if [[ "$REL_PATH" == tools/calc-verify/* || "$REL_PATH" == "tools/calc-verify" ]]; then
  if [[ "${ALLOW_VERIFY_EDIT:-0}" != "1" ]]; then
    block "Edits to '$REL_PATH' are protected. Do not change the verification harness to make checks pass; ask a human to re-run with ALLOW_VERIFY_EDIT=1 if the change is intended."
  fi
fi

if [[ "$REL_PATH" == openspec/specs/* ]]; then
  SUBPATH="${REL_PATH#openspec/specs/}"
  SPEC_FOLDER="${SUBPATH%%/*}"

  if [[ -z "$SPEC_FOLDER" || "$SPEC_FOLDER" == "$SUBPATH" ]]; then
    block "Spec files must live inside a feature folder under openspec/specs/<feature>/spec.md matching docs/feature-map.md."
  fi

  if [[ ! -f "$FEATURE_MAP" ]]; then
    block "Cannot validate spec folder '$SPEC_FOLDER' because docs/feature-map.md is missing."
  fi

  if ! grep -Eq "^## \`${SPEC_FOLDER}\`" "$FEATURE_MAP"; then
    block "Spec folder 'openspec/specs/${SPEC_FOLDER}/' does not match any top-level section in docs/feature-map.md. Update docs/feature-map.md first (human-approved) or edit an existing 1:1 spec folder."
  fi
fi

exit 0
