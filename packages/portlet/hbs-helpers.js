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
    menus = _.map(_.entries(menus), ar => _.extend({ _name: ar[0] }, ar[1]))
    menus = _.sortBy(menus, m => _.get(m, '_meta.sort') || 1)
    return _.map(menus, m => {
        let mindex = `${index}.${m._name}`
        let submenus = getSortedMenus(mindex, _.omit(m, '_name', '_meta'))
        let uri = _.get(m, '_meta.uri')
        let i18n = _.get(m, '_meta.i18n')
        let langs = _.keys(i18n)
        let title = langs.length > 0 ? i18n[langs[0]] : m._name
        let menu = { index: mindex, title, uri }
        if (submenus.length > 0) menu.submenus = submenus
        return menu
    })
}
function menuData(name, options) {
    let menusByZone = options.data.root._menusByZone
    var val = getSortedMenus(name, menusByZone && menusByZone[name])
    return `${!val ? "null" : sanitizeJsonToString(val)}`
}

module.exports = {
    contentFor,
    content: contentFor,
    menuData,
    block,
    json
}