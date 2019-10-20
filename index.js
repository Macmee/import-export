const hook = require("node-hook")

const IdentifierList = require("./lib/identifier-list")

hook.hook(".js", (src, name) => {
    /* This modifies the source of your included Javascript files so that any
     * import/export statements become require(). See the accompanying README
     * for details.
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
            `var $1;require($2)._bridge.then(ns=>$1=ns)`
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
            (a, $1, $2) => exporting(`eximportBridge.exportFrom(require(${$1})._bridge)`)
        )
        .replace(
            /\bexport [{]([^{]*?)[}] from ((["'`]).*?\3)/g,
            (all, $1, $2, $3) => exporting(new IdentifierList($1).exportAllFrom($2))
        )
        .replace(
            /\bexport default +/g,
            () => exporting("eximportBridge.ns.default=")
        )

    /**
     * @type {string[]}
     */
    const late_exports = []
    /**
     *
     * @param {string} type
     * @param {string} names_values
     */
    function add_late_export(type, names_values) {
        for(const nv of names_values.split(/,/)) {
            const n = nv.replace(/=.*/, "").trim()
            if(n.match(/^[a-zA-Z0-9_$]+$/)) {
                late_exports.push(n)
            } else {
                throw new Error(`Invalid export name: ${n}`)
            }
        }
        return exporting(`${type} ${names_values}`)
    }
    src = src
        .replace(
            /\bexport (var|let|const) ((?:[a-zA-Z0-9_$]+(?:=[^,\n;]+)?,\s*)*[a-zA-Z0-9_$]+(?:=[^,\n;]+)?)/g,
            (all, $1, $2) => add_late_export($1, $2)
        )
        .replace(
            /\bexport (function|class) ([a-zA-Z0-9_$]*)/g,
            (a, $1, $2) => exporting(`eximportBridge.ns.${$2}=${$1} ${$2}`)
        )
        .replace(
            /\bexport {(.*?)}/g,
            (all, $1) => exporting(new IdentifierList($1).exportAll())
        )
    if(exports_seen) {
        return `let eximportBridge=require("eximport-bridge").bridge;module.exports=eximportBridge.ns;${src}\neximportBridge.commit({${late_exports.map(n => `${n}:${n}`).join(",")}});`
    } else {
        return src
    }
})
