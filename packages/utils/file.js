const _ = require('lodash')
const fs = require('graceful-fs')
const path = require('path')
const crypto = require('crypto')
const { glob } = require("glob")
const stream = require('stream')
const yaml = require('js-yaml')
const Promise = require('bluebird')
const accessAsync = Promise.promisify(fs.access)

function loadYaml(f) {
    try {
        let yamlContent = fs.readFileSync(f).toString()
        return yaml.load(yamlContent)
    } catch (ex) {
        return null;
    }
}

function loadJson(file) {
    try {
        let data = fs.readFileSync(file)
        return JSON.parse(data.toString())
    } catch (ex) {
        return null;
    }
}

function loadText(file) {
    try {
        let data = fs.readFileSync(file)
        return data.toString()
    } catch (ex) {
        return null;
    }
}

function loadFileAs(file) {
    try {
        let ext = path.extname(file)
        if (ext === '.yaml' || ext === '.yml')
            return loadYaml(file)
        else if (ext === '.json')
            return loadJson(file)
        else if (ext === '.js')
            return require(file)
    } catch (ex) {
        $logger.error(`Fails to load ${file}`, ex)
    }
}

function loadDataTree(root) {
    let data = {}
    _.each(glob.sync(root + "/*"), function (file) {
        if (fs.statSync(file).isDirectory()) {
            let name = path.basename(file)
            data[name] = loadDataTree(file)
        } else {
            let ext = path.extname(file)
            if (_.includes(['.yaml', '.yml', '.json', '.js'], ext)) {
                let name = path.basename(file)
                name = name.substring(0, name.length - ext.length)
                data[name] = loadFileAs(file)
            }
        }
    })
    return data
}

function loadConfigs(context, ...files) {
    const Handlebars = require("handlebars");
    const configsDir = context.configsDir || path.join(process.cwd(), 'configs')
    let configs = {}
    let vars = _.cloneDeep(context.env)
    if (context.root && !vars.ROOT) vars.ROOT = context.root
    _.each(vars, (v, k) => {
        if (v && v.indexOf('{{') != -1) {
            try {
                const template = Handlebars.compile(v)
                let cv = template(vars)
                vars[k] = cv
                //console.log(`Converted environment variable ${k}=${cv} (${v})`)
            } catch (ex) {
                if (global.$logger)
                    $logger.error(`Fails to load environment variable ${k}`, ex)
                else
                    console.log(ex)
            }
        }
    })
    vars.env = _.cloneDeep(vars) // make it compatible with previous version
    vars.root = context.root
    _.each(files, f => {
        try {
            let filePath = path.join(configsDir, f) + '.yaml'
            let yamlContent = fs.readFileSync(filePath).toString()
            const template = Handlebars.compile(yamlContent)
            let cf = yaml.load(template(vars))
            configs = _.merge(configs, cf)
        } catch (ex) {
            if (global.$logger)
                $logger.error(`Fails to load config file ${f}`, ex)
            else
                console.log(ex)
        }
    })
    return configs
}

function isStream(val) {
    return _.isObject(val) && _.isFunction(val.pipe)
}

function isReadableStream(val) {
    return isStream(val) && _.isFunction(val.read)
}

function readStreamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const buffersCache = []
        stream.on('data', (data) => {
            buffersCache.push(data)
        })
        stream.on('end', () => {
            resolve(Buffer.concat(buffersCache))
        })
        stream.on('error', (error) => {
            reject(error)
        })
    })
}

function pipeStreams(...streams) {
    return new Promise((resolve, reject) => {
        streams.reduce((src, dst) => {
            src.on('error', err => dst.emit('error', err))
            return src.pipe(dst)
        }).on('error', e => reject(e)).on('finish', () => resolve())
    })
}

function getStreamChecksum(s, type) {
    return new Promise((resolve, reject) => {
        var sum = crypto.createHash(type || 'md5')
        s.on('data', d => { sum.update(d) })
        s.on('error', err => reject(err))
        s.on('end', () => { resolve(sum.digest('hex')) })
    })
}

function getFileChecksum(filename, type) {
    return accessAsync(filename).then(r => getStreamChecksum(fs.ReadStream(filename), type))
}

class WritableBufferStream extends stream.Writable {
    constructor(options) {
        super(options);
        this._chunks = [];
    }

    _write(chunk, enc, callback) {
        this._chunks.push(chunk);
        return callback(null);
    }

    _destroy(err, callback) {
        this._chunks = null;
        return callback(null);
    }

    toBuffer() {
        return Buffer.concat(this._chunks);
    }
}

module.exports = {
    WritableBufferStream,
    pipeStreams,
    isStream,
    isReadableStream,
    readStreamToBuffer,
    getFileChecksum,
    getStreamChecksum,
    loadYaml,
    loadJson,
    loadText,
    loadDataTree,
    loadConfigs
}