const _ = require('lodash')
const fs = require('fs')
const moment = require('moment-timezone')
const { loadYaml, duration, formatDate } = require('@vimesh/utils')
const { execute } = require('@vimesh/cron')
const path = require('path')
const Promise = require('bluebird')
const ReadPreference = require('mongodb').ReadPreference;
const BATCH = 1000
function memUsagePercent() {
    let mu = process.memoryUsage()
    return Math.round(mu.heapUsed * 100 / mu.heapTotal)
}
function joinAndTransform(context) {
    if (context.items.length == 0) return Promise.resolve()
    let transItems = []
    let items = context.items
    context.items = []
    return (context.join ? context.source.join(items, context.join) : Promise.resolve(items)).then(r => {
        if (context.handler) {
            _.each(items, item => {
                let rs = context.handler(item)
                if (_.isArray(rs)) {
                    if (rs.length > 0) {
                        context.transCount += rs.length
                        transItems = _.concat(transItems, rs)
                    }
                } else if (rs) {
                    context.transCount++
                    transItems.push(rs)
                }
            })
        } else {
            context.transCount += items.length
            transItems = items
        }
    }).then(r => {
        let mup = memUsagePercent()
        $logger.info(`Batch transform ${context.count}/${context.jobMemo.count} ${context.source.getFullName()} into ${context.transCount} ${context.target.getFullName()}(+${transItems.length}, #${mup}%) @ ${formatDate(context.jobMemo.last)}`)
        if (transItems.length > 0) {
            if (context.type === 'update')
                return context.target.set(transItems).catch((ex) => { /* Ignore duplicate key error */ })
            else
                return context.target.add(transItems).catch((ex) => { /* Ignore duplicate key error */ })
        }
    })
}
function batchTransform(context) {
    return context.cursor.next().then(item => {
        if (item) {
            context.count++
            context.items.push(item)
            context.jobMemo.last = item[context.config.source.timestamp]
            context.jobMemo.count++
            if (context.items.length >= BATCH) {
                return joinAndTransform(context).then(r => {
                    let mup = memUsagePercent()
                    if (mup >= 95)
                        return $logger.warn(`Too much memory used (${mup}%), stop here!`)
                    return batchTransform(context)
                })
            }
            return batchTransform(context)
        } else {
            if (context.items.length > 0)
                return joinAndTransform(context)
        }
    })
}
function transformSingleToSingle(config, handler, jobMemo) {
    let source = $dao[config.source.model]
    let tmSource = config.source.timestamp
    let target = $dao[config.target.model]
    let tmTarget = config.target.timestamp
    let dur = Math.floor(duration(config.overlap || '10s') / 1000)
    let sortTarget = {}
    sortTarget[tmTarget] = -1
    if (undefined == jobMemo.count) jobMemo.count = 0
    return (jobMemo.last ? Promise.resolve(jobMemo.last) : target.select({ size: 1, sort: sortTarget }).then(r => {
        if (r.data.length == 1) {
            let tm = r.data[0][tmTarget]
            if (!tm) {
                $logger.error(`Timestamp (${tmTarget}) is not found in ${JSON.stringify(r.data[0])}`)
            }
            return tm
        }
        return null
    })).then(r => {
        let cond = {}
        if (r) {
            let tm = moment(r).subtract(dur, 'seconds').toDate()
            cond[tmSource] = { $gte: tm }
            $logger.info(`Transform from ${formatDate(tm)}`)
        }
        let sort = {}
        sort[tmSource] = 1
        return source.getModel().find(cond, { sort: sort, readPreference: ReadPreference.SECONDARY_PREFERRED });
    }).then(cursor => {
        let context = {
            type: config.type || 'insert',
            count: 0,
            transCount: 0,
            items: [],
            join: config.source.join,
            cursor,
            source,
            target,
            handler,
            config,
            jobMemo
        }
        return batchTransform(context).catch(ex => { $logger.error(`${ex}`); console.log(ex) }).then(r => cursor.close())
    })
}

function doTransform(jobConfig, jobMemo) {
    let config = jobConfig.config
    if (!config) {
        return Promise.reject(`There are no transform config defined : ${jobConfig}`)
    } else {
        if (!config.yaml.source.affix && !config.yaml.target.affix) {
            return transformSingleToSingle(config.yaml, config.handler, jobMemo)
        }
        return Promise.reject(`Transform config is wrong! (${JSON.stringify(config)})`)
    }
}

function executeTransformJob(name, cron, configFile) {
    let yamlPath = path.join(configFile + '.yaml')
    let jsPath = path.join(configFile + '.js')
    let handler = null
    if (!fs.existsSync(yamlPath) || !fs.existsSync(jsPath)) {
        return $logger.error(`Transform job ${name} has no yaml or js config @ ${configFile}`)
    }
    handler = require(jsPath)
    if (!_.isFunction(handler)) {
        return $logger.error(`You must export a item transform handler @ ${jsPath}`)
    }

    return execute({
        name,
        cron,
        job: doTransform,
        config: {
            handler,
            yaml: loadYaml(yamlPath)
        }
    })
}
function setupTransformJobs(settings) {
    let configDir = settings.configDir
    _.each(settings.jobs, (val, name) => {
        let cron = _.isString(val) ? val : val && val.cron
        if (!cron) {
            return $logger.error(`No cron defined for ${name}`)
        }
        executeTransformJob(name, cron, path.join(configDir, name))
    })
}
module.exports = {
    setupTransformJobs,
    executeTransformJob
}