const _ = require('lodash')
const moment = require('moment-timezone')
const TIMEZONE = 'Asia/Shanghai'
function getJwtSecret(config) {
    return _.get(config, 'passport.jwt.secret') || 'vimesh-secret'
}
function formatDate(dt, format){
    return moment(dt).tz(TIMEZONE).format(format || 'MM-DD HH:mm')
}
module.exports = {
    getJwtSecret,
    formatDate
}