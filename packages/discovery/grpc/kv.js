
function get(call) {
    return this.keyValueStore.get(call.request.key, { recurse: call.request.recurse }).then(r => ({ data: r }))
}
function keys(call) {
    return this.keyValueStore.keys(call.request.key).then(r => ({ keys: r }))
}
function set(call) {
    return this.keyValueStore.set(call.request.key, call.request.value)
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