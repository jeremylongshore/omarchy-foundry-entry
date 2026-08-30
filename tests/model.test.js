const test = require("node:test")
const assert = require("node:assert/strict")
const Model = require("../Model.js")

test("receipt parser fails closed on malformed output", () => {
  assert.deepEqual(Model.emptyReceipt(), {
    ready: false,
    template: "",
    workspace: "",
    message: "Waiting for Foundry",
    capabilities: "",
    proof: "UNPROVEN"
  })
  assert.deepEqual(Model.parseReceipt("not json"), Model.emptyReceipt())
  assert.deepEqual(Model.parseReceipt("null"), Model.emptyReceipt())
  assert.deepEqual(Model.parseReceipt("[]"), Model.emptyReceipt())
  assert.deepEqual(Model.parseReceipt('"receipt"'), Model.emptyReceipt())
  assert.equal(Model.parseReceipt('{"ready":true,"proof":"READY"}').ready, true)
  assert.equal(Model.parseReceipt('{"ready":1,"proof":"READY"}').ready, false)
})

test("receipt parser cleans tool output before it reaches QML", () => {
  const receipt = Model.parseReceipt('{"message":"<b>created</b>\\u0000","capabilities":"local"}')
  assert.equal(receipt.message, "bcreated/b")
  assert.equal(receipt.capabilities, "local")
  assert.equal(Model.clean(null), "")
  assert.equal(Model.clean(undefined), "")
  assert.equal(Model.clean("abcdef", 3), "abc")
  assert.equal(Model.clean("ab", 3), "ab")
  assert.equal(Model.clean("x".repeat(80)).length, 64)
})

test("pill never implies an unproven receipt is ready", () => {
  assert.equal(Model.pillText(Model.emptyReceipt()), "FOUNDRY")
  assert.equal(Model.pillText(Model.parseReceipt('{"ready":true,"proof":"READY"}')), "FOUNDRY READY")
  assert.equal(Model.pillText(Model.parseReceipt('{"ready":true,"proof":"UNPROVEN"}')), "FOUNDRY DRAFT")
  assert.equal(Model.pillText(null), "FOUNDRY")
  assert.equal(Model.tooltipText({ message: "<b>forge</b>" }), "bforge/b")
  assert.equal(Model.tooltipText({ message: "" }), "Open Foundry")
  assert.equal(Model.tooltipText(null), "Open Foundry")
})

test("receipt fields are independently bounded", () => {
  const receipt = Model.parseReceipt(JSON.stringify({
    ready: true,
    template: "t".repeat(80),
    workspace: "w".repeat(100),
    message: "m".repeat(140),
    capabilities: "c".repeat(100),
    proof: "p".repeat(60)
  }))
  assert.equal(receipt.template.length, 48)
  assert.equal(receipt.workspace.length, 80)
  assert.equal(receipt.message.length, 120)
  assert.equal(receipt.capabilities.length, 80)
  assert.equal(receipt.proof.length, 48)
})
