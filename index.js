const hook = require("node-hook")

class IdentifierList {
  /**
   * Converts a name expression string into a map from destination names to source names.
   *
   * @param {string} identifier_list eg. "foo as bar, baz"
   */
  constructor(identifier_list) {
    /**
     * @type {{[local_name: string]: string}}
     */
    this.destToSrc = {}
    for(const identifier of identifier_list.split(/,/)) {
      let md
      if(md = identifier.match(/(\w+) as (\w+)/)) {
        this.add(md[2], md[1])
      } else {
        this.add(identifier.trim(), identifier.trim())
      }
    }
  }
  /**
   *
   * @param {string} local_name
   * @param {string} remote_name
   * @throws
   */
  add(local_name, remote_name) {
    if(!local_name.match(/^\w+$/)) {
      throw new Error(`Invalid import name: ${local_name}`)
    }
    if(!remote_name.match(/^\w+$/)) {
      throw new Error(`Invalid export name: ${remote_name}`)
    }
    this.destToSrc[local_name] = remote_name
  }
  exportAll() {
    return Object.keys(this.destToSrc).map(
      k => `module.exports.ns.${k}=${this.destToSrc[k]}`
    ).join(";")
  }
  /**
   * Returns injectable source to export the given destination-to-source
   * map of names from the given file.
   *
   * @param {string} file_quoted
   * @return {string}
   */
  exportAllFrom(file_quoted) {
    const local_names = Object.keys(this.destToSrc)
    return `module.exports.exportFrom(require(${file_quoted}),{${local_names.map(name => `${name}:"${this.destToSrc[name]}"`).join(",")}})`
  }
  /**
   * Returns injectable source to import the given destination-to-source
   * map of names from the given file.
   *
   * @param {string} file_quoted
   * @return {string}
   */
  importAllFrom(file_quoted) {
    const local_names = Object.keys(this.destToSrc)
    return `var ${local_names.join(",")};require(${file_quoted}).then(ns=>{${local_names.map(dest => `${dest}=ns.${this.destToSrc[dest]}`).join(";")}})`
  }
}

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
      /\bimport (\w+?), {([^{]*?)} from ((["']).*?\4)/g,
      `import $1 from $3;import {$2} from $3`
    )
    .replace(
      /\bimport (\w+?), [*] as (\w+?) from ((["']).*?\4)/g,
      `import $1 from $3;import * as $2 from $3`
    )
    .replace(
      /\bimport [*] as (\w+?) from ((["']).*?\3)/g,
      `var $1;require($2).then(ns=>$1=ns)`
    )
    .replace(
      /\bimport (\w+?) from ((["']).*?\3)/g,
      `import {default as $1} from $2`
    )
    .replace(
      /\bimport {([^{]*?)} from ((["']).*?\3)/g,
      (all, $1, $2, $3) => new IdentifierList($1).importAllFrom($2)
    )
    .replace(
      /\bimport ((["']).*?\2)/g,
      `require($1)`
    )
  let exports_seen = 0

  src = src.replace(
    /\bexport [*] from ((["']).*?\2)/g,
    (a, $1, $2) => {
      exports_seen++
      return `module.exports.exportFrom(require(${$1}))`
    },
  )
  src = src.replace(
    /\bexport [{]([^{]*?)[}] from ((["']).*?\3)/g,
    (all, $1, $2, $3) => {
      exports_seen++
      return new IdentifierList($1).exportAllFrom($2)
    }
  )

  src = src.replace(/\bexport default +/g, () => {
    exports_seen++
    return "module.exports.ns.default="
  })

  /**
   * @type {string[]}
   */
  const late_exports = []
  src = src
    .replace(
      /\bexport (var|let|const) ((?:\w+(?:=[^,\n;]+)?,\s*)*\w+(?:=[^,\n;]+)?)/g,
      (all, $1, $2) => {
        exports_seen++
        late_exports.push(
          ...$2.split(/,/).map(n => n.replace(/=.*/, "").trim())
        )
        return `${$1} ${$2}`
      }
    )
    .replace(
      /\bexport (function|class) ([a-zA-Z0-9_$]*)/g,
      () => {
        exports_seen++
        return "module.exports.ns.$2=$1 $2"
      }
    )
    .replace(
      /\bexport {(.*?)}/g,
      (all, $1) => {
        exports_seen++
        return new IdentifierList($1).exportAll()
      }
    )
  if(exports_seen) {
    return `module.exports=require("eximport-bridge").bridge;${src}\nmodule.exports.commit({${late_exports.map(n => `"${n}":${n}`).join(",")}});`
  } else {
    return src
  }
})