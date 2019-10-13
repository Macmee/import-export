var hook = require('node-hook');

hook.hook('.js', (src, name) => {
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

  /**
   * Converts a name expression string into a map from destination names to source names.
   *
   * @param {string} identifier_list eg. "foo as bar, baz"
   * @return {object} eg. {bar:"foo",baz:"baz"}
   */
  function identifierList(identifier_list) {
    var dest_to_src = {};
    identifier_list.split(/,/).forEach(identifier => {
      var md;
      if(md = identifier.match(/(\w+) as (\w+)/)) {
        dest_to_src[md[2]] = md[1];
      } else {
        dest_to_src[identifier.trim()] = identifier.trim();;
      }
    });
    return dest_to_src;
  }

  /**
   * Returns injectable source to import the given destination-to-source
   * map of names from the given file.
   *
   * @param {string} file_quoted
   * @param {{[local_name: string]: string}} dest_to_src
   * @return {string}
   */
  function importAll(file_quoted, dest_to_src) {
    const local_names = Object.keys(dest_to_src)
    const invalid_names = local_names.filter(n => !n.match(/^\w+$/))
    if(invalid_names.length) {
      throw new Error(`Invalid import name(s): ${invalid_names}`)
    }
    const invalid_source_names = Object.values(dest_to_src).filter(n => !n.match(/^\w+$/))
    if(invalid_source_names.length) {
      throw new Error(`Invalid source name(s): ${invalid_source_names}`)
    }
    return `var ${local_names.join(",")};require(${file_quoted}).then(ns=>{${local_names.map(dest => `${dest}=ns.${dest_to_src[dest]}`).join(";")}})`
  }

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
      (all, $1, $2, $3) => importAll($2, {[$1]: "default"})
    )
    .replace(
      /\bimport {([^{]*?)} from ((["']).*?\3)/g,
      (all, $1, $2, $3) => importAll($2, identifierList($1))
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
      const names = identifierList($1)
      return `module.exports.exportFrom(require(${$2}),{` +
        Object.keys(names).map(
          name => `"${name}":"${names[name]}"`
        ).join(",") +
        `})`
    }
  )

  src = src.replace(/\bexport default +/g, () => {
    exports_seen++
    return 'module.exports.ns.default = '
  })

  var late_exports = [];
  src = src.replace(/\bexport (var|let|const) ((?:\w+(?:=[^,\n;]+)?,\s*)*\w+(?:=[^,\n;]+)?)/g, (all, $1, $2) => {
    exports_seen++
    late_exports.push(
      ...$2.split(/,/).map(n => n.replace(/=.*/, "").trim())
    );
    return `${$1} ${$2}`;
  });
  src = src.replace(
    /\bexport (function|class) ([a-zA-Z0-9_$]*)/g,
    () => {
      exports_seen++
      return 'module.exports.ns.$2=$1 $2'
    }
  );
  src = src.replace(/\bexport {(.*?)}/g, (all, $1) => {
    exports_seen++
    const names = identifierList($1)
    return Object.keys(names).map(
        k => `module.exports.ns.${k}=${names[k]}`
    ).join(";")
  })
  if(exports_seen) {
    return `module.exports=require('eximport-bridge').bridge;${src}\nmodule.exports.commit({${late_exports.map(n => `"${n}":${n}`).join(",")}});`
  } else {
    return src
  }
})