const { setupGrpcService } = require('@vimesh/grpc')
function setup(options) {
    setupGrpcService({
        path: __dirname + '/grpc',
        imports: [`${__dirname}/../common/proto`],
        port: options.port
    })
}

module.exports = {
    setup
}