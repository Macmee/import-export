const assert = require("assert")

require("./index")
require("./test/import")

const a = require("./test/mutual-a")
assert.ok(a.hasOwnProperty("A"), "mutual export is initially set")
const timeout = setTimeout(
    () => console.error("Passed timeout without import resolving - this is a bug"),
    5000
)
assert.doesNotReject(async () => {
    try {
        const ns = await a._bridge
        assert.ok(ns.A, "mutual export is set to a real value after then()")
    } catch(e) {
        console.log(e)
    }
    clearTimeout(timeout)
})
