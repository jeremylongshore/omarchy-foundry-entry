// Pure receipt parsing. This module has no process or network access, so it
// loads in Quickshell and the offline node suite.
function clean(value, max) {
  var s = String(value === undefined || value === null ? "" : value)
  s = s.replace(/[<>]/g, "").replace(/[\x00-\x1f\x7f]/g, "")
  var cap = max || 64
  return s.length > cap ? s.slice(0, cap) : s
}

function parseReceipt(raw) {
  var data
  try { data = JSON.parse(String(raw || "")) } catch (e) { return emptyReceipt() }
  if (!data || typeof data !== "object" || Array.isArray(data)) return emptyReceipt()
  return {
    ready: data.ready === true,
    template: clean(data.template, 48),
    workspace: clean(data.workspace, 80),
    message: clean(data.message, 120),
    capabilities: clean(data.capabilities, 80),
    proof: clean(data.proof, 48)
  }
}

function emptyReceipt() {
  return { ready: false, template: "", workspace: "", message: "Waiting for Foundry", capabilities: "", proof: "UNPROVEN" }
}

function pillText(receipt) {
  if (!receipt || !receipt.ready) return "FOUNDRY"
  return receipt.proof === "READY" ? "FOUNDRY READY" : "FOUNDRY DRAFT"
}

function tooltipText(receipt) {
  return receipt && receipt.message ? clean(receipt.message, 120) : "Open Foundry"
}

if (typeof module !== "undefined") {
  module.exports = {
    clean: clean,
    parseReceipt: parseReceipt,
    emptyReceipt: emptyReceipt,
    pillText: pillText,
    tooltipText: tooltipText
  }
}
