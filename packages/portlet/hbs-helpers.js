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
function getSortedMenus(index, menus) {
    menus = _.filter(_.map(_.entries(menus), ar => _.extend({ _name: ar[0] }, ar[1])), m => {
        if (!m._meta) $logger.warn(`Menu config (${JSON.stringify(m)}) seems wrong.`)
        return !!m._meta
    })
    menus = _.sortBy(menus, m => _.get(m, '_meta.sort') || 1)
    return _.map(menus, m => {
        let mindex = `${index}.${m._name}`
        let submenus = getSortedMenus(mindex, _.omit(m, '_name', '_meta'))
        let uri = _.get(m, '_meta.uri')
        let i18n = _.get(m, '_meta.i18n')
        let icon = _.get(m, '_meta.icon')
        let langs = _.keys(i18n)
        let title = langs.length > 0 ? i18n[langs[0]] : m._name
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
    let menus = getSortedMenus(name, options.data.root._menusByZone && options.data.root._menusByZone[name])
    return `${sanitizeJsonToString({ activeMenu: getActiveMenu(menus, options.data.root._path), menus })}`
}

function T(name, options) {
    if (!name) return ''
    return _.get(options.data.root._i18nItems, name) || _.capitalize(name.substring(name.lastIndexOf('.') + 1))
}

module.exports = {
    T,
    contentFor,
    content: contentFor,
    menusByZone,
    block,
    json
}