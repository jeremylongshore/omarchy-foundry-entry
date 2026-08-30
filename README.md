# Foundry

![Foundry banner](assets/banner.svg)

Foundry turns one Omarchy bar-widget idea into a reviewable local project. The
starter arrives with exact marketplace copy, its own deterministic visual
identity, offline tests, pinned CI, security guidance, and an honest
`UNPROVEN` receipt. Foundry is a scaffold and proof boundary, not an autonomous
agent, installer, Git client, or publisher.

## What it does

- Requires a namespaced plugin id, safe display name, and exactly 500 characters
  of specific marketplace copy.
- Pins the allowed root, workspace, and private staging tree by open directory
  descriptor so a live path swap cannot redirect its writes.
- Publishes the complete draft with stock coreutils' atomic no-clobber move, so
  a concurrent creator or planted target cannot be merged or overwritten.
- Creates a manifest, accessible QML entry point, pure model, offline tests,
  contract checks, README, security notes, license, pinned CI, and a named SVG
  banner whose palette is derived from that plugin identity.
- Reports `UNPROVEN` until separate validation and real-shell evidence exist.
- Never installs, enables, commits, pushes, publishes, calls AI, sends telemetry,
  or reaches the network.

## Runtime dependencies

The installed helper uses Perl modules shipped by Arch's core Perl package and
GNU coreutils, both present on stock Omarchy. The panel uses Omarchy's QML and
Quickshell runtime. Node is development-only and never runs in the graphical
session.

## Create a draft

Write one single-line, plugin-specific description using the complete 500
character marketplace allowance. Choose a workspace inside your home directory,
or set `FOUNDRY_ALLOWED_ROOT` to an explicit development root. Review a dry run
before creating anything.

```bash
bin/omarchy-foundry create \
  --workspace "$HOME/Projects" \
  --id io.github.you.hello-widget \
  --name "Hello Widget" \
  --description-file "$HOME/hello-widget-marketplace-copy.txt" \
  --dry-run
```

The description file may contain one trailing newline, but the description
itself must be exactly 500 characters. Remove `--dry-run` only after reviewing
the target path. The generated project is not installed. Run its tests,
`omarchy plugin validate .`, and `qmllint *.qml`; then inspect every file before
creating a Git repository or installing the plugin.

## Install Foundry

```bash
omarchy plugin add https://github.com/jeremylongshore/omarchy-foundry-entry --enable
```

The panel displays a receipt and the terminal command. It does not expose an
arbitrary command field, because Omarchy plugins share the long-running shell
process and run with the current user permissions.

## Remove Foundry

```bash
omarchy plugin remove io.github.jeremylongshore.foundry
```

## Development

```bash
npm test
npm run test:race
npm run test:mutation
npm run audit
bash scripts/run-plugin-gates.sh .
bash scripts/rig-verify.sh .
bash scripts/rig-render.sh . preview.png
```

The final two commands use the Buzz production-boundary rig. Static validation
is not a render, and a missing rig is `UNPROVEN`, not a pass. `npm run test:e2e`
also creates a disposable project through the shipped generator, installs that
project locally on the rig, shadows Node, and loads it in a real Omarchy shell.

## Proof model

Foundry deliberately does not turn a generated draft green. The generated
receipt says `UNPROVEN`; validation, live-shell loading, screenshot inspection,
clean exact-SHA CI, and marketplace review belong to the generated repository's
own release lane. This prevents a template's evidence from being laundered into
evidence for a different plugin.

## Security

See [SECURITY.md](SECURITY.md) for the write boundary, rejected inputs, runtime
capabilities, and vulnerability reporting guidance.

## License

MIT.
