const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const glob = require('glob')

const protoLoader = require('@grpc/proto-loader')
const grpc = require('grpc')
const boom = require('grpc-boom')

function setupGrpcService(options) {
    if (!fs.existsSync(options.path) || !fs.statSync(options.path).isDirectory())
        throw new Error(`gRPC server config path "${options.path}" does not exist!`)

    const server = new grpc.Server();

    _.each(glob.sync(options.path + "/**"), function (f) {
        let ext = path.extname(f)
        let name = path.basename(f)
        if (ext) {
            name = name.substring(0, name.length - ext.length)
        }
        if (fs.statSync(f).isFile() &&
            name.substring(0, 1) != '_') {
            if (ext === '.proto') {
                let js = f.substring(0, f.length - ext.length) + '.js'
                const protoDefinition = protoLoader.loadSync(f);
                const packageDefinition = grpc.loadPackageDefinition(protoDefinition)
                if (!fs.existsSync(js)) {
                    $logger.warn(`There are no gRPC implementation for ${f}`)
                }
                const imp = require(js)
                _.each(packageDefinition[_.keys(packageDefinition)[0]], (v, k) => {
                    if (v.service) {
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

    let url = `${options.host || 'localhost'}:${options.port}`
    server.bind(url, options.credentials || grpc.ServerCredentials.createInsecure())
    server.start()
    $logger.info(`🚀 gRPC server runs at ${url}`);
}

function createGrpcClient(options) {

    if (!fs.existsSync(options.path) || !fs.statSync(options.path).isFile())
        throw new Error(`gRPC client proto path "${options.path}" does not exist!`)
    let client = null
    const protoDefinition = protoLoader.loadSync(options.path)
    const packageDefinition = grpc.loadPackageDefinition(protoDefinition)
    _.each(packageDefinition[_.keys(packageDefinition)[0]], (v, k) => {
        if (v.service) {
            client = new v(options.url, options.credentials || grpc.credentials.createInsecure())
            Object.keys(Object.getPrototypeOf(client)).forEach(function (functionName) {
                const originalFunction = client[functionName]
                let newFunc = async (req, mt) => {
                    return new Promise((resolve, reject) => {
                        originalFunction.bind(client)(req, mt, (err, res) => {
                            if (err)
                                reject(err)
                            else 
                                resolve(res)
                        })
                    })
                }
                client[functionName] = newFunc;
            })
        }
    })
    return client
}
module.exports = {
    Metadata: grpc.Metadata,
    GrpcError: boom.default,
    GrpcStatus: boom.Status,
    setupGrpcService,
    createGrpcClient
}