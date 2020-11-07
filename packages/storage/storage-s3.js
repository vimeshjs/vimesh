
const _ = require('lodash')
const util = require("util")
const { encodeMeta, decodeMeta } = require('./meta')
const AWS = require('aws-sdk')
const { Storage } = require('./storage')
const { isStream, getMD5 } = require('@vimesh/utils')
const { reject } = require('bluebird')
function S3Storage(config) {
    Storage.call(this, config)
    let options = config.options
    if (!options.region) {
        throw new Error(`Parameter "region" for an S3 storage is missing!`)
    }
    if (!options.accessKey) {
        throw new Error(`Parameter "accessKey" for an S3 storage is missing!`)
    }
    if (!options.secretKey) {
        throw new Error(`Parameter "secretKey" for an S3 storage is missing!`)
    }
    AWS.config = new AWS.Config(
        {
            accessKeyId: options.accessKey,
            secretAccessKey: options.secretKey,
            region: options.region
        }
    )
    this.bucketPrefix = options.bucketPrefix || ''
    this.region = options.region
    this.client = new AWS.S3()
}

util.inherits(S3Storage, Storage)

function ACLString(access) {
    switch (access) {
        case 'public-read':
        case 'public':
            return 'public-read'
        case 'public-read-write':
        case 'authenticated-read':
            return access
        case 'none':
        case 'private':
        default:
            return 'private'
    }
}

S3Storage.prototype.listBuckets = function () {
    return new Promise((resolve, reject) => {
        this.client.listBuckets(function (err, data) {
            if (err || !data || !data.Buckets) {
                return reject(err || Error('Invalid response while listing containers'))
            }

            const list = []
            _.each(data.Buckets, bucket => {
                if (bucket && bucket.Name) {
                    list.push(bucket.Name)
                }
            })
            resolve(list)
        })
    })
}

S3Storage.prototype.hasBucket = function (name) {
    return new Promise((resolve, reject) => {
        const methodOptions = {
            Bucket: this.bucketPrefix + name
        }
        this.client.headBucket(methodOptions, function (err, data) {
            if (err) {
                // Check error code to see if bucket doesn't exist, or if someone else owns it
                if (err.statusCode == 404) {
                    // Container doesn't exist
                    resolve(false)
                } else if (err.statusCode === 403) {
                    // Someone else owns this
                    resolve(false)
                } else {
                    // Another error, so throw an exception
                    return reject(err)
                }
            } else {
                // Bucket exists and user owns it
                resolve(true)
            }
        })
    })
}

S3Storage.prototype.createBucket = function (name, options) {
    return new Promise((resolve, reject) => {
        if (!options) {
            options = {}
        }

        const methodOptions = {
            ACL: ACLString(options.access),
            Bucket: this.bucketPrefix + name,
            CreateBucketConfiguration: {
                LocationConstraint: this.region
            }
        }
        this.client.createBucket(methodOptions, function (err, data) {
            if (err || !data || !data.Location) {
                return reject(err || Error('Invalid response while creating container'))
            }

            resolve()
        })
    })
}

S3Storage.prototype.ensureBucket = function (name, options) {
    return this.hasBucket(name).then((exists) => {
        if (!exists) {
            return this.createBucket(bucket, options);
        }
    })
}

S3Storage.prototype.deleteBucket = function (name) {
    return new Promise((resolve, reject) => {
        const methodOptions = {
            Bucket: this.bucketPrefix + name
        }
        this.client.deleteBucket(methodOptions, function (err, data) {
            if (err) {
                if (err.code == 'NoSuchBucket')
                    resolve()
                return reject(err)
            }
            resolve()
        })
    })
}

function PutObjectMethodOptions(options) {
    const methodOptions = {}

    // If no other options...
    if (!options) {
        return methodOptions
    }

    // ACL: add only if explicitly passed
    if (options.access) {
        methodOptions.ACL = ACLString(options.access)
    }

    // Storage class
    if (options.class) {
        methodOptions.StorageClass = options.class
    }

    // Enable server-side encryption
    if (options.serverSideEncryption) {
        methodOptions.ServerSideEncryption = 'AES256'
    }

    // Metadata
    if (options.meta) {
        methodOptions.Metadata = {}

        for (const key in options.meta) {
            if (!options.meta.hasOwnProperty(key)) {
                continue
            }

            const keyLowerCase = key.toLowerCase()
            switch (keyLowerCase) {
                case 'cache-control':
                    methodOptions.CacheControl = options.meta[key]
                    break
                case 'content-disposition':
                    methodOptions.ContentDisposition = options.meta[key]
                    break
                case 'content-encoding':
                    methodOptions.ContentEncoding = options.meta[key]
                    break
                case 'content-language':
                    methodOptions.ContentLanguage = options.meta[key]
                    break
                case 'content-md5':
                    methodOptions.ContentMD5 = options.meta[key]
                    break
                case 'content-type':
                    methodOptions.ContentType = options.meta[key]
                    break
                default:
                    methodOptions.Metadata[key] = options.meta[key]
                    break
            }
        }
    }

    return methodOptions
}

