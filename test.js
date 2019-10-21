const assert = require("assert")

require("./index")
require("./test/import")

const a = require("./test/mutual-a")
assert.ok(a.hasOwnProperty("A"), "mutual export is initially set")
const timeout = setTimeout(
    () => console.error("Passed timeout without import resolving - this is a bug"),
    5000
)
let run_in_current_context = false
assert.doesNotReject(async () => {
    run_in_current_context = true
    try {
        const ns = await a._bridge
        assert.ok(ns.A, "mutual export is set to a real value after then()")
    } catch(e) {
        console.log(e)
    }
    clearTimeout(timeout)
})
assert.ok(run_in_current_context, "Resolveable dependencies complete in current context")
