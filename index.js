var hook = require('node-hook');

hook.hook('.js', (src, name) => {
  var seen_names = {};
  src = src.replace(/import ([^{]*?) from (["'])(.*?)\2/g, (all, $1, $2, $3) => {
    seen_names[$1.trim()] = $3;
    return `imported["${$3}"] = require("${$3}")`;
  });
  src = src.replace(/export default ([^ ]*)/g, 'module.exports = $1');
  src = src.replace(/export (var|let|const) ([a-zA-Z0-9_$]*)/g, '$1 $2 = module.exports.$2');
  src = src.replace(/export function ([a-zA-Z0-9_$]*)/g, 'var $1 = module.exports.$1 = function');
  src = src.replace(/export class ([a-zA-Z0-9_$]*)/g, 'var $1 = module.exports.$1 = class');
  src = src.replace(/export {(.*?)}/g, (all, $1) => {
    return $1.split(/,/).map(name => `module.exports.${name.trim()} = ${name.trim()}`).join(";");
  });
  src = src.replace(/import {(.*?)} from (["'])(.*?)\2/g, (all, $1, $2, $3) => {
    $1.split(",").forEach(name => {
        seen_names[name.trim()] = $3;
    });
    return `imported["${$3}"] = require("${$3}")`;
  });
  // Ultimately we want AST parsing but this will work in most cases.
  Object.keys(seen_names).forEach(name => {
    src = src.replace(new RegExp(`\\b${name}\\b`, "g"), `imported["${seen_names[name]}"].${name}`)
  });
  return "var imported = {};" + src;
});
