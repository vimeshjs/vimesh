
const sinon = require('sinon')
clock = sinon.useFakeTimers({
    now: new Date(),
    shouldAdvanceTime: true
})
// clock must be initialized before require fixture
require('../fixture.js')
const _ = require('lodash')
const path = require('path')
const moment = require('moment')
const { formatDate, duration, timeout } = require('@vimesh/utils')
const { executeReportJob } = require('@vimesh/mongodb')
const VIN = "T1000002"
const VMIDS = [1001, 1002, 1003]
function generateUpdateStatusBySession(begin, step, count, status) {
    let mnt = moment(begin).startOf('hour')
    console.log(`Generate ${count} UpdateStatusBySession from ${formatDate(mnt)}`)
    let vs = _.map(_.range(1, count + 1), n => {
        let dt = mnt.add(step, 'minute').toDate()
        let vin = VIN + n
        let vmid = VMIDS[n % 3]
        let cmp_id = 2002
        let sch_id = 20028
        //let batch_number = BNS[n % 3]
        return { vin, vmid, status, cmp_id, sch_id, _at: dt }
    })
    return $dao.UpdateStatusBySessionV2.set(vs).then(r => vs)
}
beforeAll(function () {
    return $mongodb.connected.then(() => {
        return Promise.all(
            [
                $dao.UpdateStatusBySessionV2.delete({}),
                $dao.UpdateStatusBySessionHourlyReportsV2.delete({}),
                $dao.UpdateStatusBySessionDailyReportsV2.delete({}),
                $dao.UpdateStatusBySessionWeeklyReportsV2.delete({}),
                $dao.UpdateStatusBySessionMonthlyReportsV2.delete({}),
            ]
        ).then(() => {
            executeReportJob(
                'Update Status By Session Hourly Reports',
                '59 59 */1 * * *',
                `${__dirname}/configs/UpdateStatusBySessionHourlyReportsV2.yaml`
            )
        })
    })
}, 1000 * 60)

test('1/insert vehicles into collection', function () {
    return generateUpdateStatusBySession(new Date("2020-01-01"), 1, 50, 'init')
})
test('1/generate daily report', function () {
    console.log("1/ " + new Date())
    clock.tick(duration('1h'))
    return timeout('2s')
}, 1000 * 10)

test('2/insert vehicles into collection', function () {
    return generateUpdateStatusBySession(new Date("2020-02-01"), 1, 50, 'success')
})
test('2/generate daily report', function () {
    console.log("2/ " + new Date())
    clock.tick(duration('1h'))
    return timeout('2s')
}, 1000 * 10)
