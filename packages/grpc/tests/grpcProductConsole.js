const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { createGrpcClient } = require('..')

setupLogger()

let client = createGrpcClient({
    path: __dirname + '/services/product',
    url: 'localhost:2000'
})


client.ProductService.listProducts({}, (err,r) => {
    console.log(err, r)
})


client.ProductService.deleteProduct({id:123},(err, r) => {
    console.log(err, r)
})


let client2 = createGrpcClient({
    path: __dirname + '/services/product',
    url: 'localhost:2000',
    includePackage : true
})


client2.org.vimesh.ProductService.listProducts({}, (err,r) => {
    console.log(err, r)
})


client2.org.vimesh.ProductService.deleteProduct({id:123},(err, r) => {
    console.log(err, r)
})