const path = require('path')
const fs = require('graceful-fs')
const Promise = require('bluebird')
const { createMemoryCache } = require('@vimesh/cache')
const { getFullLocalStat, compareLocalAndRemoteStat } = require('./storage')
const { createLocalStorage } = require('./storage-local')
const { createMinioStorage } = require('./storage-minio')

function createStorage(config) {
    switch (config.type) {
        case 'local': return createLocalStorage(config)
        case 'minio': return createMinioStorage(config)
    }
    throw Error(`Storage type "${config.type}" is not supported`)
}

function setupFileDownloadMiddleware(app, urlPath, storage, bucket, cacheDir, options) {
    options = options || {}
    let cache = createMemoryCache({
        maxAge: options.maxAge || '10m',
        updateAgeOnGet: false,
        onRefresh: function (filePath) {
            let localFilePath = path.join(cacheDir, filePath)
            return Promise.all([
                storage.statObject(bucket, filePath),
                getFullLocalStat(localFilePath)
            ]).then(rs => {
                let remoteStat = rs[0]
                let localStat = rs[1]
                let cached = compareLocalAndRemoteStat(localStat, remoteStat)
                if (cached) {
                    return { size: localStat.size, md5: localStat.md5, localFilePath }
                } else {
                    return storage.getObjectAsFile(bucket, filePath, localFilePath).then(r => {
                        return getFullLocalStat(localFilePath).then(r => {
                            localStat = r
                            cached = localStat && remoteStat.size == localStat.size && (!remoteStat.md5 || remoteStat.md5 == localStat.md5)
                            return cached ? { size: localStat.size, md5: localStat.md5, localFilePath } : null
                        })
                    })
                }
            })
        }
    })
    app.get(`${urlPath}/*`, function (req, res, next) {
        let filePath = path.relative(`${urlPath}/`, req.path)
        cache.get(filePath).then(stat => {
            if (!stat || !stat.localFilePath) return next()
            res.sendFile(stat.localFilePath)
        })
    })
}

module.exports = {
    createStorage,
    setupFileDownloadMiddleware
}