#!/usr/bin/env bash
# Exercise the installed GitHub artifact on the Buzz Omarchy rig. This is
# separate from rig-render: it proves Foundry can create and validate a real
# starter tree, rather than only loading Foundry's own panel.
set -euo pipefail

HOST="${OMARCHY_RIG_HOST:-intent-ops-buzz}"
CONTAINER="${OMARCHY_RIG_CONTAINER:-omarchy-rig}"

# The remote script is a literal heredoc. Avoid embedding user text into a
# remote shell command, even in a test harness.
ssh "$HOST" "docker exec -i $CONTAINER sh -s" <<'REMOTE'
set -eu
export XDG_RUNTIME_DIR=/tmp/xdgrt WAYLAND_DISPLAY=wayland-1 OMARCHY_PATH=/root/omarchy PATH=/root/omarchy/bin:$PATH
repo=https://github.com/jeremylongshore/omarchy-foundry-entry.git
plugin_id=io.github.jeremylongshore.foundry
for existing in /root/.config/omarchy/plugins/*; do
  [ -f "$existing/manifest.json" ] || continue
  found_id=$(jq -r '.id // empty' "$existing/manifest.json")
  [ "$found_id" = "$plugin_id" ] || continue
  mv "$existing" "/tmp/foundry-prior-install-$$-$(basename "$existing")"
done
omarchy plugin add "$repo" --enable --yes
plugin=/root/.config/omarchy/plugins/$plugin_id
test -x "$plugin/bin/omarchy-foundry"
root=$(mktemp -d /tmp/foundry-e2e-XXXXXX)
trap 'rm -rf "$root"' EXIT
mkdir "$root/workspace"
FOUNDRY_ALLOWED_ROOT="$root" "$plugin/bin/omarchy-foundry" create \
  --workspace "$root/workspace" \
  --id io.github.e2e.generated \
  --name "Generated E2E" \
  --description "A disposable generated starter"
target="$root/workspace/io.github.e2e.generated"
test -f "$target/manifest.json"
test -f "$target/assets/banner.svg"
# Node is a development-only runner. The stock graphical session PATH has no
# npm, which is a runtime property we want generated plugins to survive.
/usr/bin/node --test "$target"/tests/*.test.js
/root/omarchy/bin/omarchy-plugin-validate "$target"
/usr/lib/qt6/bin/qmllint "$target/BarWidget.qml"
if FOUNDRY_ALLOWED_ROOT="$root" "$plugin/bin/omarchy-foundry" create \
  --workspace "$root/workspace" \
  --id "io.github.e2e.bad;dispatch" \
  --name "Bad" \
  --description "Must refuse" \
  --dry-run; then
  echo "rig-e2e: hostile id unexpectedly succeeded" >&2
  exit 1
fi
omarchy plugin list --json | grep -F io.github.jeremylongshore.foundry | grep -F enabled >/dev/null
echo "rig-e2e: PASS installed artifact, generated starter, validator, lint, hostile-id refusal"
REMOTE
