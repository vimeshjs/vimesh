const _ = require('lodash')

function MemoryKeyValueStore() {
    this.all = {}
    setInterval(() => {
        this.clean()
    }, 1000)
}

MemoryKeyValueStore.prototype.clean = function(){
    let keysToRemove = []
    _.each(this.all, (v, k) => {       
        if (v.expires && v.expires.valueOf() < Date.now()) 
            keysToRemove.push(k)
    })
    if (keysToRemove.length > 0){
        this.all = _.omit(this.all, keysToRemove)
    }
}

MemoryKeyValueStore.prototype.get = function (key) {
    key = _.trim(key)
    let results = {}
    if (_.endsWith(key, '*')) {
        key = _.trimEnd(key, '*')
        let ks = _.filter(_.keys(this.all), item => item.indexOf(key) == 0)
        results = _.pick(this.all, ks)
    } else {
        if (this.all[key]) {
            results[key] = this.all[key]
        }
    }
    _.each(_.keys(results), k => results[k] = results[k].value)
    return Promise.resolve(results)
}

MemoryKeyValueStore.prototype.keys = function (key) {
    let ks = _.filter(_.keys(this.all), item => item.indexOf(key) == 0)
    return Promise.resolve(ks)
}

MemoryKeyValueStore.prototype.set = function (key, value, options) {
    let data = this.all[key] = { value }
    if (options.expires) data.expires = options.expires
    return Promise.resolve(true)
}

MemoryKeyValueStore.prototype.del = function (key) {
    delete this.all[key]
    return Promise.resolve(true)
}

module.exports = {
    MemoryKeyValueStore
}