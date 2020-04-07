const _ = require('lodash')

function getSortedMenus(lang, index, menus) {
    menus = _.filter(_.map(_.entries(menus), ar => _.extend({ _name: ar[0] }, ar[1])), m => {
        if (!m._meta) $logger.warn(`Menu config (${JSON.stringify(m)}) seems wrong.`)
        return !!m._meta
    })
    menus = _.sortBy(menus, m => _.get(m, '_meta.sort') || 1)
    return _.map(menus, m => {
        let mindex = `${index}.${m._name}`
        let submenus = getSortedMenus(lang, mindex, _.omit(m, '_name', '_meta'))
        let uri = _.get(m, '_meta.uri')
        let title = _.get(m, '_meta.title')
        let icon = _.get(m, '_meta.icon')
        if (_.isObject(title)) {
            let i18n = title
            let ls = _.keys(i18n)
            title = i18n[lang] || ls.length > 0 && i18n[ls[0]]
        }
        if (!title) title = m._name
        let menu = { index: mindex, title, uri, icon }
        if (submenus.length > 0) menu.submenus = submenus
        return menu
    })
}
function getActiveMenu(menus, path) {
    if (!menus || !path) return null
    let activeMenu = null
    _.each(menus, m => {
        if (path === m.uri) {
            activeMenu = m
        } else if (m.uri && path.substring(0, m.uri.length) == m.uri) {
            if (!activeMenu || activeMenu.uri.length < m.uri.length) activeMenu = m
        }
        if (m.submenus) {
            let am = getActiveMenu(m.submenus, path)
            if (am && (!activeMenu || activeMenu.uri.length < am.uri.length)) activeMenu = am
        }
    })
    return activeMenu
}

function getFirstMenu(menus) {
    if (!menus || !path) return null
    let firstMenu = null
    _.each(menus, m => {
        if (!firstMenu && m.uri) {
            firstMenu = m        
        }
        if (firstMenu) return
        if (m.submenus) {
            let fm = getFirstMenu(m.submenus)
            if (fm) firstMenu = fm
        }
    })
    return firstMenu
}

module.exports = {
    getSortedMenus,
    getActiveMenu,
    getFirstMenu
}