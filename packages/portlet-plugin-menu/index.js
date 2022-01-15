const _ = require('lodash')
const { setupRedirects } = require('./redirects')
const { getSortedMenus, getActiveMenu } = require('./menus')

let evaluatePermissionFormular = () => true

function menusByZone(name, options) {
    let lang = options.data.root.$language
    let permissions = options.data.root.$permissions || {}
    let menusInZone = options.data.root._menusByZone && options.data.root._menusByZone[name]
    let menus = getSortedMenus(lang, name, menusInZone, (formular) => evaluatePermissionFormular(formular, permissions))
    let am = getActiveMenu(menus, options.data.root.$url)
    let result = { activeMenu: am && am.index, menus }
    let variable = options.hash.assignTo
    if (variable) {
        this[variable] = result
    } else {
        return JSON.stringify(result)
    }
}

module.exports = (portlet) => {
    portlet.ready.menus = false
    portlet.allMenusByZone = {}
    portlet.on('decorateResponse', (req, res) => {
        res.locals._menusByZone = portlet.allMenusByZone
        res.buildMenus = (menusInZone) => {
            let lang = res.locals.$language
            let permissions = res.locals.$permissions || {}
            let menus = getSortedMenus(lang, 'menu', menusInZone, (formular) => evaluatePermissionFormular(formular, permissions))
            let am = getActiveMenu(menus, res.locals.$url)
            return { activeMenu: am && am.index, menus }
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

    portlet.on('start', () => {
        if (portlet.evaluatePermissionFormular)
            evaluatePermissionFormular = portlet.evaluatePermissionFormular
    })
}
