# Security

## Runtime boundary

Foundry reads its own bundled helper and runs `doctor --json` as a fixed argv.
It does not accept panel input, use a shell command string, access the network,
store mutable state, read credentials, install plugins, or write Git data.

## Generator write boundary

`bin/omarchy-foundry create` only accepts a workspace beneath the selected
allowed root. It opens the path one component at a time without following
symlinks, retains directory descriptors, builds a private mode-0700 staging
tree, creates every file with no-follow and exclusive-create flags, syncs each
file, rechecks directory identity, and publishes with an atomic no-clobber move.
Existing and concurrently planted targets are preserved.

The plugin id, display name, and description are bounded before any write. A
description file must be a same-owner regular file, may not be a symlink, and is
read under a hard byte ceiling. Generated content has no remote assets or
executable SVG content.

## Reporting

Do not include secrets or private workspace data in a report. Open a private
GitHub security advisory on the repository with the affected version, exact
reproduction boundary, and expected versus observed behavior.
