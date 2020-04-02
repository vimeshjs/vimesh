
const _ = require('lodash')
const glob = require('glob')
const fs = require('graceful-fs')
const path = require('path')
const Promise = require('bluebird')
const axios = require('axios')
const handlebars = require('handlebars')
const { createMemoryCache } = require('@vimesh/cache')
const { createHbsViewEngine } = require('./hbs-express')
const accessAsync = Promise.promisify(fs.access)
const readFileAsync = Promise.promisify(fs.readFile)
const globAsync = Promise.promisify(glob)

function createLocalTemplateCache(portlet, dir, options) {
    let extName = options.extName || '.hbs'
    return createMemoryCache({
        maxAge: options.maxAge,
        updateAgeOnGet: false,
        onEnumerate: () => {
            return globAsync(`${dir}/**/*${extName}`).then(files => {
                return _.map(files, f => {
                    let rf = path.relative(dir, f)
                    return rf.substring(0, rf.length - extName.length)
                })
            }).catch(ex => {
                $logger.error(`Fails to enumerate ${dir}/**/*${extName}`, ex)
            })
        },
        onRefresh: function (key) {
            let fn = `${dir}/${key}${extName}`
            //$logger.debug(`Loading ${fn}`)
            return accessAsync(fn).then(r => readFileAsync(fn)).then(r => {
                let source = r.toString()
                let uri = fn
                let template = handlebars.compile(source, options.compilation)
                return { portlet, uri, source, path: key, template }
            }).catch(ex => {
                $logger.error(`Fails to load ${fn}`, ex)
            })
        }
    })
}

function createRemoteTemplateCache(portlet, url, options) {
    return createMemoryCache({
        maxAge: options.maxAge,
        enumForceReload: options.enumForceReload,
        updateAgeOnGet: false,
        onEnumerate: () => {
            return axios.get(`${url}?file=*`).then(resp => {
                return _.keys(resp.data)
            })
        },
        onRefresh: function (key) {
            let fullUrl = `${url}?file=${encodeURIComponent(key)}`
            return axios.get(fullUrl).then(resp => {
                let source = resp.data.content
                let uri = fullUrl
                let template = handlebars.compile(source, options.compilation)
                return { portlet, uri, source, path: key, template }
            }).catch(ex => null)
        }
    })
}

function createViewEngine(portletServer){
    let portlet = portletServer.portlet
    let config = portletServer.config
    let extName = portletServer.extName
    let localCacheOption = {
        maxAge: config.debug ? '3s' : '100d',
        extName
    }
    let remoteCacheOption = {
        maxAge: config.debug ? '3s' : '1m',
        enumForceReload: config.debug
    }
    let hveConfig = {
        portlet,
        pretty: config.debug,
        alias: config.alias || {},
        defaultLayout: config.layout,
        views: [{
            cache: createLocalTemplateCache(portlet, portletServer.routesDir, localCacheOption)
        }, {
            cache: createLocalTemplateCache(portlet, portletServer.viewsDir, localCacheOption)
        }],
        layouts: [{ cache: createLocalTemplateCache(portlet, portletServer.layoutsDir, localCacheOption) }],
        partials: [{ cache: createLocalTemplateCache(portlet, portletServer.partialsDir, localCacheOption) }]
    }
    _.each(config.peers, (url, name) => {
        hveConfig.views.push({ portlet: name, cache: createRemoteTemplateCache(name, `${url}/_views`, remoteCacheOption) })
        hveConfig.layouts.push({ portlet: name, cache: createRemoteTemplateCache(name, `${url}/_layouts`, remoteCacheOption) })
        hveConfig.partials.push({ portlet: name, cache: createRemoteTemplateCache(name, `${url}/_partials`, remoteCacheOption) })
    })

    return createHbsViewEngine(hveConfig)
}

module.exports = {
    createViewEngine
}