const _ = require('lodash')
const { setupGrpcService, createGrpcClient } = require('@vimesh/grpc')
const { MemoryKeyValueStore } = require('./kv/memory')
const { MongodbKeyValueStore } = require('./kv/mongodb')

function setupDiscoveryService(options) {
    let context = {}
    if (options.type === 'mongodb') {
        $logger.info(`Setup discovery service with mongodb store (${JSON.stringify(options)})`)
        context.keyValueStore = new MongodbKeyValueStore(options)
    } else {
        $logger.info(`Setup discovery service with memory store (${JSON.stringify(options)})`)
        context.keyValueStore = new MemoryKeyValueStore()
    }
    return setupGrpcService({
        context,
        path: __dirname + '/grpc',
        port: options.port || 8000
    })
}

function createKeyValueClient(options) {
    let client = createGrpcClient({
        path: __dirname + '/grpc/kv.proto',
        url: options.url
    })
    return {
        get(key) {
            return new Promise((resolve, reject) => {
                key = _.trim(key)
                client.get({ key }, (err, r) => {
                    if (err) return reject(err)
                    let data = r.data
                    _.each(data, (v, k) => data[k] = JSON.parse(v))
                    resolve(_.endsWith(key, '*') ? (data || {}) : (data && data[key] || null))
                })
            })
        },
        set(key, value, options) {
            return new Promise((resolve, reject) => {
                value = JSON.stringify(value)
                let data = { key, value }
                if (options && options.duration) data.duration = options.duration
                client.set(data, (err, r) => {
                    if (err) return reject(err)
                    resolve(r)
                })
            })
        },
        keys(prefix) {
            return new Promise((resolve, reject) => {
                client.keys({ key: prefix }, (err, r) => {
                    err ? reject(err) : resolve(r.keys)
                })
            })
        },
        del(key) {
            return new Promise((resolve, reject) => {
                client.del({ key }, (err, r) => {
                    err ? reject(err) : resolve(r)
                })
            })
        }
    }
}
module.exports = {
    createKeyValueClient,
    setupDiscoveryService
}