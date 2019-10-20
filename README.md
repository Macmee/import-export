# eximport

This module brings support for ECMAScript 6 import/export statements to your projects.

This was forked from the unmaintained `import-export` module.

## Usage

In your top-level .js file require this module before your other project
includes. Node's module loader will be hooked to rewrite both `import` and
`export` statements into mutually compatible wrappers.

e.g. you might have an `index.js` like:

```
require("eximport")

module.exports = require("./src/foo").ns
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
expose the whole namespace (`require(...).ns`), just the default
(`require(...).ns.default`) or a specific named export (`require(...).ns.Foo`)

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