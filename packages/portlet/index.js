const _ = require('lodash')
const path = require('path')
const glob = require('glob')
const axios = require('axios')
const fs = require('graceful-fs')
const yaml = require('js-yaml')
const bodyParser = require('body-parser')
const { getCRC16, getMD5, duration, retry } = require('@vimesh/utils')
const { createMemoryCache } = require('@vimesh/cache')
const { setupGraphQLService } = require('@vimesh/graphql')
const Promise = require('bluebird')
const express = require('express')
const compression = require('compression')
const handlebars = require('handlebars')
const { createHbsViewEngine } = require('./hbs-express')
const accessAsync = Promise.promisify(fs.access)
const readFileAsync = Promise.promisify(fs.readFile)
const globAsync = Promise.promisify(glob)
const HTTP_METHODS = ['all', 'get', 'post', 'put', 'delete', 'patch', 'config', 'head']

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
            })
        },
        onRefresh: function (key) {
            let fn = `${dir}/${key}${extName}`
            $logger.debug(`Loading ${fn}`)
            return accessAsync(fn).then(r => readFileAsync(fn)).then(r => {
                let source = r.toString()
                let uri = fn
                let template = handlebars.compile(source, options.compilation)
                return { portlet, uri, source, path: key, template }
            }).catch(ex => null)
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

function mountSharedResourcesMiddleware(portletServer, type, extName) {
    let sharedDir = portletServer.sharedDir
    if (!extName) extName = portletServer.extName
    if (!portletServer.sharedResourcesCaches[type]) {
        portletServer.sharedResourcesCaches[type] = createMemoryCache({
            maxAge: portletServer.config.debug ? '3s' : '1d',
            updateAgeOnGet: false,
            onEnumerate: () => {
                let dir = path.join(sharedDir, type)
                return globAsync(`${dir}/**/*${extName}`).then(files => {
                    return _.map(files, f => {
                        let rf = path.relative(dir, f)
                        return rf.substring(0, rf.length - extName.length)
                    })
                })
            },
            onRefresh: function (key) {
                let file = path.join(sharedDir, type, key + extName)
                $logger.info(`Loading shared/${type}/${key} `)
                return accessAsync(file).then(r => {
                    return readFileAsync(file)
                }).then(r => {
                    let content = r.toString()
                    if (extName === '.yaml') {
                        content = yaml.load(content)
                    }
                    return {
                        content,
                        md5: getMD5(r)
                    }
                }).catch(ex => {
                    $logger.error(`Fails to load ${file}.`, ex)
                    return null
                })
            }
        })
    }
    portletServer.app.get(`/_${type}`, _.bind(sharedResourcesMiddleware, null, portletServer.sharedResourcesCaches[type]))
}

function sharedResourcesMiddleware(caches, req, res, next) {
    if (!caches) return next()
    let file = req.query.file
    let md5 = req.query.md5
    if (file === '*') {
        caches.enumerate(false).then(rs => {
            res.json(rs)
        }).catch(ex => {
            res.json([])
        })
    } else {
        caches.get(file).then(r => {
            if (r.md5 === md5)
                res.json({ md5 })
            else
                res.json(r)
        }).catch(ex => {
            res.json({})
        })
    }
}

function scanRoutes(portletServer, current) {
    const app = portletServer.app
    let pipelines = _.clone(current.pipelines || {})
    let layout = current.layout
    let before = _.clone(current.before || [])
    let after = _.clone(current.after || [])
    let portlet = portletServer.portlet
    let viewEngine = portletServer.viewEngine

    if (!fs.existsSync(current.dir)) return

    if (fs.existsSync(path.join(current.dir, 'index.js'))) {
        let methods = require(path.join(current.dir, 'index.js'))
        if (methods.before && methods.before.length > 0) {
            if (methods.before[0] === '|')
                before = _.slice(methods.before, 1)
            else
                before = _.concat(before, methods.before)
        }
        if (methods.after && methods.after.length > 0) {
            if (methods.after[methods.after.length - 1] === '|')
                after = _.slice(0, methods.after.length - 1)
            else
                after = _.concat(methods.after, after)
        }
        if (methods.layout) layout = methods.layout
        if (methods.pipelines) pipelines = _.merge(pipelines, methods.pipelines)
    }
    _.each(fs.readdirSync(current.dir), f => {
        let ext = path.extname(f)
        let action = path.basename(f)
        let fullPath = path.join(current.dir, f)
        action = action.substring(0, action.length - ext.length)
        if (fs.statSync(fullPath).isDirectory()) {
            let childUrlPath = `${current.urlPath}/${action}`
            let child = {
                parent: current,
                urlPath: childUrlPath,
                dir: fullPath,
                pipelines,
                before,
                after,
                layout,
                routes: []
            }
            current.routes.push(child)
            scanRoutes(portletServer, child)
        } else if (ext === '.js') {
            let methods = require(fullPath)
            methods = _.pick(methods, HTTP_METHODS)
            _.each(methods, (m, k) => {
                let handler = null
                let mbefore = _.clone(before)
                let mafter = _.clone(after)
                let mlayout = m.layout || layout
                if (_.isFunction(m)) {
                    handler = m
                } else if (_.isPlainObject(m)) {
                    if (m.before && m.before.length > 0) {
                        if (m.before[0] === '|')
                            mbefore = _.slice(m.before, 1)
                        else
                            mbefore = _.concat(mbefore, m.before)
                    }
                    if (m.after && m.after.length > 0) {
                        handler = m.handler
                        if (m.after[m.after.length - 1] === '|')
                            mafter = _.slice(0, m.after.length - 1)
                        else
                            mafter = _.concat(m.after, mafter)
                    }
                    if (m.layout) mlayout = m.layout
                } else {
                    $logger.error('Route handler must be a function or an object with {before:, handler:, after:}')
                    return
                }
                let wrappedHandler = function (req, res, next) {
                    retry(() => {
                        return portletServer.receivedMenuReady ? Promise.resolve() : Promise.reject(Error())
                    }).then(() => {
                        res.locals._menusByZone = _.merge(portletServer.receivedMenusByZone, portletServer.mergedMenusByZone)
                        res.locals.portlet = portlet
                        res.locals.layout = _.isFunction(mlayout) ? mlayout(req) : mlayout
                        res.show = function (viewPath, data) {
                            if (!data) {
                                data = viewPath
                                viewPath = `${current.urlPath}/${action}`.substring(1) // Remove the first '/'r
                            }
                            //res.render(viewPath, data) --> It will check the view file in the disk, while our view may be in another peer server
                            viewEngine(viewPath, _.extend(res.locals, data), (err, html) => {
                                if (err) return req.next(err);
                                res.send(html)
                            })
                        }
                        handler(req, res, next)
                    })
                }
                let allHandlers = _.concat(mbefore, wrappedHandler, mafter)
                allHandlers = _.map(allHandlers, h => _.isFunction(h) ? h : pipelines[h])
                let realUrlPath = `${portlet ? '/@' + portlet : ''}${current.urlPath}/${action === 'index' ? '' : action}`.replace(/\[/g, ':').replace(/\]/g, '')
                if (portletServer.config.logRoutes) $logger.info(`ROUTE ${k.toUpperCase()} ${realUrlPath}`)
                app[k](realUrlPath, ...allHandlers)
            })
        }
    })
}

function PortletServer(config) {
    let portlet = this.portlet = config.name
    let port = config.port || (10000 + getCRC16(portlet) % 10000)
    let app = this.app = express()
    let rootDir = config.rootDir || process.cwd()
    let routesDir = path.join(rootDir, config.routesDir || 'routes')
    let sharedDir = this.sharedDir = path.join(rootDir, config.sharedDir || 'shared')
    let layoutsDir = path.join(sharedDir, 'layouts')
    let partialsDir = path.join(sharedDir, 'partials')
    let viewsDir = path.join(sharedDir, 'views')
    let pipelinesDir = path.join(sharedDir, 'pipelines')
    let mockDir = path.join(rootDir, config.mock && config.mock.dir || 'mock')
    let extName = this.extName = '.hbs'

    this.config = config
    this.sharedResourcesCaches = {}
    this.mergedMenusByZone = {}
    this.receivedMenusByZone = {}
    this.receivedMenuReady = false
    this.startedAt = new Date()
    let pkgPath = path.join(process.cwd(), 'package.json')
    this.version = fs.existsSync(pkgPath) ? require(pkgPath).version || '0' : '0'

    app.enable('trust proxy')
    app.disable('x-powered-by')
    app.disable('etag')

    app.set('views', routesDir)

    let localCacheOption = {
        maxAge: config.debug ? '3s' : '100d',
        extName: this.extName
    }
    let remoteCacheOption = {
        maxAge: config.debug ? '3s' : '1m',
        enumForceReload: config.debug
    }
    let hveConfig = {
        portlet: portlet,
        pretty: config.debug,
        alias: config.alias || {},
        defaultLayout: config.layout,
        views: [{
            cache: createLocalTemplateCache(portlet, routesDir, localCacheOption)
        }, {
            cache: createLocalTemplateCache(portlet, viewsDir, localCacheOption)
        }],
        layouts: [{ cache: createLocalTemplateCache(portlet, layoutsDir, localCacheOption) }],
        partials: [{ cache: createLocalTemplateCache(portlet, partialsDir, localCacheOption) }]
    }
    _.each(config.peers, (url, name) => {
        hveConfig.views.push({ portlet: name, cache: createRemoteTemplateCache(name, `${url}/_views`, remoteCacheOption) })
        hveConfig.layouts.push({ portlet: name, cache: createRemoteTemplateCache(name, `${url}/_layouts`, remoteCacheOption) })
        hveConfig.partials.push({ portlet: name, cache: createRemoteTemplateCache(name, `${url}/_partials`, remoteCacheOption) })
    })
    const viewEngine = this.viewEngine = createHbsViewEngine(hveConfig)
    app.engine(extName, this.viewEngine)
    app.set('view engine', extName)
    if (config.logRequests) {
        let format = config.logRequests.format || 'dev'
        $logger.info(`Log requests with format ${format}`)
        app.use(require("morgan")(format, { "stream": { write: message => $logger.debug(message.trim()) } }))
    }

    let root = {
        parent: null,
        urlPath: '',
        dir: routesDir,
        pipelines: {},
        before: [],
        after: [],
        layout: config.layout,
        routes: []
    }
    if (config.compress) {
        $logger.info('Compression of HTTP response is enabled.')
        app.use(compression())
    }

    if (fs.existsSync(pipelinesDir)) {
        _.each(fs.readdirSync(pipelinesDir), f => {
            let ext = path.extname(f)
            if (ext === '.js') {
                let methods = require(path.join(pipelinesDir, f))
                root.pipelines = _.merge(root.pipelines, methods)
            }
        })
    }
    app.use(bodyParser.urlencoded({
        extended: true,
        limit: config.uploadLimit || '100mb'
    }))
    app.use(bodyParser.json({
        limit: config.uploadLimit || '100mb'
    }))

    /*
    app.use(express.multiparty({
        dest: $config.TMP_DIR
    }).any());
    */

    scanRoutes(this, root)

    app.use(`/@${portlet}`, express.static(config.publicDir || 'public', {
        maxAge: '1d'
    }))

    mountSharedResourcesMiddleware(this, 'layouts')
    mountSharedResourcesMiddleware(this, 'partials')
    mountSharedResourcesMiddleware(this, 'views')
    mountSharedResourcesMiddleware(this, 'menus', '.yaml')

    app.post('/_menus/merge/:zone', (req, res, next) => {
        let zone = req.body.zone
        if (this.mergedMenusByZone[zone]) {
            this.mergedMenusByZone[zone] = _.merge(this.mergedMenusByZone[zone], req.body.menus)
        }
        res.json(this.mergedMenusByZone[zone])
    })

    app.get('/_menus/merged', (req, res, next) => {
        res.json(this.mergedMenusByZone)
    })

    this.sharedResourcesCaches['menus'].enumerate(true).then(all => {
        if (all.zones) {
            _.each(all.zones.content, zone => {
                this.mergedMenusByZone[zone] = {}
                let allInZone = _.filter(_.keys(all), key => _.startsWith(key, `${zone}/`))
                if (allInZone.length > 0) {
                    this.mergedMenusByZone[zone] = _.merge(..._.map(_.values(_.pick(all, allInZone)), r => r.content))
                }
            })
        }
    })

    setInterval(() => {
        let peers = this.config.peers
        if (_.keys(peers).length > 0) {
            let names = _.keys(peers)
            this.sharedResourcesCaches['menus'].enumerate(true).then(all => {
                Promise.all(_.map(names, name => axios.get(`${peers[name]}/_menus?file=zones`))).then(rs => {
                    _.each(rs, (r, i) => {
                        let name = names[i]
                        let url = peers[name]
                        _.each(r.data.content, zone => {
                            let allInZone = _.filter(_.keys(all), key => _.startsWith(key, `${zone}/`))
                            if (allInZone.length > 0) {
                                let menus = _.merge(..._.map(_.values(_.pick(all, allInZone)), r => r.content))
                                let data = { zone, menus, version: `${this.version}.${this.startedAt.valueOf()}` }
                                axios.post(`${url}/_menus/merge/${encodeURIComponent(zone)}`, data).catch(ex => {
                                    $logger.error('Fails to merge menus.', ex)
                                })
                            }
                        })
                    })
                }).catch(ex => {
                    $logger.error('Fails to load zones.', ex)
                })
            })
            Promise.all(_.map(names, name => axios.get(`${peers[name]}/_menus/merged`))).then(rs => {
                _.each(rs, r => {
                    _.each(r.data, (menus, zone) => {
                        this.receivedMenusByZone[zone] = menus
                    })
                })
            }).then(r => {
                this.receivedMenuReady = true
            }).catch(ex => {
                $logger.error('Fails to receive merged menus.', ex)
            })
        }
    }, duration('3s'))

    if (config.mock) {
        let graphqlDir = path.join(mockDir, 'graphql')
        if (fs.existsSync(graphqlDir)) {
            setupGraphQLService({
                path: graphqlDir,
                attach: {
                    to: app
                }
            })
        }

        const peers = config.peers
        if (peers) {
            const httpProxy = require('http-proxy')
            const proxy = httpProxy.createProxy()
            _.each(peers, (url, name) => {
                $logger.info(`Proxy /@${name} to ${url}`)
            })
            app.use(function (req, res, next) {
                let parts = req.path.split('/')
                if (parts.length > 1 && parts[1][0] === '@') {
                    let name = parts[1].substring(1)
                    if (peers[name]) {
                        return proxy.web(req, res, {
                            target: peers[name]
                        })
                    }
                }
                next()
            })
        }
    }

    app.use(function (req, res, next) {
        $logger.error("404 (" + req.url + ") ");
        if (req.xhr) {
            res.status(404).json(normalizeError('404'))
        } else {
            viewEngine('404', normalizeError('404'), (err, html) => {
                if (err) return req.next(err);
                res.status(404).end(html)
            })
        }
    })

    app.use(function (err, req, res, next) {
        $logger.error("500 (" + req.url + ")", err)
        if (req.xhr) {
            res.status(err.status || 500).json(normalizeError(err))
        } else {
            viewEngine('500', normalizeError('500'), (err, html) => {
                res.status(err && err.status || 500).end(html)
            })
        }
    })

    app.use(function (err, req, res, next) {
        res.status(err.status || 500).end('500')
    })

    app.listen(port, function () {
        $logger.info(`Portlet ${portlet}(${this.version}) starts on port ${port} with node.js ${process.version}`)
        $logger.info(`Url http://localhost:${port}/@${portlet}/`)
    })

}

function normalizeError(err, errCode) {
    let json = { error: { message: _.isString(err) ? err : err && err.message || err + '' } }
    if (errCode !== undefined) json.error.code = errCode
    return json
}

function setupPortletServer(config) {
    return new PortletServer(config)
}

module.exports = {
    ...require('./xss'),
    normalizeError,
    setupPortletServer
}