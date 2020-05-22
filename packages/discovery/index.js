const _ = require('lodash')
const { setupGrpcService, createGrpcClient, GrpcStatus } = require('@vimesh/grpc')
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
        path: __dirname + '/grpc',
        url: options.url
    })
    function retry(reject, err){
        if (err && err.code === GrpcStatus.UNAVAILABLE){
            client.reconnect()
        }
        reject(err)
    }
    return {
        get(key) {
            return new Promise((resolve, reject) => {
                key = _.trim(key)
                client.KeyValueService.get({ key }, (err, r) => {
                    if (err) return retry(reject, err)
                    let data = r.data
                    _.each(data, (v, k) => {
                        try {
                            if (v !== 'undefined')
                                data[k] = JSON.parse(v)
                        } catch (ex) {
                            $logger.error(`Fails to parse value ${k} : ${v} .`, ex)
                        }
                    })
                    resolve(_.endsWith(key, '*') ? (data || {}) : (data && data[key] || null))
                })
            })
        },
        set(key, value, options) {
            return new Promise((resolve, reject) => {
                value = JSON.stringify(value)
                let data = { key, value }
                if (options && options.duration) data.duration = options.duration
                client.KeyValueService.set(data, (err, r) => {
                    if (err) return retry(reject, err)
                    resolve(r)
                })
            })
        },
        keys(prefix) {
            return new Promise((resolve, reject) => {
                client.KeyValueService.keys({ key: prefix }, (err, r) => {
                    err ? retry(reject, err) : resolve(r.keys)
                })
            })
        },
        del(key) {
            return new Promise((resolve, reject) => {
                client.KeyValueService.del({ key }, (err, r) => {
                    err ? retry(reject, err) : resolve(r)
                })
            })
        }
    }
}
module.exports = {
    createKeyValueClient,
    setupDiscoveryService
}