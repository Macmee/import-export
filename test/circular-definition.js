const assert = require("assert")
const a = require("./mutual-a")
assert.ok(a.hasOwnProperty("A"), "mutual export is initially set")
assert.equal(a.ab(), 69, "Circular definition works")
const timeout = setTimeout(
    () => console.error("Passed timeout without import resolving - this is a bug"),
    5000
)
let run_in_current_context = false
assert.doesNotReject(async () => {
    run_in_current_context = true
    try {
        assert.ok(a.A, "mutual export is set to a real value")
    } catch(e) {
        console.log(e)
    }
    clearTimeout(timeout)
})
assert.ok(run_in_current_context, "Resolveable dependencies complete in current context")