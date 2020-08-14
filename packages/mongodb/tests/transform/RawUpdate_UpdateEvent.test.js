
const sinon = require('sinon')
clock = sinon.useFakeTimers({
    now: new Date(),
    shouldAdvanceTime: true
})
// clock must be initialized before require fixture
require('../fixture.js')
const _ = require('lodash')
const moment = require('moment')
var ObjectID = require('mongodb').ObjectID;
const { formatDate, loadYaml, duration, timeout } = require('@vimesh/utils')
const { executeTransformJob } = require('@vimesh/mongodb')
function getObjectID(){
    return new ObjectID()
}
const VMIDS = [1001, 1002, 1003]
const CMPIDS = [2001, 2002]
const SCHIDS = [20011, 20012, 20028, 20029]

const VIN11 = 'T1000001'
const VIN12 = 'T1000002'
const VIN13 = 'T1000003'
const VIN21 = 'G2000001'
const VINS = [VIN11, VIN21, VIN12, VIN13]

const updateSessions = [
    {
        _id : getObjectID(),
        vmid : 1351,
        vin: VINS[0],
        scheduleId : SCHIDS[0],
        campaignId : CMPIDS[0],
        _at : new Date(),
        resp: {
            mode : 'by-user'
        },
        params:{
            ecus:{
                ECU0:{name: 'ECU0'},
                ECU1:{name: 'ECU1'},
                ECU2:{name: 'ECU2'},
            }
        },
        ups: [
            {
                _id: getObjectID(),
                emid: 100,
                ecu: {
                    ecu_name: 'ECU0'
                }
            },
            {
                _id: getObjectID(),
                emid: 101,
                ecu: {
                    ecu_name: 'ECU1'
                }
            },
            {
                _id: getObjectID(),
                emid: 102,
                ecu: {
                    ecu_name: 'ECU2'
                }
            }
        ]
    },{
        _id : getObjectID(),
        vmid : 1351,
        vin: VINS[1],
        scheduleId : SCHIDS[1],
        campaignId : CMPIDS[0],
        _at : new Date(),
        resp: {
            mode : 'by-user'
        },
        params:{
            ecus:{
                ECU0:{name: 'ECU0'},
                ECU1:{name: 'ECU1'},
                ECU2:{name: 'ECU2'},
            }
        },
        ups: [
            {
                _id: getObjectID(),
                emid: 100,
                ecu: {
                    ecu_name: 'ECU0'
                }
            },
            {
                _id: getObjectID(),
                emid: 101,
                ecu: {
                    ecu_name: 'ECU1'
                }
            },
            {
                _id: getObjectID(),
                emid: 102,
                ecu: {
                    ecu_name: 'ECU2'
                }
            }
        ]
    },{
        _id : getObjectID(),
        vmid : 1351,
        vin: VINS[2],
        scheduleId : SCHIDS[2],
        campaignId : CMPIDS[1],
        _at : new Date(),
        resp: {
            mode : 'auto'
        },
        params:{
            ecus:{
                ECU0:{name: 'ECU0'},
                ECU1:{name: 'ECU1'},
                ECU2:{name: 'ECU2'},
            }
        },
        ups: [
            {
                _id: getObjectID(),
                emid: 100,
                ecu: {
                    ecu_name: 'ECU0'
                }
            },
            {
                _id: getObjectID(),
                emid: 101,
                ecu: {
                    ecu_name: 'ECU1'
                }
            },
            {
                _id: getObjectID(),
                emid: 102,
                ecu: {
                    ecu_name: 'ECU2'
                }
            }
        ]
    },{
        _id : getObjectID(),
        vmid : 1351,
        vin: VINS[0],
        scheduleId : SCHIDS[3],
        campaignId : CMPIDS[1],
        _at : new Date(),
        resp: {
            mode : 'auto'
        },
        params:{
            ecus:{
                ECU0:{name: 'ECU0'},
                ECU1:{name: 'ECU1'},
                ECU2:{name: 'ECU2'},
            }
        },
        ups: [
            {
                _id: getObjectID(),
                emid: 100,
                ecu: {
                    ecu_name: 'ECU0'
                }
            },
            {
                _id: getObjectID(),
                emid: 101,
                ecu: {
                    ecu_name: 'ECU1'
                }
            },
            {
                _id: getObjectID(),
                emid: 102,
                ecu: {
                    ecu_name: 'ECU2'
                }
            }
        ]
    }
]
function generateRawUpdate(begin, count){
    let mnt = moment(begin)
    console.log(`Generate ${count} RawUpdate from ${formatDate(mnt)}`)
    let vs = _.map(_.range(1, count + 1), n => {
        let dt = mnt.add(1, 'minutes').toDate()
        let did = updateSessions[n % updateSessions.length]._id
        let data1 = _.map(_.range(0, 3), i => {
            return {
                "ecu" : 'ECU' + i,
                "state" : 0
            }
        })
        let data2 = _.map(_.range(0, 3), i => {
            return {
                "ecu" : 'ECU' + i,
                "state" : n % 2 ? 6 : 2
            }
        })
        //错误数据，但是统计的时候要可以规避掉
        let data3 = _.map(_.range(0, 3), i => {
            return {
                "ecu" : 'ECU' + i,
                "state" : 0
            }
        })
        return { did , data: _.concat(data1, data2, data3), _at : dt, s_at : dt.valueOf()}
    })
    return $dao.RawUpdate.add(vs)
}

beforeAll(function(){
    return $mongodb.connected.then(() => {
        return Promise.all(
            [
                $dao.UpdateSession.delete({}),
                $dao.RawUpdate.delete({}),
                $dao.UpdateEventsV2.delete({}),
                $dao.UpdateStatusBySessionV2.delete({}),
            ]
        )
    }).then(() => {
        return Promise.all(
            [
                $dao.UpdateSession.set(updateSessions)
            ]
        )
    }).then(()=>{
        executeTransformJob(
            'Transform RawUpdate to UpdateEventsV2',
            '0 */1 * * * *',
            __dirname + '/configs/RawUpdate_UpdateEventsV2'
        )

        executeTransformJob(
            'Transform UpdateEventV2 to UpdateStatusBySessionV2',
            '0 */1 * * * *',
            __dirname + '/configs/UpdateEventsV2_UpdateStatusBySessionV2'
        )
    })
}, 1000 * 60)

test('1/init', function() {
    return Promise.all(
        [
            $dao.RawUpdate.count({}),
            $dao.UpdateEventsV2.count({}),
            $dao.UpdateStatusBySessionV2.count({}),
        ]
    ).then((rs)=>{
        expect(rs[0]).toBe(0)
        expect(rs[1]).toBe(0)
        expect(rs[2]).toBe(0)
    })
})

test('1/insert RawUpdate into collection', function() {
    return generateRawUpdate('2019-01-01', 100)
})
test('1/transform to UpdateEventsV2', function() {
    console.log("1/ " + new Date())
    clock.tick(duration('1m')) 
    return timeout('2s')
}, 1000 * 10)

test('2/insert RawUpdate into collection', function() {
    return generateRawUpdate('2020-01-01', 100)
})
test('2/transform to UpdateEventsV2 && UpdateStatusBySessionV2', function() {
    console.log("2/ " + new Date())
    clock.tick(duration('1m')) 
    return timeout('2s')
}, 1000 * 100)


test('3/transform to UpdateStatusBySessionV2', function() {
    console.log("3/ " + new Date())
    clock.tick(duration('1m')) 
    return timeout('2s')
}, 1000 * 100)