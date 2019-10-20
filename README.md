# eximport

This module brings support for ECMAScript 6 import/export statements to your
projects.

This was forked from the unmaintained `import-export` package.

This exists because Node itself does not support ES6 modules currently - see
https://nodejs.org/api/esm.html - but the functionality is useful if for little
more reason than that it's more terse. If/when Node gets production es6 module
support this package will become redundant and probably stop being maintained,
because more complicated scenarios absolutely require that you can rearrange the
AST.

## Usage

In your top-level .js file require this module before your other project
includes. Node's module loader will be hooked to rewrite both `import` and
`export` statements into mutually compatible wrappers.

e.g. you might have an `index.js` like:

```
require("eximport")

module.exports = require("./src/foo")
```

...and a `src/foo.js` like:

```
import Bar from "./bar"
Bar.baz()
```

...and a `src/bar.js` like:

```
class Bar {
  static baz() {
    console.log("Hello World")
  }
}
export default Bar
```

## Return from require()

This returns an EximportBridge object.

When you're using require() with an import/export module, you may either want to
expose the whole namespace (`require(...)`), just the default
(`require(...).default`) or a specific named export (`require(...).Foo`)

## Resolving Non-Immediate Evaluation

Under some circumstances, evaluation might not complete in the current execution
context, for example this may happen where there's a mutual dependency between
two files. If this is the case, you might get some symbols defined immediately
and some later. If this comes up, you can call `.then(...)` on the bridge
object, eg:

```
var foo = require("foo")
foo._bridge.then(resolved_ns => foo = resolved_ns)
```

This will reassign the namespace once it's available. If you prefer to have no
namespace at all until it's resolved, you can do:

```
var foo
require("foo")._bridge.then(ns => foo = ns)
```

Or in async context:

```
const foo = await require("foo")._bridge
```

## Notes/bugs & Known Limitations

### Self-modifying

This cannot modify the file it's required in.

### Complex Expressions

Due to the use of regexps, complex expressions won't be parseable. For example,
you might want to write:

```
export var foo=`export var bar=${baz.join(",") + `}`}`
```

That's simply not going to work unless the filter has a full understanding of
Javascript syntax and the ability to parse recursively, which isn't possible in
regular expressions. If you've got expressions like that, just split them into a
plain export (which eximport can handle) and the relevant assignment/expression
(which the Javascript engine can handle).

You might in some cases have a non-export/non-import expression which is picked
up as an export or import - if so, that's an unknown bug, and you should
consider reporting it if the code in question isn't pathological.

### Cyclic Dependencies

Any engine-embedded module support will defer some elements of evaluation of
module A while module B is loaded - for example if you have
`class Foo extends Bar` in one file, and `class Bar {} class Baz extends Foo` in
another, and really the only way to handle that is to have `Foo` and `Baz` as
incomplete classes which will become complete after all dependent evaluations
are complete.

Any cyclic dependency which would have to be evaluted immediately (including all
top-level code) won't work because of the complexity of expressing this,
particularly where top-level object definitions will be present in both cases.

Later evaluations are worked around by dropping an empty `var` in then updating
it once loaded. As a result, evaluation of a module might not be complete
immediately from the perspective of the caller if there's a dependency cycle
which includes the caller.