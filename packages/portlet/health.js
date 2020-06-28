const _ = require('lodash')
const { getHealthStatus, getClientIP } = require('@vimesh/utils')
function setupHealthCheck(portletServer) {
    let path = portletServer.config.health
    if (path) {
        let prefix = portletServer.standalone ? '' : `/@${portletServer.portlet}`
        portletServer.app.use(`${prefix}/${path}`, (req, res) => {
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

module.exports = {
    setupHealthCheck
}