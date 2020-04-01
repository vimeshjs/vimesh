const _ = require('lodash')

function getJwtSecret(config) {
    return _.get(config, 'passport.jwt.secret') || 'vimesh-secret'
}

module.exports = {
    getJwtSecret
}