require("./index")
require("./test/import")
require("./test/circular-definition")
require("./test/export-class").Baz.boz // Just try evaluating it
require("./test/export-class").Baz.bar // Just try evaluating it

require("./test/cycle-crash/t")
require("./test/cycle-crash-wildcard/t")
require("./test/late-reassign-wildcard/t")
