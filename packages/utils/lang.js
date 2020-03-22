const _ = require('lodash')
const { duration } = require('./datetime')

function trim(s) {
    if (!s) return null;
    return s.replace(/(^\s*)|(\s*$)/g, "");
}

function retryPromise(fn, ms = 1000) {
    return new Promise(resolve => {
        fn()
            .then(resolve)
            .catch(() => {
                setTimeout(() => {
                    retryPromise(fn, ms).then(resolve);
                }, ms);
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

module.exports = {
    trim,
    retryPromise,
    timeout,
    next,
    pretty
}