const fs = require('graceful-fs')
const { pipeStreams } = require('@vimesh/utils')
const path = require('path')
const mkdirp = require('mkdirp')
const { readStreamToBuffer } = require('@vimesh/utils')
const Promise = require('bluebird')
const accessAsync = Promise.promisify(fs.access)
const statAsync = Promise.promisify(fs.stat)
const unlinkAsync = Promise.promisify(fs.unlink)
const renameAsync = Promise.promisify(fs.rename)
function Storage(config) {
    this.type = config.type
    this.config = config
}

let getObjectFileIndex = 1
Storage.prototype.getObjectAsFile = function (bucket, filePath, localFilePath) {
    return Promise.all([
        this.statObject(bucket, filePath),
        accessAsync(localFilePath).then(r => statAsync(localFilePath)).catch(ex => { })
    ]).then(rs => {
        let remoteStat = rs[0]
        let localStat = rs[1]
        if (remoteStat && localStat && remoteStat.size == localStat.size) {
            return Promise.resolve()
        } else {
            let dir = path.dirname(localFilePath)
            let partFilePath = `${localFilePath}.${getObjectFileIndex++}.part`
            let error = Error(`Fails to download the complete file ${filePath} at bucket ${bucket}!`)
            return mkdirp(dir).then(r => this.getObject(bucket, filePath)).then(stream => {
                return pipeStreams(stream, fs.createWriteStream(partFilePath)).then(r => statAsync(partFilePath))
            }).then(s => {
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

module.exports = Storage