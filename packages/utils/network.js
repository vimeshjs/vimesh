const _ = require('lodash')
const { trim } = require('./lang')

function getFullUrl(url, params, req) {
    var ps = _.map(params, function (v, k) { return k + "=" + encodeURIComponent(v) }).join('&')
    if (ps && url)
        url += (url.indexOf('?') > 0 ? '&' : '?') + ps;
    if (req && url)
        url = url.replace('{this}', req.protocol + "://" + req.get('host'));
    return url;
}

function getClientIP(req) {
    var ip = req.headers['push-real-ip'] ||
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress;
    var oip = ip;
    if (req.query.ip)
        ip = req.query.ip;
    if (ip && ip.indexOf(',') != -1) {
        var ips = ip.split(',');
        ip = trim(ips[0])
        if (!ip && ips.length > 1)
            ip = trim(ips[1])
        if (ip == '127.0.0.1' && ips.length > 1) {
            ip = trim(ips[1])
        }
    }
    if (ip && ip.indexOf('::ffff:') == 0) {
        ip = ip.substring('::ffff:'.length)
    }
    return ip;
}

module.exports = {
    getFullUrl,
    getClientIP
}