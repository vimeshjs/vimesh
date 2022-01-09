const _ = require('lodash')
const { getHealthStatus } = require('./health')

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

module.exports = (portlet) => {
    let path = portlet.config.health || '_health'
    if (path) {
        let prefix = portlet.urlPrefix
        portlet.app.use(`${prefix}/${path}`, (req, res) => {
            let client = {
                ip: getClientIP(req),
                headers: req.headers,
                query: req.query,
                body: req.body
            }
            res.json(_.extend(client, getHealthStatus()))
        })
    }
}