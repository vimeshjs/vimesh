const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { createGrpcClient } = require('..')

setupLogger()

let client = createGrpcClient({
    path: __dirname + '/services/product.proto',
    url: 'localhost:2000'
})


client.listProducts().then(r => {
    console.log(r)
})


client.deleteProduct({id:123}).catch(ex => {
    console.log(ex)
})