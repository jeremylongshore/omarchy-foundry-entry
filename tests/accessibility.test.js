const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const root = path.join(__dirname, "..")
const bar = fs.readFileSync(path.join(root, "BarWidget.qml"), "utf8")
const panel = fs.readFileSync(path.join(root, "Panel.qml"), "utf8")

test("the bar control exposes a button role and a readable name", () => {
  assert.match(bar, /Accessible\.role:\s*Accessible\.Button/)
  assert.match(bar, /Accessible\.name:/)
  assert.match(bar, /tooltipText:/)
})

test("the panel supports keyboard close, traversal, and refresh", () => {
  assert.match(panel, /PanelKeyCatcher\s*{/)
  assert.match(panel, /onCloseRequested:/)
  assert.match(panel, /onTabRequested:/)
  assert.match(panel, /function refresh\(\)/)
})

test("authored text uses plain-text rendering and overflow controls", () => {
  const textBlocks = panel.split(/\bText\s*{/).slice(1)
  assert.ok(textBlocks.length >= 8)
  for (const block of textBlocks) {
    const body = block.slice(0, block.indexOf("}"))
    assert.match(body, /textFormat:\s*Text\.PlainText/)
  }
  assert.match(panel, /(?:elide|wrapMode):/)
})
