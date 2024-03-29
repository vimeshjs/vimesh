
const _ = require('lodash')
const util = require("util")
const minio = require('minio')
const { encodeMeta, decodeMeta, Storage } = require('@vimesh/storage')
const { isStream, getMD5 } = require('@vimesh/utils')
function MinioStorage(config) {
    Storage.call(this, config)
    this.client = new minio.Client(config.options)
}

util.inherits(MinioStorage, Storage)

MinioStorage.prototype.listBuckets = function () {
    return this.client.listBuckets()
        .then(list => _.map(list, el => (el && el.name) || undefined));
}

MinioStorage.prototype.hasBucket = function (name) {
    return this.client.bucketExists(name)
}

MinioStorage.prototype.createBucket = function (name) {
    return this.client.makeBucket(name, this.client.region || '');
}

MinioStorage.prototype.ensureBucket = function (name, options) {
    return this.hasBucket(name).then((exists) => {
        if (!exists) {
            return this.createBucket(bucket, options);
        }
    })
}

MinioStorage.prototype.deleteBucket = function (name) {
    return this.client.removeBucket(name);
}

MinioStorage.prototype.putObject = function (bucket, filePath, data, options) {
    if (!options) options = {}
    if (!options.meta) options.meta = {}
    if (!isStream(data)) options.meta.md5 = getMD5(data)
    return Promise.resolve(this.client.putObject(bucket, filePath, data, null, encodeMeta(options && options.meta)));
}

MinioStorage.prototype.getObject = function (bucket, filePath) {
    return this.client.getObject(bucket, filePath);
}

MinioStorage.prototype.getPartialObject = function (bucket, filePath, offset, size) {
    return this.client.getPartialObject(bucket, filePath, offset, size);
}

MinioStorage.prototype.deleteObject = function (bucket, filePath) {
    return this.client.removeObject(bucket, filePath)
}

MinioStorage.prototype.statObject = function (bucket, filePath) {
    return this.client.statObject(bucket, filePath).then(s => {
        return { path: filePath, size: s.size, modifiedAt: s.lastModified, meta: decodeMeta(s.metaData) }
    })
}

MinioStorage.prototype.copyObject = function (sourceBucket, sourcePath, targetBucket, targetPath) {
    if (targetPath === undefined) {
        targetPath = targetBucket
        targetBucket = sourceBucket
    }
    return this.client.copyObject(targetBucket, targetPath, `/${sourceBucket}/${sourcePath}`)
}

MinioStorage.prototype.listObjects = function (bucket, prefix) {
    return new Promise((resolve, reject) => {
        const stream = this.client.listObjectsV2(bucket, prefix || '', true)
        const list = []
        stream.on('data', (obj) => {
            let res
            if (obj.name && obj.lastModified) {
                res = {
                    modifiedAt: obj.lastModified,
                    path: obj.name,
                    size: obj.size
                };
            }
            else if (obj.prefix) {
                //res = { prefix: obj.prefix }
            }
            else {
                throw Error('Invalid object returned from the server')
            }
            list.push(res)
        });
        stream.on('error', (err) => { reject(err) })
        stream.on('end', () => { resolve(list) })
    })
}


module.exports = (config) => {
    return new MinioStorage(config)
}