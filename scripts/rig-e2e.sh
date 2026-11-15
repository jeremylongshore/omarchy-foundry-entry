#!/usr/bin/env bash
# Prove the exact published Foundry commit can generate, validate, install, and
# load a disposable starter inside an isolated Buzz Omarchy session, and that the
# command the panel shows runs from the installed plugin directory on a stock PATH.
#
# By default the rig installs the default branch of the GitHub repository, as a
# user does. `omarchy plugin add` has no ref option, so to prove a commit that is
# pushed but not yet merged, set FOUNDRY_E2E_REF=HEAD: the rig then fetches that
# exact commit from GitHub into a throwaway clone and installs the clone. Either
# way the installed commit must equal this tree's HEAD, or the run fails.
set -euo pipefail

TARGET="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${OMARCHY_RIG_HOST:-intent-ops-buzz}"
CONTAINER="${OMARCHY_RIG_CONTAINER:-omarchy-rig}"
COMMIT="$(git -C "$TARGET" rev-parse HEAD)"
RECEIPT="$TARGET/.rig-e2e-proof.json"
RUN_ID="foundry-e2e-$$"

# The rig proves a pushed commit, not a working tree: refuse runtime edits that
# would make the receipt describe code nobody ran.
if [[ -n "$(git -C "$TARGET" status --porcelain --untracked-files=all -- '*.qml' '*.js' manifest.json bin 2>/dev/null)" ]]; then
  echo "rig-e2e: runtime files differ from HEAD; commit and push them first" >&2
  exit 2
fi

PIN=""
ORIGIN="github"
case "${FOUNDRY_E2E_REF:-}" in
  "") ;;
  HEAD | "$COMMIT") PIN="$COMMIT"; ORIGIN="github commit via isolated file-git" ;;
  *) echo "rig-e2e: FOUNDRY_E2E_REF must be HEAD or the full HEAD commit" >&2; exit 2 ;;
esac

RESULT="$(ssh -o BatchMode=yes "$HOST" "docker exec -i $CONTAINER sh -s -- '$RUN_ID' '$PIN'" <<'REMOTE'
set -eu
run_id="$1"
pin="${2:-}"
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

foundry="$HOME/.config/omarchy/plugins/$foundry_id"
install_url="$repo"
if [ -n "$pin" ]; then
  # Fetch exactly the pushed commit from GitHub; install the clone by file URL.
  src="$workspace/foundry-src"
  git init -q "$src"
  git -C "$src" fetch -q "$repo" "$pin"
  git -C "$src" checkout -q --detach FETCH_HEAD
  install_url="file://$src"
fi
if ! omarchy plugin add "$install_url" --yes; then
  # Current Omarchy add clones and validates before its unconditional live-shell
  # rescan. In this isolated pre-shell phase, that final rescan is expected to
  # fail; accept only the already-validated target at the exact declared id.
  test -f "$foundry/manifest.json"
  test "$(jq -r '.id' "$foundry/manifest.json")" = "$foundry_id"
fi
test -x "$foundry/bin/omarchy-foundry"
foundry_commit=$(git -C "$foundry" rev-parse HEAD)

# Reuse the repository's audited 500-character prose only as bounded E2E input.
# The generated project remains disposable and never enters the marketplace.
jq -r '.description' "$foundry/manifest.json" > "$workspace/description.txt"
# The panel shows a command built from the helper's own path, because a plugin's
# bin/ is not on PATH. Build that exact text with the installed Model.js, fill its
# placeholders, and run it with a stock PATH and nothing else. The bare name must
# not resolve there, or this proves nothing.
if env -i PATH=/usr/bin:/bin bash -c 'command -v omarchy-foundry' >/dev/null 2>&1; then
  echo "rig-e2e: a bare omarchy-foundry resolves on a stock PATH" >&2
  exit 1
fi
shown_command=$(/usr/bin/node -e '
  const M = require(process.argv[1])
  const [, , helper, home, ws, copy] = process.argv
  const inv = M.helperInvocation(helper, home)
  const shown = M.startCommand(helper, home)
  process.stdout.write(inv + shown.slice(inv.length)
    .replace("--workspace PATH", "--workspace " + M.shellQuote(ws))
    .replace("--name NAME", "--name Rig")
    .replace("--description-file COPY.txt", "--description-file " + M.shellQuote(copy)))
' "$foundry/Model.js" "$foundry/bin/omarchy-foundry" "$HOME" "$workspace/projects" "$workspace/description.txt")
case "$shown_command" in
  "~/.config/omarchy/plugins/$foundry_id/bin/omarchy-foundry create "*) ;;
  *) echo "rig-e2e: panel command is not the installed helper path: $shown_command" >&2; exit 1 ;;
esac
panel_out=$(env -i PATH=/usr/bin:/bin HOME="$HOME" FOUNDRY_ALLOWED_ROOT="$workspace" bash -c "$shown_command")
printf '%s' "$panel_out" | jq -e '.write == false and (.target | endswith("/io.github.you.widget"))' >/dev/null
test -z "$(ls -A "$workspace/projects")"

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
generated_install="$HOME/.config/omarchy/plugins/$generated_id"
if ! omarchy plugin add "file://$generated" --yes; then
  test -f "$generated_install/manifest.json"
  test "$(jq -r '.id' "$generated_install/manifest.json")" = "$generated_id"
fi
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

echo "E2E_RECEIPT installed_foundry=$foundry_commit generated_tree=$generated_commit panel_command=runs node=shadowed hostile_id=refused shell=loaded descriptions=500/500 banner=unique"
REMOTE
)"

printf '%s\n' "$RESULT"
LINE="$(printf '%s\n' "$RESULT" | grep '^E2E_RECEIPT ' || true)"
[[ "$LINE" =~ ^E2E_RECEIPT\ installed_foundry=([0-9a-f]{40})\ generated_tree=([0-9a-f]{40})\ panel_command=runs\ node=shadowed\ hostile_id=refused\ shell=loaded\ descriptions=500/500\ banner=unique$ ]] || {
  echo "rig-e2e: missing or malformed receipt line" >&2
  exit 1
}
INSTALLED_COMMIT="${BASH_REMATCH[1]}"
GENERATED_COMMIT="${BASH_REMATCH[2]}"
[[ "$INSTALLED_COMMIT" == "$COMMIT" ]] || {
  echo "rig-e2e: installed commit does not match local HEAD" >&2; exit 1; }

jq -n --arg commit "$COMMIT" --arg rig "$HOST/$CONTAINER" \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg installed "$INSTALLED_COMMIT" \
  --arg generated "$GENERATED_COMMIT" --arg origin "$ORIGIN" \
  '{commit:$commit,installedFoundryCommit:$installed,generatedTreeCommit:$generated,
    rig:$rig,foundryOrigin:$origin,generatedOrigin:"isolated file-git",
    panelCommand:"runs from the installed path on a stock PATH",
    node:"shadowed",hostileId:"refused",generatedShell:"loaded",
    descriptions:"500/500",bannerIdentity:"unique",completedAt:$at}' > "$RECEIPT"
echo "rig-e2e: PASS, receipt written to $RECEIPT"
