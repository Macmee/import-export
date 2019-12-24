const hook = require("node-hook")

const IdentifierList = require("./lib/identifier-list")

const DEBUG = false

hook.hook(".js", (src, name) => {
    /* This modifies the source of your included Javascript files so that any
     * import/export statements become require(). See the accompanying README
     * for details.
     */

    /** @type {(?string)[]} */
    const exports_seen = []
    /**
     * @param {string} v
     * @param {(string|null)[]} names
     */
    const exporting = (v, names) => {
        exports_seen.push(...names)
        return v
    }

    src = src
        .replace(
            /\bexport [*] from ((["'`]).*?\2)/g,
            (a, $1) => exporting(`eximportBridge.exportFrom(require(${$1})._bridge)`, [null])
        )
        .replace(
            /\bexport [{]([^{]*?)[}] from ((["'`]).*?\3)/g,
            (a, $1, $2) => {
                const il = new IdentifierList($1)
                return exporting(il.exportAllFrom($2), Object.keys(il.destToSrc))
            }
        )
        .replace(
            /\bexport default +/g,
            () => exporting("yield eximportBridge.ns.default=", ["default"])
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
        const new_late_exports = []
        for(const nv of names_values.split(/,/)) {
            const n = nv.replace(/=.*/, "").trim()
            if(n.match(/^[a-zA-Z0-9_$]+$/)) {
                new_late_exports.push(n)
            } else {
                throw new Error(`Invalid export name: ${n}`)
            }
        }
        late_exports.push(...new_late_exports)
        return exporting(`${type} ${names_values}`, new_late_exports)
    }
    src = src
        .replace(
            /\bexport (var|let|const) ((?:[a-zA-Z0-9_$]+(?:=[^,\n;]+)?,\s*)*[a-zA-Z0-9_$]+(?:=[^,\n;]+)?)/g,
            (a, $1, $2) => add_late_export($1, $2)
        )
        .replace(
            /\bexport (function|class) ([a-zA-Z0-9_$]*)/g,
            (a, $1, $2) => exporting(`let ${$2};yield eximportBridge.ns.${$2}=${$2}=${$1}`, [$2])
        )
        .replace(
            /\bexport {(.*?)}/g,
            (a, $1) => {
                const il = new IdentifierList($1)
                return exporting(il.exportAll(), Object.keys(il.destToSrc))
            }
        )
    let with_imports = 0
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
            exports_seen.length ? `var $1 = require($2)._bridge.ns;yield` : `var $1 = require($2)._bridge.ns`
        )
        .replace(
            /\bimport ([a-zA-Z0-9_$]+?) from ((["'`]).*?\3)/g,
            `import {default as $1} from $2`
        )
        .replace(
            /\bimport {([^{]*?)} from ((["'`]).*?\3)/g,
            (a, $1, $2) => {
                with_imports++
                return exports_seen.length ?
                    new IdentifierList($1).importAllFrom($2) + ";yield" :
                    new IdentifierList($1).importAllFrom($2)
            }
        )
        .replace(
            /\bimport ((["'`]).*?\2)/g,
            exports_seen.length ?
                `{const b = require($1)._bridge;yield;b.finish()}` :
                `require($1)._bridge.finish()`
        )
    src += "}".repeat(with_imports)

    if(exports_seen.length) {
        const commit_src = late_exports.length ?
            `${src};eximportBridge.commit({${late_exports.map(n => `${n}:${n}`).join(",")}})` :
            src
        const out = `const eximportBridge=require("eximport-bridge").prepareBridge(${JSON.stringify(exports_seen)});module.exports=eximportBridge.ns;eximportBridge.execute(function* () {${commit_src}})`
        if(DEBUG) {
            console.log(out.replace(/^/gm, "> "))
        }
        return out
    } else {
        return src
    }
})
