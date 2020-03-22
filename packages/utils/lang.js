const _ = require('lodash')
const { duration } = require('./datetime')

function trim(s) {
    if (!s) return null;
    return s.replace(/(^\s*)|(\s*$)/g, "");
}

function getPropertyPaths(rows, path, obj) {
    _.each(obj, (v, k) => {
        if (_.isString(v)) {
            rows.push([path ? path + '.' + k : k, v])
        } else {
            getPropertyPaths(rows, path ? path + '.' + k : k, v)
        }
    })
}
function copyProperties(dst, src) {
    let rows = []
    getPropertyPaths(rows, '', src)
    _.each(rows, item => {
        let parts = item[0].split('.')
        let path = parts[0]
        for (let i = 0; i < parts.length - 1; i++) {
            if (!_.get(dst, path)) _.set(dst, path, {})
            path += '.' + parts[i + 1]
        }
        _.set(dst, item[0], item[1])
    })
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
    copyProperties,
    retryPromise,
    timeout,
    next,
    pretty
}