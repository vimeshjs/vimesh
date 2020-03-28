const _ = require('lodash')
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

function LocalStorage(config) {
    this.root = config.root
    mkdirp.sync(this.root)
}

LocalStorage.prototype.listContainers = function () {
    return readdirAsync(this.root)
}

LocalStorage.prototype.isContainer = function (name) {
    return accessAsync(`${this.root}/${name}`, fs.constants.F_OK).then(r => true).catch(ex => false)
}

LocalStorage.prototype.createContainer = function (name) {
    return mkdirp(`${this.root}/${name}`).then(r => this.isContainer(name))
}

LocalStorage.prototype.ensureContainer = function (name, options) {
    return this.createContainer(name)
}

LocalStorage.prototype.deleteContainer = function (name, options) {
    return rmdirAsync(`${this.root}/${name}`)
}

LocalStorage.prototype.putObject = function (container, filePath, data, options) {
    return this.isContainer(container).then(r => {
        if (r) {
            let fn = path.join(this.root, container, filePath)
            let dir = path.dirname(fn)
            if (isStream(data)) {
                if (isReadableStream(data)) {
                    return readStreamToBuffer(data).then(buffer => {
                        return mkdirp(dir).then(r => writeFileAsync(fn, buffer))
                            .then(r => writeFileAsync(`${fn}.meta.json`, JSON.stringify(options && options.meta || {}, null, 2)))
                    })
                } else {
                    return Promise.reject(Error(`Stream data must be readable to put into ${container}/${filePath}`))
                }
            }
            return mkdirp(dir).then(r => writeFileAsync(fn, data))
                .then(r => writeFileAsync(`${fn}.meta.json`, JSON.stringify(options && options.meta || {}, null, 2)))
        } else {
            return Promise.reject(Error(`Conatiner ${container} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.getObject = function (container, filePath) {
    return this.isContainer(container).then(r => {
        if (r) {
            let fn = path.join(this.root, container, filePath)
            return readFileAsync(fn)
        } else {
            return Promise.reject(Error(`Conatiner ${container} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.deleteObject = function (container, filePath) {
    return this.isContainer(container).then(r => {
        if (r) {
            let fn = path.join(this.root, container, filePath)
            return Promise.all([unlinkAsync(fn), unlinkAsync(`${fn}.meta.json`)])
        } else {
            return Promise.reject(Error(`Conatiner ${container} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.statObject = function (container, filePath) {
    return this.isContainer(container).then(r => {
        if (r) {
            let fn = path.join(this.root, container, filePath)
            return Promise.all([statAsync(fn), readFileAsync(`${fn}.meta.json`)]).then(rs => {
                let s = rs[0]
                let meta = JSON.parse(rs[1].toString())
                return { path: filePath, size: s.size, modifiedAt: new Date(s.mtimeMs), meta }
            })
        } else {
            return Promise.reject(Error(`Conatiner ${container} does not exist for file ${filePath}!`))
        }
    })
}

LocalStorage.prototype.listObjects = function (container, prefix) {
    return this.isContainer(container).then(r => {
        if (r) {
            return globAsync(`${this.root}/${container}/${prefix}*`).then(fs => {
                fs = _.map(fs, f => path.relative(`${this.root}/${container}`, f))
                return _.filter(fs, f => !_.endsWith(f, '.meta.json'))
            })
        } else {
            return Promise.reject(Error(`Conatiner ${container} does not exist for file ${filePath}!`))
        }
    })
}

function createLocalStorage(config) {
    return new LocalStorage(config)
}
module.exports = {
    createLocalStorage
}