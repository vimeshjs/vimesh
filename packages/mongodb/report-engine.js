const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const moment = require('moment-timezone')
const Promise = require('bluebird')
const { loadYaml, formatDate } = require('@vimesh/utils')
const { execute } = require('@vimesh/cron')

function buildReports(options) {
    const TIMEZONE = options.TIMEZONE || 'UTC'
    let source = _.isString(options.source) ? $dao[options.source] : options.source
    let target = _.isString(options.target) ? $dao[options.target] : options.target
    let stages = options.stages
    if (!stages) return $logger.error('Parameter stages must be provided!')
    let tmfield = options.timestamp || '_at'
    let ts = options.timeslot || 'day'
    let max = options.max || 10
    let first = null
    let last = null
    let next = null
    let dtype
    let dformat
    let dunit
    switch (ts) {
        case 'hour': dtype = 'dh'; dunit = 'h'; dformat = 'YYYYMMDDHH'; break
        case 'day': dtype = 'dd'; dunit = 'd'; dformat = 'YYYYMMDD'; break
        case 'week': dtype = 'dw'; dunit = 'w'; dformat = 'YYYYWW'; break
        case 'month': dtype = 'dm'; dunit = 'M'; dformat = 'YYYYMM'; break
        default:
            return Promise.reject('Wrong timeslot value!')
    }
    let sort = {}
    sort[`_id.${dtype}`] = -1
    return target.select({ size: 1, sort }).then(r => {
        let cond = {}
        cond[tmfield] = { $exists: true }
        if (r.data.length == 1) {
            last = moment(r.data[0]._id[dtype] + '', dformat).tz(TIMEZONE, true)
            next = moment(last).add(1, dunit).startOf(ts === 'week' ? 'isoWeek' : ts)
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
        let toNow = 0
        if (last) {
            toNow = Math.max(0, moment.duration(moment().diff(last)).as(dunit))
            if (toNow < 1) dates.push(moment(last).subtract(1, dunit))
            dates.push(last)
            if (first) {
                _.each(_.range(0, Math.min(max, Math.ceil(toNow))), function (r) {
                    dates.push(moment(first).add(r, dunit))
                })
            }
        } else if (first) {
            toNow = Math.max(0, moment.duration(moment().diff(first)).as(dunit))
            _.each(_.range(0, Math.min(max, Math.ceil(toNow))), function (r) {
                dates.push(moment(first).add(r, dunit))
            })
        } else {
            return Promise.resolve()
        }
        $logger.info(`Build reports (${ts}, ${TIMEZONE}) from ${options.source} to ${options.target} for ${_.map(dates, dt => formatDate(dt, dformat))})`)

        let defOptions = {
            timezone: TIMEZONE,
            timeslot: ts,
            timestamp: tmfield,
            source: source,
            target: target,
            stages: stages
        }
        return Promise.each(dates, dt => $aggregator.createReportInTimeslot(_.extend({ date: dt }, defOptions)))
    })
}
function executeReportJob(name, cron, configFile) {
    if (!configFile) {
        return $logger.error(`Config file for report job ${name} could not be empty!`)
    }
    if (!_.endsWith(configFile, '.yaml')) configFile += '.yaml'
    if (!fs.existsSync(configFile)) {
        return $logger.error(`Config file ${configFile} for report job ${name} does not exist!`)
    }
    let config = loadYaml(configFile)
    if (!config) {
        return $logger.error(`Config for report job ${name} could not be empty!`)
    }
    if (config.$include) {
        config = _.extend(loadYaml(path.join(path.dirname(configFile), config.$include + '.yaml')), config)
        delete config.$include
    }
    return execute({
        name,
        cron,
        job: () => {
            if (config.type === 'daily') {
                if (config.affix) {
                    return $aggregator.buildDailyReportsWithAffix(config)
                } else {
                    return $aggregator.buildDailyReports(config)
                }
            } else if (config.type === 'now') {
                let options = {
                    date: new Date(),
                    timeslot: config.timeslot || 'day',
                    timestamp: config.timestamp,
                    source: config.source,
                    target: config.target,
                    stages: config.stages
                }
                return $aggregator.createReportInTimeslot(options)
            } else {
                if (config.affix) {
                } else {
                    return buildReports(config)
                }
            }
        }
    })
}
function setupReportJobs(settings) {
    let configDir = settings.configDir
    _.each(settings.jobs, (val, name) => {
        let cron = _.isString(val) ? val : val && val.cron
        if (!cron) {
            return $logger.error(`No cron defined for ${name}`)
        }
        executeReportJob(name, cron, path.join(configDir, name))
    })
}

module.exports = {
    setupReportJobs,
    executeReportJob
}