const { sanitizeJsonToString } = require('./xss')
function block(name) {
    if (this._blocks && this._blocks[name]) {
        return this._blocks[name].join('\n')
    }
}
function contentFor(name, options) {
    if (!this._blocks) this._blocks = {}
    if (!this._blocks[name]) this._blocks[name] = []
    this._blocks[name].push(options.fn(name))
}
function json(js, options) {
    var name = options.hash.name || '?'
    var val = null;
    val = js == null ? "null" : sanitizeJsonToString(js)
    return `
    <script type="text/javascript">
    var ${name} = ${val}
    </script>
`
}

module.exports = {
    contentFor,
    content: contentFor,
    block,
    json
}