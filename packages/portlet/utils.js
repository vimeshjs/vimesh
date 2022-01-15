const _ = require('lodash')

function formatError(err, code) {
    let json = {
        status: 'error',
        message: _.isString(err) ? err : err && err.message || err + '',
        code
    }
    return json
}

function formatOK(msg, code) {
    let json = {
        status: 'ok',
        message: msg,
        code
    }
    return json
}

module.exports = {
    formatOK,
    formatError
}