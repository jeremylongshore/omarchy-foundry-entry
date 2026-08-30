#!/usr/bin/env bash
# Prove the exact published Foundry commit can generate, validate, install, and
# load a disposable starter inside an isolated Buzz Omarchy session.
set -euo pipefail

TARGET="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${OMARCHY_RIG_HOST:-intent-ops-buzz}"
CONTAINER="${OMARCHY_RIG_CONTAINER:-omarchy-rig}"
COMMIT="$(git -C "$TARGET" rev-parse HEAD)"
RECEIPT="$TARGET/.rig-e2e-proof.json"
RUN_ID="foundry-e2e-$$"

RESULT="$(ssh -o BatchMode=yes "$HOST" "docker exec -i $CONTAINER sh -s -- '$RUN_ID'" <<'REMOTE'
set -eu
run_id="$1"
export OMARCHY_PATH=/root/omarchy PATH=/root/omarchy/bin:/usr/bin:/bin
repo=https://github.com/jeremylongshore/omarchy-foundry-entry.git
foundry_id=io.github.jeremylongshore.foundry
generated_id=io.github.e2e.generated
rig_home=/tmp/"$run_id"-home
runtime=/tmp/"$run_id"-runtime
workspace=/tmp/"$run_id"-workspace
sway_config=/tmp/"$run_id"-sway.conf
sway_log=/tmp/"$run_id"-sway.log
qs_log=/tmp/"$run_id"-qs.log
shot=/tmp/"$run_id".png
qs_pid=""; sway_pid=""

cleanup() {
  [ -z "$qs_pid" ] || kill "$qs_pid" 2>/dev/null || true
  [ -z "$sway_pid" ] || kill "$sway_pid" 2>/dev/null || true
  for path in "$rig_home" "$runtime" "$workspace"; do
    [ ! -d "$path" ] || find "$path" -depth -delete
  done
}
trap cleanup EXIT INT TERM
mkdir -p "$rig_home" "$runtime" "$workspace/projects"
chmod 700 "$rig_home" "$runtime" "$workspace" "$workspace/projects"
export HOME="$rig_home" XDG_RUNTIME_DIR="$runtime"

omarchy plugin add "$repo" --enable --yes
foundry="$HOME/.config/omarchy/plugins/$foundry_id"
test -x "$foundry/bin/omarchy-foundry"
foundry_commit=$(git -C "$foundry" rev-parse HEAD)

# Reuse the repository's audited 500-character prose only as bounded E2E input.
# The generated project remains disposable and never enters the marketplace.
jq -r '.description' "$foundry/manifest.json" > "$workspace/description.txt"
FOUNDRY_ALLOWED_ROOT="$workspace" "$foundry/bin/omarchy-foundry" create \
  --workspace "$workspace/projects" \
  --id "$generated_id" \
  --name "Generated E2E" \
  --description-file "$workspace/description.txt"
generated="$workspace/projects/$generated_id"
test -f "$generated/manifest.json"
test -f "$generated/assets/banner.svg"
jq -e '.description | length == 500' "$generated/manifest.json" >/dev/null
jq -e '.barWidget.description | length == 500' "$generated/manifest.json" >/dev/null
grep -F '<title id="title">Generated E2E</title>' "$generated/assets/banner.svg" >/dev/null

