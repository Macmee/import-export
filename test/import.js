var assert = require("assert");
import aDefault from "./export/a";
assert.equal(
    aDefault,
    42,
    "Static default import works"
);
import * as aAll from "./export/a";
assert.deepEqual(
    aAll,
    { a: 1, b: 2, c1: 3, d: 4, default: 42 },
    "Namespaced wildcard import works with alias and expression default"
);
import { e } from "./export/b";
assert.equal(
    e,
    5,
    "Importing a named let item works"
);
import { c1 as see } from "./export/b";
assert.equal(
    see,
    3,
    "Aliasing an imported item which was itself export-imported works"
);
import { k, l } from "./export/c";
assert.deepEqual(
    [k, l],
    [11, 12],
    "Importing multiple named var items works"
);
import { h , e as eee } from "./export/c";
assert.deepEqual(
    [h, eee],
    [8, 5],
    "Importing multiple named items with alias and named export-import works"
);
import ooh, { m , n } from "./export/d";
assert.deepEqual(
    [ooh, m, n],
    [ 16, 14, 15 ],
    "Importing multiple named const items with named default export-import works"
);
import oh, * as dee from "./export/d";
assert.deepEqual(
    [oh, dee],
    [ 16, { default: 16, p: 17, eye: 9, l: 12, m: 14, n: 15 } ],
    "Namespaced import with default import works"
)
assert.doesNotThrow(
    () => {
        import "./export/d";
    },
    "Plain import for side-effects is accepted"
);