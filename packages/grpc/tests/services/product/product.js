const _ = require('lodash')
const {GrpcError} = require('../../..')
let products = [
    {
        id: 1,
        name: 'prod one'
    }, {
        id: 2,
        name: 'prod two'
    }, {
        id: 3,
        name: 'prod three'
    }
]

function listProducts() {
    return Promise.resolve({ products: products })
}
function readProduct(call) {
    let id = +call.request.id
    let p = products.find(p => p.id === id)
    return p ? Promise.resolve(p) : Promise.reject(`Product "${id}" does not exist`)
}
let lastId = 1000
function createProduct(call) {
    lastId ++
    products.push({
        id : lastId,
        name : call.request.name
    })
    return Promise.resolve({ status: 'success' })
}
function updateProduct(call) {
    let id = +call.request.id
    let p = products.find(p => p.id === id)
    p.name = call.request.name
    return Promise.resolve({ status: 'success' })
}
function deleteProduct() {
    //return Promise.reject(GrpcError.unimplemented('You can not delete'))
    throw GrpcError.unimplemented('You can not delete')
}

module.exports = {
    listProducts,
    readProduct,
    createProduct,
    updateProduct,
    deleteProduct
}