const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { createGrpcClient } = require('..')

setupLogger()

let client = createGrpcClient({
    path: __dirname + '/services/product/product.proto',
    url: 'localhost:2000'
})


client.listProducts({}, (err,r) => {
    console.log(err, r)
})


client.deleteProduct({id:123},(err, r) => {
    console.log(err, r)
})