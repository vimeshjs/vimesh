const _ = require('lodash')
const cron = require('cron')

function onTick() {
    let context = this
    context.round++
    let currentRound = context.round
    let roundStarted = new Date()
    if (!context.isRunning) {
        context.isRunning = true;
        $logger.info(`[${context.name}] Round ${currentRound} begins. (${roundStarted})`)
        try {
            let promise = context.handler(context.jobConfig, context.jobMemo)
            if (promise && _.isFunction(promise.then)) {
                promise.then(() => {
                    let roundFinished = new Date()
                    $logger.info(`[${context.name}] Round ${currentRound} ends. (${roundFinished} / ${(roundFinished - roundStarted)}ms)`)
                }).catch((ex) => {
                    let roundFinished = new Date()
                    $logger.error(`[${context.name}] Round ${currentRound} fails. (${roundFinished} / ${(roundFinished - roundStarted)}ms)`, ex)
                }).then(() => {
                    context.isRunning = false;
                })
            } else {
                let roundFinished = new Date()
                $logger.info(`[${context.name}] Round ${currentRound} ends. (${roundFinished} / ${(roundFinished - roundStarted)}ms)`)
                context.isRunning = false;
            }
        } catch (ex) {
            let roundFinished = new Date()
            $logger.error(`[${context.name}] Round ${currentRound} fails. (${roundFinished} / ${(roundFinished - roundStarted)}ms)`, ex)
            context.isRunning = false;
        }
    } else {
        $logger.info(`[${context.name}] Round ${currentRound} missed. (${roundStarted})`)
    }
}
function onComplete() {
    let context = this.context
    $logger.info(`The cron job "${context.name}" finishes after ${context.round} rounds`)
}

exports.execute = function (config) {
    let enabled = config.enabled !== false
    if (!enabled) {
        $logger.warn(`Cron job "${config.name}" is disabled!`)
    } else {
        let handler = _.isFunction(config.job) ? config.job : require(config.job)
        let job = cron.job({
            cronTime: config.cron,
            onTick: onTick,
            onComplete: onComplete,
            start: true,
            context: {
                jobConfig: _.omit(config, 'memo'),
                startedAt: new Date(),
                round: 0,
                name: config.name,
                isRunning: false,
                handler: handler,
                jobMemo: config.memo || {}
            }
        })
        if (config.start !== false)
            job.start()
        return job
    }
}