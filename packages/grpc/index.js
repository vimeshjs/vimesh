const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const glob = require('glob')

const protoLoader = require('@grpc/proto-loader')
const grpc = require('@grpc/grpc-js')
const boom = require('grpc-boom')

function visitService(definition, namespace, callback) {
    if (!definition || definition.format) return
    _.each(definition, (v, k) => {
        if (v.service && typeof v === 'function') {
            callback(k, v, namespace)
        } else {
            visitService(v, (namespace ? namespace + '.' : '') + k, callback)
        }
    })
}
function setupGrpcService(options) {
    if (!fs.existsSync(options.path) || !fs.statSync(options.path).isDirectory())
        throw new Error(`gRPC server config path "${options.path}" does not exist!`)

    let includeDirs = [`${__dirname}/proto`, options.path]
    if (options.imports) {
        if (_.isString(options.imports))
            includeDirs.push(options.imports)
        else if (_.isArray(options.imports))
            includeDirs = _.concat(includeDirs, options.imports)
    }
    
    const server = new grpc.Server();
    const protoOptions = { includeDirs, keepCase: true, longs: Number }
    _.each(glob.sync(options.path + "/**"), function (f) {
        let ext = path.extname(f)
        let name = path.basename(f)
        if (ext) {
            name = name.substring(0, name.length - ext.length)
        }
        if (fs.statSync(f).isFile() &&
            name.substring(0, 1) != '_') {
            if (ext === '.js') {
                let js = f
                let proto = path.relative(options.path, f.substring(0, f.length - ext.length) + '.proto')
                const protoDefinition = protoLoader.loadSync(proto, protoOptions);
                const packageDefinition = grpc.loadPackageDefinition(protoDefinition)
                if (!fs.existsSync(js)) {
                    $logger.warn(`There are no gRPC implementation for ${f}`)
                }
                const imp = require(js)
                if (options.context) {
                    _.each(_.keys(imp), k => imp[k] = _.bind(imp[k], options.context))
                }
                visitService(packageDefinition, '', function (k, v, namespace) {
                    $logger.info(`Add gRPC service ${k} (${namespace})`)
                    if (options.promisify === false) {
                        server.addService(v.service, imp)
                    } else {
                        server.addService(v.service, _.mapValues(imp, promiseFunc => {
                            return (call, callback) => {
                                try {
                                    let promise = promiseFunc(call, callback)
                                    if (_.isFunction(promise && promise.then))
                                        promise.then(r => callback(null, r)).catch(ex => callback(ex))
                                } catch (ex) {
                                    callback(ex)
                                }
                            }
                        }))
                    }
                })
            }
        }
    })

    let url = `${options.host || '0.0.0.0'}:${options.port}`
    server.bindAsync(url, options.credentials || grpc.ServerCredentials.createInsecure(), (err, port) => {
        server.start()
        $logger.info(`gRPC server runs at ${url}`);
    })
    return server
}

function createGrpcClient(options) {
    if (!fs.existsSync(options.path) || !fs.statSync(options.path).isDirectory())
        throw new Error(`gRPC client config path "${options.path}" does not exist!`)
    let includeDirs = [`${__dirname}/proto`, options.path]
    if (options.imports) {
        if (_.isString(options.imports))
            includeDirs.push(options.imports)
        else if (_.isArray(options.imports))
            includeDirs = _.concat(includeDirs, options.imports)
    }
    const protoOptions = { includeDirs, keepCase: true, longs: Number }
    let client = {
        __factories__: {}
    }
    client.reconnect = function (key) {
        if (key === undefined) {
            _.each(client.__factories__, (factory, k) => {
                $logger.warn(`Reconnecting gRPC service ${k}`)
                factory()
            })
        } else if (client.__factories__[key]) {
            $logger.warn(`Reconnecting gRPC service ${key}`)
            client.__factories__[key]()
        }
    }
    _.each(glob.sync(options.path + "/**"), function (f) {
        let ext = path.extname(f)
        let name = path.basename(f)
        if (ext) {
            name = name.substring(0, name.length - ext.length)
        }
        if (ext === '.proto' && fs.statSync(f).isFile() && name.substring(0, 1) != '_') {
            let proto = path.relative(options.path, f)
            const protoDefinition = protoLoader.loadSync(proto, protoOptions)
            const packageDefinition = grpc.loadPackageDefinition(protoDefinition)
            visitService(packageDefinition, '', function (k, v, namespace) {
                $logger.info(`Create gRPC client for service ${k} (${(options.includePackage ? '+' : '-') + namespace})`)
                let key = (options.includePackage && namespace ? namespace + '.' : '') + k
                let factory = function () {
                    let service = new v(options.url, options.credentials || grpc.credentials.createInsecure())
                    _.set(client, key, service)
                }
                client.__factories__[key] = factory
                factory()
            })
        }
    })
    return client
}

function toTimestamp(dt) {
    let tms = _.isDate(dt) ? dt.valueOf() : +dt
    return {
        seconds: tms / 1000,
        nanos: (tms % 1000) * 1e6
    }
}

function fromTimestamp(ts) {
    return new Date(ts.seconds * 1000 + Math.round(ts.nanos / 1e6))
}
module.exports = {
    Metadata: grpc.Metadata,
    GrpcError: boom.default,
    GrpcStatus: boom.Status,
    setupGrpcService,
    createGrpcClient,
    toTimestamp,
    fromTimestamp
}