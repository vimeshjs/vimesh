
const _ = require('lodash')
const util = require("util")
const { encodeMeta, decodeMeta } = require('./meta')
const Azure = require('azure-storage')
const { Storage } = require('./storage')
const { isStream, getMD5 } = require('@vimesh/utils')
const { Stream, Transform } = require('stream')

function AzureStorage(config) {
    Storage.call(this, config)
    let options = config.options
    this.client = Azure.createBlobService(options.connection)
}

util.inherits(AzureStorage, Storage)

AzureStorage.prototype.listBuckets = function () {
    const resultList = []

    const requestPromise = (continuationToken) => {
        return new Promise((resolve, reject) => {
            this.client.listContainersSegmented(continuationToken, (err, response) => {
                if (err) {
                    return reject(err)
                }

                if (!response.entries || !Array.isArray(response.entries)) {
                    throw Error('Response does not contain an entries array')
                }
                for (const i in response.entries) {
                    if (response.entries.hasOwnProperty(i)) {
                        const e = response.entries[i]
                        if (!e || !e.name) {
                            throw Error('Invalid entry')
                        }
                        resultList.push(e.name)
                    }
                }

                if (response.continuationToken) {
                    resolve(requestPromise(response.continuationToken))
                }
                else {
                    resolve(resultList)
                }
            })
        })
    }

    return requestPromise(null)
}

AzureStorage.prototype.hasBucket = function (name) {
    return new Promise((resolve, reject) => {
        this.client.getContainerProperties(name, (err, response) => {
            if (err) {
                return err.toString().match(/NotFound/) ?
                    resolve(false) :
                    reject(err)
            }
            else if (response && response.name) {
                return resolve(true)
            }
            else {
                throw Error('Response does not contain storage account name')
            }
        })
    })
}

AzureStorage.prototype.createBucket = function (name, options) {
    return this._createContainerInternal(name, false, options).then(() => {
        return
    })
}

AzureStorage.prototype.ensureBucket = function (name, options) {
    return this._createContainerInternal(name, true, options).then(() => {
        return
    })
}

AzureStorage.prototype.deleteBucket = function (name) {
    return new Promise((resolve, reject) => {
        this.client.deleteContainer(name, (err, response) => {
            if (err) {
                return reject(err)
            }
            else if (!response || !response.isSuccessful) {
                throw Error('Response was empty or not successful')
            }
            else {
                return resolve()
            }
        })
    })
}

function PutObjectRequestOptions(options) {
    const requestOptions = {
        contentSettings: {},
        metadata: {}
    }
    if (!options) {
        return requestOptions
    }

    if (options.meta) {
        requestOptions.metadata = {}

        for (const key in options.meta) {
            if (!options.meta.hasOwnProperty(key)) {
                continue
            }

            const keyLowerCase = key.toLowerCase()
            switch (keyLowerCase) {
                case 'cache-control':
                    requestOptions.contentSettings.cacheControl = options.meta[key]
                    break
                case 'content-disposition':
                    requestOptions.contentSettings.contentDisposition = options.meta[key]
                    break
                case 'content-encoding':
                    requestOptions.contentSettings.contentEncoding = options.meta[key]
                    break
                case 'content-language':
                    requestOptions.contentSettings.contentLanguage = options.meta[key]
                    break
                case 'content-md5':
                    requestOptions.contentSettings.contentMD5 = options.meta[key]
                    break
                case 'content-type':
                    requestOptions.contentSettings.contentType = options.meta[key]
                    break
                default:
                    requestOptions.metadata[key] = options.meta[key]
                    break
            }
        }
    }

    if (requestOptions.metadata)
        requestOptions.metadata = encodeMeta(requestOptions.metadata)
    return requestOptions
}


AzureStorage.prototype.putObject = function (bucket, filePath, data, options) {
    if (!data) {
        throw Error('Argument data is empty')
    }

    const requestOptions = PutObjectRequestOptions(options)

    return new Promise((resolve, reject) => {
        const callback = (err, response) => {
            if (err) {
                return reject(err)
            }
            if (!response || (!response.name && !response.commmittedBlocks)) {
                throw Error('Response was empty or not successful')
            }
            else {
                return resolve()
            }
        }

        if (typeof data == 'object' && typeof data.pipe == 'function') {
            data.pipe(this.client.createWriteStreamToBlockBlob(bucket, filePath, requestOptions, callback))
        } else if (typeof data == 'string' || (typeof data == 'object' && Buffer.isBuffer(data))) {
            this.client.createBlockBlobFromText(bucket, filePath, data, requestOptions, callback)
        } else {
            throw Error('Argument data must be a Stream, a String or a Buffer')
        }
    })
}

AzureStorage.prototype.getObject = function (bucket, filePath) {
    return new Promise((resolve, reject) => {
        const duplexStream = new Transform({
            transform: (chunk, encoding, done) => {
                done(null, chunk)
            }
        })
        this.client.getBlobToStream(bucket, filePath, duplexStream, (err, response) => {
            if (err) {
                return reject(err)
            }
            resolve(duplexStream)
        })
    })
}

