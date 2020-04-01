const _ = require('lodash')
const JavaScriptObfuscator = require('javascript-obfuscator')
const { sanitizeJsonToString } = require('./xss')

const obfuscateOptions = {
    compact: true,
    controlFlowFlattening: false,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: false,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    debugProtectionInterval: false,
    disableConsoleOutput: false,
    domainLock: [],
    identifierNamesGenerator: 'mangled',
    identifiersPrefix: '',
    inputFileName: '',
    log: false,
    renameGlobals: false,
    reservedNames: [],
    reservedStrings: [],
    rotateStringArray: true,
    seed: 0,
    selfDefending: false,
    sourceMap: false,
    sourceMapBaseUrl: '',
    sourceMapFileName: '',
    sourceMapMode: 'separate',
    stringArray: true,
    stringArrayEncoding: 'rc4',
    stringArrayThreshold: 0.75,
    target: 'browser',
    transformObjectKeys: false,
    unicodeEscapeSequence: false
}

function block(name, options) {
    if (options.data.root._blocks && options.data.root._blocks[name]) {
        return options.data.root._blocks[name].join('\n')
    }
}
function contentFor(name, options) {
    if (!options.data.root._blocks) options.data.root._blocks = {}
    if (!options.data.root._blocks[name]) options.data.root._blocks[name] = []
    let content = options.fn(this)
    options.data.root._blocks[name].push(content)
}
function obfuscate(enabled, options){
    let content = options.fn(this)
    return enabled ? JavaScriptObfuscator.obfuscate(content, obfuscateOptions) : content
}
function json(js) {
    return js == null ? "null" : sanitizeJsonToString(js)
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
        if (!activeMenu) {
            if (path === m.uri) {
                activeMenu = m
            } else if (m.uri && path.substring(0, m.uri.length) == m.uri) {
                if (!activeMenu || activeMenu.uri.length < m.uri.length) activeMenu = m
            } else if (m.submenus) {
                let am = getActiveMenu(m.submenus, path)
                if (am && (!activeMenu || activeMenu.uri.length < ac.uri.length)) activeMenu = am
            }
        }
    })
    return activeMenu
}
function menusByZone(name, options) {
    let lang = options.data.root._language
    let menusInZone = options.data.root._menusByZone && options.data.root._menusByZone[name]
    let menus = getSortedMenus(lang, name, menusInZone)
    let am = getActiveMenu(menus, options.data.root._path)
    return `${sanitizeJsonToString({ activeMenu: am && am.index, menus })}`
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
    obfuscate,
    menusByZone,
    block,
    json
}