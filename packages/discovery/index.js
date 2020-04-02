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
            key = _.trim(key)
            return client.get({ key }).then(r => {
                let data = r.data
                _.each(data, (v, k) => data[k] = JSON.parse(v))
                return _.endsWith(key, '*') ? (data || {}) : (data && data[key] || null)
            })
        },
        set(key, value, options) {
            value = JSON.stringify(value)
            let data = { key, value }
            if (options && options.duration) data.duration = options.duration
            return client.set(data)
        },
        keys(prefix) {
            return client.keys({ key: prefix }).then(r => r.keys)
        },
        del(key) {
            return client.del({ key })
        }
    }
}
module.exports = {
    createKeyValueClient,
    setupDiscoveryService
}