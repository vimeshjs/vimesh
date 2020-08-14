
const sinon = require('sinon')
clock = sinon.useFakeTimers({
    now: new Date(),
    shouldAdvanceTime: true
})
// clock must be initialized before require fixture
require('../fixture.js')
const _ = require('lodash')
const moment = require('moment')
const { formatDate, loadYaml, duration, timeout } = require('@vimesh/utils')
const { executeReportJob } = require('@vimesh/mongodb')
const { setupReportJobs } = require('../../report-engine.js')
const VMIDS = [1001, 1002, 1003]
const BNS = ['X1', 'Y2', 'Z3']
const VIN = 'T100000'
const FORMAT = 'YYYYMMDD'

function generateVehicles(begin, count) {
    let mnt = moment(begin)
    console.log(`Generate ${count} vehicles from ${formatDate(mnt)}`)
    let vs = _.map(_.range(1, count + 1), n => {
        let dt = mnt.add(1, 'hours').toDate()
        let vin = VIN + formatDate(dt, "YYYYMMDDHH")
        let vmid = VMIDS[n % 3]
        let batch_number = BNS[n % 3]
        return { vin, vmid, batch_number, activated_at: dt }
    })
    return $dao.Vehicles.set(vs)
}

beforeAll(function () {
    return $mongodb.connected.then(() => {
        return Promise.all(
            [
                $dao.Vehicles.delete({}),
                $dao.VehiclesDailyReportsV2.delete({}),
            ]
        ).then(() => {
            setupReportJobs({
                configDir : __dirname + '/configs',
                jobs: {
                    'Vehicles.daily' : '0 */10 * * * *',
                    'VehicleLogs.daily' : '0 */10 * * * *'
                }
            })
        })
    })
}, 1000 * 60)

test('1/insert vehicles into collection', function () {
    return generateVehicles('2020-01-01', 100)
})
test('1/generate daily report', function () {
    console.log("1/ " + new Date())
    clock.tick(duration('10m'))
    return timeout('2s')
}, 1000 * 10)

test('2/insert vehicles into collection', function () {
    return generateVehicles('2020-05-01', 100)
})
test('2/generate daily report', function () {
    console.log("2/ " + new Date())
    clock.tick(duration('10m'))
    return timeout('2s')
}, 1000 * 10)
