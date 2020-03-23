const _ = require('lodash')
const LRU = require("lru-cache")
const stringify = require('json-stable-stringify')
const { duration } = require('@vimesh/utils')

function refreshValue(cache, keyObj, onRefresh) {
    let key = _.isString(keyObj) ? keyObj : stringify(keyObj)
    try {
        let r = onRefresh(keyObj)
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
function createMemoryCache(options) {
    const max = options.maxCount || 10000
    const maxAge = duration(options.maxAge)
    const onRefresh = options.onRefresh
    const stale = options.stale
    const updateAgeOnGet = options.updateAgeOnGet || true
    if (!onRefresh) throw Error('onRefresh() method must be provided when creating cache')
    const cache = new LRU({
        maxAge,
        stale,
        max,
        updateAgeOnGet
    })
    return {
        get(keyObj) {
            let key = _.isString(keyObj) ? keyObj : stringify(keyObj)
            let reload = !cache.has(key)
            let val = cache.get(key)
            if (val !== undefined) {
                if (reload) { // refresh when value is stale
                    refreshValue(cache, keyObj, onRefresh).catch(ex => {
                        $logger.error(`Fails to fetch value with key (key)`, ex)
                    })
                }
                return Promise.resolve(val)
            } else {
                return refreshValue(cache, keyObj, onRefresh).catch(ex => {
                    $logger.error(`Fails to fetch value with key (key)`, ex)
                })
            }
        }
    }
}

module.exports = {
    createMemoryCache
}