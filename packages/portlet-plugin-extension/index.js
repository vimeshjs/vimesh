const _ = require('lodash')
const { getSortedExtensions } = require('./extensions')

function extensionsByZone(name, options) {
    let permissions = options.data.root.$permissions || {}
    let extensionsInZone = options.data.root._extensionsByZone && options.data.root._extensionsByZone[name]
    let extensions = getSortedExtensions(name, extensionsInZone, options.data.root.$allow)
    let variable = options.hash.assignTo
    if (variable) {
        this[variable] = extensions
    } else {
        return JSON.stringify(extensions)
    }
}

module.exports = (portlet) => {
    portlet.ready.extensions = false
    portlet.allExtensionsByZone = {}
    portlet.on('decorateResponse', (req, res) => {
        res.locals._extensionsByZone = portlet.allExtensionsByZone        
    })

    portlet.on('beforeSetupRoutes', () => {
        portlet.loadAssets('extensions', '.yaml', (rs) => {
            _.each(rs, (r, key) => {
                let pos = key.indexOf('/')
                let zone = pos == -1 ? key : key.substring(0, pos)
                portlet.allExtensionsByZone[zone] = _.merge(portlet.allExtensionsByZone[zone], r)
            })
            portlet.ready.extensions = true
        })
    })

    portlet.registerHbsHelpers({ extensionsByZone })
}
