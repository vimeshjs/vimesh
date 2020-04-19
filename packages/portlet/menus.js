const _ = require('lodash')

function getSortedMenus(lang, index, menus, permissions) {
    menus = _.filter(_.map(_.entries(menus), ar => _.extend({ _name: ar[0] }, ar[1])), m => {
        let perm = _.get(m, '_meta.permission')
        if (perm){
            if (_.isString(perm) && (!permissions || !permissions[perm])){
                return false
            }
        }
        if (!m._meta) 
            $logger.warn(`Menu config (${JSON.stringify(m)}) has no _meta definition.`)
        return !!m._meta
    })
    menus = _.sortBy(menus, m => _.get(m, '_meta.sort') || 1)
    return _.filter(_.map(menus, m => {
        let mindex = `${index}.${m._name}`
        let submenus = getSortedMenus(lang, mindex, _.omit(m, '_name', '_meta'), permissions)
        let url = _.get(m, '_meta.url')
        let title = _.get(m, '_meta.title')
        let icon = _.get(m, '_meta.icon')
        if (_.isObject(title)) {
            let i18n = title
            let ls = _.keys(i18n)
            title = i18n[lang] || ls.length > 0 && i18n[ls[0]]
        }
        if (!title) title = m._name
        let menu = { index: mindex, title, url, icon }
        if (submenus.length > 0) menu.submenus = submenus
        return menu
    }), m => m.url || m.submenus && m.submenus.length > 0)
}
function getActiveMenu(menus, path) {
    if (!menus || !path) return null
    let activeMenu = null
    _.each(menus, m => {
        if (path === m.url) {
            activeMenu = m
        } else if (m.url && path.substring(0, m.url.length) == m.url) {
            if (!activeMenu || activeMenu.url.length < m.url.length) activeMenu = m
        }
        if (m.submenus) {
            let am = getActiveMenu(m.submenus, path)
            if (am && (!activeMenu || activeMenu.url.length < am.url.length)) activeMenu = am
        }
    })
    return activeMenu
}

function getFirstMenu(menus) {
    if (!menus) return null
    let firstMenu = null
    _.each(menus, m => {
        if (!firstMenu && m.url) {
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

function getMenuByIndex(menus, index) {
    if (!menus || !index) return null
    let menu = null
    _.each(menus, m => {
        if (!menu && m.index === index) {
            menu = m        
        }
        if (menu) return
        if (m.submenus) {
            let fm = getMenuByIndex(m.submenus, index)
            if (fm) menu = fm
        }
    })
    return menu
}

function visitMenus(menus, callback) {
    _.each(menus, m => {
        callback(m)
        if (m.submenus) {
            visitMenus(m.submenus, callback)
        }
    })
}

module.exports = {
    visitMenus,
    getMenuByIndex,
    getSortedMenus,
    getActiveMenu,
    getFirstMenu
}