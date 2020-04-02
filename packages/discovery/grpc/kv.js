const { duration } = require('@vimesh/utils')

function get(call) {
    return this.keyValueStore.get(call.request.key).then(r => ({ data: r }))
}
function keys(call) {
    return this.keyValueStore.keys(call.request.key).then(r => ({ keys: r }))
}
function set(call) {
    let options = {}
    if (call.request.duration) {
        options.expires = new Date(duration(call.request.duration) + Date.now())
    }
    return this.keyValueStore.set(call.request.key, call.request.value, options)
}
function del(call) {
    return this.keyValueStore.del(call.request.key)
}
module.exports = {
    get,
    keys,
    set,
    del
}