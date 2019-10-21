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

You might have noticed with `require()` that where _a_ contains `require("b")`
and _b_ contains `require("a")`, the second one to get loaded gets the value of
`module.exports` at that time when its corresponding `require()` appeared. In
other words, mutual dependencies mean temporarily incomplete imports. This
package still uses `require` so the same rules apply.

In practice, this means that immediate evaluation where mutual `import`s are
present won't work - but runtime evaluation generally will.

If you get into this situation with a file which `require()`s a file which uses `export`, you can call `.then(...)` on the bridge object, eg:

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

In any case, where this happens the immediate context will not have a defined
value for the datum in question. As with mutual `require()`, you should change
such expressions to be computed on demand, eg. rather than:

```
import {b} from "./b"
export var a = b + 1
```

You should:

```
import {b} from "./b"
export function a() {return b + 1}
```

This will operate differently - it will require to be called rather than just
evaluated - but at any time which is not in itself in the middle of mutual
dependency resolution it'll have a resolved value.

## How this works

At a simple level, `import {Foo} from "./foo"` is the same as `var Foo =
require("./foo").Foo`. Unfortunately it's not quite that simple because "export"
hoists (its names exist before the code delaring them is executed), which is
very valuable when you have circular references but needs to be emulated here.

Instead, the code `import {Foo} from "./foo"` becomes roughly:

```
var Foo = require("./foo").Foo // Original line position
// Other code before the main script run starts...
Foo = require("./foo").Foo
```

This means that we can fill in the namespace entry early and then before
anything really uses it we can insert the final value. Specifically, we can do
that as soon as the exporting module body execution finishes.

The initial "var" line has to appear at its original (presumably top) level; by
doing so it inserts an entry directly into the correct namespace. It won't work
inside a function. Once the name exists, plain assignment in any scope which
inherits the original namespace is fine, so the second half is done via a
callback function. It doesn't make sense to do a second assingment once the
module's evaluation is complete, so at that point the callback handler is
dummied out and any pending callbacks executed.

On the exporting side, `export Foo` becomes roughly:

```
module.exports.Foo = null
// Other module code...
module.exports.Foo = Foo // Original line position
// Other module code...
```

This ensures that the names all exist before any other code's import returns,
and sets the correct value once it's known. It's necessary to do this in two
stages because only one type of value has both its declaration and value
hoisted: explicitly named functions.

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