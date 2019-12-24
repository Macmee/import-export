const assert = require("assert")
const bar = require("./bar")
assert.equal(bar.bar, 42, "Exporting import-derived symbol through mutual dependency works")