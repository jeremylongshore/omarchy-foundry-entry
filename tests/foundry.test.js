const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const cli = path.join(__dirname, "..", "bin", "omarchy-foundry")

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
    const result = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.hello", "--name", "Hello", "--description", "A safe draft", "--dry-run")
    assert.equal(result.status, 0)
    assert.equal(JSON.parse(result.stdout).write, false)
    assert.equal(fs.existsSync(path.join(fix.workspace, "io.github.demo.hello")), false)
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("create writes only a fresh project with deterministic starter files", () => {
  const fix = fixture()
  try {
    const result = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.hello", "--name", "Hello", "--description", "A safe draft")
    assert.equal(result.status, 0)
    const target = path.join(fix.workspace, "io.github.demo.hello")
    assert.equal(JSON.parse(result.stdout).target, target)
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, "manifest.json"))).id, "io.github.demo.hello")
    assert.match(fs.readFileSync(path.join(target, "BarWidget.qml"), "utf8"), /io\.github\.demo\.hello/)
    assert.equal(fs.existsSync(path.join(target, "assets", "banner.svg")), true)
    const generatedTests = spawnSync("npm", ["test"], { cwd: target, encoding: "utf8" })
    assert.equal(generatedTests.status, 0, generatedTests.stderr)
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})

test("create refuses unsafe ids, existing targets, and workspace symlink escapes", () => {
  const fix = fixture()
  try {
    const badId = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.bad;rm", "--name", "Hello", "--description", "A safe draft", "--dry-run")
    assert.equal(badId.status, 2)
    const badName = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.name", "--name", "Hello\nInjected", "--description", "A safe draft", "--dry-run")
    assert.equal(badName.status, 2)
    const badDescription = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.description", "--name", "Hello", "--description", "<b>not markup</b>", "--dry-run")
    assert.equal(badDescription.status, 2)
    const outside = run(fix, "create", "--workspace", os.tmpdir(), "--id", "io.github.demo.hello", "--name", "Hello", "--description", "A safe draft", "--dry-run")
    assert.equal(outside.status, 2)
    const first = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.existing", "--name", "Hello", "--description", "A safe draft")
    assert.equal(first.status, 0)
    const existing = run(fix, "create", "--workspace", fix.workspace, "--id", "io.github.demo.existing", "--name", "Hello", "--description", "A safe draft")
    assert.equal(existing.status, 2)
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "foundry-outside-"))
    fs.symlinkSync(outsideRoot, path.join(fix.root, "escape"))
    const escaped = run(fix, "create", "--workspace", path.join(fix.root, "escape"), "--id", "io.github.demo.escape", "--name", "Hello", "--description", "A safe draft", "--dry-run")
    assert.equal(escaped.status, 2)
    fs.rmSync(outsideRoot, { recursive: true, force: true })
  } finally { fs.rmSync(fix.root, { recursive: true, force: true }) }
})
