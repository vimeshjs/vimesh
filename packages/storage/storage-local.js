const _ = require('lodash')
const util = require( "util" )
const fs = require('graceful-fs')
const path = require('path')
const glob = require('glob')
const mkdirp = require('mkdirp')
const { isStream, isReadableStream, readStreamToBuffer } = require('@vimesh/utils')
const Promise = require('bluebird')
const accessAsync = Promise.promisify(fs.access)
const writeFileAsync = Promise.promisify(fs.writeFile)
const readFileAsync = Promise.promisify(fs.readFile)
const readdirAsync = Promise.promisify(fs.readdir)
const statAsync = Promise.promisify(fs.stat)
const globAsync = Promise.promisify(glob)
const rmdirAsync = Promise.promisify(fs.rmdir)
const unlinkAsync = Promise.promisify(fs.unlink)
const Storage = require('./storage')
function LocalStorage(config) {
    Storage.call(this, config)
    this.root = config.options.root
    mkdirp.sync(this.root)
}

util.inherits( LocalStorage, Storage )

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
    return this.hasBucket(bucket).then(r => {
        if (r) {
            let fn = path.join(this.root, bucket, filePath)
            let dir = path.dirname(fn)
            if (isStream(data)) {
                if (isReadableStream(data)) {
                    return readStreamToBuffer(data).then(buffer => {
                        return mkdirp(dir).then(r => writeFileAsync(fn, buffer))
                            .then(r => writeFileAsync(`${fn}.meta.json`, JSON.stringify(options && options.meta || {}, null, 2)))
                    })
                } else {
                    return Promise.reject(Error(`Stream data must be readable to put into ${bucket}/${filePath}`))
                }
            }
            return mkdirp(dir).then(r => writeFileAsync(fn, data))
                .then(r => writeFileAsync(`${fn}.meta.json`, JSON.stringify(options && options.meta || {}, null, 2)))
        } else {
            return Promise.reject(Error(`Conatiner ${bucket} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.getObject = function (bucket, filePath) {
    return this.hasBucket(bucket).then(r => {
        if (r) {
            let fn = path.join(this.root, bucket, filePath)
            return accessAsync(fn).then(r => fs.createReadStream(fn))
        } else {
            return Promise.reject(Error(`Conatiner ${bucket} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.getPartialObject = function (bucket, filePath, offset, size) {
    return this.hasBucket(bucket).then(r => {
        if (r) {
            let fn = path.join(this.root, bucket, filePath)
            let options = {start : offset}
            if (size > 0) options.end = offset + size - 1
            return accessAsync(fn).then(r => fs.createReadStream(fn, options))
        } else {
            return Promise.reject(Error(`Conatiner ${bucket} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.deleteObject = function (bucket, filePath) {
    return this.hasBucket(bucket).then(r => {
        if (r) {
            let fn = path.join(this.root, bucket, filePath)
            return Promise.all([unlinkAsync(fn), unlinkAsync(`${fn}.meta.json`)])
        } else {
            return Promise.reject(Error(`Conatiner ${bucket} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.statObject = function (bucket, filePath) {
    return this.hasBucket(bucket).then(r => {
        if (r) {
            let fn = path.join(this.root, bucket, filePath)
            return Promise.all([statAsync(fn), readFileAsync(`${fn}.meta.json`)]).then(rs => {
                let s = rs[0]
                let meta = JSON.parse(rs[1].toString())
                return { path: filePath, size: s.size, modifiedAt: new Date(s.mtimeMs), meta }
            })
        } else {
            return Promise.reject(Error(`Conatiner ${bucket} does not exist for file ${filePath}!`))
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
            return Promise.reject(Error(`Conatiner ${bucket} does not exist for file ${filePath}!`))
        }
    })
}

function createLocalStorage(config) {
    return new LocalStorage(config)
}
module.exports = {
    createLocalStorage
}