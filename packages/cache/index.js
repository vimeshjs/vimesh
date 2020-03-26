const _ = require('lodash')
const LRU = require("lru-cache")
const stringify = require('json-stable-stringify')
const { duration } = require('@vimesh/utils')
const Promise = require('bluebird')

function MemoryCache(options) {
    const max = options.maxCount || 10000
    const maxAge = duration(options.maxAge)
    const stale = options.stale
    const updateAgeOnGet = options.updateAgeOnGet || true
    this.enumList = null
    this.enumInterval = options.enumInterval
    this.enumForceReload = options.enumForceReload || false
    this.onRefresh = options.onRefresh
    this.onEnumerate = options.onEnumerate
    if (!this.onRefresh) throw Error('onRefresh() method must be provided when creating cache.')    
    this.cache = new LRU({
        maxAge,
        stale,
        max,
        updateAgeOnGet
    })
    if (this.enumInterval){
        setInterval(() => {
            if (this.onEnumerate){
                this.onEnumerate().then(rs => {
                    if (_.isArray(rs)) enumList = rs
                })
            }
        }, duration(options.enumInterval))
    }
}

MemoryCache.prototype.ensureEnumList = function() {
    if (this.onEnumerate && (this.enumForceReload || !this.enumList)){
        return this.onEnumerate().then(rs => {
            if (_.isArray(rs)) this.enumList = rs
            return Promise.resolve(this.enumList)
        }).catch(ex => {
            return Promise.resolve(this.enumList)
        })
    }
    return Promise.resolve(this.enumList)
}

MemoryCache.prototype.enumerate = function(withContent = true) {
    return this.ensureEnumList().then(rs => {
        if (!this.enumList) return Promise.resolve([])
        return Promise.all(_.map(this.enumList, key => withContent ? this.get(key) : 1)).then(rs => {
            let result = {}
            _.each(rs, (v, i) => result[this.enumList[i]] = v)
            return result
        })
    })
}

MemoryCache.prototype.get = function(keyObj) {
    const cache = this.cache
    let key = _.isString(keyObj) ? keyObj : stringify(keyObj)
    let reload = !cache.has(key)
    let val = cache.get(key)
    if (val !== undefined) {
        if (reload) { // refresh when value is stale
            this.refreshValue(keyObj).catch(ex => {
                $logger.error(`Fails to fetch value with key (key)`, ex)
            })
        }
        return Promise.resolve(val)
    } else {
        return this.refreshValue(keyObj).catch(ex => {
            $logger.error(`Fails to fetch value with key (key)`, ex)
        })
    }
}

MemoryCache.prototype.refreshValue = function (keyObj) {
    const cache = this.cache
    let key = _.isString(keyObj) ? keyObj : stringify(keyObj)
    try {
        let r = this.onRefresh(keyObj)
        if (r !== undefined) {
            if (_.isFunction(r.then)) {
                return r.then(val => {
                    cache.set(key, val)
                    return val
                })
            } else {
                cache.set(key, r)
                return Promise.resolve(r)
            }
        } else {
            return Promise.resolve(null)
        }
    } catch (ex) {
        return Promise.reject(ex)
    }
}

function createMemoryCache(options){
    return new MemoryCache(options)
}
module.exports = {
    createMemoryCache
}