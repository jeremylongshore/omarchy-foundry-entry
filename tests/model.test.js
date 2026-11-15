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
  // The helper reports UNPROVEN by design. It must not read as a draft or a
  // proven state, and a receipt that is not ready never earns READY.
  assert.equal(Model.pillText(Model.parseReceipt('{"ready":true,"proof":"UNPROVEN"}')), "FOUNDRY")
  assert.equal(Model.pillText(Model.parseReceipt('{"ready":false,"proof":"READY"}')), "FOUNDRY")
  assert.equal(Model.pillText(null), "FOUNDRY")
  assert.equal(Model.pillText(undefined), "FOUNDRY")
})

test("a healthy idle Foundry is not an alert, an unanswered helper is", () => {
  const idle = Model.parseReceipt('{"ready":true,"proof":"UNPROVEN"}')
  assert.equal(Model.needsAttention(idle, true), false)
  assert.equal(Model.needsAttention(Model.parseReceipt('{"ready":true,"proof":"READY"}'), true), false)
  // Before the first answer there is nothing to alert about.
  assert.equal(Model.needsAttention(Model.emptyReceipt(), false), false)
  assert.equal(Model.needsAttention(Model.emptyReceipt(), undefined), false)
  // Asked and answered with nothing usable: the pill lights.
  assert.equal(Model.needsAttention(Model.emptyReceipt(), true), true)
  assert.equal(Model.needsAttention(Model.parseReceipt("not json"), true), true)
  assert.equal(Model.needsAttention(null, true), true)
  assert.equal(Model.needsAttention(Model.parseReceipt('{"ready":1}'), true), true)
})

test("hero and tooltip text explain every state in one short line", () => {
  const ready = Model.parseReceipt('{"ready":true,"message":"<b>Ready</b> to forge"}')
  assert.equal(Model.heroText(Model.emptyReceipt(), false), "Reading the local Foundry boundary")
  assert.equal(Model.heroText(ready, true), "bReady/b to forge")
  assert.equal(Model.heroText(Model.emptyReceipt(), true), "Foundry's helper did not answer. Reinstall it, then reopen.")
  assert.equal(Model.heroText(Model.parseReceipt('{"ready":true}'), true), "")
  assert.equal(Model.tooltipText(ready, true), "bReady/b to forge")
  assert.equal(Model.tooltipText(Model.emptyReceipt(), true), "Foundry's helper did not answer. Reinstall it, then reopen.")
  assert.equal(Model.tooltipText(Model.emptyReceipt(), false), "Waiting for Foundry")
  assert.equal(Model.tooltipText({ message: "<b>forge</b>" }), "bforge/b")
  assert.equal(Model.tooltipText({ message: "" }), "Open Foundry")
  assert.equal(Model.tooltipText(null), "Open Foundry")
  // A hero line is elided by the shell at roughly 75 characters; ours must fit.
  assert.ok(Model.heroText(Model.emptyReceipt(), true).length <= 60)
})

test("text cleaning removes bidi controls and Unicode tag characters", () => {
  const bidi = "a\u202ab\u202bc\u202cd\u202de\u202ef\u2066g\u2067h\u2068i\u2069j\u200ek\u200fl\u061cm"
  assert.equal(Model.clean(bidi, 80), "abcdefghijklm")
  // U+E0041 and U+E007F are tag characters (surrogate pairs in UTF-16).
  assert.equal(Model.clean("x\u{E0041}y\u{E007F}z", 80), "xyz")
  // The edges of each range are removed; the neighbours are kept.
  assert.equal(Model.clean("\u2029\u202f\u2065\u206a\u200d\u0610", 80), "\u2029\u202f\u2065\u206a\u200d\u0610")
  assert.equal(Model.clean("\u{E0000}\u{E0080}\u{DFFFF}", 80), "\u{E0080}\u{DFFFF}")
  assert.equal(Model.clean("\x1f\x7f<>", 80), "")
  assert.equal(Model.clean("\x20\x7e", 80), " ~")
})

