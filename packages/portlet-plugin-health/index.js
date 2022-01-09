const _ = require('lodash')
const { getHealthStatus, getClientIP } = require('@vimesh/utils')

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