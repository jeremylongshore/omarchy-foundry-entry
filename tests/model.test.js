const test = require("node:test")
const assert = require("node:assert/strict")
const Model = require("../Model.js")

test("receipt parser fails closed on malformed output", () => {
  assert.deepEqual(Model.parseReceipt("not json"), Model.emptyReceipt())
  assert.equal(Model.parseReceipt('{"ready":true,"proof":"READY"}').ready, true)
})

test("receipt parser cleans tool output before it reaches QML", () => {
  const receipt = Model.parseReceipt('{"message":"<b>created</b>\\u0000","capabilities":"local"}')
  assert.equal(receipt.message, "bcreated/b")
  assert.equal(receipt.capabilities, "local")
})

test("pill never implies an unproven receipt is ready", () => {
  assert.equal(Model.pillText(Model.emptyReceipt()), "FOUNDRY")
  assert.equal(Model.pillText(Model.parseReceipt('{"ready":true,"proof":"READY"}')), "FOUNDRY READY")
  assert.equal(Model.pillText(Model.parseReceipt('{"ready":true,"proof":"UNPROVEN"}')), "FOUNDRY DRAFT")
})
