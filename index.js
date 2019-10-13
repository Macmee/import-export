const hook = require("node-hook")

const IdentifierList = require("./lib/identifier-list")

hook.hook(".js", (src, name) => {
    /* How this works:
    *
    * At a simple level, `import {Foo} from "./foo"` is the same as
    * `var Foo = require("./foo").Foo`. Unfortunately it's not quite that simple because
    * "export" hoists (its names exist before the code delaring them is executed), which is
    * very valuable when you have circular references but needs to be emulated here.
    *
    * Instead, the code `import {Foo} from "./foo"` becomes roughly:
    *
    *     var Foo = require("./foo").Foo; // Original line position
    *     // Other code before the main script run starts...
    *     Foo = require("./foo").Foo;
    *
    * This means that we can fill in the namespace entry early and then before anything really
    * uses it we can insert the final value. Specifically, we can do that as soon as the
    * exporting module body execution finishes.
    *
    * The initial "var" line has to appear at its original (presumably top) level; by doing so
    * it inserts an entry directly into the correct namespace. It won't work inside a function.
    * Once the name exists though, and plain assignment in any scope which inherits the
    * original namespace is fine, so the second half is done via a callback function. It
    * doesn't make sense to do a second assingment once the module's evaluation is complete, so
    * at that point the callback handler is dummied out and any pending callbacks executed.
    *
    * On the exporting side, `export Foo` becomes:
    *
    *     module.exports.Foo = null;
    *     // Other module code...
    *     module.exports.Foo = Foo; // Original line position
    *     // Other module code...
    *
    * This ensures that the names all exist before any other code's import returns, and sets
    * the correct value once it's known. It's necessary to do this in two stages because only
    * one type of value has both its declaration and value hoisted: explicitly named functions.
    */

    src = src
        .replace(
            /\bimport ([a-zA-Z0-9_$]+?), {([^{]*?)} from ((["'`]).*?\4)/g,
            `import $1 from $3;import {$2} from $3`
        )
        .replace(
            /\bimport ([a-zA-Z0-9_$]+?), [*] as ([a-zA-Z0-9_$]+?) from ((["'`]).*?\4)/g,
            `import $1 from $3;import * as $2 from $3`
        )
        .replace(
            /\bimport [*] as ([a-zA-Z0-9_$]+?) from ((["'`]).*?\3)/g,
            `var $1;require($2).then(ns=>$1=ns)`
        )
        .replace(
            /\bimport ([a-zA-Z0-9_$]+?) from ((["'`]).*?\3)/g,
            `import {default as $1} from $2`
        )
        .replace(
            /\bimport {([^{]*?)} from ((["'`]).*?\3)/g,
            (all, $1, $2, $3) => new IdentifierList($1).importAllFrom($2)
        )
        .replace(
            /\bimport ((["'`]).*?\2)/g,
            `require($1)`
        )
    let exports_seen = 0
    const exporting = (v) => {
        exports_seen++
        return v
    }

    src = src
        .replace(
            /\bexport [*] from ((["'`]).*?\2)/g,
            (a, $1, $2) => exporting(`module.exports.exportFrom(require(${$1}))`)
        )
        .replace(
            /\bexport [{]([^{]*?)[}] from ((["'`]).*?\3)/g,
            (all, $1, $2, $3) => exporting(new IdentifierList($1).exportAllFrom($2))
        )
        .replace(
            /\bexport default +/g,
            () => exporting("module.exports.ns.default=")
        )

    /**
     * @type {string[]}
     */
    const late_exports = []
    src = src
        .replace(
            /\bexport (var|let|const) ((?:[a-zA-Z0-9_$]+(?:=[^,\n;]+)?,\s*)*[a-zA-Z0-9_$]+(?:=[^,\n;]+)?)/g,
            (all, $1, $2) => {
                late_exports.push(
                    ...$2.split(/,/).map(n => n.replace(/=.*/, "").trim())
                )
                return exporting(`${$1} ${$2}`)
            }
        )
        .replace(
            /\bexport (function|class) ([a-zA-Z0-9_$]*)/g,
            (a, $1, $2) => exporting(`module.exports.ns.${$2}=${$1} ${$2}`)
        )
        .replace(
            /\bexport {(.*?)}/g,
            (all, $1) => exporting(new IdentifierList($1).exportAll())
        )
    if(exports_seen) {
        return `module.exports=require("eximport-bridge").bridge;${src}\nmodule.exports.commit({${late_exports.map(n => `"${n}":${n}`).join(",")}});`
    } else {
        return src
    }
})
