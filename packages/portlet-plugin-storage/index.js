const _ = require('lodash')

const { createStorage, createScopedStorage, createCacheForScopedStorage } = require('@vimesh/storage')

module.exports = (portlet) => {
    portlet.storages = {}
    _.each(portlet.config.storages, (sconfig, name) => {
        let storage = createStorage(sconfig)
        let bucket = sconfig.bucket || 'default'
        storage.hasBucket(bucket).then(exists => {
            if (!exists) storage.createBucket(bucket)
        })
        let scopedStorage = createScopedStorage(storage, bucket, sconfig.prefix)
        let cache = createCacheForScopedStorage(scopedStorage, sconfig.cacheDir, sconfig.cacheOptions)
        portlet.storages[name] = { storage: scopedStorage, cache }
    })
}