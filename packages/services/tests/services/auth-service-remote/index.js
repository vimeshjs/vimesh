const { createGrpcClient, GrpcStatus } = require('@vimesh/grpc')
const Promise = require('bluebird')
function setup(options) {
    let client = createGrpcClient({
        path: __dirname + '/grpc',
        imports: [`${__dirname}/../common/proto`],
        url: options.url
    })
    let userService = Promise.promisifyAll(client.UserService)
    return {
        login(username, password) {
            return userService.loginAsync({ username, password }).then(r => r.result)
        }
    }
}

module.exports = {
    setup
}