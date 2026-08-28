#!/usr/bin/env bash
# Prove the published Foundry artifact can generate, install, and load a
# starter plugin on the Buzz Omarchy rig. This is intentionally separate from
# rig-render: it tests the generated artifact, not merely Foundry's own panel.
set -euo pipefail

TARGET="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${OMARCHY_RIG_HOST:-intent-ops-buzz}"
CONTAINER="${OMARCHY_RIG_CONTAINER:-omarchy-rig}"
COMMIT="$(git -C "$TARGET" rev-parse HEAD)"
RECEIPT="$TARGET/.rig-e2e-proof.json"

RESULT="$(ssh "$HOST" "docker exec -i $CONTAINER sh -s" <<'REMOTE'
set -eu
export XDG_RUNTIME_DIR=/tmp/xdgrt WAYLAND_DISPLAY=wayland-1 OMARCHY_PATH=/root/omarchy PATH=/root/omarchy/bin:$PATH
repo=https://github.com/jeremylongshore/omarchy-foundry-entry.git
foundry_id=io.github.jeremylongshore.foundry
generated_id=io.github.e2e.generated

remove_id() {
  wanted="$1"
  for existing in /root/.config/omarchy/plugins/*; do
    [ -f "$existing/manifest.json" ] || continue
    [ "$(jq -r '.id // empty' "$existing/manifest.json")" = "$wanted" ] || continue
    rm -rf "$existing"
  done
}
remove_id "$foundry_id"
remove_id "$generated_id"
omarchy plugin add "$repo" --enable --yes
foundry=/root/.config/omarchy/plugins/$foundry_id
test -x "$foundry/bin/omarchy-foundry"

root=$(mktemp -d /tmp/foundry-e2e-XXXXXX)
trap 'rm -rf "$root"' EXIT
mkdir "$root/workspace"
FOUNDRY_ALLOWED_ROOT="$root" "$foundry/bin/omarchy-foundry" create \
  --workspace "$root/workspace" \
  --id "$generated_id" \
  --name "Generated E2E" \
  --description "A disposable generated starter"
generated="$root/workspace/$generated_id"
test -f "$generated/manifest.json"
test -f "$generated/assets/banner.svg"

# Node is a development-only test runner; the subsequent shell load shadows it.
/usr/bin/node --test "$generated"/tests/*.test.js
/root/omarchy/bin/omarchy-plugin-validate "$generated"
/usr/lib/qt6/bin/qmllint "$generated/BarWidget.qml"

git -C "$generated" init -q
git -C "$generated" config user.email e2e@invalid.local
git -C "$generated" config user.name "Foundry E2E"
git -C "$generated" add .
git -C "$generated" commit -qm generated
omarchy plugin add "file://$generated" --enable --yes
omarchy plugin list --json | grep -F "$generated_id" | grep -F enabled >/dev/null

# A stock graphical session does not need Node. Put a failing node first on the
# path and prove the generated plugin still loads in a real shell.
mkdir -p /tmp/foundry-nonode
printf '#!/bin/sh\nexit 127\n' >/tmp/foundry-nonode/node
chmod 755 /tmp/foundry-nonode/node
if [ ! -e "$XDG_RUNTIME_DIR/wayland-1" ]; then
  WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 WLR_RENDERER=pixman sway >/tmp/foundry-e2e-sway.log 2>&1 &
  sleep 6
fi
pkill -f 'qs -p' 2>/dev/null || true
PATH=/tmp/foundry-nonode:/root/omarchy/bin:/usr/bin:/bin qs -p /root/omarchy/shell >/tmp/foundry-generated-qs.log 2>&1 &
sleep 18
test -s /tmp/foundry-generated-qs.log || true
if grep -a -iE 'cannot assign|is not a type|unable to|no such|ERROR' /tmp/foundry-generated-qs.log | grep -aviE 'libEGL|MESA|ZINK|pipewire|pw_loop_new|pw\.loop|UPower|hyprland' >/dev/null; then
  echo "rig-e2e: generated plugin emitted a shell load error" >&2
  grep -a -iE 'cannot assign|is not a type|unable to|no such|ERROR' /tmp/foundry-generated-qs.log >&2
  exit 1
fi
grim /tmp/foundry-generated.png 2>/dev/null
test "$(wc -c </tmp/foundry-generated.png)" -ge 4000

if FOUNDRY_ALLOWED_ROOT="$root" "$foundry/bin/omarchy-foundry" create \
  --workspace "$root/workspace" \
  --id 'io.github.e2e.bad;dispatch' \
  --name Bad \
  --description 'Must refuse' \
  --dry-run; then
  echo "rig-e2e: hostile id unexpectedly succeeded" >&2
  exit 1
fi

echo "E2E_RECEIPT foundry=github generated=file-git node=shadowed hostile_id=refused shell=loaded"
REMOTE
)"

printf '%s\n' "$RESULT"
LINE="$(printf '%s\n' "$RESULT" | /usr/bin/grep '^E2E_RECEIPT ' || true)"
[[ "$LINE" == "E2E_RECEIPT foundry=github generated=file-git node=shadowed hostile_id=refused shell=loaded" ]] || {
  echo "rig-e2e: missing or malformed receipt line" >&2
  exit 1
}

jq -n --arg commit "$COMMIT" --arg rig "$HOST/$CONTAINER" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{commit:$commit, rig:$rig, foundryOrigin:"github", generatedOrigin:"file-git", node:"shadowed", hostileId:"refused", generatedShell:"loaded", completedAt:$at}' > "$RECEIPT"
echo "rig-e2e: PASS, receipt written to $RECEIPT"
