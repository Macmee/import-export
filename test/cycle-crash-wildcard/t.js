const assert = require("assert")
const A = require("./a").A
const a = new A()
assert.equal(a.b.c.b, 1)