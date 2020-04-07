const _ = require('lodash')
const { getSortedMenus, getFirstMenu, getMenuByIndex} = require('./menus')

function setupRedirects(portletServer) {
    let app = portletServer.app
    let config = portletServer.config
    _.each(config.redirects, function (url, path) {
        path = path.trim()
        url = url.trim()
        let menu = null
        if (url.startsWith('menu://')) {
            let parts = url.substring('menu://'.length).split('/')
            menu = { zone: parts[0], index: parts.join('.') }
        }
        app.get(path, function (req, res, next) {
            if (menu) {
                let menusInZone = portletServer.allMenusByZone[menu.zone]
                if (!menusInZone) return next()
                let menus = getSortedMenus('', menu.zone, menusInZone)
                let menuItem = null
                if (menu.index == menu.zone) {
                    menuItem = getFirstMenu(menus)
                } else {
                    menuItem = getMenuByIndex(menus, menu.index)
                }
                if (menuItem) {
                    res.redirect(menuItem.url)
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
    setupRedirects
}