AzureStorage.prototype.getPartialObject = function (bucket, filePath, offset, size) {
    return new Promise((resolve, reject) => {
        const duplexStream = new Transform({
            transform: (chunk, encoding, done) => {
                done(null, chunk)
            }
        })
        let options = { rangeStart: offset }
        if (size) options.rangeEnd = offset + size - 1
        this.client.getBlobToStream(bucket, filePath, duplexStream, options, (err, response) => {
            if (err) {
                return reject(err)
            }
            resolve(duplexStream)
        })
    })
}

AzureStorage.prototype.deleteObject = function (bucket, filePath) {
    return new Promise((resolve, reject) => {
        this.client.deleteBlob(bucket, filePath, (err, response) => {
            if (err) {
                return reject(err)
            }
            else if (!response || !response.isSuccessful) {
                throw Error('Response was empty or not successful')
            }
            else {
                return resolve()
            }
        })
    })
}

AzureStorage.prototype.statObject = function (bucket, filePath) {
    return new Promise((resolve, reject) => {
        this.client.getBlobProperties(bucket, filePath, (err, resp) => {
            if (err) {
                return reject(err)
            }
            let meta = decodeMeta(resp.metadata)
            if (resp.contentSettings.contentType)
                meta['content-type'] = resp.contentSettings.contentType
            if (resp.contentSettings.cacheControl)
                meta['cache-control'] = resp.contentSettings.cacheControl
            if (resp.contentSettings.contentDisposition)
                meta['content-disposition'] = resp.contentSettings.contentDisposition
            if (resp.contentSettings.contentEncoding)
                meta['content-encoding'] = resp.contentSettings.contentEncoding
            if (resp.contentSettings.contentLanguage)
                meta['content-language'] = resp.contentSettings.contentLanguage
            if (resp.contentSettings.contentMD5)
                meta['content-md5'] = resp.contentSettings.contentMD5
            resolve({ path: filePath, size: +resp.contentLength, modifiedAt: new Date(resp.lastModified), meta })
        })
    })
}

AzureStorage.prototype.copyObject = function (sourceBucket, sourcePath, targetBucket, targetPath) {
    if (targetPath === undefined) {
        targetPath = targetBucket
        targetBucket = sourceBucket
    }
    let sasToken = this.client.generateSharedAccessSignature(sourceBucket, sourcePath, {
        AccessPolicy: {
            Expiry : Azure.date.minutesFromNow(60),
            Permissions: Azure.BlobUtilities.SharedAccessPermissions.READ
        }
    })
    let sasUrl = this.client.getUrl(sourceBucket, sourcePath, sasToken, true)
    return new Promise((resolve, reject) => {
        this.client.startCopyBlob(sasUrl, targetBucket, targetPath, (err, r) => {
            if (err)
                return reject(err)
            resolve()
        })
    })
}

AzureStorage.prototype.listObjects = function (bucket, prefix) {
    const resultList = []

    const requestPromise = (continuationToken) => {
        return new Promise((resolve, reject) => {

            this.client.listBlobsSegmentedWithPrefix(bucket, prefix || null, continuationToken, { delimiter: '/' }, (err, response) => {
                if (err) {
                    return reject(err)
                }

                for (const i in response.entries) {
                    if (response.entries.hasOwnProperty(i)) {
                        const e = response.entries[i]

                        // Is this a prefix (folder) or object? If etag is present, it's an object
                        if (e.etag) {
                            const res = {
                                createdAt: e.creationTime ? new Date(e.creationTime) : undefined,
                                modifiedAt: e.lastModified ? new Date(e.lastModified) : undefined,
                                path: e.name,
                                size: +e.contentLength
                            }
                            if (e.contentSettings && e.contentSettings.contentMD5) {
                                res.contentMD5 = Buffer.from(e.contentSettings.contentMD5, 'base64').toString('hex')
                            }
                            if (e.contentSettings && e.contentSettings.contentType) {
                                res.contentType = e.contentSettings.contentType
                            }
                            resultList.push(res)
                        }
                    }
                }

                if (response.continuationToken) {
                    resolve(requestPromise(response.continuationToken))
                }
                else {
                    resolve(resultList)
                }
            })
        })
    }
    return requestPromise(null)
}

AzureStorage.prototype._createContainerInternal = function (container, ifNotExists, options) {
    return new Promise((resolve, reject) => {
        const containerOpts = {
            publicAccessLevel: null
        }
        if (options && options.access) {
            if (options.access == 'blob') {
                containerOpts.publicAccessLevel = 'blob'
            }
            else if (options.access == 'container' || options.access == 'public') {
                containerOpts.publicAccessLevel = 'container'
            }
        }

        const callback = (err, response) => {
            if (err) {
                return reject(err)
            }
            else if (response && response.name) {
                return resolve()
            }
            else {
                throw Error('Response does not contain storage account name')
            }
        }

        if (ifNotExists) {
            this.client.createContainerIfNotExists(container, containerOpts, callback)
        }
        else {
            this.client.createContainer(container, containerOpts, callback)
        }
    })
}

function createAzureStorage(config) {
    return new AzureStorage(config)
}
module.exports = {
    createAzureStorage
}