const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const root = path.join(__dirname, "..")
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"))
const banner = fs.readFileSync(path.join(root, "assets", "banner.svg"), "utf8")

test("both marketplace descriptions use the complete allowance", () => {
  assert.equal(manifest.description.length, 500)
  assert.equal(manifest.barWidget.description.length, 500)
  assert.equal(manifest.barWidget.description, manifest.description)
  for (const claim of [
    "local Omarchy bar-widget draft", "500-char description", "matched copy",
    "unique SVG banner", "offline tests, CI, security, and install/removal guidance",
    "descriptor-pinned generator", "publishes only to a new target",
    "draft begins UNPROVEN", "real-shell evidence before release",
    "never installs, enables, commits, pushes, publishes, calls a network service, or uses AI"
  ]) assert.match(manifest.description, new RegExp(claim))
})

test("Foundry owns a named, wide, graphic SVG banner", () => {
  assert.match(banner, /<title id="title">Foundry<\/title>/)
  assert.match(banner, /viewBox="0 0 1280 360"/)
  assert.match(banner, /<(?:path|circle|polygon|ellipse)\b/)
  assert.ok(new Set(banner.match(/#[0-9a-fA-F]{6}/g)).size >= 3)
  assert.doesNotMatch(banner, /(?:href|src)="(?:https?:|\/\/)/)
})

test("the marketplace version matches the package version", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
  const contract = JSON.parse(fs.readFileSync(path.join(root, "contracts", "marketplace-presentation.schema.json"), "utf8"))
  assert.equal(manifest.version, pkg.version)
  assert.equal(contract.properties.description.minLength, 500)
  assert.equal(contract.properties.description.maxLength, 500)
  assert.equal(contract.properties.barWidget.properties.description.minLength, 500)
  assert.equal(contract.properties.barWidget.properties.description.maxLength, 500)
})
