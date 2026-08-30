#!/usr/bin/env bash
# Acceptance lane: static Buzz validation, live Foundry render, then generation
# and live load of a disposable project through the shipped generator.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/rig-verify.sh" "$ROOT"
"$ROOT/scripts/rig-render.sh" "$ROOT" "$ROOT/preview.png"
"$ROOT/scripts/rig-e2e.sh"

jq -e '.sourceDirty == false and .sourcePackageSha256 == .remotePackageSha256
  and .omarchyPluginValidate == 0 and .qmllintErrors == 0' \
  "$ROOT/.rig-proof.json" >/dev/null
jq -e '.sourceDirty == false and .sourcePackageSha256 == .remotePackageSha256
  and (.previewSha256 | length == 64) and .dimensions == "1280 x 720"
  and .nonblackCoverage >= 0.35 and (.runId | length > 0)
  and (.rawShellLogSha256 | length == 64)
  and .outputScale == 1.5 and .visualInspection.status == "pending"
  and .primaryAction == "Foundry doctor receipt rendered and panel opened through live IPC"' \
  "$ROOT/.render-proof.json" >/dev/null
jq -e '.installedFoundryCommit == .commit and .generatedShell == "loaded"
  and .node == "shadowed" and .hostileId == "refused"
  and .descriptions == "500/500" and .bannerIdentity == "unique"' \
  "$ROOT/.rig-e2e-proof.json" >/dev/null
