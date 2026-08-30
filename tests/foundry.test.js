const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawn, spawnSync } = require("node:child_process")

const cli = path.join(__dirname, "..", "bin", "omarchy-foundry")
const DESCRIPTION = (
  "Build a focused Omarchy bar widget that turns one local workflow into a visible, keyboard-ready control surface. " +
  "The generated draft includes exact marketplace copy, a deterministic plugin-specific SVG identity, offline model and presentation tests, pinned CI, security notes, install and removal guidance, and a stock-runtime boundary. It never installs, commits, pushes, publishes, calls a model, or reaches the network. Review every generated file, replace the placeholder author, run the validator, and capture real-shell proof. "
).slice(0, 500)
assert.equal(DESCRIPTION.length, 500)

function createArgs(id = "io.github.demo.hello", name = "Hello") {
  return ["create", "--workspace", null, "--id", id, "--name", name, "--description", DESCRIPTION]
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "foundry-test-"))
  const workspace = path.join(root, "projects")
  fs.mkdirSync(workspace)
  return { root, workspace, env: { ...process.env, FOUNDRY_ALLOWED_ROOT: root } }
}

function run(fix, ...args) {
  return spawnSync(cli, args, { env: fix.env, encoding: "utf8" })
}

test("doctor returns a conservative unproven receipt", () => {
  const fix = fixture()
  try {
    const result = run(fix, "doctor", "--json")
    assert.equal(result.status, 0)
    assert.equal(JSON.parse(result.stdout).proof, "UNPROVEN")
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("dry run validates identity and never writes a project", () => {
  const fix = fixture()
  try {
    const args = createArgs()
    args[2] = fix.workspace
    const result = run(fix, ...args, "--dry-run")
    assert.equal(result.status, 0)
    assert.equal(JSON.parse(result.stdout).write, false)
    assert.equal(fs.existsSync(path.join(fix.workspace, "io.github.demo.hello")), false)
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("create writes only a fresh project with deterministic starter files", () => {
  const fix = fixture()
  try {
    const args = createArgs()
    args[2] = fix.workspace
    const result = run(fix, ...args)
    assert.equal(result.status, 0)
    const target = path.join(fix.workspace, "io.github.demo.hello")
    assert.equal(JSON.parse(result.stdout).target, target)
    const manifest = JSON.parse(fs.readFileSync(path.join(target, "manifest.json")))
    assert.equal(manifest.id, "io.github.demo.hello")
    assert.equal(manifest.description.length, 500)
    assert.equal(manifest.barWidget.description.length, 500)
    assert.match(fs.readFileSync(path.join(target, "BarWidget.qml"), "utf8"), /io\.github\.demo\.hello/)
    assert.match(fs.readFileSync(path.join(target, "README.md"), "utf8"), /omarchy plugin remove io\.github\.demo\.hello/)
    assert.equal(fs.existsSync(path.join(target, "assets", "banner.svg")), true)
    assert.match(fs.readFileSync(path.join(target, "assets", "banner.svg"), "utf8"), /<title id="title">Hello<\/title>/)
    assert.equal(fs.existsSync(path.join(target, ".github", "workflows", "test.yml")), true)
    assert.deepEqual(fs.readdirSync(target, { recursive: true }).filter(entry =>
      fs.lstatSync(path.join(target, entry)).isSymbolicLink()), [])
    const generatedTests = spawnSync("npm", ["test"], { cwd: target, encoding: "utf8" })
    assert.equal(generatedTests.status, 0, generatedTests.stderr)
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("create refuses unsafe ids, existing targets, and workspace symlink escapes", () => {
  const fix = fixture()
  try {
    const badId = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.bad;rm", "--name", "Hello", "--description", DESCRIPTION, "--dry-run")
    assert.equal(badId.status, 2)
    const badName = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.name", "--name", "Hello\nInjected", "--description", DESCRIPTION, "--dry-run")
    assert.equal(badName.status, 2)
    const badDescription = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.description", "--name", "Hello", "--description", "<b>not markup</b>", "--dry-run")
    assert.equal(badDescription.status, 2)
    const outside = run(fix, "create", "--workspace", os.tmpdir(), "--id", "io.github.demo.hello", "--name", "Hello", "--description", DESCRIPTION, "--dry-run")
    assert.equal(outside.status, 2)
    const first = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.existing", "--name", "Hello", "--description", DESCRIPTION)
    assert.equal(first.status, 0)
    const existing = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.existing", "--name", "Hello", "--description", DESCRIPTION)
    assert.equal(existing.status, 2)
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "foundry-outside-"))
    fs.symlinkSync(outsideRoot, path.join(fix.root, "escape"))
    const escaped = run(fix, "create", "--workspace", path.join(fix.root, "escape"), "--id", "io.github.demo.escape", "--name", "Hello", "--description", DESCRIPTION, "--dry-run")
    assert.equal(escaped.status, 2)
    fs.rmSync(outsideRoot, { recursive: true, force: true })
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("description files are bounded, regular, no-follow inputs", () => {
  const fix = fixture()
  try {
    const descriptionFile = path.join(fix.root, "description.txt")
    fs.writeFileSync(descriptionFile, DESCRIPTION + "\n")
    const result = run(fix, "create", "--workspace", fix.workspace,
      "--id", "io.github.demo.file", "--name", "File Input",
      "--description-file", descriptionFile, "--dry-run")
    assert.equal(result.status, 0, result.stderr)

    const link = path.join(fix.root, "description-link.txt")
    fs.symlinkSync(descriptionFile, link)
    const linked = run(fix, "create", "--workspace", fix.workspace,
      "--id", "io.github.demo.link", "--name", "Link Input",
      "--description-file", link, "--dry-run")
    assert.equal(linked.status, 2)

    fs.writeFileSync(descriptionFile, "x".repeat(503))
    const oversized = run(fix, "create", "--workspace", fix.workspace,
      "--id", "io.github.demo.large", "--name", "Large Input",
      "--description-file", descriptionFile, "--dry-run")
    assert.equal(oversized.status, 2)
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("marketplace copy must be exactly 500 single-line characters", () => {
  const fix = fixture()
  try {
    for (const [suffix, value] of [["short", "x".repeat(499)], ["long", "x".repeat(501)], ["line", "x".repeat(250) + "\n" + "x".repeat(249)]]) {
      const result = run(fix, "create", "--workspace", fix.workspace,
        "--id", `io.github.demo.${suffix}`, "--name", "Copy Guard", "--description", value, "--dry-run")
      assert.equal(result.status, 2)
      assert.match(result.stderr, /exactly 500 single-line characters/)
    }
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("atomic no-replace publication refuses a target planted during generation", async () => {
  const fix = fixture()
  try {
    const target = path.join(fix.workspace, "io.github.demo.race")
    const child = spawn(cli, [
      "create", "--workspace", fix.workspace, "--id", "io.github.demo.race",
      "--name", "Race", "--description", DESCRIPTION
    ], { env: { ...fix.env, FOUNDRY_TEST_BEFORE_PUBLISH_MS: "700" }, encoding: "utf8" })
    const childClosed = new Promise(resolve => child.once("close", resolve))
    for (let i = 0; i < 100 && !fs.readdirSync(fix.workspace).some(n => n.startsWith(".foundry-")); i++) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    fs.mkdirSync(target)
    fs.writeFileSync(path.join(target, "owner.txt"), "existing target")
    const status = await childClosed
    assert.equal(status, 2)
    assert.equal(fs.readFileSync(path.join(target, "owner.txt"), "utf8"), "existing target")
    assert.deepEqual(fs.readdirSync(fix.workspace), ["io.github.demo.race"])
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("a live workspace swap cannot redirect staged or final files", async () => {
  const fix = fixture()
  try {
    const moved = path.join(fix.root, "projects-moved")
    const child = spawn(cli, [
      "create", "--workspace", fix.workspace, "--id", "io.github.demo.swap",
      "--name", "Swap", "--description", DESCRIPTION
    ], { env: { ...fix.env, FOUNDRY_TEST_BEFORE_PUBLISH_MS: "700" }, encoding: "utf8" })
    const childClosed = new Promise(resolve => child.once("close", resolve))
    for (let i = 0; i < 100 && !fs.readdirSync(fix.workspace).some(n => n.startsWith(".foundry-")); i++) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    fs.renameSync(fix.workspace, moved)
    fs.mkdirSync(fix.workspace)
    const status = await childClosed
    assert.equal(status, 2)
    assert.deepEqual(fs.readdirSync(fix.workspace), [])
    assert.equal(fs.existsSync(path.join(moved, "io.github.demo.swap")), false)
    assert.deepEqual(fs.readdirSync(moved), [])
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("concurrent creators cannot merge or overwrite the same project", async () => {
  const fix = fixture()
  try {
    const argv = ["create", "--workspace", fix.workspace, "--id", "io.github.demo.concurrent",
      "--name", "Concurrent", "--description", DESCRIPTION]
    const children = [spawn(cli, argv, { env: fix.env }), spawn(cli, argv, { env: fix.env })]
    const statuses = await Promise.all(children.map(child => new Promise(resolve => child.once("close", resolve))))
    assert.deepEqual(statuses.sort(), [0, 2])
    const target = path.join(fix.workspace, "io.github.demo.concurrent")
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, "manifest.json"))).id, "io.github.demo.concurrent")
    assert.equal(fs.readdirSync(fix.workspace).filter(name => name.startsWith(".foundry-")).length, 0)
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("names and options cannot manufacture unsafe generated metadata", () => {
  const fix = fixture()
  try {
    const punctuation = run(fix, "create", "--workspace", fix.workspace,
      "--id", "io.github.demo.punctuation", "--name", "!!!", "--description", DESCRIPTION, "--dry-run")
    assert.equal(punctuation.status, 2)
    const unknown = run(fix, "create", "--workspace", fix.workspace,
      "--id", "io.github.demo.unknown", "--name", "Unknown", "--description", DESCRIPTION, "--publish")
    assert.equal(unknown.status, 2)
    assert.match(unknown.stderr, /unknown create option/)
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("different plugin identities receive different named SVG themes", () => {
  const fix = fixture()
  try {
    for (const [id, name] of [["io.github.demo.alpha", "Alpha"], ["io.github.demo.beta", "Beta"]]) {
      const result = run(fix, "create", "--workspace", fix.workspace,
        "--id", id, "--name", name, "--description", DESCRIPTION)
      assert.equal(result.status, 0, result.stderr)
    }
    const alpha = fs.readFileSync(path.join(fix.workspace, "io.github.demo.alpha", "assets", "banner.svg"), "utf8")
    const beta = fs.readFileSync(path.join(fix.workspace, "io.github.demo.beta", "assets", "banner.svg"), "utf8")
    assert.notEqual(alpha, beta)
    assert.match(alpha, />Alpha</)
    assert.match(beta, />Beta</)
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})
