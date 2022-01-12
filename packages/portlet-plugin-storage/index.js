const _ = require('lodash')
const path = require('path')

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
        portlet.storages[name] = {
            storage: scopedStorage,
            cache,
            upload(uploadedFile, targetPath) {
                let localFilePath = uploadedFile.path
                let fid = path.basename(localFilePath)
                let meta = _.pick(uploadedFile, 'name', 'type', 'size')
                if (!targetPath) targetPath = `.tmp/${fid}`
                return scopedStorage.putObjectAsFile(targetPath, localFilePath, { meta }).then(r => {
                    return _.merge({ path: targetPath }, meta)
                })
            },
            download(filePath, res) {
                return cache.get(filePath).then(stat => {
                    if (!stat || !stat.localFilePath) return null
                    if (res) {
                        if (stat.meta && stat.meta.type) res.set('Content-Type', stat.meta.type)
                        res.sendFile(stat.localFilePath)
                    }
                    return _.merge({ path: stat.localFilePath }, stat.meta)
                })
            },
            move(srcPath, dstPath) {
                return scopedStorage.moveObject(srcPath, dstPath)
            }
        }
    })
}