
const _ = require('lodash')
const util = require("util")
const { encodeMeta, decodeMeta, Storage } = require('@vimesh/storage')
const GcpCloudStorageSDK = require('@google-cloud/storage')
const { isStream, isReadableStream, getMD5, loadJson, pipeStreams } = require('@vimesh/utils')

function GcpStorage(config) {
    Storage.call(this, config)
    let options = config.options
    if (!options.keyFilename) {
        throw new Error(`Parameter "keyFilename" for a GCP storage is missing!`)
    }
    let jsonConfig = loadJson(options.keyFilename)
    let projectId = options.projectId || jsonConfig.project_id
    this.bucketPrefix = options.bucketPrefix || ''
    this.region = options.region
    this.client = new GcpCloudStorageSDK.Storage({
        projectId,
        keyFilename: options.keyFilename
    })
}

util.inherits(GcpStorage, Storage)

GcpStorage.prototype.listBuckets = function () {
    return this.client.getBuckets().then(r => {
        return _.map(r[0], bucket => bucket.name)
    })
}

GcpStorage.prototype.hasBucket = function (name) {
    return this.client.bucket(this.bucketPrefix + name).getMetadata().then(r => {
        return true
    }).catch(ex => {
        return false
    })
}

GcpStorage.prototype.createBucket = function (name, options) {
    if (!options) {
        options = {}
    }
    const methodOptions = {
        location: options.region || this.region,
        storageClass: options.storageClass
    }
    return this.client.createBucket(this.bucketPrefix + name, methodOptions)
}

GcpStorage.prototype.ensureBucket = function (name, options) {
    return this.hasBucket(name).then((exists) => {
        if (!exists) {
            return this.createBucket(bucket, options);
        }
    })
}

GcpStorage.prototype.deleteBucket = function (name) {
    return this.client.bucket(this.bucketPrefix + name).delete().catch(ex => {
        if (ex.code != 404) return Promise.reject(ex)
    })
}

function PutObjectMethodOptions(options) {
    const methodOptions = {}

    // If no other options...
    if (!options) {
        return methodOptions
    }

    // Metadata
    if (options.meta) {
        methodOptions.metadata = {}

        for (const key in options.meta) {
            if (!options.meta.hasOwnProperty(key)) {
                continue
            }

            const keyLowerCase = key.toLowerCase()
            switch (keyLowerCase) {
                case 'cache-control':
                    methodOptions.cacheControl = options.meta[key]
                    break
                case 'content-disposition':
                    methodOptions.contentDisposition = options.meta[key]
                    break
                case 'content-encoding':
                    methodOptions.contentEncoding = options.meta[key]
                    break
                case 'content-language':
                    methodOptions.contentLanguage = options.meta[key]
                    break
                case 'content-md5':
                    methodOptions.contentMD5 = options.meta[key]
                    break
                case 'content-type':
                    methodOptions.contentType = options.meta[key]
                    break
                default:
                    methodOptions.metadata[key] = options.meta[key]
                    break
            }
        }
    }

    return methodOptions
}

GcpStorage.prototype.putObject = function (bucketName, filePath, data, options) {
    if (!options) options = {}
    if (!options.meta) options.meta = {}
    if (!isStream(data)) options.meta.md5 = getMD5(data)

    const bucket = this.client.bucket(this.bucketPrefix + bucketName)
    const blob = bucket.file(filePath)
    if (isStream(data)) {
        if (isReadableStream(data)) {
            return pipeStreams(data, blob.createWriteStream()).then(r => {
                blob.setMetadata(PutObjectMethodOptions(options))
            })
        } else {
            return Promise.reject(Error(`Stream data must be readable to put into ${bucket}/${filePath}`))
        }
    } else {
        return new Promise((resolve, reject) => {
            const stream = blob.createWriteStream()
            stream.on('error', err => {
                reject(err);
            })
            stream.on('finish', () => {
                blob.setMetadata(PutObjectMethodOptions(options))
                resolve()
            })
            stream.end(data)
        })
    }
}

GcpStorage.prototype.getObject = function (bucketName, filePath) {
    return this.statObject(bucketName, filePath).then(r => {
        const bucket = this.client.bucket(this.bucketPrefix + bucketName)
        const blob = bucket.file(filePath)
        return Promise.resolve(blob.createReadStream())
    })
}

GcpStorage.prototype.getPartialObject = function (bucketName, filePath, offset, size) {
    const bucket = this.client.bucket(this.bucketPrefix + bucketName)
    const blob = bucket.file(filePath)
    if (undefined === offset) offset = 0
    const options = {
        start: offset
    }
    if (size)
        options.end = offset + size - 1
    return Promise.resolve(blob.createReadStream(options))
}

GcpStorage.prototype.deleteObject = function (bucketName, filePath) {
    const bucket = this.client.bucket(this.bucketPrefix + bucketName)
    const blob = bucket.file(filePath)
    return blob.delete().catch(ex => {
        if (ex.code != 404) return Promise.reject(ex)
    })
}

GcpStorage.prototype.statObject = function (bucketName, filePath) {
    const bucket = this.client.bucket(this.bucketPrefix + bucketName)
    const blob = bucket.file(filePath)
    return blob.getMetadata().then(r => {
        let resp = r[0]
        let meta = decodeMeta(resp.metadata)
        if (resp.contentType)
            meta['content-type'] = resp.contentType
        if (resp.cacheControl)
            meta['cache-control'] = resp.cacheControl
        if (resp.contentDisposition)
            meta['content-disposition'] = resp.contentDisposition
        if (resp.contentEncoding)
            meta['content-encoding'] = resp.contentEncoding
        if (resp.contentLanguage)
            meta['content-language'] = resp.contentLanguage
        if (resp.md5Hash)
            meta['content-md5'] = resp.md5Hash
        return { path: filePath, size: +resp.size, modifiedAt: new Date(resp.updated), meta }
    })
}

GcpStorage.prototype.copyObject = function (sourceBucket, sourcePath, targetBucket, targetPath) {
    if (targetPath === undefined) {
        targetPath = targetBucket
        targetBucket = sourceBucket
    }
    return this.client
        .bucket(this.bucketPrefix + sourceBucket)
        .file(sourcePath)
        .copy(this.client.bucket(this.bucketPrefix + targetBucket).file(targetPath))
}

GcpStorage.prototype.moveObject = function (sourceBucket, sourcePath, targetBucket, targetPath) {
    if (targetPath === undefined) {
        targetPath = targetBucket
        targetBucket = sourceBucket
    }
    return this.client
        .bucket(this.bucketPrefix + sourceBucket)
        .file(sourcePath)
        .move(this.client.bucket(this.bucketPrefix + targetBucket).file(targetPath))
}

GcpStorage.prototype.listObjects = function (bucket, prefix) {
    const methodOptions = {
        prefix: prefix,
        //delimiter: '/'
    }

    return this.client.bucket(this.bucketPrefix + bucket).getFiles(methodOptions).then(r => {
        return _.map(r[0], file => {
            return {
                modifiedAt: new Date(file.metadata.updated),
                path: file.name,
                size: file.metadata.size
            }
        })
    }).catch(ex => {
        return []
    })
}

module.exports = (config) => {
    return new GcpStorage(config)
}