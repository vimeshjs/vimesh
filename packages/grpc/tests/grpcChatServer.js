const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { setupGrpcService } = require('..')  

setupLogger()
module.exports = setupGrpcService({
    path : __dirname + '/services/chat',
    port : 2000,
    promisify: false
})