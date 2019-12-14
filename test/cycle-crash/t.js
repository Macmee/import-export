const A = require("./a")._bridge.ns.A
const a = new A()
console.log(a.b.c.b)
