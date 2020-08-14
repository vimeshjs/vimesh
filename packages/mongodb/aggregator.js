const _ = require('lodash')
const moment = require('moment-timezone')
const { formatDate } = require('@vimesh/utils')

$aggregator.MAX_DAYS = 10

$aggregator.createReportInTimeslot = function (options) {
    const TIMEZONE = options.timezone || 'UTC'
    let dt = moment(options.date).tz(TIMEZONE)
    let ts = options.timeslot
    let tmfield = options.timestamp
    let stages = options.stages
    let source = _.isString(options.source) ? $dao[options.source] : options.source
    let target = _.isString(options.target) ? $dao[options.target] : options.target
    let dtype
    let dformat
    switch (ts) {
        case 'hour': dtype = 'dh'; dformat = 'YYYYMMDDHH'; break
        case 'day': dtype = 'dd'; dformat = 'YYYYMMDD'; break
        case 'week': dtype = 'dw'; dformat = 'YYYYWW'; break
        case 'month': dtype = 'dm'; dformat = 'YYYYMM'; break
        default:
            return Promise.reject('Wrong timeslot value!')
    }
    let st = moment(dt).startOf(ts === 'week' ? 'isoWeek' : ts)
    let en = moment(dt).endOf(ts === 'week' ? 'isoWeek' : ts)
    let range = {}
    range[tmfield] = { $gte: st.toDate(), $lte: en.toDate() }
    let fullStages = _.concat([{ $match: range }], stages)
    let d = +dt.format(dformat)
    return source.aggregate(fullStages).then(rs => {
        let all = _.map(rs.data, item => {
            item._id[dtype] = d
            return item
        })
        if (all.length > 0)
            $logger.info(`Create ${ts}ly report (${all.length} rows : ${source.getFullName()} -> ${target.getFullName()}) @${d}(${TIMEZONE})`)
        return target ? target.set(all) : all
    })
}
function createOneDayReportTask(dao, dt, tmfield, stages) {
    let st = moment(dt).startOf('day')
    let en = moment(dt).endOf('day')
    let range = {}
    range[tmfield] = { $gte: st.toDate(), $lte: en.toDate() }
    let fullStages = _.concat([{ $match: range }], stages)
    let dd = +dt.format('YYYYMMDD')
    return dao.aggregate(fullStages).then(rs => {
        return _.map(rs.data, item => {
            item._id.dd = dd
            return item
        })
    })
}
$aggregator.buildDailyReports = function (options) {
    const TIMEZONE = options.timezone || 'UTC'
    let source = _.isString(options.source) ? $dao[options.source] : options.source
    let target = _.isString(options.target) ? $dao[options.target] : options.target
    let stages = options.stages
    let tmfield = options.timestamp
    let first = null
    let last = null
    let next = null
    return target.select({ size: 1, sort: { "_id.dd": -1 } }).then(r => {
        let cond = {}
        cond[tmfield] = { $exists: true }
        if (r.data.length == 1) {
            last = moment(r.data[0]._id.dd + '').tz(TIMEZONE, true)
            next = moment(last).add(1, 'days').startOf('day')
            cond[tmfield] = { $gte: next.toDate() }
        }
        let ssort = {}
        ssort[tmfield] = 1
        return source.select({ cond, size: 1, sort: ssort })
    }).then(r => {
        if (r.data.length == 1) {
            first = moment(r.data[0][tmfield]).tz(TIMEZONE)
        }
        let dates = []
        let daysToNow = 0
        if (last) {
            daysToNow = Math.max(0, moment.duration(moment().diff(last)).as('days'))
            if (daysToNow < 1) dates.push(moment(last).subtract(1, 'days'))
            dates.push(last)
            if (first) {
                _.each(_.range(0, Math.min($aggregator.MAX_DAYS, Math.ceil(daysToNow))), function (r) {
                    dates.push(moment(first).add(r, 'days'))
                })
            }
        } else if (first) {
            daysToNow = Math.max(0, moment.duration(moment().diff(first)).as('days'))
            _.each(_.range(0, Math.min($aggregator.MAX_DAYS, Math.ceil(daysToNow))), function (r) {
                dates.push(moment(first).add(r, 'days'))
            })
        } else {
            return Promise.resolve()
        }
        $logger.info(`Build daily reports for ${options.source} into ${options.target} for ${_.map(dates, dt => formatDate(dt, 'YYYYMMDD'))})`)

        return Promise.all(_.map(dates, dt => createOneDayReportTask(source, dt, tmfield, stages))).then(rs => {
            target.set(_.flatten(rs))
        })
    })
}

$aggregator.buildDailyReportsWithAffix = function (options) {
    let source = _.isString(options.source) ? $dao[options.source] : options.source
    let target = _.isString(options.target) ? $dao[options.target] : options.target
    let stages = options.stages
    return Promise.all(
        [
            target.select({ size: 1, sort: { "_id.dd": -1 } }),
            source.listAllWithAffix()
        ]
    ).then(rs => {
        let last = 0
        if (rs[0].data.length == 1) last = rs[0].data[0]._id.dd
        let dts = _.sortBy(rs[1])
        let first = _.findIndex(dts, dt => dt >= last)
        if (first > 0) first-- // 重新计算前一天      
        dts = _.slice(dts, first)
        $logger.info(`Build daily reports with affix for ${options.source} into ${options.target} (${last} : ${dts[0]} - ${dts[dts.length - 1]})`)
        let tasks = _.map(dts, dt => {
            let dd = +dt
            return source._(dd).aggregate(stages).then(rs => {
                return _.map(rs.data, item => {
                    item._id.dd = dd
                    return item
                })
            })
        })
        return Promise.all(tasks).then(rs => {
            target.set(_.flatten(rs))
        })
    })
}