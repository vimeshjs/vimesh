const _ = require('lodash')
const { GrpcError } = require('@vimesh/grpc')

function login(call) {
    let username = call.request.username
    let password = call.request.password
    //console.log(`Login ${username}/${password}`)
    return Promise.resolve({ result: username == 'admin' && password == 'admin' })
}

module.exports = {
    login
}