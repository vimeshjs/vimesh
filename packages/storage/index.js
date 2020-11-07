const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const Promise = require('bluebird')
const { createMemoryCache } = require('@vimesh/cache')
const { getFullLocalStat, compareLocalAndRemoteStat } = require('./storage')
const { createLocalStorage } = require('./storage-local')
const { createMinioStorage } = require('./storage-minio')
const { createS3Storage } = require('./storage-s3')
const { getMD5 } = require('@vimesh/utils')
const writeFileAsync = Promise.promisify(fs.writeFile)

function createStorage(config) {
    switch (config.type) {
        case 'local': return createLocalStorage(config)
        case 'minio': return createMinioStorage(config)
        case 's3': return createS3Storage(config)
    }
    throw Error(`Storage type "${config.type}" is not supported`)
}
function createScopedStorage(storage, bucket, prefix) {
    prefix = prefix || ''
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
function createSmartCache(storage, bucket, prefix, cacheDir, options) {
    return createMemoryCache({
        maxAge: options.maxAge || '10m',
        updateAgeOnGet: false,
        onRefresh: function (filePath) {
            let query = null
            let pos = filePath.indexOf('?')
            let fullFilePath = null
            if (pos != -1) {
                query = {}
                _.each(filePath.substring(pos + 1).split('&'), r => {
                    let parts = r.split('=')
                    query[parts[0]] = parts.length == 1 ? true : decodeURIComponent(parts[1])
                })
                if (_.keys(query).length == 0) query = null

                fullFilePath = filePath.replace(/\?/g, '`1`').replace(/&/g, '`2`').replace(/=/g, '`3`')
                filePath = filePath.substring(0, pos)
            }
            let localFilePath = prefix ? path.join(cacheDir, prefix, filePath) : path.join(cacheDir, filePath)
            return Promise.all([
                bucket ? storage.statObject(bucket, filePath) : storage.statObject(filePath),
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
            }).then(result => {
                if (!query || !result) return result
                let localFullFilePath = prefix ? path.join(cacheDir, prefix, fullFilePath) : path.join(cacheDir, fullFilePath)

                if (query.cmd === 'image.info') {
                    return sharp(result.localFilePath).metadata().then(metadata => {
                        let json = JSON.stringify(metadata)
                        return writeFileAsync(localFullFilePath, json).then(r => {
                            let meta = { source: result }
                            meta.type = 'application/json'
                            return { size: json.length, md5: getMD5(json), localFilePath: localFullFilePath, meta }
                        })
                    })
                } else if (query.cmd === 'image.resize' || !query.cmd) {
                    let options = _.pick(query, 'fit', 'position', 'background')
                    let width = query.w || query.width || query.s || query.size
                    if (width) width = +width
                    let height = query.h || query.height || query.s || query.size
                    if (height) height = +height
                    return sharp(result.localFilePath)
                        .resize(width, height, options)
                        .toFile(localFullFilePath)
                        .then(() => {
                            return getFullLocalStat(localFullFilePath)
                        }).then(localStat => {
                            let meta = _.pick(result.meta, 'type')
                            return { size: localStat.size, md5: localStat.md5, localFilePath: localFullFilePath, meta }
                        })
                }

                return result
            })
        }
    })
}
function createCacheForStorage(storage, bucket, cacheDir, options) {
    return createSmartCache(storage, bucket, null, cacheDir, options || {})
}

function createCacheForScopedStorage(scopedStorage, cacheDir, options) {
    return createSmartCache(scopedStorage, null, scopedStorage.prefix, cacheDir, options || {})
}

module.exports = {
    createStorage,
    createCacheForStorage,
    createScopedStorage,
    createCacheForScopedStorage,
}