const _ = require('lodash')
const { sanitizeJsonToString } = require('./xss')
function block(name, options) {
    if (options.data.root._blocks && options.data.root._blocks[name]) {
        return options.data.root._blocks[name].join('\n')
    }
}
function contentFor(name, options) {
    if (!options.data.root._blocks) options.data.root._blocks = {}
    if (!options.data.root._blocks[name]) options.data.root._blocks[name] = []
    options.data.root._blocks[name].push(options.fn(name))
}
function json(js, options) {
    var name = options.hash.name || '?'
    var val = null;
    val = js == null ? "null" : sanitizeJsonToString(js)
    return `
    <script type="text/javascript">
    var ${name} = ${val}
    </script>
`
}
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
        if (_.isObject(title)){
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
        if (!activeMenu) {
            if (path === m.uri) {
                activeMenu = m.index
            } else if (m.submenus) {
                activeMenu = getActiveMenu(m.submenus, path)
            }
        }
    })
    return activeMenu
}
function menusByZone(name, options) {
    let lang = options.data.root._language 
    let menusInZone = options.data.root._menusByZone && options.data.root._menusByZone[name]
    let menus = getSortedMenus(lang, name, menusInZone)
    return `${sanitizeJsonToString({ activeMenu: getActiveMenu(menus, options.data.root._path), menus })}`
}

function T(name, options) {
    if (!name) return ''
    let lang = options.data.root._language 
    let items = options.data.root._i18nItems
    let ls = _.keys(_.omit(items, '*'))
    if (!lang && ls.length > 0) lang = ls[0]
    let fallbackText = _.capitalize(name.substring(name.lastIndexOf('.') + 1))
    return _.get(items[lang], name) || _.get(items['*'], name) || fallbackText
}

module.exports = {
    T,
    contentFor,
    content: contentFor,
    menusByZone,
    block,
    json
}