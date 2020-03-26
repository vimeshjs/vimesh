const { sanitizeJsonToString } = require('./xss')
function img(msg) {
    return `<img>${msg}</img>`
}

function json(context, options) {
    var name = options.hash.name || '?'
    var val = null;
    val = context == null ? "null" : sanitizeJsonToString(context)
    return `
    <script type="text/javascript">
    var ${name} = ${val}
    </script>
`
}

module.exports = {
    img,
    json
}