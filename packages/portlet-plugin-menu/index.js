const _ = require('lodash')
const { setupRedirects } = require('./redirects')
const { getSortedMenus, getActiveMenu } = require('./menus')

function menusByZone(name, options) {
    let lang = options.data.root.$language
    let menusInZone = options.data.root._menusByZone && options.data.root._menusByZone[name]
    let menus = getSortedMenus(lang, name, menusInZone, options.data.root.$allow)
    let am = getActiveMenu(menus, options.data.root.$url)
    let result = { activeMenu: am && am.index, menus }
    let variable = options.hash.assignTo
    if (variable) {
        this[variable] = result
    } else {
        const safeString = () => JSON.stringify(result)
        return {
            toString: safeString,
            toHTML: safeString
        }
    }
}

module.exports = (portlet) => {
    portlet.ready.menus = false
    portlet.allMenusByZone = {}
    portlet.on('decorateResponse', (req, res) => {
        res.locals._menusByZone = portlet.allMenusByZone
        res.buildMenus = (menusInZone) => {
            let lang = res.locals.$language
            let menus = getSortedMenus(lang, 'menu', menusInZone,
                (perm, cond) => res.allow(perm, cond, res.locals._menusPermissionScope))
            let am = getActiveMenu(menus, res.locals.$url)
            return { activeMenu: am && am.index, menus }
        }
        res.setMenusPermissionScope = (scope) => {
            res.locals._menusPermissionScope = _.merge(res.locals._menusPermissionScope, scope)
        }
    })

    portlet.on('beforeSetupRoutes', () => {
        portlet.loadAssets('menus', '.yaml', (rs) => {
            _.each(rs, (r, key) => {
                let pos = key.indexOf('/')
                let zone = pos == -1 ? key : key.substring(0, pos)
                portlet.allMenusByZone[zone] = _.merge(portlet.allMenusByZone[zone], r)
            })
            portlet.ready.menus = true
        })
    })
    portlet.on('afterSetupRoutes', () => {
        setupRedirects(portlet)
    })

    portlet.registerHbsHelpers({ menusByZone })
}
