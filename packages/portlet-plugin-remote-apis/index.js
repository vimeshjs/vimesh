const _ = require('lodash')
const { toTemplate } = require('@vimesh/utils')
const axios = require('axios')

function createRestfulApi(config) {
    let urlPrefix = config.url
    let optionsTemplate = toTemplate(JSON.stringify(_.omit(config, 'url')))
    function getFullOptions(options) {
        let req = _.merge({ headers: {}, params: {}, body: {}, query: {}, cookies: {} },
            _.pick(options && options.req, 'params', 'query', 'body', 'headers', 'cookies'))
        options = _.merge(JSON.parse(optionsTemplate(req)), _.omit(options, 'req'))
        return options
    }
    return {
        get(url, options) {
            return axios.get(urlPrefix + url, getFullOptions(options))
        },
        delete(url, options) {
            return axios.delete(urlPrefix + url, getFullOptions(options))
        },
        head(url, options) {
            return axios.head(urlPrefix + url, getFullOptions(options))
        },
        options(url, options) {
            return axios.options(urlPrefix + url, getFullOptions(options))
        },
        post(url, data, options) {
            return axios.post(urlPrefix + url, data, getFullOptions(options))
        },
        put(url, data, options) {
            return axios.put(urlPrefix + url, data, getFullOptions(options))
        },
        patch(url, data, options) {
            return axios.patch(urlPrefix + url, data, getFullOptions(options))
        }
    }
}

function appendContentToBlock(name, options, content) {
    if (!options.data.root._blocks) options.data.root._blocks = {}
    if (!options.data.root._blocks[name]) options.data.root._blocks[name] = []
    options.data.root._blocks[name].push(content)
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

module.exports = (portlet) => {
    let config = portlet.config
    portlet.remoteApis = {}
    _.each(config.remoteApis, (api, name) => {
        if (api.type === 'grpc') {
            const { createGrpcClient } = require('@vimesh/grpc')
            portlet.remoteApis[name] = createGrpcClient(api)
        } else if (api.type === 'graphql' || api.type === 'gql') {
            const { createGraphQLClient } = require('@vimesh/graphql')
            portlet.remoteApis[name] = createGraphQLClient(api)
        } else {
            portlet.remoteApis[name] = createRestfulApi(api)
        }
    })

    portlet.on('decorateResponse', (req, res) => {
        res.locals._req = _.pick(req, 'params', 'query', 'body', 'headers', 'cookies')
        res.locals._remoteApis = portlet.remoteApis
    })

    portlet.registerHbsHelpers({ fetch })
}