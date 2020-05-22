const _ = require('lodash')
const { fromTimestamp} = require('@vimesh/grpc')

const ResponseCode = {
    DEFAULT : 0,
    FAIL : 500,
    SUCCESS : 200
}
function queryDevicesAll(call) {
    console.log(call.request)
    console.log(fromTimestamp(call.request.start_create_time))
    return Promise.resolve({
        devices: [],
        pageResponse: {
            total_count: 100,
            page_no: 1,
            page_size: 10
        },
        result:{
            code: ResponseCode.SUCCESS,
            msg: 'Success!'
        }
    })
}

function queryCriteria(call) {
    return Promise.resolve()
}
module.exports = {
    queryDevicesAll,
    queryCriteria
}