
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
                    f = f.replace(/\\/g, '/')
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
                let template = handlebars.compile(source, options.compilation)
                return { portlet, source, path: key, template }
            }).catch(ex => {
                $logger.error(`Fails to load ${fn}`, ex)
            })
        }
    })
}

function createRemoteTemplateCache(kvClient, portlet, type, options) {
    let prefix = `${type}/@${portlet}/`
    return createMemoryCache({
        maxAge: options.maxAge,
        enumForceReload: options.enumForceReload,
        updateAgeOnGet: false,
        onEnumerate: () => {            
            return kvClient.keys(prefix).then(keys => _.map(keys, k => k.substring(prefix.length)))
        },
        onRefresh: function (key) {
            return kvClient.get(`${prefix}${key}`).then(content => {
                let source = content
                let template = handlebars.compile(source, options.compilation)
                return { portlet, source, path: key, template }
            }).catch(ex => null)
        }
    })
}

function createViewEngine(portletServer){
    let portlet = portletServer.portlet
    let config = portletServer.config
    let extName = portletServer.extName
    let kvClient = portletServer.kvClient
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
    _.each(config.dependsOn, name => {
        hveConfig.views.push({ portlet: name, cache: createRemoteTemplateCache(kvClient, name, 'views', remoteCacheOption) })
        hveConfig.layouts.push({ portlet: name, cache: createRemoteTemplateCache(kvClient, name, 'layouts', remoteCacheOption) })
        hveConfig.partials.push({ portlet: name, cache: createRemoteTemplateCache(kvClient, name, 'partials', remoteCacheOption) })
    })

    return createHbsViewEngine(hveConfig)
}

module.exports = {
    createViewEngine
}