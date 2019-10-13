module.exports = class IdentifierList {
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
            if(md = identifier.match(/([a-zA-Z0-9_$]+) as ([a-zA-Z0-9_$]+)/)) {
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
        if(!local_name.match(/^[a-zA-Z0-9_$]+$/)) {
            throw new Error(`Invalid import name: ${local_name}`)
        }
        if(!remote_name.match(/^[a-zA-Z0-9_$]+$/)) {
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