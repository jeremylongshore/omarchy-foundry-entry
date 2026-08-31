# Marketplace contract

Foundry ships one bar widget whose listing copy and generator behavior tell the
same product story.

- Root and bar-widget descriptions are identical and exactly 500 characters.
- Copy names required inputs, generated artifacts, descriptor-pinned staging,
  new-target/no-overwrite publication, UNPROVEN status, and the separate
  validation and real-shell evidence boundary.
- `assets/banner.svg` identifies Foundry and depicts its draft pipeline.
- `preview.png` is accepted only with current-tree Buzz provenance, exact
  1280x720 dimensions, a clean shell-log hash, and visual approval.
- Foundry does not install, enable, commit, push, publish, call a network
  service, or use AI.

`tests/presentation-contract.test.js`, the presentation schema, and gate C43
enforce the machine-checkable portions.
