const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const Model = require("../Model.js")

const root = path.join(__dirname, "..")
const helper = path.join(root, "bin", "omarchy-foundry")
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"))
const INSTALL_DIR = ".config/omarchy/plugins/" + manifest.id

// A graphical session on stock Omarchy has no development runtime and no
// plugin bin/ on PATH. This is that PATH, with node shadowed by a stub that
// exits 127 for good measure.
function stockEnv(home, shadowDir) {
  return {
    PATH: shadowDir + ":/usr/bin:/bin",
    HOME: home,
    FOUNDRY_ALLOWED_ROOT: home,
    LANG: "C"
  }
}

function sandbox(homeName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "foundry-smoke-"))
  const home = path.join(base, homeName)
  fs.mkdirSync(home, { recursive: true, mode: 0o700 })
  const shadow = path.join(base, "shadow")
  fs.mkdirSync(shadow)
  fs.writeFileSync(path.join(shadow, "node"), "#!/bin/sh\nexit 127\n", { mode: 0o700 })
  return { base, home, shadow }
}

function installHelper(home) {
  const binDir = path.join(home, INSTALL_DIR, "bin")
  fs.mkdirSync(binDir, { recursive: true })
  const installed = path.join(binDir, "omarchy-foundry")
  fs.copyFileSync(helper, installed)
  fs.chmodSync(installed, 0o755)
  return installed
}

test("every Model function called by QML exists", () => {
  const calls = new Set()
  for (const file of ["Panel.qml", "BarWidget.qml"]) {
    const qml = fs.readFileSync(path.join(root, file), "utf8")
    for (const match of qml.matchAll(/Model\.([A-Za-z][A-Za-z0-9_]*)\(/g)) calls.add(match[1])
  }
  assert.ok(calls.size >= 6, [...calls].join(","))
  for (const name of calls) assert.equal(typeof Model[name], "function", name)
})

test("the shipped helper answers doctor on a stock PATH with node shadowed", () => {
  const box = sandbox("home")
  try {
    const result = spawnSync(helper, ["doctor", "--json"], {
      env: stockEnv(box.home, box.shadow), encoding: "utf8", timeout: 5000
    })
    assert.equal(result.status, 0, result.stderr)
    const receipt = Model.parseReceipt(result.stdout)
    assert.equal(receipt.ready, true)
    assert.equal(receipt.proof, "UNPROVEN")
    // The idle receipt neither lights the pill nor reads as a draft.
    assert.equal(Model.needsAttention(receipt, true), false)
    assert.equal(Model.pillText(receipt), "FOUNDRY")
    // The hero line is elided at roughly 75 characters; the message must fit.
    assert.ok(Model.heroText(receipt, true).length <= 60, Model.heroText(receipt, true))
  } finally { fs.rmSync(box.base, { recursive: true, force: true }) }
})

// HOME known to the shell shows the helper as ~/..., HOME unknown shows its
// absolute path, quoted when the path needs it. All four must run as typed.
for (const [label, homeName, knowsHome] of [
  ["a plain home shown as ~/", "home", true],
  ["a home with a space and a quote shown as ~/", "ann's home", true],
  ["a plain home shown as an absolute path", "home", false],
  ["a home with a space and a quote shown as a quoted absolute path", "ann's home", false]
]) {
  test("the command the panel shows runs from the installed plugin on a stock PATH, " + label, () => {
    const box = sandbox(homeName)
    try {
      const installed = installHelper(box.home)
      const workspace = path.join(box.home, "Projects")
      fs.mkdirSync(workspace)
      const copy = path.join(box.home, "copy.txt")
      fs.writeFileSync(copy, manifest.description + "\n")

      // What QML hands the Model: the helper's resolved file URL, then HOME.
      const url = "file://" + encodeURI(installed).replace(/'/g, "%27")
      const helperPath = Model.fileUrlToPath(url)
      assert.equal(helperPath, installed)
      const home = knowsHome ? box.home : ""
      const shown = Model.startCommand(helperPath, home)
      const invocation = Model.helperInvocation(helperPath, home)
      assert.ok(shown.startsWith(invocation + " create "), shown)
      assert.ok(!/^omarchy-foundry /.test(shown), "must not be a bare, PATH-dependent name")
      if (knowsHome) assert.ok(invocation.startsWith("~/" + INSTALL_DIR), invocation)
      else if (homeName === "home") assert.equal(invocation, installed)
      else assert.equal(invocation.charAt(0), "'")

      // Fill the placeholders the way a user would; keep the helper words.
      const filled = invocation + shown.slice(invocation.length)
        .replace("--workspace PATH", "--workspace " + Model.shellQuote(workspace))
        .replace("--name NAME", "--name Smoke")
        .replace("--description-file COPY.txt", "--description-file " + Model.shellQuote(copy))
      const result = spawnSync("bash", ["-c", filled], {
        env: stockEnv(box.home, box.shadow), encoding: "utf8", timeout: 5000
      })
      assert.equal(result.status, 0, filled + "\n" + result.stderr)
      const out = JSON.parse(result.stdout)
      assert.equal(out.write, false)
      assert.equal(out.target, path.join(fs.realpathSync(workspace), "io.github.you.widget"))
      assert.deepEqual(fs.readdirSync(workspace), [], "a dry run writes nothing")
    } finally { fs.rmSync(box.base, { recursive: true, force: true }) }
  })
}

test("negative control: the old bare command is not found on a stock PATH", () => {
  const box = sandbox("home")
  try {
    installHelper(box.home)
    const result = spawnSync("bash", ["-c", "omarchy-foundry doctor --json"], {
      env: stockEnv(box.home, box.shadow), encoding: "utf8", timeout: 5000
    })
    assert.equal(result.status, 127)
    assert.match(result.stderr, /not found/)
  } finally { fs.rmSync(box.base, { recursive: true, force: true }) }
})

test("the panel builds the command from its own helper path, never a bare name", () => {
  const panel = fs.readFileSync(path.join(root, "Panel.qml"), "utf8")
  assert.match(panel, /Model\.startCommand\(helperPath, Quickshell\.env\("HOME"\)\)/)
  assert.match(panel, /text:\s*root\.startCommand/)
  assert.doesNotMatch(panel, /"omarchy-foundry /)
  assert.match(panel, /command:\s*\[root\.helperPath, "doctor", "--json"\]/)
})
