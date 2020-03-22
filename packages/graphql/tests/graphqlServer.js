const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { setupGraphQLService, setupGraphQLProxy } = require('..')

setupLogger()

function setupServer() {
    return Promise.all([
        setupGraphQLService({ path: __dirname + '/services/service1', port: 1001 }),
        setupGraphQLService({ path: __dirname + '/services/products', port: 1002 }),
        setupGraphQLService({ path: __dirname + '/services/reviews', port: 1003 })
    ]).then(serviceList => {
        return setupGraphQLProxy({ serviceList, port: 1000 })
    })
}

setupServer()