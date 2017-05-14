var hook = require('node-hook');

hook.hook('.js', (src, name) => {
  src = src.replace(/import ([^{]*?) from (["'])(.*?)\2/g, 'const $1 = require("$3")');
  src = src.replace(/export default ([^ ]*)/g, 'module.exports = $1');
  src = src.replace(/export (var|let|const) ([a-zA-Z0-9_$]*)/g, '$1 $2 = module.exports.$2');
  src = src.replace(/export function ([a-zA-Z0-9_$]*)/g, 'var $1 = module.exports.$1 = function');
  src = src.replace(/export class ([a-zA-Z0-9_$]*)/g, 'var $1 = module.exports.$1 = class');
  src = src.replace(/import {(.*?)} from (["'])(.*?)\2/g, (all, $1, $2, $3) => {
    return $1.split(",")
      .map(part => 'var ' + part + '= require("' + $3 + '").' + part.trim() + ';')
      .join('');
  });
  return src;
});
