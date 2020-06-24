const _ = require('lodash')
const { duration } = require('./datetime')

function retryPromise(fn, ms = 1000) {
    return new Promise(resolve => {
        fn().then(resolve).catch(() => {
            setTimeout(() => {
                retryPromise(fn, ms).then(resolve);
            }, ms)
        })
    })
}

function timeout(dur) {
    return new Promise((resolve) => {
        setTimeout(resolve, duration(dur))
    })
}

function next() {
    return new Promise((resolve) => {
        process.nextTick(resolve)
    })
}

function pretty(strOrJson) {
    if (!strOrJson) return "";
    if (_.isString(strOrJson)) {
        try {
            strOrJson = JSON.parse(strOrJson)
        } catch (ex) {
        }
    }
    return JSON.stringify(strOrJson, null, 2)
}

function toTemplate(str) {
    return new Function("data", "with (data){return `" + str + "`}");
}

module.exports = {
    retry: retryPromise,
    retryPromise,
    timeout,
    next,
    pretty,
    toTemplate
}