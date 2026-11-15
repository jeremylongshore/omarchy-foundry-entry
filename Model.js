// Pure receipt parsing and command building. This module has no process or
// network access, so it loads in Quickshell and the offline node suite.
//
// ES5 only: no template literals, arrow functions, let, or const.

// Where `omarchy plugin add` puts a plugin, relative to HOME. The panel builds
// its command from the helper's real location; this is only the fallback.
var INSTALLED_HELPER = "~/.config/omarchy/plugins/io.github.jeremylongshore.foundry/bin/omarchy-foundry"
var START_ARGS = "create --workspace PATH --id io.github.you.widget --name NAME --description-file COPY.txt --dry-run"
// Characters a shell leaves alone in a word; anything else gets single quotes.
var SAFE_WORD = /^[A-Za-z0-9_.+@:\/-]+$/
var READING_MESSAGE = "Reading the local Foundry boundary"
var UNAVAILABLE_MESSAGE = "Foundry's helper did not answer. Reinstall it, then reopen."

// Strip angle brackets, ASCII controls, bidi overrides and isolates (U+202A to
// U+202E, U+2066 to U+2069, U+200E, U+200F, U+061C), and Unicode tag characters
// (U+E0000 to U+E007F, a surrogate pair in UTF-16), then cap the length.
function clean(value, max) {
  var s = String(value === undefined || value === null ? "" : value)
  s = s.replace(/[<>]/g, "").replace(/[\x00-\x1f\x7f]/g, "")
  s = s.replace(/[\u202a-\u202e\u2066-\u2069\u200e\u200f\u061c]/g, "")
  s = s.replace(/\udb40[\udc00-\udc7f]/g, "")
  s = s.slice(0, max || 64)
  // A cut must never leave half of a surrogate pair at the end.
  var last = s.charCodeAt(s.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? s.slice(0, -1) : s
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

// The pill never claims more than the receipt proves. The helper reports
// UNPROVEN by design (it never validates what it forges), so a healthy idle
// Foundry reads plain "FOUNDRY"; only a READY proof adds a word.
function pillText(receipt) {
  return receipt && receipt.ready === true && receipt.proof === "READY" ? "FOUNDRY READY" : "FOUNDRY"
}

// The alert tint is for a helper that was asked and gave no usable receipt, not
// for UNPROVEN, which is the standing state of a scaffold tool.
function needsAttention(receipt, loaded) {
  return loaded === true && !(receipt && receipt.ready === true)
}

function heroText(receipt, loaded) {
  if (loaded !== true) return READING_MESSAGE
  if (needsAttention(receipt, loaded)) return UNAVAILABLE_MESSAGE
  return clean(receipt.message, 120)
}

function tooltipText(receipt, loaded) {
  if (needsAttention(receipt, loaded)) return UNAVAILABLE_MESSAGE
  return receipt && receipt.message ? clean(receipt.message, 120) : "Open Foundry"
}

// Qt.resolvedUrl(...).toString() yields a file URL, and a URL percent-encodes
// what a path does not (a space is %20, a literal percent is %25).
function fileUrlToPath(url) {
  var s = String(url === undefined || url === null ? "" : url).replace(/^file:\/\//, "")
  try { return decodeURIComponent(s) } catch (e) { return s }
}

function shellQuote(text) {
  return "'" + String(text).replace(/'/g, "'\\''") + "'"
}

// The helper as a terminal user must type it. `omarchy plugin add` does not put
// a plugin's bin/ on PATH, so a bare `omarchy-foundry` is command not found; the
// panel shows the helper's own absolute path. A path under HOME is shown as ~/
// (shorter, and identical for every user). A path with a character the shell
// would interpret is single-quoted, and anything unusable falls back to the
// standard install location.
function helperInvocation(helperPath, home) {
  // String(undefined) and String(null) are not absolute paths, so they take the
  // same fallback as an empty value without a special case.
  var p = String(helperPath)
  if (p.charAt(0) !== "/" || p.length > 512 || clean(p, 512) !== p) return INSTALLED_HELPER
  var h = String(home).replace(/\/+$/, "")
  if (h !== "" && p.indexOf(h + "/") === 0) {
    var rest = p.slice(h.length + 1)
    if (SAFE_WORD.test(rest)) return "~/" + rest
  }
  return SAFE_WORD.test(p) ? p : shellQuote(p)
}

function startCommand(helperPath, home) {
  return helperInvocation(helperPath, home) + " " + START_ARGS
}

if (typeof module !== "undefined") {
  module.exports = {
    clean: clean,
    parseReceipt: parseReceipt,
    emptyReceipt: emptyReceipt,
    pillText: pillText,
    needsAttention: needsAttention,
    heroText: heroText,
    tooltipText: tooltipText,
    fileUrlToPath: fileUrlToPath,
    shellQuote: shellQuote,
    helperInvocation: helperInvocation,
    startCommand: startCommand,
    INSTALLED_HELPER: INSTALLED_HELPER
  }
}
