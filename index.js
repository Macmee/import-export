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
   * @param {string} file
   * @param {object} dest_to_src
   * @return {string}
   */
  function importAll(file, dest_to_src) {
    return `var ${Object.keys(dest_to_src).join(",")};` +
    `require("${file}").importer(ns=>{` +
    Object.keys(dest_to_src).map(dest =>
      `${dest}=ns.${dest_to_src[dest]}`
    ).join(";") +
    `})`
  }
  src = src.replace(
    /\bimport ([^{]*?) from (["'])(.*?)\2/g,
    (all, $1, $2, $3) => importAll($3, {[$1]: "default"})
  );
  src = src.replace(
    /\bimport {([^{]*?)} from (["'])(.*?)\2/g,
    (all, $1, $2, $3) => importAll($3, identifierList($1))
  );

  src = src.replace(/\bexport default +/g, 'module.exports.ns.default = ');
  src = src.replace(/\bexport (var|let|const) ([a-zA-Z0-9_$]*)/g, (all, $1, $2) => {
    return `module.exports.ns.${$2} = ${$1} ${$2}`;
  });
  src = src.replace(
    /\bexport (function|class) ([a-zA-Z0-9_$]*)/g,
    'module.exports.ns.$2 = $1 $2'
  );

  src = src.replace(/\bexport {(.*?)}/g, (all, $1) => {
    var names = identifierList($1);
    return Object.keys(names).map(
        k => `module.exports.ns.${k} = ${names[k]}`
    ).join(";");
  });
  if(src.match(/\bmodule.exports\b/)) {
    return "var importers = []; " +
      "module.exports.ns = {}; " +
      "module.exports.importer = f => importers.push(f);" +
      src + "\n" +
      "module.exports.importer = f => f(module.exports.ns);" +
      "importers.forEach(f => f(module.exports.ns));";
  } else {
    return src;
  }
});
