# Foundry

![Foundry banner](assets/banner.svg)

Foundry creates an inspectable local starter plugin tree for a small Omarchy bar
widget. It is intentionally a scaffold and proof surface, not an autonomous
shell agent, plugin store, or publisher.

## What it does

- validates a namespaced plugin id and a user-selected workspace;
- creates a fresh local repository with a manifest, QML entry point, pure data
  model, offline test, README, license, and SVG banner;
- performs a dry run before writing when requested;
- reports an explicit `UNPROVEN` proof state until a separate validation lane
  runs;
- never installs, enables, commits, pushes, sends telemetry, or files a
  marketplace issue.

## Runtime dependencies

The installed helper uses only stock Omarchy tools: `bash` and `jq`. Node is
development-only; it runs the generated offline test suite and is never needed
by the bar widget at runtime.

## Create a draft

Choose a workspace inside your home directory, or set `FOUNDRY_ALLOWED_ROOT`
to an explicit development root. Review the dry-run output first.

```bash
omarchy-foundry create \
  --workspace "$HOME/Projects" \
  --id io.github.you.hello-widget \
  --name "Hello Widget" \
  --description "A small local bar widget" \
  --dry-run
```

Remove `--dry-run` only after reviewing the target path. The generated project
is not installed. Run its tests and `omarchy plugin validate .`, then inspect
the diff before deciding whether to install it.

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
bash scripts/run-plugin-gates.sh .
bash scripts/rig-verify.sh .
bash scripts/rig-render.sh . preview.png
```

The last two commands use a configured rig. A missing rig is `UNPROVEN`, not a
pass.

## License

MIT.
