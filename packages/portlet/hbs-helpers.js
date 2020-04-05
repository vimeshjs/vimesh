const _ = require('lodash')
const JavaScriptObfuscator = require('javascript-obfuscator')
const { sanitizeJsonToString } = require('./xss')
const babel = require("@babel/core")
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
const css = require('css')
const { pipeStreams, WritableBufferStream } = require('@vimesh/utils')

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
function obfuscate(enabled, options) {
    let content = options.fn(this)
    return enabled ? '\n' + JavaScriptObfuscator.obfuscate(content, obfuscateOptions) : content
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

function es5(options) {
    let code = options.fn(this)
    let result = babel.transformSync(code, { presets: ["@babel/preset-env"] })
    return `${result.code}`
}


const cssSource = fs.createReadStream(path.join(__dirname, '/tailwind@1.2.0.min.css.gz'))
const cssUnzip = zlib.createGunzip()
const cssBufferStream = new WritableBufferStream()
let tailwindStyles = null
let tailwindStylesList = []
let tailwindStylesMap = {}
function addRule(parent, rule, selector) {
    if (selector[0] !== '.') return
    selector = selector.substring(1)
    let pos = selector.lastIndexOf('\\:')
    let prefix = ''
    if (pos != -1) {
        prefix = selector.substring(0, pos + 2)
        selector = selector.substring(pos + 2)
    }
    pos = selector.indexOf(':')
    if (pos != -1) {
        selector = selector.substring(0, pos)
    }
    selector = (prefix + selector).replace(/\\/g, '')
    if (!tailwindStylesMap[selector]) tailwindStylesMap[selector] = {}
    let index = tailwindStylesList.length
    tailwindStylesMap[selector][index] = 1
    let rules = [rule]
    if (parent) {
        parent = Object.create(parent)
        parent.rules = [rule]
        rules = [parent]
    }
    let ss = {
        type: 'stylesheet',
        stylesheet: { rules }
    }
    tailwindStylesList.push(ss)
}
pipeStreams(cssSource, cssUnzip, cssBufferStream).then(() => {
    tailwindStyles = css.parse(cssBufferStream.toBuffer().toString());
    _.each(tailwindStyles.stylesheet.rules, (rule, i) => {
        if (rule.selectors) {
            _.each(rule.selectors, selector => addRule(null, rule, selector))
        } else if (rule.rules) {
            _.each(rule.rules, r => {
                _.each(r.selectors, selector => addRule(rule, r, selector))
            })
        }
    })
})

function tailwindUse(usedClasses, options) {
    if (!options.data.root._tailwindStyles) options.data.root._tailwindStyles = {}
    if (!options.data.root._tailwindUsedClasses) options.data.root._tailwindUsedClasses = {}
    if (!options.data.root._tailwindAllClasses) options.data.root._tailwindAllClasses = tailwindStylesMap
    let items = _.map(usedClasses.split(' '), s => {
        s = _.trim(s)
        if (s && !tailwindStylesMap[s]) {
            $logger.warn(`Could not find tailwind selector for "${s}"`)
            return null
        }
        options.data.root._tailwindUsedClasses[s] = 1
        return tailwindStylesMap[s]
    })
    options.data.root._tailwindStyles = _.merge(options.data.root._tailwindStyles, ...items)
}

function tailwindApply(usedClasses, options) {
    let items = _.map(usedClasses.split(' '), s => tailwindStylesMap[_.trim(s)])
    let ruleIdMap = _.merge(...items)
    return _.map(_.sortBy(_.keys(ruleIdMap), i => +i), index => {
        let lines = css.stringify(tailwindStylesList[index]).split('\n')
        return lines.slice(1, lines.length - 1).join('')
    }).join('')
}

function tailwindBlock(options) {
    if (options.data.root._tailwindStyles) {
        let cssContent = _.map(_.sortBy(_.keys(options.data.root._tailwindStyles), i => +i), index => {
            return css.stringify(tailwindStylesList[index])
        }).join('\n')
        return ['<style>', cssContent, '</style>'].join('\n')
    }
}

const { icon } = require('@fortawesome/fontawesome-svg-core')
const allIcons = _.merge(
    require('@fortawesome/free-solid-svg-icons'),
    require('@fortawesome/free-regular-svg-icons'),
    require('@fortawesome/free-solid-svg-icons')
)
function faIcon(name, options) {
    let iconName = _.camelCase(name)
    if (allIcons[iconName]){
        let svg = icon(allIcons[iconName]).html[0]
        let size = options.hash.size
        let klass = options.hash.class
        if (!size && !klass) size = 16
        if (klass) svg = svg.replace('svg-inline--fa', klass)
        if (size) svg = [svg.substring(0, 4), `style="width:${size}px;"`, svg.substring(4)].join(' ')
        return svg
    } else {
        $logger.warn(`Icon ${name} does not exist!`)
    }
}
module.exports = {
    T,
    es5,
    faIcon,
    contentFor,
    tailwindUse,
    tailwindApply,
    tailwindBlock,
    obfuscate,
    menusByZone,
    block,
    json
}