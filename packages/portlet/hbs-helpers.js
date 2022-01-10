const _ = require('lodash')
const { sanitizeJsonToString } = require('./xss')
const { evaluatePermissionFormular } = require('./utils')
const { getSortedMenus, getActiveMenu } = require('./menus')
const { getSortedExtensions } = require('./extensions')

function injectBlocks(params, context) {
    return (context._blocks[params.name] || []).join('\n')
}

function block(name, options) {
    if (!options.data.root._blocks) options.data.root._blocks = {}
    if (!options.data.root._blocks[name]) options.data.root._blocks[name] = []
    let placeholder = `<!-- *****BLOCK ${name}***** -->`
    options.data.root._postProcessors.push({
        order: 10,
        placeholder,
        params: { name },
        processor: injectBlocks
    })
    return placeholder
}

function appendContentToBlock(name, options, content) {
    if (!options.data.root._blocks) options.data.root._blocks = {}
    if (!options.data.root._blocks[name]) options.data.root._blocks[name] = []
    options.data.root._blocks[name].push(content)
}

function contentFor(name, options) {
    if (!name) {
        $logger.error('Block name must be provided in contentFor helper!')
        return
    }
    let content = options.fn(this)
    appendContentToBlock(name, options, content)
}

function json(js) {
    return js == null ? "null" : sanitizeJsonToString(js)
}

function menusByZone(name, options) {
    let lang = options.data.root.$language
    let permissions = options.data.root.$permissions || {}
    let menusInZone = options.data.root._menusByZone && options.data.root._menusByZone[name]
    let menus = getSortedMenus(lang, name, menusInZone, permissions)    
    let am = getActiveMenu(menus, options.data.root.$url)
    let result = { activeMenu: am && am.index, menus }
    let variable = options.hash.assignTo
    if (variable) {
        this[variable] = result
    } else {
        return JSON.stringify(result)
    }
}

function extensionsByZone(name, options) {
    let permissions = options.data.root.$permissions || {}
    let extensionsInZone = options.data.root._extensionsByZone && options.data.root._extensionsByZone[name]
    let extensions = getSortedExtensions(name, extensionsInZone, permissions)
    let variable = options.hash.assignTo
    if (variable) {
        this[variable] = extensions
    } else {
        return JSON.stringify(extensions)
    }
}

function T(name, options) {
    if (!name) return ''
    let lang = options.data.root.$language
    let items = options.data.root._i18nItems
    let ls = _.keys(_.omit(items, '*'))
    if (!lang && ls.length > 0) lang = ls[0]
    let fallbackText = _.capitalize(name.substring(name.lastIndexOf('.') + 1))
    return _.get(items[lang], name) || _.get(items['*'], name) || fallbackText
}

function allow(perm, options) {
    if (!options) {
        $logger.error('Permission must be provided in allow helper!')
        return
    }
    let permsOfCurrentUser = options.data.root.$permissions || {}
    let allowed = evaluatePermissionFormular(perm, permsOfCurrentUser, options.data.root._allPermissions)
    let content = options.fn(this)
    return allowed ? content : ''
}

module.exports = {
    T,
    allow,
    contentFor,
    block,
    json,
    menusByZone,
    extensionsByZone
}