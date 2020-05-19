const _ = require('lodash')
const { fromTimestamp} = require('@vimesh/grpc')
let devices = [
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

//rpc queryDevicesAll (QueryDevicesCriteria) returns (PageDevicesResult );

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

//rpc queryCriteria(QueryCriteria) returns(QueryResult);
function queryCriteria(call) {
    let id = +call.request.id
    let p = products.find(p => p.id === id)
    return p ? Promise.resolve(p) : Promise.reject(`Product "${id}" does not exist`)
}
module.exports = {
    queryDevicesAll,
    queryCriteria
}