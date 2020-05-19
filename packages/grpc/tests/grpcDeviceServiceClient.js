const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { createGrpcClient, toTimestamp } = require('..')

setupLogger()

let client = createGrpcClient({
    path: __dirname + '/services/device-service',
    proto: 'device/device.proto',
    url: 'localhost:2000'
})

client.queryDevicesAll({
    request: {
        page_no: 2,
        page_size: 10
    },
    name: 'jacky',
    start_create_time: toTimestamp(new Date())
}, (err, r) => {
    console.log(err, r)
})
