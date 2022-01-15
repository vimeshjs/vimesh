const _ = require('lodash')
const { getSortedMenus, getFirstMenu, getMenuByIndex } = require('./menus')

function setupRedirects(portletServer) {
    let app = portletServer.app
    let config = portletServer.config
    _.each(config.redirects, function (url, path) {
        path = path.trim()
        url = url.trim()
        let menu = null
        if (url.startsWith('menu://')) {
            let fallback = null
            let pos = url.indexOf('|')
            if (pos != -1) {
                fallback = url.substring(pos + 1).trim()
                url = url.substring(0, pos).trim()
            }
            let parts = url.substring('menu://'.length).split('/')
            menu = { zone: parts[0], index: parts.join('.'), fallback }
        }
        $logger.info(`Redirection: ${path} -> ${url} `)
        function doRedirect(req, res, next) {
            if (menu) {
                let menusInZone = portletServer.allMenusByZone[menu.zone]
                if (!menusInZone) {
                    $logger.error(`Could not find menu zone "${menu.zone}" when redirecting "${path}"`)
                    return next()
                }
                const allow = (formular) => {
                    if (!portletServer.evaluatePermissionFormular) return true
                    return portletServer.evaluatePermissionFormular(formular, res.locals.$permissions)
                }
                let menus = getSortedMenus('', menu.zone, menusInZone, allow)
                let menuItem = null
                if (menu.index == menu.zone) {
                    menuItem = getFirstMenu(menus)
                } else {
                    menuItem = getMenuByIndex(menus, menu.index)
                }
                if (menuItem) {
                    $logger.info(`Redirecting ${path} -> ${url} -> ${menuItem.url} (user: ${JSON.stringify(req.user)}, permissions: ${JSON.stringify(res.locals.$permissions)})`)
                    res.redirect(menuItem.url)
                } else {
                    $logger.error(`Fails to get real url for ${url} (user: ${JSON.stringify(req.user)}, permissions: ${JSON.stringify(res.locals.$permissions)})`)
                    if (menu.fallback)
                        res.redirect(menu.fallback)
                    else
                        next()
                }
            } else {
                $logger.info(`Redirecting ${path} -> ${url}`)
                res.redirect(url)
            }
        }
        if (menu)
            app.get(path, portletServer.beforeAll, doRedirect)
        else 
            app.get(path, doRedirect)
    })
}

module.exports = {
    setupRedirects
}