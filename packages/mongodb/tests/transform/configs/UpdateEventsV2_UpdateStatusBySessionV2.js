const _ = require('lodash')
let USS = {}
const UpdateSessionStatus = [
    "init",
    "running",
    "success",
    "timeout",
    "failure",
    "cancelled"
]
_.each(UpdateSessionStatus, v => USS[v] = v)
let FINALS = [USS.success, USS.timeout, USS.failure, USS.cancelled]

module.exports = (item) => {
    if (item.state == 0){ 
        let data = _.extend({
            status: USS.init,
            start_at: item._at,
        }, _.pick(item, 'vin', 'vmid', 'sch_id', 'cmp_id', 'pkg_id', 'mode', 'all'))
        for (let i = 0; i < item.all; i++){
            data[`s_${i}`] = false
        }
        return {
            _id : item.usid,
            _at : item._at,
            $insert$ : data
        }
    } else if (item.state == 2) { 
        return {
            _id : item.usid, 
            _at : item._at,
            end_at : item._at,
            status : USS.cancelled,
            $when$ : {status : {$nin : FINALS}}
        }
    } else if (_.includes([7, 8, 10, 12, 14], item.state)) { 
        return {
            _id : item.usid, 
            _at : item._at,
            end_at : item._at,
            status : USS.failure,
            error_code : item.state,
            $when$ : {status : {$nin : FINALS}}
        }
    } else if (item.state == 6) {
        let ops = []
        let data1 = {
            _id : item.usid,
            _at : item._at,
            status : USS.running,
            $when$ : {status : {$in : [USS.init, USS.running]}}
        }
        data1[`s_${item.no}`] = true
        let data2 = {
            _id : item.usid, 
            _at : item._at,
            end_at : item._at,
            status : USS.success,
            $when$ : {status : {$nin : FINALS}}
        }
        for (let i = 0; i < item.all; i++){
            data2.$when$[`s_${i}`] = {$eq : true}
        }
        return [data1, data2]
    } else {
        return {
            _id : item.usid, 
            _at : item._at,
            status : USS.running,
            $when$ : {status : {$in : [USS.init, USS.running]}}
        }
    }
}