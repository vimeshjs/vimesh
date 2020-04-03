const path = require('path')
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
function createScopedStorage(storage, bucket, prefix) {
    return {
        storage,
        bucket,
        prefix,
        putObject(filePath, data, options) {
            return storage.putObject(bucket, prefix + filePath, data, options)
        },
        getObject(filePath) {
            return storage.getObject(bucket, prefix + filePath)
        },
        getPartialObject(filePath, offset, size) {
            return storage.getPartialObject(bucket, prefix + filePath, offset, size)
        },
        deleteObject(filePath) {
            return storage.deleteObject(bucket, prefix + filePath)
        },
        statObject(filePath) {
            return storage.statObject(bucket, prefix + filePath)
        },
        copyObject(sourcePath, targetPath) {
            return storage.copyObject(bucket, prefix + sourcePath, prefix + targetPath)
        },
        listObjects(prefix2) {
            return storage.listObjects(prefix + prefix2)
        },
        getObjectAsFile(filePath, localFilePath) {
            return storage.getObjectAsFile(bucket, prefix + filePath, localFilePath)
        },
        putObjectAsFile(filePath, localFilePath, options) {
            return storage.putObjectAsFile(bucket, prefix + filePath, localFilePath, options)
        },
        getObjectAsBuffer(filePath) {
            return storage.getObjectAsBuffer(bucket, prefix + filePath)
        },
        getObjectAsString(filePath) {
            return storage.getObjectAsString(bucket, prefix + filePath)
        },
        getPartialObjectAsBuffer(filePath, offset, size) {
            return storage.getPartialObjectAsBuffer(bucket, prefix + filePath, offset, size)
        },
        getPartialObjectAsString(filePath, offset, size) {
            return storage.getPartialObjectAsString(bucket, prefix + filePath, offset, size)
        }
    }
}
function createCacheForStorage(storage, bucket, cacheDir, options) {
    options = options || {}
    return createMemoryCache({
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
                    return { size: localStat.size, md5: localStat.md5, localFilePath, meta: remoteStat.meta }
                } else {
                    return storage.getObjectAsFile(filePath, localFilePath).then(r => {
                        return getFullLocalStat(localFilePath).then(r => {
                            localStat = r
                            cached = localStat && remoteStat.size == localStat.size && (!remoteStat.md5 || remoteStat.md5 == localStat.md5)
                            return cached ? { size: localStat.size, md5: localStat.md5, localFilePath, meta: remoteStat.meta } : null
                        })
                    })
                }
            })
        }
    })
}

function createCacheForScopedStorage(scopedStorage, cacheDir, options) {
    options = options || {}
    return createMemoryCache({
        maxAge: options.maxAge || '10m',
        updateAgeOnGet: false,
        onRefresh: function (filePath) {
            let localFilePath = path.join(cacheDir, scopedStorage.prefix, filePath)
            return Promise.all([
                scopedStorage.statObject(filePath),
                getFullLocalStat(localFilePath)
            ]).then(rs => {
                let remoteStat = rs[0]
                let localStat = rs[1]
                let cached = compareLocalAndRemoteStat(localStat, remoteStat)
                if (cached) {
                    return { size: localStat.size, md5: localStat.md5, localFilePath, meta: remoteStat.meta }
                } else {
                    return scopedStorage.getObjectAsFile(filePath, localFilePath).then(r => {
                        return getFullLocalStat(localFilePath).then(r => {
                            localStat = r
                            cached = localStat && remoteStat.size == localStat.size && (!remoteStat.md5 || remoteStat.md5 == localStat.md5)
                            return cached ? { size: localStat.size, md5: localStat.md5, localFilePath, meta: remoteStat.meta } : null
                        })
                    })
                }
            })
        }
    })
}

module.exports = {
    createStorage,
    createCacheForStorage,
    createScopedStorage,
    createCacheForScopedStorage,
}