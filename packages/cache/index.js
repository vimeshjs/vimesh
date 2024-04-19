const _ = require('lodash')
const stringify = require('json-stable-stringify')
const { duration } = require('@vimesh/utils')
const Promise = require('bluebird')

function MemoryCache(options) {
    this.max = options.maxCount || 10000
    this.maxAge = duration(options.maxAge)
    this.stale = options.stale
    this.updateAgeOnGet = options.updateAgeOnGet
    this.enumList = null
    this.enumInterval = options.enumInterval
    this.enumForceReload = options.enumForceReload
    this.onRefresh = options.onRefresh
    this.onEnumerate = options.onEnumerate
    if (!this.onRefresh) throw Error('onRefresh() method must be provided when creating cache.')
    this.cache = {}
    if (this.enumInterval) {
        setInterval(() => {
            if (this.onEnumerate) {
                this.onEnumerate().then(rs => {
                    if (_.isArray(rs)) enumList = rs
                })
            }
        }, duration(options.enumInterval))
    }
}

MemoryCache.prototype.ensureEnumList = function () {
    if (this.onEnumerate && (this.enumForceReload || !this.enumList)) {
        return this.onEnumerate().then(rs => {
            if (_.isArray(rs)) this.enumList = rs
            return Promise.resolve(this.enumList)
        }).catch(ex => {
            return Promise.resolve(this.enumList)
        })
    }
    return Promise.resolve(this.enumList)
}

MemoryCache.prototype.enumerate = function (withContent = true) {
    return this.ensureEnumList().then(rs => {
        if (!this.enumList) return Promise.resolve([])
        return Promise.all(_.map(this.enumList, key => withContent ? this.get(key) : 1)).then(rs => {
            let result = {}
            _.each(rs, (v, i) => result[this.enumList[i]] = v)
            return result
        })
    })
}

MemoryCache.prototype.get = function (keyObj) {
    const cache = this.cache
    let key = _.isString(keyObj) ? keyObj : stringify(keyObj)
    let val = cache[key]
    if (val !== undefined) {
        if (val.at + this.maxAge < new Date().valueOf()) { 
            let nval = this.refreshValue(keyObj).catch(ex => {
                $logger.error(`Fails to fetch value with key (${keyObj})`, ex)
            })
            if (!this.stale) return nval
        }
        return Promise.resolve(val.value)
    } else {
        return this.refreshValue(keyObj).catch(ex => {
            $logger.error(`Fails to fetch value with key (${keyObj})`, ex)
        })
    }
}

MemoryCache.prototype.refreshValue = function (keyObj) {
    const cache = this.cache
    let key = _.isString(keyObj) ? keyObj : stringify(keyObj)
    try {
        let r = this.onRefresh(keyObj)
        if (r !== undefined) {
            if (_.isFunction(r && r.then)) {
                return r.then(val => {
                    cache[key] = { value: val, at: new Date().valueOf() }
                    return val
                })
            } else {
                cache[key] = { value: r, at: new Date().valueOf() }
                return Promise.resolve(r)
            }
        } else {
            return Promise.resolve(null)
        }
    } catch (ex) {
        return Promise.reject(ex)
    }
}

function createMemoryCache(options) {
    return new MemoryCache(options)
}
module.exports = {
    createMemoryCache
}