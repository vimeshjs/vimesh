
const sinon = require('sinon')
clock = sinon.useFakeTimers({
    now: new Date(),
    shouldAdvanceTime: true
})
// clock must be initialized before require fixture
require('../fixture.js')
const _ = require('lodash')
const moment = require('moment')
const { formatDate, duration, timeout } = require('@vimesh/utils')
const { executeReportJob } = require('@vimesh/mongodb')
const VM1 = 1001
const VM2 = 1002
const VIN11 = 'T1000001'
const VIN12 = 'T1000002'
const VIN13 = 'T1000003'
const VIN21 = 'G2000001'
const VINS = [VIN11, VIN21, VIN12, VIN13]
const LEVELS = ['info', 'info', 'info', 'error', 'info']
const FORMAT = 'YYYYMMDD'

function generateLogs(begin, count){
    let mnt = moment(begin)
    console.log(`Generate ${count} logs from ${formatDate(mnt)}`)
    let logs = _.map(_.range(1, count + 1), n => {
        let dt = mnt.add(1, 'hours').toDate()
        let level = LEVELS[n % LEVELS.length]
        let vin = VINS[n % VINS.length]
        let fdt =formatDate(dt, FORMAT)
        return {vin, level , msg : `${level} : ${fdt}`, _at : dt}
    })
    return Promise.all(_.map(logs, log => $dao.VehicleLogs._(log._at).add(log)))
}

beforeAll(function(){
    return $mongodb.connected.then(() => {
        return Promise.all(
            [
                $dao.Vehicles.delete({}),
                $dao.VehicleLogs.delete({}),
                $dao.VehicleLogs.listAllWithAffix().then(dts => {
                    return Promise.all(_.map(dts, dt => {
                        let col = $dao.VehicleLogs.getMappings().collection + '_' + dt
                        return $dao.VehicleLogs.getDatabase().collection(col).drop()
                    }))
                }),
                $dao.VehicleLogsDailyReports.delete({}),
            ]
        ).then(r => {
            return Promise.all([
                $dao.Vehicles.add({vmid : VM1, vin: VIN11}),
                $dao.Vehicles.add({vmid : VM1, vin: VIN12}),
                $dao.Vehicles.add({vmid : VM1, vin: VIN13}),
                $dao.Vehicles.add({vmid : VM2, vin: VIN21}),
            ])        
        }).then(()=>{
            executeReportJob(
                'Vehicle Logs Daily Reports',
                '0 */10 * * * *',
                `${__dirname}/configs/VehicleLogs.daily.yaml`
            )
        })
    })
}, 1000 * 60)

test('insert logs into daily collection', function() {
    return generateLogs('2020-01-01', 100)
})
test('generate daily report 1', function() {
    console.log("1 : " + new Date())
    clock.tick(duration('10m')) 
    return timeout('2s')
}, 1000 * 10)
test('insert more logs into daily collection', function() {
    return generateLogs('2020-05-01', 100)
})
test('generate daily report 2', function() {
    console.log("2 : " + new Date())
    clock.tick(duration('10m')) 
    return timeout('2s')
}, 1000 * 10)

test('list all logs', function() {
    return $dao.VehicleLogs.select({
        size : 10000,
        affix : {
            debug : true,
            begin : moment('2020-01-01'),
            end : moment('2020-12-30')
        }
    }).then((r)=>{
        console.log(r.count, r.from)
        //console.log(r.tasks)
    })
})