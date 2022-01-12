const _ = require('lodash')
const fs = require('graceful-fs')
const { pipeStreams } = require('@vimesh/utils')
const path = require('path')
const mkdirp = require('mkdirp')
const { readStreamToBuffer, getFileChecksum } = require('@vimesh/utils')
const Promise = require('bluebird')
const accessAsync = Promise.promisify(fs.access)
const statAsync = Promise.promisify(fs.stat)
const unlinkAsync = Promise.promisify(fs.unlink)
const renameAsync = Promise.promisify(fs.rename)
function Storage(config) {
    this.type = config.type
    this.config = config
}

function getFullLocalStat(localFilePath) {
    let localStat
    return accessAsync(localFilePath)
        .then(r => statAsync(localFilePath))
        .then(r => localStat = _.pick(r, 'size'))
        .then(r => getFileChecksum(localFilePath))
        .then(md5 => { localStat.md5 = md5 })
        .catch(ex => { })
        .then(r => localStat)
}
function compareLocalAndRemoteStat(localStat, remoteStat) {
    if (!remoteStat || !localStat) return false
    let rmd5 = remoteStat.meta && remoteStat.meta.md5
    return remoteStat.size == localStat.size && (!rmd5 || rmd5 == localStat.md5)
}
let getObjectFileIndex = 1
Storage.prototype.getObjectAsFile = function (bucket, filePath, localFilePath) {
    return Promise.all([
        this.statObject(bucket, filePath),
        getFullLocalStat(localFilePath)
    ]).then(rs => {
        let remoteStat = rs[0]
        let localStat = rs[1]
        if (compareLocalAndRemoteStat(localStat, remoteStat)) {
            return Promise.resolve()
        } else {
            let dir = path.dirname(localFilePath)
            let partFilePath = `${localFilePath}.${getObjectFileIndex++}.part`
            let error = Error(`Fails to download the complete file ${filePath} at bucket ${bucket}!`)
            return (localStat ? unlinkAsync(localFilePath) : Promise.resolve())
                .then(r => mkdirp(dir))
                .then(r => this.getObject(bucket, filePath))
                .then(stream => {
                    return pipeStreams(stream, fs.createWriteStream(partFilePath)).then(r => statAsync(partFilePath))
                })
                .then(s => {
                    if (remoteStat.size == s.size) {
                        return renameAsync(partFilePath, localFilePath).catch(r =>
                            unlinkAsync(partFilePath).then(r => Promise.reject(error)))
                    } else {
                        return unlinkAsync(partFilePath).then(r => Promise.reject(error))
                    }
                })
        }
    })
}

Storage.prototype.putObjectAsFile = function (bucket, filePath, localFilePath, options) {
    if (!options) options = {}
    if (!options.meta) options.meta = {}
    return getFileChecksum(localFilePath, 'md5').then(md5 => {
        options.meta.md5 = md5
        return this.putObject(bucket, filePath, fs.createReadStream(localFilePath), options)
    })
}

Storage.prototype.getObjectAsBuffer = function (bucket, filePath) {
    return this.getObject(bucket, filePath).then(stream => readStreamToBuffer(stream))
}

Storage.prototype.getObjectAsString = function (bucket, filePath) {
    return this.getObjectAsBuffer(bucket, filePath).then(buffer => buffer.toString())
}

Storage.prototype.getPartialObjectAsBuffer = function (bucket, filePath, offset, size) {
    return this.getPartialObject(bucket, filePath, offset, size).then(stream => readStreamToBuffer(stream))
}

Storage.prototype.getPartialObjectAsString = function (bucket, filePath, offset, size) {
    return this.getPartialObjectAsBuffer(bucket, filePath, offset, size).then(buffer => buffer.toString())
}

Storage.prototype.moveObject = function (sourceBucket, sourcePath, targetBucket, targetPath) {
    return this.copyObject(sourceBucket, sourcePath, targetBucket, targetPath).then(r => {
        return this.deleteObject(sourceBucket, sourcePath)
    })
}

module.exports = {
    compareLocalAndRemoteStat,
    getFullLocalStat,
    Storage
}