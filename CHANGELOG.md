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
