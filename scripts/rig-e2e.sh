#!/usr/bin/env bash
# Exercise the installed GitHub artifact on the Buzz Omarchy rig. This is
# separate from rig-render: it proves Foundry can create and validate a real
# starter tree, rather than only loading Foundry's own panel.
set -euo pipefail

HOST="${OMARCHY_RIG_HOST:-intent-ops-buzz}"
CONTAINER="${OMARCHY_RIG_CONTAINER:-omarchy-rig}"
REPO_URL="${1:-https://github.com/jeremylongshore/omarchy-foundry-entry.git}"
PLUGIN_ID="io.github.jeremylongshore.foundry"

ssh "$HOST" "docker exec $CONTAINER sh -lc '
  set -eu
  export XDG_RUNTIME_DIR=/tmp/xdgrt WAYLAND_DISPLAY=wayland-1 OMARCHY_PATH=/root/omarchy PATH=/root/omarchy/bin:\$PATH
  existing=/root/.config/omarchy/plugins/$PLUGIN_ID
  if [ -d "\$existing" ]; then mv "\$existing" "/tmp/foundry-prior-install-\$\$"; fi
  omarchy plugin add "$REPO_URL" --enable --yes
  plugin=/root/.config/omarchy/plugins/$PLUGIN_ID
  test -x "\$plugin/bin/omarchy-foundry"
  root=\$(mktemp -d /tmp/foundry-e2e-XXXXXX)
  trap "rm -rf \"\$root\"" EXIT
  mkdir "\$root/workspace"
  FOUNDRY_ALLOWED_ROOT="\$root" "\$plugin/bin/omarchy-foundry" create \\
    --workspace "\$root/workspace" \\
    --id io.github.e2e.generated \\
    --name "Generated E2E" \\
    --description "A disposable generated starter"
  target="\$root/workspace/io.github.e2e.generated"
  test -f "\$target/manifest.json"
  test -f "\$target/assets/banner.svg"
  npm test --prefix "\$target"
  /root/omarchy/bin/omarchy-plugin-validate "\$target"
  /usr/lib/qt6/bin/qmllint "\$target/BarWidget.qml"
  if FOUNDRY_ALLOWED_ROOT="\$root" "\$plugin/bin/omarchy-foundry" create \\
    --workspace "\$root/workspace" \\
    --id "io.github.e2e.bad;dispatch" \\
    --name "Bad" \\
    --description "Must refuse" \\
    --dry-run; then
    echo "rig-e2e: hostile id unexpectedly succeeded" >&2
    exit 1
  fi
  omarchy plugin list --json | jq -e --arg id "$PLUGIN_ID" ".[] | select(.id == \$id and .enabled == true)" >/dev/null
  echo "rig-e2e: PASS installed artifact, generated starter, validator, lint, hostile-id refusal"
'"
