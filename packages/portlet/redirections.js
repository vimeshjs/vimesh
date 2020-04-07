const _ = require('lodash')
const {getSortedMenus, getFirstMenu} = require('./menus')

function setupRedirections(portletServer){
    let app = portletServer.app
    let config = portletServer.config
    _.each(config.redirects, function(url, path) {
        path = path.trim()
        let menu = null
        if (path.startsWith('menu://')){
            let parts = path.substring('menu://'.length).split('/')
            menu = { zone: parts[0], item : parts[1]}
        }
        app.get(path, function(req, res, next){
            if (menu){
                let menusInZone = portletServer.allMenusByZone[menu.zone]
                if (!menusInZone) return next()
                let menus = getSortedMenus('', menu.zone, menusInZone)
                let first = getFirstMenu(menus)
                if (first){
                    res.redirect(first.uri)
                } else {
                    next()
                }
            } else {
                res.redirect(url)
            }
        })
    })
}

module.exports = {
    setupRedirections
}