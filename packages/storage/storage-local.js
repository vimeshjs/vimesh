const _ = require('lodash')
const util = require("util")
const fs = require('graceful-fs')
const path = require('path')
const glob = require('glob')
const mkdirp = require('mkdirp')
const { isStream, isReadableStream, pipeStreams, getMD5 } = require('@vimesh/utils')
const Promise = require('bluebird')
const accessAsync = Promise.promisify(fs.access)
const writeFileAsync = Promise.promisify(fs.writeFile)
const readFileAsync = Promise.promisify(fs.readFile)
const readdirAsync = Promise.promisify(fs.readdir)
const statAsync = Promise.promisify(fs.stat)
const globAsync = Promise.promisify(glob)
const rmdirAsync = Promise.promisify(fs.rmdir)
const unlinkAsync = Promise.promisify(fs.unlink)
const copyFileAsync = Promise.promisify(fs.copyFile)
const { Storage } = require('./storage')
function LocalStorage(config) {
    Storage.call(this, config)
    this.root = config.options.root
    mkdirp.sync(this.root)
}

util.inherits(LocalStorage, Storage)

LocalStorage.prototype.listBuckets = function () {
    return readdirAsync(this.root)
}

LocalStorage.prototype.hasBucket = function (name) {
    return accessAsync(`${this.root}/${name}`).then(r => true).catch(ex => false)
}

LocalStorage.prototype.createBucket = function (name) {
    return mkdirp(`${this.root}/${name}`).then(r => this.hasBucket(name))
}

LocalStorage.prototype.ensureBucket = function (name, options) {
    return this.createBucket(name)
}

LocalStorage.prototype.deleteBucket = function (name, options) {
    return rmdirAsync(`${this.root}/${name}`)
}

LocalStorage.prototype.putObject = function (bucket, filePath, data, options) {
    let fn = path.join(this.root, bucket, filePath)
    let dir = path.dirname(fn)
    let meta = options && options.meta || {}
    return this.hasBucket(bucket).then(r => {
        if (r) {
            if (isStream(data)) {
                if (isReadableStream(data)) {
                    if (!fs.existsSync(dir)) mkdirp.sync(dir)
                    return pipeStreams(data, fs.createWriteStream(fn))
                } else {
                    return Promise.reject(Error(`Stream data must be readable to put into ${bucket}/${filePath}`))
                }
            }
            meta.md5 = getMD5(data)
            return mkdirp(dir).then(r => writeFileAsync(fn, data))
        } else {
            return Promise.reject(Error(`Bucket ${bucket} does not exist for file ${filePath}!`))
        }
    }).then(r => writeFileAsync(`${fn}.meta.json`, JSON.stringify(meta, null, 2)))
}

LocalStorage.prototype.getObject = function (bucket, filePath) {
    return this.hasBucket(bucket).then(r => {
        if (r) {
            let fn = path.join(this.root, bucket, filePath)
            return accessAsync(fn).then(r => fs.createReadStream(fn))
        } else {
            return Promise.reject(Error(`Bucket ${bucket} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.getPartialObject = function (bucket, filePath, offset, size) {
    return this.hasBucket(bucket).then(r => {
        if (r) {
            let fn = path.join(this.root, bucket, filePath)
            let options = { start: offset }
            if (size > 0) options.end = offset + size - 1
            return accessAsync(fn).then(r => fs.createReadStream(fn, options))
        } else {
            return Promise.reject(Error(`Bucket ${bucket} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.deleteObject = function (bucket, filePath) {
    return this.hasBucket(bucket).then(r => {
        if (r) {
            let fn = path.join(this.root, bucket, filePath)
            return Promise.all([unlinkAsync(fn), unlinkAsync(`${fn}.meta.json`)])
        } else {
            return Promise.reject(Error(`Bucket ${bucket} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.copyObject = function (sourceBucket, sourcePath, targetBucket, targetPath) {
    if (targetPath === undefined) {
        targetPath = targetBucket
        targetBucket = sourceBucket
    }
    return Promise.all([
        this.hasBucket(sourceBucket),
        this.hasBucket(targetBucket),
    ]).then(r => {
        if (r) {
            let fnSource = path.join(this.root, sourceBucket, sourcePath)
            let fnTarget = path.join(this.root, targetBucket, targetPath)
            return Promise.all([
                copyFileAsync(fnSource, fnTarget),
                copyFileAsync(`${fnSource}.meta.json`, `${fnTarget}.meta.json`)
            ])
        } else {
            return Promise.reject(Error(`Bucket ${sourceBucket} or ${targetBucket} does not exist !`))
        }
    })
}

LocalStorage.prototype.statObject = function (bucket, filePath) {
    return this.hasBucket(bucket).then(r => {
        if (r) {
            let fn = path.join(this.root, bucket, filePath)
            let stat = null
            let meta = {}
            return statAsync(fn).then(r => {
                stat = r
                return readFileAsync(`${fn}.meta.json`).then(r => {
                    meta = JSON.parse(r.toString())
                    return { path: filePath, size: stat.size, modifiedAt: new Date(stat.mtimeMs), meta }
                }).catch(ex => {
                    //$logger.warn(`Fails to read meta for ${fn}`)
                    return { path: filePath, size: stat.size, modifiedAt: new Date(stat.mtimeMs), meta }
                })
            })
        } else {
            return Promise.reject(Error(`Bucket ${bucket} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.listObjects = function (bucket, prefix) {
    return this.hasBucket(bucket).then(r => {
        if (r) {
            return globAsync(`${this.root}/${bucket}/${prefix}*`).then(fs => {
                fs = _.filter(fs, f => !_.endsWith(f, '.meta.json'))
                let all = []
                return Promise.each(fs, f => {
                    return statAsync(f).then(s => {
                        all.push({
                            path: path.relative(`${this.root}/${bucket}`, f),
                            size: s.size,
                            modifiedAt: new Date(s.mtimeMs)
                        })
                    })
                }).then(r => all)
            })
        } else {
            return Promise.reject(Error(`Bucket ${bucket} does not exist for file ${filePath}!`))
        }
    })
}

function createLocalStorage(config) {
    return new LocalStorage(config)
}
module.exports = {
    createLocalStorage
}