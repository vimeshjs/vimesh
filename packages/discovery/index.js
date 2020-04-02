const _ = require('lodash')
const { setupGrpcService, createGrpcClient } = require('@vimesh/grpc')
const { MemoryKeyValueStore } = require('./kv/memory')

function setupDiscoveryService(options) {
    let context = {}
    if (!options.keyValueStore) {
        context.keyValueStore = new MemoryKeyValueStore()
    }
    return setupGrpcService({
        context,
        path: __dirname + '/grpc',
        port: options.port || 8000
    })
}

function createKeyValueClient(options) {
    return createGrpcClient({
        path: __dirname + '/grpc/kv.proto',
        url: options.url
    })
}
module.exports = {
    createKeyValueClient,
    setupDiscoveryService
}