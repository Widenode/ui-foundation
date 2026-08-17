#!/usr/bin/env bash
# Text-level backstop for the Tier 2 rule.
# AST linters miss Tailwind classes inside Vue template strings; this doesn't.
#
#   bash check-tokens.sh [dir]     default: src
set -uo pipefail

SRC="${1:-src}"
# Files permitted to define or override Tier 1, by convention.
EXCLUDE='(tokens\.css|brand\.css|adapters/[^/]*\.css)'
FAIL=0

check() {
  local pattern="$1" label="$2"
  local hits
  hits=$(grep -rnE "$pattern" "$SRC" \
          --include='*.vue' --include='*.css' --include='*.ts' \
          --include='*.tsx' --include='*.jsx' \
        | grep -vE "$EXCLUDE" || true)
  if [ -n "$hits" ]; then
    echo "✗ $label"
    echo "$hits" | sed 's/^/    /'
    echo
    FAIL=1
  fi
}

check '\[[0-9]+(px|rem|em|%)\]'      'Arbitrary Tailwind size — use a token'
check '\[#[0-9a-fA-F]{3,8}\]'        'Arbitrary Tailwind colour — use a token'
check '#[0-9a-fA-F]{3,8}\b'          'Raw hex colour — use a Tier 2 token'
check 'var\(\s*--[na]-[0-9]'         'Tier 1 primitive — use a Tier 2 token'
check 'var\(\s*--ui-'                'Nuxt UI token used directly — go through the adapter'
check 'shadow-(sm|md|lg|xl|2xl)\b'   'Tailwind shadow — only --shadow-popover / --shadow-overlay'
check '\bgap-\[|\bp-\[|\bm-\[|\bw-\[|\bh-\[' 'Arbitrary Tailwind spacing/size'

if [ "$FAIL" -eq 0 ]; then echo "✓ Token discipline clean"; fi
exit "$FAIL"
