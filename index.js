var hook = require('node-hook');

hook.hook('.js', (src, name) => {
  var seen_names = {};
  src = src.replace(/\bimport ([^{]*?) from (["'])(.*?)\2/g, (all, $1, $2, $3) => {
    seen_names[$1.trim()] = $3;
    return `imported["${$3}"] = require("${$3}").ns`;
  });
  src = src.replace(/\bexport default +/g, 'module.exports.ns = ');
  src = src.replace(/\bexport (var|let|const) ([a-zA-Z0-9_$]*)/g, '$1 $2 = module.exports.ns.$2');
  src = src.replace(
    /\bexport (function|class) ([a-zA-Z0-9_$]*)/g,
    'var $2 = module.exports.ns.$2 = $1'
);
  src = src.replace(/\bexport {(.*?)}/g, (all, $1) => {
    var names = $1.split(/,/);
    return names.map(
        name => `module.exports.ns.${name.trim()} = ${names[name.trim()]}`
    ).join(";");
  src = src.replace(/\bimport {(.*?)} from (["'])(.*?)\2/g, (all, $1, $2, $3) => {
    $1.split(",").forEach(name => {
        seen_names[name.trim()] = $3;
    });
    return `imported["${$3}"] = require("${$3}").ns`;
  });
  // Ultimately we want AST parsing but this will work in most cases.
  Object.keys(seen_names).forEach(name => {
    src = src.replace(new RegExp(`\\b${name}\\b`, "g"), `imported["${seen_names[name]}"].${name}`)
  });
  return "var imported = {};" + src;
});
