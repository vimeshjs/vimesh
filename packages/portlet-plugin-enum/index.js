const _ = require('lodash')

module.exports = (portlet) => {
    portlet.allEnums = {}
    portlet.on('decorateResponse', (req, res) => {
        res.locals._allEnums = portletServer.allEnums
        res.enums = name => {
            return res.locals._allEnums[name]
        }
    })
    portlet.on('beforeSetupRoutes', () => {
        portlet.loadAssets('enums', '.yaml', (rs) => {
            portlet.allEnums = _.merge({}, rs)
        })
    })
}