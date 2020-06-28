const _ = require('lodash')
function encodeMeta(meta){
    let result = {}
    _.each(meta, (v, k) => result[k] = encodeURIComponent(v))
    return result
}

function decodeMeta(meta){
    let result = {}
    _.each(meta, (v, k) => result[k] = decodeURIComponent(v))
    return result
}

module.exports = {
    encodeMeta,
    decodeMeta
}