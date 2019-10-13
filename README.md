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

## Notes/bugs

This cannot modify the file it's required in.