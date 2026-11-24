#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FEATURE_MAP="$REPO_ROOT/docs/feature-map.md"

TARGET_FILE="${1:-${TARGET_FILE:-}}"

if [[ -z "$TARGET_FILE" && ! -t 0 ]]; then
  STDIN_DATA="$(cat)"
  TARGET_FILE="$(printf '%s' "$STDIN_DATA" | sed -nE 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | head -n 1)"
fi

if [[ -z "$TARGET_FILE" ]]; then
  echo "Usage: $0 <target-file-path>" >&2
  exit 2
fi

REL_PATH="${TARGET_FILE#"$REPO_ROOT/"}"
REL_PATH="${REL_PATH#./}"

if [[ "$REL_PATH" == tools/calc-verify/* || "$REL_PATH" == "tools/calc-verify" ]]; then
  if [[ "${ALLOW_VERIFY_EDIT:-0}" != "1" ]]; then
    echo "BLOCKED: Edits to '$REL_PATH' are protected. Set ALLOW_VERIFY_EDIT=1 to explicitly authorize verification CLI changes." >&2
    exit 1
  fi
fi

if [[ "$REL_PATH" == openspec/specs/* ]]; then
  SUBPATH="${REL_PATH#openspec/specs/}"
  SPEC_FOLDER="${SUBPATH%%/*}"

  if [[ -z "$SPEC_FOLDER" || "$SPEC_FOLDER" == "$SUBPATH" ]]; then
    echo "BLOCKED: Spec files must live inside a feature folder under openspec/specs/<feature>/spec.md matching docs/feature-map.md." >&2
    exit 1
  fi

  if [[ ! -f "$FEATURE_MAP" ]]; then
    echo "BLOCKED: Cannot validate spec folder '$SPEC_FOLDER' because docs/feature-map.md is missing." >&2
    exit 1
  fi

  if ! grep -Eq "^## \`${SPEC_FOLDER}\`" "$FEATURE_MAP"; then
    echo "BLOCKED: Spec folder 'openspec/specs/${SPEC_FOLDER}/' does not match any top-level section in docs/feature-map.md." >&2
    echo "Update docs/feature-map.md first or edit an existing 1:1 spec folder." >&2
    exit 1
  fi
fi

exit 0
