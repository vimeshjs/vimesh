const _ = require('lodash')
const { sanitizeJsonToString } = require('./xss')
const axios = require('axios')
const { evaluatePermissionFormular } = require('./utils')
const { getSortedMenus, getActiveMenu } = require('./menus')
const { getSortedExtensions } = require('./extensions')
const { getUUID, toTemplate } = require('@vimesh/utils')

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

module.exports = {
    T,
    allow,
    contentFor,
    menusByZone,
    block,
    json,
    fetch,
    extensionsByZone,
    template
}