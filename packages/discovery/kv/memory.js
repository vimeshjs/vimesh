const _ = require('lodash')

function MemoryKeyValueStore(){
    this.all = {}
}

MemoryKeyValueStore.prototype.get = function(key, options){
    let results = {}
    if (options && options.recurse){
        let ks = _.filter(_.keys(this.all), item => item.indexOf(key) == 0)
        results = _.pick(this.all, ks)
    } else {
        if (this.all[key]){
            results[key] = this.all[key] 
        }
    }
    return Promise.resolve(results)
}

MemoryKeyValueStore.prototype.keys = function(key){
    let ks = _.filter(_.keys(this.all), item => item.indexOf(key) == 0)
    return Promise.resolve(ks)
}

MemoryKeyValueStore.prototype.set = function(key, value){
    this.all[key] = value
    return Promise.resolve(true)
}

MemoryKeyValueStore.prototype.del = function(key){
    delete this.all[key] 
    return Promise.resolve(true)
}

module.exports = {
    MemoryKeyValueStore
}