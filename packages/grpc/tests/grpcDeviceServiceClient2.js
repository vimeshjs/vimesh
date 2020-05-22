const _ = require('lodash')
const Promise = require('bluebird')
const { setupLogger } = require('@vimesh/logger')
const { createGrpcClient, toTimestamp } = require('..')

setupLogger()

let client = createGrpcClient({
    path: __dirname + '/services/device-service/device',
    imports: [__dirname + '/services/device-service'],
    url: 'localhost:2000'
})

let deviceService = Promise.promisifyAll(client.DevicesService)
deviceService.queryDevicesAllAsync({
    request: {
        page_no: 2,
        page_size: 10
    },
    name: 'jacky',
    start_create_time: toTimestamp(new Date())
}).then(r => {
    console.log(r)
})
