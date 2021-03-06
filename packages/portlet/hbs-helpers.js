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
const { getSortedExtensions } = require('./extensions')
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

function es5(options) {
    let code = options.fn(this)
    let fullpath = path.join(options.data.root._rootDir, 'node_modules', '@babel/preset-env')
    let result = babel.transformSync(code, { presets: [fullpath] })
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

function preloadTailwindCss() {
    let cssTailwind = fs.readFileSync(path.join(__dirname, '/tailwind@1.2.0.min.css'))
    tailwindStyles = css.parse(cssTailwind.toString())
    _.each(tailwindStyles.stylesheet.rules, (rule, i) => {
        if (rule.selectors) {
            _.each(rule.selectors, selector => addRule(null, rule, selector))
        } else if (rule.rules) {
            _.each(rule.rules, r => {
                _.each(r.selectors, selector => addRule(rule, r, selector))
            })
        }
    })
}

function tailwindUse(usedClasses, options) {
    if (!options.data.root._tailwindStyles) options.data.root._tailwindStyles = {}
    if (!options.data.root._tailwindUsedClasses) options.data.root._tailwindUsedClasses = {}
    if (!options.data.root._tailwindAllClasses) {
        if (!tailwindStyles) preloadTailwindCss()
        options.data.root._tailwindAllClasses = tailwindStylesMap
    }
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
function injectTailwindStyles(params, context, html) {
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
            return [
                '/* --- Tailwind CSS Auto Injected Styles --- */',
                cssContent,
                '/* ------------------------------------- */'
            ].join('\n')
        }
    }
    return ''
}
function tailwindBlock(options) {
    if (!options.data.root._tailwindAllClasses) {
        if (!tailwindStyles) preloadTailwindCss()
        options.data.root._tailwindAllClasses = tailwindStylesMap
    }
    if (!options.data.root._tailwindStylesList) options.data.root._tailwindStylesList = tailwindStylesList
    let cssContent = ''
    if (options.data.root._tailwindStyles) {
        cssContent = _.map(_.sortBy(_.keys(options.data.root._tailwindStyles), i => +i), index => {
            return css.stringify(tailwindStylesList[index])
        }).join('\n')
    }
    options.data.root._postProcessors.push({
        order: 10000,
        placeholder: TAILWIND_PLACEHOLDER,
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

function extract(tag, html) {
    let tagOpen = `<${tag}`
    let lOpen = tagOpen.length
    let tagClose = `</${tag}>`
    let lClose = tagClose.length
    let posOpen = html.indexOf(tagOpen)
    if (posOpen == -1) {
        return { html, result: '' }
    }
    let htmlResults = []
    let tagResults = []
    let posClose = -lClose
    while (posOpen != -1) {
        if (posClose + lClose >= 0) {
            htmlResults.push(html.substring(posClose + lClose, posOpen))
        }
        posClose = html.indexOf(tagClose, posOpen + lOpen)
        if (posClose == -1) {
            htmlResults.push(html.substring(posOpen))
            break
        }
        tagResults.push(html.substring(posOpen, posClose + lClose))
        posOpen = html.indexOf(tagOpen, posClose + lClose)
        if (posOpen == -1) {
            htmlResults.push(html.substring(posClose + lClose))
        }
    }
    return {
        html: htmlResults.join('\n'),
        result: tagResults.join('\n')
    }
}

function processFetchedResult(params, fetchedResult) {
    let r = fetchedResult
    let html = _.isString(r.data) ? r.data : JSON.stringify(r.data)
    let result = []
    if (params.stylePlaceholder) {
        r = extract('style', html)
        html = r.html
        result.push({ placeholder: params.stylePlaceholder, content: r.result })
    }
    if (params.scriptPlaceholder) {
        r = extract('script', html)
        html = r.html
        result.push({ placeholder: params.scriptPlaceholder, content: r.result })
    }
    result.push({ placeholder: params.placeholder, content: html })
    return result
}
function injectFetchedContent(params, context) {
    let url = _.trim(params.url)
    if (!url) return ''
    const remoteApis = context._remoteApis
    const req = context._req
    const data = { req, params }
    if (_.startsWith(url, 'http://') || _.startsWith(url, 'https://')) {
        return axios.get(url).then(r => {
            return processFetchedResult(params, r)
        })
    } else {
        let pos = url.indexOf('://')
        if (pos != -1) {
            let key = url.substring(0, pos)
            let path = url.substring(pos + 3)
            if (remoteApis[key]) {
                let fullPath = toTemplate(path)(data)
                $logger.debug(`Fetch ${url} with ${JSON.stringify(data)}\n----->\nRemote API "${key + '" : ' + fullPath}`)
                return remoteApis[key].get(path, { req }).then(r => {
                    return processFetchedResult(params, r)
                })
            } else {
                $logger.error(`Remote API "${key}" does not exist!`)
                return ''
            }
        } else {
            let fullUrl = toTemplate(`http://localhost:${context._port}${url[0] == '/' ? '' : '/'}${url}`)(data)
            $logger.debug(`Fetch ${url} with ${JSON.stringify(data)}\n----->\nFull URL : ${fullUrl}`)
            return axios.get(fullUrl).then(r => {
                return processFetchedResult(params, r)
            })
        }
    }
}
function fetch(url, options) {
    let id = getUUID()
    let placeholder = `<!-- *****FETCH ${id}:${url}***** -->`
    let params = {
        order: 100,
        placeholder,
        params: _.extend({ id, url, placeholder }, options.hash),
        processor: injectFetchedContent
    }
    if (options.hash.scriptBlock) {
        params.params.scriptPlaceholder = `<!-- *****FETCH SCRIPT ${id}:${url}***** -->`
        appendContentToBlock(options.hash.scriptBlock, options, params.params.scriptPlaceholder)
    }
    if (options.hash.styleBlock) {
        params.params.stylePlaceholder = `<!-- *****FETCH STYLE ${id}:${url}***** -->`
        appendContentToBlock(options.hash.styleBlock, options, params.params.stylePlaceholder)
    }
    options.data.root._postProcessors.push(params)
    return placeholder
}

function template(tpl, options) {
    let meta = {}
    _.each(options.data, (v, k) => meta[`$${k}`] = v)
    let data = _.extend({}, options.hash, meta)
    with (data) {
        try {
            let result = _.bind(toTemplate(tpl), this)(data)
            return result
        } catch (ex) {
            $logger.error(ex + ' ', ex)
            return ex + ''
        }
    }
}

function component(name, options) {
    let isDev = 'development' === process.env.NODE_ENV
    return `<script src="${options.data.root._urlPrefix || ''}/_/${name}${isDev ? '' : '.min'}.js"></script>`
}

module.exports = {
    T,
    es5,
    allow,
    fontAwesomeIcon,
    faIcon: fontAwesomeIcon,
    contentFor,
    tailwindUse,
    twUse: tailwindUse,
    tailwindApply,
    twApply: tailwindApply,
    tailwindBlock,
    twBlock: tailwindBlock,
    obfuscate,
    menusByZone,
    block,
    json,
    fetch,
    extensionsByZone,
    template,
    component
}