test("a length cap never leaves half of a surrogate pair", () => {
  const smile = "\u{1F600}"
  assert.equal(Model.clean("ab" + smile, 3), "ab")
  assert.equal(Model.clean("ab" + smile, 4), "ab" + smile)
  assert.equal(Model.clean(smile + smile, 2), smile)
  assert.equal(Model.clean("abc", 3), "abc")
  // A lone high surrogate at the very end is dropped, at the edges of its range.
  assert.equal(Model.clean("a\ud800", 80), "a")
  assert.equal(Model.clean("a\udbff", 80), "a")
  assert.equal(Model.clean("a\ud7ff", 80), "a\ud7ff")
  assert.equal(Model.clean("a\udc00", 80), "a\udc00")
  assert.equal(Model.clean("", 80), "")
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

test("file URLs become paths, including percent-encoded ones", () => {
  assert.equal(Model.fileUrlToPath("file:///home/a/.config/x"), "/home/a/.config/x")
  assert.equal(Model.fileUrlToPath("file:///home/a%20b/x%25y"), "/home/a b/x%y")
  assert.equal(Model.fileUrlToPath("/already/a/path"), "/already/a/path")
  // Only a leading scheme is stripped.
  assert.equal(Model.fileUrlToPath("/x/file:///y"), "/x/file:///y")
  assert.equal(Model.fileUrlToPath("file:///bad%zz"), "/bad%zz")
  assert.equal(Model.fileUrlToPath(null), "")
  assert.equal(Model.fileUrlToPath(undefined), "")
})

test("shell quoting survives every shell metacharacter", () => {
  assert.equal(Model.shellQuote("plain"), "'plain'")
  assert.equal(Model.shellQuote("it's"), "'it'\\''s'")
  assert.equal(Model.shellQuote("a b;$(x)`y`"), "'a b;$(x)`y`'")
})

test("the helper is shown by its real path, quoted only when the shell needs it", () => {
  const helper = "/home/ann/.config/omarchy/plugins/io.github.jeremylongshore.foundry/bin/omarchy-foundry"
  const tail = ".config/omarchy/plugins/io.github.jeremylongshore.foundry/bin/omarchy-foundry"
  assert.equal(Model.helperInvocation(helper, "/home/ann"), "~/" + tail)
  assert.equal(Model.helperInvocation(helper, "/home/bob"), helper)
  assert.equal(Model.helperInvocation(helper, ""), helper)
  assert.equal(Model.helperInvocation(helper, null), helper)
  assert.equal(Model.helperInvocation(helper, "/"), helper)
  assert.equal(Model.helperInvocation(helper, "home/ann"), helper)
  assert.equal(Model.helperInvocation(helper, "//"), helper)
  // A HOME written with trailing slashes still matches whole components.
  assert.equal(Model.helperInvocation(helper, "/home/ann/"), "~/" + tail)
  assert.equal(Model.helperInvocation(helper, "/home/ann//"), "~/" + tail)
  assert.equal(Model.helperInvocation(helper, undefined), helper)
  // HOME must match whole path components, not a prefix of one.
  assert.equal(Model.helperInvocation("/home/anna/x", "/home/ann"), "/home/anna/x")
  // A dev checkout outside HOME keeps its absolute path.
  assert.equal(Model.helperInvocation("/srv/dev/bin/omarchy-foundry", "/home/ann"), "/srv/dev/bin/omarchy-foundry")
  assert.equal(Model.helperInvocation("/home/ann/dev@1:2+3/bin/x", "/home/ann"), "~/dev@1:2+3/bin/x")
  // Characters the shell interprets force quoting; ~ is not offered for them.
  assert.equal(Model.helperInvocation("/home/ann/my plugins/bin/x", "/home/ann"), "'/home/ann/my plugins/bin/x'")
  assert.equal(Model.helperInvocation("/srv/it's/x", "/home/ann"), "'/srv/it'\\''s/x'")
  assert.equal(Model.helperInvocation("/srv/a$b/x", ""), "'/srv/a$b/x'")
  assert.equal(Model.helperInvocation("/srv/a=b/x", ""), "'/srv/a=b/x'")
  assert.equal(Model.helperInvocation("/srv/a%b/x", ""), "'/srv/a%b/x'")
})

test("an unusable helper path falls back to the standard install location", () => {
  for (const bad of ["", null, undefined, "relative/bin/x", "bin/omarchy-foundry", "/a\nb", "/a\x00b", "/a\x7fb", "/a<b>/x", "/a\u202eb/x", "/a\u2066b/x", "/a\u{E0041}b/x", "/a\ud83d", "/" + "d".repeat(520)]) {
    assert.equal(Model.helperInvocation(bad, "/home/ann"), Model.INSTALLED_HELPER, JSON.stringify(bad))
  }
  assert.equal(Model.INSTALLED_HELPER,
    "~/.config/omarchy/plugins/io.github.jeremylongshore.foundry/bin/omarchy-foundry")
  // 512 is the longest path accepted.
  const longest = "/" + "d".repeat(511)
  assert.equal(Model.helperInvocation(longest, ""), longest)
})

test("the safe-start command is the helper plus the documented dry-run arguments", () => {
  assert.equal(Model.startCommand("/home/ann/p/bin/omarchy-foundry", "/home/ann"),
    "~/p/bin/omarchy-foundry create --workspace PATH --id io.github.you.widget --name NAME --description-file COPY.txt --dry-run")
  assert.match(Model.startCommand("", ""), /^~\/\.config\/omarchy\/plugins\/io\.github\.jeremylongshore\.foundry\/bin\/omarchy-foundry create /)
  assert.match(Model.startCommand("/x/y", ""), / --dry-run$/)
})
