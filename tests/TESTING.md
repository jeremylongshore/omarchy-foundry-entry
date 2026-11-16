# Foundry testing and verification record

This file says what each lane proves, what it does not, and which Omarchy the
rig lanes ran against. Counts are taken from the run, not copied from an older
document. Run the commands to refresh them.

## Lanes

| Lane | Command | What it proves |
| --- | --- | --- |
| Unit | `npm test` | 40 tests across 5 files under c8, with thresholds of 95 lines, 95 functions, 90 branches and 95 statements on `Model.js`. Last run: 100% statements, 98.18% branches, 100% functions, 100% lines. |
| Smoke | `npm run test:smoke` | 8 tests. Every `Model` function the QML calls exists. The helper answers `doctor` on a stock PATH with node shadowed. The command the panel shows runs from an installed copy of the plugin on a stock PATH, for a plain home and for a home containing a space and a quote, as `~/...` and as an absolute path. A negative control shows the old bare `omarchy-foundry` exits 127. |
| Race | `npm run test:race` | The generator's race and swap tests, three repetitions at concurrency 4. |
| Mutation | `npm run test:mutation` | Stryker over `Model.js`, break threshold 90. Last run: 97.62% (164 killed, 4 survived). The survivors are equivalent: the `typeof module` export guard, an empty-string default and an unreachable catch block. Stryker's command runner executes `tests/model.test.js` only, so the generator is covered by the race and unit lanes, not by mutation. |
| Audit | `npm run audit` | Harness hash verification, `audit --deep` and `scan` (gitleaks, osv-scanner, markdownlint, lychee). |
| Gates | `bash scripts/run-plugin-gates.sh .` | The vendored contributing-clanker lane (c28 to c44). `scripts/check-lane-freshness.sh` compares it with canonical. |
| Rig verify | `bash scripts/rig-verify.sh .` | The real `omarchy-plugin-validate` and `qmllint` accept the runtime tree. Writes `.rig-proof.json`. |
| Rig render | `bash scripts/rig-render.sh . preview.png` | The real panel opens in an isolated Omarchy shell and is captured. Writes `.render-proof.json`. |
| Rig e2e | `FOUNDRY_E2E_REF=HEAD bash scripts/rig-e2e.sh` | The pushed commit installs through `omarchy plugin add`, the panel's shown command runs from the installed directory on a stock PATH, the generator creates a project that validates and loads in a real shell with node shadowed, and a hostile id is refused. Writes `.rig-e2e-proof.json`. |

## Rig record

The rig lanes ran in the `omarchy-rig` container on `intent-ops-buzz`:

- Omarchy `74de10479d3bf7aa7865408e33219064cfe45432`
- qt6-base 6.12.0-5 (qmllint 6.12.0)
- Quickshell 0.3.2
- sway 1.12, headless, as the compositor for renders
- hyprland package 0.57.2-1, installed but not running
- coreutils 9.12, perl 5.44.0, git 2.56.1

Each receipt binds a fingerprint of the runtime files (manifest, QML, JS and
executables). `.rig-proof.json` and `.render-proof.json` carry it; gates c37 and
c43 refuse a receipt that does not match the tree.

## What is not proven

- **Hyprland.** The rig has no running Hyprland, so renders use headless sway.
  Foundry calls no `hyprctl` or Hyprland API, so there is no Hyprland behaviour
  to prove, but a real Hyprland session has not been exercised.
- **QML behaviour.** `Panel.qml` and `BarWidget.qml` have no QML unit tests. They
  are proven by `qmllint`, the real-shell render and string-level contract
  tests, which assert structure rather than behaviour.
- **CRAP score.** The harness's crap-score scores zero functions for a
  root-level `Model.js` and still reports PASS
  (jeremylongshore/intent-audit-harness#248), so it is not an enforced lane here.
  Branch coverage and mutation testing are the measures that do apply.
- **A physical Omarchy install.** Nothing here ran on a user's machine.

## Observed on the rig, outside the lanes

- `Qt.resolvedUrl("bin/x").toString()` in Quickshell 0.3.2 on Qt 6.12 returned
  `file:///tmp/.../a%23b%3Fc%25d e/bin/x` for a directory named `a#b?c%d e`: a
  space stays literal while `#`, `?` and `%` are percent-encoded.
  `Model.fileUrlToPath` decodes that, and the unit tests cover both forms.
- `Quickshell.env("HOME")` returns the shell's HOME, and `null` for an unset
  variable. `Model.helperInvocation` treats `null` as no home.
- On the rig's coreutils 9.12 and node 26.13.1, the generator's three
  `mv --no-clobber` race tests (planted target, live workspace swap, concurrent
  creators) and the options test passed 4 of 4, and the smoke and model tests
  passed 21 of 21. A pre-merge audit had checked the no-clobber move on coreutils
  9.4 only. The rig has no npm, so the one generator test that runs `npm test`
  in a generated project was not run there.