/usr/bin/node --test "$generated"/tests/*.test.js
/root/omarchy/bin/omarchy-plugin-validate "$generated"
/usr/lib/qt6/bin/qmllint "$generated/BarWidget.qml"

git -C "$generated" init -q
git -C "$generated" config user.email e2e@invalid.local
git -C "$generated" config user.name "Foundry E2E"
git -C "$generated" add .
git -C "$generated" commit -qm generated
generated_commit=$(git -C "$generated" rev-parse HEAD)
omarchy plugin add "file://$generated" --enable --yes
omarchy plugin list --json | grep -F "$generated_id" | grep -F enabled >/dev/null

mkdir -p "$HOME/.config/omarchy"
cat > "$HOME/.config/omarchy/shell.json" <<JSON
{"version":1,"bar":{"position":"top","transparent":false,"centerAnchor":"$generated_id",
"layout":{"left":[{"id":"omarchy.workspaces"}],"center":[],
"right":[{"id":"$generated_id"}]}},"plugins":[]}
JSON
cat > "$sway_config" <<SWAY
output * resolution 1280x720 scale 1.5
seat * hide_cursor 1000
SWAY
WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 WLR_RENDERER=pixman \
  sway --config "$sway_config" >"$sway_log" 2>&1 &
sway_pid=$!
wayland_socket=""; attempt=0
while [ "$attempt" -lt 30 ]; do
  wayland_socket=$(find "$runtime" -maxdepth 1 -type s -name 'wayland-*' | head -1)
  [ -z "$wayland_socket" ] || break
  attempt=$((attempt + 1)); sleep 1
done
[ -n "$wayland_socket" ] || { echo "rig-e2e: isolated Wayland failed" >&2; exit 1; }
export WAYLAND_DISPLAY="${wayland_socket##*/}"
export SWAYSOCK=$(find "$runtime" -maxdepth 1 -type s -name 'sway-ipc.*.sock' | head -1)

# A stock graphical session does not need Node. A failing shim first on PATH
# proves the generated QML loads without a development runtime.
mkdir "$workspace/nonode"
printf '#!/bin/sh\nexit 127\n' > "$workspace/nonode/node"
chmod 700 "$workspace/nonode/node"
PATH="$workspace/nonode:/root/omarchy/bin:/usr/bin:/bin" \
  qs -p /root/omarchy/shell >"$qs_log" 2>&1 &
qs_pid=$!
sleep 14
[ -d "/proc/$qs_pid" ] || { echo "rig-e2e: generated shell exited" >&2; exit 1; }
if grep -a -iE 'cannot assign|is not a type|unable to|no such|ERROR' "$qs_log" \
  | grep -aviE 'libEGL|MESA|ZINK|pipewire|pw_loop_new|pw\.loop|UPower|hyprland' >/dev/null; then
  echo "rig-e2e: generated plugin emitted a shell load error" >&2
  exit 1
fi
grim "$shot" 2>/dev/null
test "$(wc -c < "$shot")" -ge 4000

if FOUNDRY_ALLOWED_ROOT="$workspace" "$foundry/bin/omarchy-foundry" create \
  --workspace "$workspace/projects" \
  --id 'io.github.e2e.bad;dispatch' \
  --name Bad \
  --description-file "$workspace/description.txt" \
  --dry-run; then
  echo "rig-e2e: hostile id unexpectedly succeeded" >&2
  exit 1
fi

echo "E2E_RECEIPT installed_foundry=$foundry_commit generated_tree=$generated_commit node=shadowed hostile_id=refused shell=loaded descriptions=500/500 banner=unique"
REMOTE
)"

printf '%s\n' "$RESULT"
LINE="$(printf '%s\n' "$RESULT" | grep '^E2E_RECEIPT ' || true)"
[[ "$LINE" =~ ^E2E_RECEIPT\ installed_foundry=([0-9a-f]{40})\ generated_tree=([0-9a-f]{40})\ node=shadowed\ hostile_id=refused\ shell=loaded\ descriptions=500/500\ banner=unique$ ]] || {
  echo "rig-e2e: missing or malformed receipt line" >&2
  exit 1
}
INSTALLED_COMMIT="${BASH_REMATCH[1]}"
GENERATED_COMMIT="${BASH_REMATCH[2]}"
[[ "$INSTALLED_COMMIT" == "$COMMIT" ]] || {
  echo "rig-e2e: installed commit does not match local HEAD" >&2; exit 1; }

jq -n --arg commit "$COMMIT" --arg rig "$HOST/$CONTAINER" \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg installed "$INSTALLED_COMMIT" \
  --arg generated "$GENERATED_COMMIT" \
  '{commit:$commit,installedFoundryCommit:$installed,generatedTreeCommit:$generated,
    rig:$rig,foundryOrigin:"github",generatedOrigin:"isolated file-git",
    node:"shadowed",hostileId:"refused",generatedShell:"loaded",
    descriptions:"500/500",bannerIdentity:"unique",completedAt:$at}' > "$RECEIPT"
echo "rig-e2e: PASS, receipt written to $RECEIPT"
