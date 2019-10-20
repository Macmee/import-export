const assert = require("assert")

require("./index")
require("./test/import")

const a = require("./test/mutual-a")
assert.ok(a.hasOwnProperty("A"), "mutual export is initially set")