S3Storage.prototype.putObject = function (bucket, filePath, data, options) {
    if (!options) options = {}
    if (!options.meta) options.meta = {}
    if (!isStream(data)) options.meta.md5 = getMD5(data)
    //return Promise.resolve(this.client.putObject(bucket, filePath, data, null, encodeMeta(options && options.meta)));
    return new Promise((resolve, reject) => {
        // Build all the methodOptions dictionary
        const methodOptions = Object.assign(
            {},
            {
                Body: data,
                Bucket: this.bucketPrefix + bucket,
                Key: filePath
            },
            PutObjectMethodOptions(options)
        )
        // Send the request
        this.client.putObject(methodOptions, function (err, response) {
            if (err || !response || !response.ETag) {
                return reject(err || Error('Invalid response while putting object'))
            }

            resolve()
        })
    })
}

S3Storage.prototype.getObject = function (bucket, filePath) {
    return new Promise((resolve, reject) => {
        const methodOptions = {
            Bucket: this.bucketPrefix + bucket,
            Key: filePath
        }
        this.client.headObject(methodOptions, (err, resp) => {
            if (err) {
                return reject(err)
            }
            const stream = this.client.getObject(methodOptions).createReadStream()
            resolve(stream)
        })
    })
}

S3Storage.prototype.getPartialObject = function (bucket, filePath, offset, size) {
    //return this.client.getPartialObject(bucket, filePath, offset, size);
    throw new Error('Not implemented!')
}

S3Storage.prototype.deleteObject = function (bucket, filePath) {
    return new Promise((resolve, reject) => {
        const methodOptions = {
            Bucket: this.bucketPrefix + bucket,
            Key: filePath
        }

        this.client.deleteObject(methodOptions, function (err, data) {
            if (err || !data) {
                return reject(err || Error('Invalid response while deleting object'))
            }
            resolve()
        })
    })
}

S3Storage.prototype.statObject = function (bucket, filePath) {
    return new Promise((resolve, reject) => {
        const methodOptions = {
            Bucket: this.bucketPrefix + bucket,
            Key: filePath
        }
        this.client.headObject(methodOptions, (err, resp) => {
            if (err) {
                return reject(err)
            }
            let meta = decodeMeta(resp.Metadata)
            if (resp.ContentType)
                meta['content-type'] = resp.ContentType
            if (resp.CacheControl)
                meta['cache-control'] = resp.CacheControl
            if (resp.ContentDisposition)
                meta['content-disposition'] = resp.ContentDisposition
            if (resp.ContentEncoding)
                meta['content-encoding'] = resp.ContentEncoding
            if (resp.ContentLanguage)
                meta['content-language'] = resp.ContentLanguage
            if (resp.ContentMD5)
                meta['content-md5'] = resp.ContentMD5
            resolve({ path: filePath, size: resp.ContentLength, modifiedAt: new Date(resp.LastModified), meta })
        })
    })
}

S3Storage.prototype.copyObject = function (sourceBucket, sourcePath, targetBucket, targetPath) {
    if (targetPath === undefined) {
        targetPath = targetBucket
        targetBucket = sourceBucket
    }
    return new Promise((resolve, reject) => {
        const methodOptions = {
            Bucket: this.bucketPrefix + targetBucket,
            CopySource: encodeURI(`/${this.bucketPrefix + sourceBucket}/${sourcePath}`),
            Key: targetPath
        }
        this.client.copyObject(methodOptions, (err, r) => {
            if (err)
                return reject(err)
            resolve()
        })
    })
}

S3Storage.prototype.listObjects = function (bucket, prefix) {
    const list = []
    const makeRequest = (continuationToken) => {
        return new Promise((resolve, reject) => {
            const methodOptions = {
                Bucket: this.bucketPrefix + bucket,
                ContinuationToken: continuationToken || undefined,
                //Delimiter: '/',
                MaxKeys: 500,
                Prefix: prefix
            }
            this.client.listObjectsV2(methodOptions, function (err, data) {
                if (err) {
                    if (err.code == 'NoSuchBucket')
                        return resolve([])
                    return reject(err)
                }

                _.each(data.Contents, el => {
                    const add = {
                        modifiedAt: el.lastModified,
                        path: el.Key,
                        size: el.Size
                    }

                    // Check if the ETag is the MD5 of the file (this is the case for files that weren't uploaded in multiple parts, in which case there's a dash in the ETag)
                    if (el.ETag.indexOf('-') >= 0) {
                        add.contentMD5 = el.ETag
                    }

                    list.push(add)
                })

                _.each(data.CommonPrefixes, el => {
                    //list.push({ path: el.Prefix, folder: true })
                })

                if (data.ContinuationToken) {
                    resolve(makeRequest(data.ContinuationToken))
                }
                else {
                    resolve(list)
                }
            })
        })
    }

    return makeRequest()
}

function createS3Storage(config) {
    return new S3Storage(config)
}
module.exports = {
    createS3Storage
}