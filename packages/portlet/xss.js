
const _ = require('lodash')
const xss = require('xss')

function sanitize(source) {
    if (!/<\w+[^>]*>/.test(source)) return source
    return xss(source, {
        stripIgnoreTag: true,
        stripIgnoreTagBody: ["script"]
    })
}

function sanitizeJson(obj) {
    if (!obj) return obj
    if (_.isArray(obj)) return _.map(obj, item => sanitizeJson(item))
    if (_.isString(obj)) return sanitize(obj)
    if (_.isObject(obj)) {
        _.forOwn(obj, (v, k) => obj[k] = sanitizeJson(v))
    }
    return obj
}

function sanitizeJsonToString(json) {
    return JSON.stringify(sanitizeJson(json))
}

module.exports = {
    sanitize,
    sanitizeJson,
    sanitizeJsonToString
}