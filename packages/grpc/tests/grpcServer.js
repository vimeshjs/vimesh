const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { setupGrpcService } = require('..')  

setupLogger()
setupGrpcService({
    path : __dirname + '/services',
    port : 2000
})