# Changelog

Notable changes to this plugin.

Entries are derived from this repository's commit history, so every line
corresponds to a real change. The format follows Keep a Changelog and the
project uses Semantic Versioning.

Regenerate after a release with:

```bash
scripts/gen-changelog.sh . "<Plugin Name>" "<version>"
```

The generator normalises em and en dashes, because a changelog is shipped prose
and gate c28 refuses them.

## [Unreleased]

## [0.2.1] - 2026-11-15

### Fixed

- The panel's "SAFE START" command no longer names a bare `omarchy-foundry`.
  `omarchy plugin add` installs a plugin under
  `~/.config/omarchy/plugins/<id>/` and puts nothing on PATH, so the old text
  answered "command not found". The panel now builds the command from the
  helper's own location, shows a path under your home as `~/...`, and
  single-quotes a path the shell would otherwise interpret. A test runs the
  shown command from an installed copy on a stock PATH, and a negative control
  shows the bare name fails with 127.
- The helper path is read from its file URL with percent-decoding. Quickshell
  0.3.2 on Qt 6.12 hands over `%23` for `#`, `%3F` for `?` and `%25` for `%`
  (a space stays a space), so a plugin directory containing one of those
  characters no longer sends the doctor call to a path that does not exist.
- The bar pill no longer reads "FOUNDRY DRAFT" with the alert tint when no draft
  exists. The helper reports `UNPROVEN` by design, so an idle Foundry now reads
  plain "FOUNDRY"; the tint is kept for a helper that gave no usable receipt,
  and the panel then says so.
- The panel's header line no longer elides mid-sentence. The doctor message is
  shortened to fit with room to spare.
- Receipt text drops bidi overrides and isolates and Unicode tag characters, and
  a length cap never splits a surrogate pair.
- Generated projects pin `actions/setup-node` v7.1.0, as this repository's own
  CI does. A test fails if the generated action pins drift from this repo's.
- Qualify Omarchy's palette as `Commons.Color`, as the shell contract requires
  now that Qt 6.12 has its own `Color` type. A presentation-contract test fails
  on any bare `Color.` in the shipped QML.

### Changed

- The README states where `omarchy plugin add` puts the helper and shows the
  full-path invocation.
- The rig render installs the plugin at `plugins/<id>`, as a real install does,
  so the preview shows the path a user would see. It also seeds the
  current-theme state a real Omarchy install has, so first-party shell plugins
  on current Omarchy do not log warnings the render would read as plugin
  warnings.
- `scripts/rig-e2e.sh` accepts `FOUNDRY_E2E_REF=HEAD` (or a full commit) to
  prove an unmerged commit fetched from GitHub; without it the default branch
  is installed, as before.
- Added a smoke test and `npm run test:smoke`, `tests/TESTING.md`, and a
  markdownlint configuration for the changelog and the GitHub templates.
- Bump `actions/setup-node` to 7.1.0 and the MiniMax review action to the
  fork's current main (`cfb2c72`), with the audit harness re-pinned.

## [0.2.0] - 2026-08-29

### Added

- Descriptor-pinned, race-safe Perl generator with atomic no-replace publish.
- Exact 500-character copy enforcement for both marketplace description fields.
- Deterministic plugin-specific SVG themes in generated projects.
- Coverage, race repetition, mutation, accessibility, contract, audit, and Buzz
  acceptance lanes.

### Changed

- Rebuilt the panel as a readable forge, inspect, and prove workflow.
- Updated the Foundry listing copy, banner contract, and pinned CI actions.

## [0.1.0] - 2026-08-27

### Added

- Initial plugin.
