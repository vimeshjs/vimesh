const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { setupGrpcService } = require('..')  

setupLogger()
module.exports = setupGrpcService({
    path: __dirname + '/services/device-service/device',
    imports: [__dirname + '/services/device-service'],
    port : 2000
})
