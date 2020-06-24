const _ = require('lodash')
const JavaScriptObfuscator = require('javascript-obfuscator')
const { sanitizeJsonToString } = require('./xss')
const babel = require("@babel/core")
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
const css = require('css')
const axios = require('axios')
const { evaluatePermissionFormular } = require('./utils')
const { getSortedMenus, getActiveMenu, visitMenus } = require('./menus')
const { pipeStreams, WritableBufferStream, getUUID, toTemplate } = require('@vimesh/utils')

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
function injectBlocks(name, placeholder, html, context) {
    return html.replace(placeholder, (context._blocks[name] || []).join('\n'))
}
function block(name, options) {
    if (!options.data.root._blocks) options.data.root._blocks = {}
    if (!options.data.root._blocks[name]) options.data.root._blocks[name] = []
    let placeholder = `<!-- *****BLOCK ${name}***** -->`
    options.data.root._postProcessors.push({
        order: 10,
        processor: _.partial(injectBlocks, name, placeholder)
    })
    return placeholder
}
function contentFor(name, options) {
    if (!options) {
        $logger.error('Block name must be provided in contentFor helper!')
        return
    }
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
function menusByZone(name, options) {
    let lang = options.data.root.$language
    let permissions = options.data.root.$permissions || {}
    let embedIcon = options.hash.embedIcon
    let menusInZone = options.data.root._menusByZone && options.data.root._menusByZone[name]
    let menus = getSortedMenus(lang, name, menusInZone, permissions)
    if (embedIcon) {
        visitMenus(menus, (menu) => {
            if (menu.icon && _.startsWith(menu.icon, 'fa-')) {
                let svg = fontAwesomeIcon(menu.icon, { hash: { class: `${name}-menu-item` } })
                if (svg) menu.svg = svg
            }
        })
    }
    let am = getActiveMenu(menus, options.data.root.$path)
    return JSON.stringify({ activeMenu: am && am.index, menus })
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

function es5(options) {
    let code = options.fn(this)
    let result = babel.transformSync(code, { presets: ["@babel/preset-env"] })
    return `${result.code}`
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
    let items = _.map(usedClasses.split(/\s+/), s => {
        s = _.trim(s)
        if (s && !tailwindStylesMap[s]) {
            $logger.warn(`Could not find tailwind selector for "${s}"`)
            return null
        }
        options.data.root._tailwindUsedClasses[s] = 1
        return tailwindStylesMap[s]
    })
    options.data.root._tailwindStyles = _.merge({}, options.data.root._tailwindStyles, ...items)
}

function tailwindApply(usedClasses, options) {
    let items = _.map(usedClasses.split(/\s+/), s => {
        s = _.trim(s)
        if (s && !tailwindStylesMap[s]) {
            $logger.warn(`Could not find tailwind selector for "${s}"`)
        }
        return tailwindStylesMap[s]
    })
    let ruleIdMap = _.merge({}, ...items)
    return _.map(_.sortBy(_.keys(ruleIdMap), i => +i), index => {
        let lines = css.stringify(tailwindStylesList[index]).split('\n')
        return lines.slice(1, lines.length - 1).join('')
    }).join('')
}

const CLASS_NAMES = /class\s*=\s*['\"](?<class>[^'\"]*)['\"]/g
const TAILWIND_PLACEHOLDER = '/* TAILWINDCSS AUTO INJECTION PLACEHOLDER */'
function injectTailwindStyles(html, context) {
    if (context._tailwindAllClasses && context._tailwindStylesList) {
        let missedClasses = {}
        let match
        while ((match = CLASS_NAMES.exec(html)) !== null) {
            _.each(match.groups.class.split(' '), cls => {
                cls = _.trim(cls)
                if (cls && context._tailwindAllClasses[cls] &&
                    (!context._tailwindUsedClasses || !context._tailwindUsedClasses[cls])) {
                    missedClasses[cls] = 1
                }
            })
        }
        if (_.keys(missedClasses).length > 0) {
            let items = _.map(_.keys(missedClasses), cls => context._tailwindAllClasses[cls])
            let ruleIdMap = _.merge({}, ...items)
            let cssContent = _.map(_.sortBy(_.keys(ruleIdMap), i => +i), index => {
                return css.stringify(context._tailwindStylesList[index])
            }).join('\n')
            html = html.replace(TAILWIND_PLACEHOLDER, [
                '/* --- Tailwind CSS Auto Injected Styles --- */',
                cssContent,
                '/* ------------------------------------- */'
            ].join('\n'))
        } else {
            html = html.replace(TAILWIND_PLACEHOLDER, '')
        }
    }
    return html
}
function tailwindBlock(options) {
    if (!options.data.root._tailwindAllClasses) options.data.root._tailwindAllClasses = tailwindStylesMap
    if (!options.data.root._tailwindStylesList) options.data.root._tailwindStylesList = tailwindStylesList
    let cssContent = ''
    if (options.data.root._tailwindStyles) {
        cssContent = _.map(_.sortBy(_.keys(options.data.root._tailwindStyles), i => +i), index => {
            return css.stringify(tailwindStylesList[index])
        }).join('\n')
    }
    options.data.root._postProcessors.push({
        order: 10000,
        processor: injectTailwindStyles
    })
    return ['<style>', TAILWIND_PLACEHOLDER, cssContent, '</style>'].join('\n')
}

const { icon } = require('@fortawesome/fontawesome-svg-core')
const solidIcons = require('@fortawesome/free-solid-svg-icons')
const regularIcons = require('@fortawesome/free-regular-svg-icons')
const brandsIcons = require('@fortawesome/free-brands-svg-icons')
const allIcons = _.merge({}, solidIcons, regularIcons, brandsIcons)
function fontAwesomeIcon(name, options) {
    if (!_.isString(name)) return
    let icons = allIcons
    if (_.startsWith(name, 'fas-')) {
        name = name.substring(4)
        icons = solidIcons
    } else if (_.startsWith(name, 'far-')) {
        name = name.substring(4)
        icons = regularIcons
    } else if (_.startsWith(name, 'fab-')) {
        name = name.substring(4)
        icons = brandsIcons
    }
    let iconName = _.camelCase(_.startsWith(name, 'fa-') ? name : 'fa-' + name)
    if (icons[iconName]) {
        let svg = icon(icons[iconName]).html[0]
        let size = options.hash.size
        let klass = options.hash.class
        if (!size && !klass) size = 16
        if (klass) svg = svg.replace('svg-inline--fa', klass)
        if (size) svg = [svg.substring(0, 4), `style="width:${size}px;height:${size}px;"`, svg.substring(4)].join(' ')
        return svg
    } else {
        $logger.warn(`Icon ${name} does not exist!`)
    }
}

function injectFetchedContent(url, options, html) {
    url = _.trim(url)
    if (!url) return html
    let id = options.id
    let placeholder = options.placeholder
    let format = options.format || options.as
    if (_.startsWith(url, 'http://') || _.startsWith(url, 'https://')) {
        return axios.get(url).then(r => {
            return html.replace(placeholder, _.isString(r.data) ? r.data : JSON.stringify(r.data))
        })
    } else {
        let pos = url.indexOf('://')
        if (pos != -1) {
            let key = url.substring(0, pos)
            let path = url.substring(pos + 3)
            if (options.remoteApis[key]) {
                let data = { req: options.req, params: options.params }
                let fullPath = toTemplate(path)(data)
                $logger.debug(`Fetch ${url} with ${JSON.stringify(data)}\n----->\nRemote API "${key + '" : ' + fullPath}`)
                return options.remoteApis[key].get(path, { req: options.req }).then(r => {
                    return html.replace(placeholder, _.isString(r.data) ? r.data : JSON.stringify(r.data))
                })
            } else {
                $logger.error(`Remote API "${key}" does not exist!`)
                return html
            }
        } else {
            let data = { req: options.req, params: options.params }            
            let fullUrl = toTemplate(`http://localhost:${options.port}${url[0] == '/' ? '' : '/'}${url}`)(data)
            $logger.debug(`Fetch ${url} with ${JSON.stringify(data)}\n----->\nFull URL : ${fullUrl}`)
            return axios.get(fullUrl).then(r => {
                return html.replace(placeholder, _.isString(r.data) ? r.data : JSON.stringify(r.data))
            })
        }
    }
}
function fetch(url, options) {
    let id = getUUID()
    let placeholder = `<!-- *****FETCH ${id}***** -->`
    options.data.root._postProcessors.push({
        order: 10,
        processor: _.partial(injectFetchedContent, url,
            _.extend({
                id, placeholder,
                req: options.data.root._req,
                port: options.data.root._port,
                remoteApis: options.data.root._remoteApis
            }, { params: options.hash }))
    })
    return placeholder
}

module.exports = {
    T,
    es5,
    allow,
    fontAwesomeIcon,
    faIcon: fontAwesomeIcon,
    contentFor,
    content: contentFor,
    tailwindUse,
    twUse: tailwindUse,
    tailwindApply,
    twApply: tailwindApply,
    tailwindBlock,
    twBlock: tailwindBlock,
    obfuscate,
    menusByZone,
    menus: menusByZone,
    block,
    json,
    fetch
}