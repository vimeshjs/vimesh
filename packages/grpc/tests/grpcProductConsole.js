const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { createGrpcClient, GrpcStatus } = require('..')

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


let client3 = createGrpcClient({
    path: __dirname + '/services/product',
    url: 'localhost:2000'
})


setInterval(function(){
    console.log('Now:', new Date())
    client3.ProductService.listProducts({}, (err,r) => {
        if (err && err.code == GrpcStatus.UNAVAILABLE) {
            client3.reconnect()
        }
        console.log(err, r, new Date())
    })
}, 2000)
