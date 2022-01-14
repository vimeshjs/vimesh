const _ = require('lodash')
const http = require('http')
const path = require('path')
const glob = require('glob')
const fs = require('graceful-fs')
const yaml = require('js-yaml')
const EventEmitter = require('events');
const cookieParser = require('cookie-parser')
const { getCRC16, getMD5, duration } = require('@vimesh/utils')
const express = require('express')
const compression = require('compression')
const { setupRoutes } = require('./routes')
const { setupProxy } = require('./proxy')
const { createViewEngine } = require('./view-engine')
const { formatError } = require('./utils')
const { createMemoryCache } = require('@vimesh/cache')
const Promise = require('bluebird')
const accessAsync = Promise.promisify(fs.access)
const readFileAsync = Promise.promisify(fs.readFile)
const globAsync = Promise.promisify(glob)
const defaultHbsHelpers = require('./hbs-helpers')

class PortletServer extends EventEmitter {
    constructor(config) {
        super()
        let portlet = this.portlet = config.name
        let port = this.port = config.port || (10000 + getCRC16(portlet) % 10000)
        let app = this.app = express()
        this.server = http.createServer(app)
        let rootDir = this.rootDir = config.rootDir || process.cwd()
        let routesDir = this.routesDir = path.join(rootDir, config.routesDir || 'routes')
        let assetsDir = this.assetsDir = path.join(rootDir, config.assetsDir || 'assets')
        if (!fs.existsSync(assetsDir)) {
            let sharedDir = path.join(rootDir, config.sharedDir || 'shared')
            if (fs.existsSync(sharedDir))
                assetsDir = this.assetsDir = sharedDir
        }
        this.layoutsDir = path.join(assetsDir, 'layouts')
        this.partialsDir = path.join(assetsDir, 'partials')
        this.viewsDir = path.join(assetsDir, 'views')
        this.componentsDir = path.join(assetsDir, 'components')
        this.config = config
        this.assetCaches = {}
        this.allPermissions = {}
        this.allExtensionsByZone = {}
        this.allEnums = {}
        this.allHbsHelpers = _.clone(defaultHbsHelpers)
        this.beforeAll = []
        this.ready = {}
        this.startedAt = new Date()
        let pkgPath = path.join(process.cwd(), 'package.json')
        this.version = config.version || (fs.existsSync(pkgPath) ? require(pkgPath).version || '0' : '0')

        if (!config.extName) config.extName = '.hbs'
        if (config.mock) {
            let mockDir = path.join(rootDir, config.mock && config.mock.dir || 'mock')
            $logger.info(`Portlet ${portlet} is under mock mode!`)
            global.$mock = {}
            if (fs.existsSync(mockDir)) {
                _.each(fs.readdirSync(mockDir), f => {
                    try {
                        let key = f.substring(0, f.length - path.extname(f).length)
                        $mock[key] = require(path.join(mockDir, f))
                    } catch (ex) {
                        $logger.error('Fails to load mock!', ex)
                    }
                })
            }
        }
        let discoveryUrl = _.get(config, 'discovery.url')
        this.kvClient = null
        this.standalone = !discoveryUrl
        if (discoveryUrl) {
            const { createKeyValueClient } = require('@vimesh/discovery')
            this.kvClient = createKeyValueClient({ url: discoveryUrl })
            this.selfUrl = config.selfUrl
            if (this.selfUrl) {
                setInterval(() => {
                    this.kvClient.set(`portlets/@${portlet}`, this.selfUrl, { duration: '1m' })
                }, duration('3s'))
            }
        }
        this.urlPrefix = this.standalone ? '' : `/@${portlet}`
        app.enable('trust proxy')
        app.disable('x-powered-by')
        app.disable('etag')

        app.set('views', routesDir)

        this.viewEngine = createViewEngine(this)
        app.engine(config.extName, this.viewEngine)
        app.set('view engine', config.extName)

        if (config.logRequests) {
            let format = config.logRequests.format || 'dev'
            $logger.info(`Log requests with format ${format}`)
            app.use(require("morgan")(format, {
                skip: (req) => { return _.startsWith(req.path, '/_') }, // Do not log internal requests, too many!
                stream: { write: message => $logger.debug(message.trim()) }
            }))
        }

        if (config.compress) {
            $logger.info('Compression of HTTP response is enabled.')
            app.use(compression())
        }

        if (config.plugins) {
            _.each(config.plugins, plugin => {
                try {
                    if (_.isString(plugin)) {
                        $logger.info(`Loading plugin ${plugin}`)
                        let setupFun
                        try {
                            setupFun = require(plugin)
                        } catch (ex) {
                            let pluginPath = path.join(process.cwd(), 'node_modules', plugin)
                            setupFun = require(pluginPath)
                        }
                        setupFun(this)
                    } else if (_.isFunction(plugin)) {
                        $logger.info(`Loading plugin ${plugin}`)
                        plugin(this)
                    }
                } catch (ex) {
                    $logger.error(`Fails to load plugin ${plugin}`, ex)
                }
            })
        }

        if (config.onSetupRoutes) {
            $logger.warn('onSetupRoutes will be removed in the next version, please use plugins instead.')
            config.onSetupRoutes(this)
            delete config.onSetupRoutes
        }

        if (!config.disableCookies)
            app.use(cookieParser())
        $logger.info(`HTTP cookies is ${config.disableCookies ? 'disabled' : 'enabled'}`)

        this.createAssetsCache('layouts')
        this.createAssetsCache('partials')
        this.createAssetsCache('views')
        
        this.loadAssets('permissions', '.yaml', (rs) => {
            this.allPermissions = _.merge({}, ..._.values(rs))
        })
        this.loadAssets('extensions', '.yaml', (rs) => {
            _.each(rs, (r, key) => {
                let pos = key.indexOf('/')
                let zone = pos == -1 ? key : key.substring(0, pos)
                this.allExtensionsByZone[zone] = _.merge(this.allExtensionsByZone[zone], r)
            })
        })
        this.loadAssets('enums', '.yaml', (rs) => {
            this.allEnums = _.merge({}, rs)
        })

        this.emit('beforeSetupRoutes')
        setupRoutes(this)
        this.emit('afterSetupRoutes')
        if (!this.standalone)
            setupProxy(this)

        app.use(this.urlPrefix, express.static(config.publicDir || 'public', {
            maxAge: config.publicMaxAge || '1d'
        }))

        app.use(this.beforeAll, function (req, res, next) {
            $logger.error("404 (" + req.url + ") ");
            if (req.xhr) {
                res.status(404).json(formatError('404'))
            } else {
                res.status(404)
                res.show('404', {})
            }
        })

        app.use(this.beforeAll, function (err, req, res, next) {
            $logger.error("500 (" + req.url + ")", err)
            if (req.xhr) {
                res.status(err.status || 500).json(formatError(err))
            } else {
                res.status(err && err.status || 500)
                res.show('500', {})
            }
        })

        app.use(function (err, req, res, next) {
            res.status(err.status || 500).end('500')
        })

        if (config.onStart) {
            config.onStart(this)
            delete config.onStart
        }

        this.emit('start')

        this.server.listen(port, () => {
            $logger.info(`Portlet ${portlet}(version: ${this.version}) starts on port ${port} with node.js ${process.version}`)
            $logger.info(`Url http://localhost:${port}/${this.standalone ? '' : `@${portlet}/`}`)
        })
    }
    registerHbsHelpers(helpers) {
        $logger.info(`Registering Hbs helpers ${_.keys(helpers).join(',')}`)
        _.merge(this.allHbsHelpers, helpers)
    }
    createAssetsCache(type, extName) {
        if (!extName) extName = this.config.extName
        if (!this.assetCaches[type]) {
            let debug = this.config.debug
            let assetsDir = this.assetsDir
            let portlet = this.portlet
            let kvClient = this.kvClient
            this.assetCaches[type] = createMemoryCache({
                enumInterval: debug ? '3s' : null,
                maxAge: debug ? '3s' : '1m',
                updateAgeOnGet: false,
                onEnumerate() {
                    let dir = path.join(assetsDir, type)
                    return globAsync(`${dir}/**/*${extName}`).then(files => {
                        return _.map(files, f => {
                            let rf = path.relative(dir, f)
                            rf = rf.replace(/\\/g, '/')
                            return rf.substring(0, rf.length - extName.length)
                        })
                    })
                },
                onRefresh(key) {
                    let file = path.join(assetsDir, type, key + extName)
                    //$logger.debug(`Loading shared/${type}/${key} `)                
                    return accessAsync(file).then(r => {
                        return readFileAsync(file)
                    }).then(r => {
                        let content = r.toString()
                        if (extName === '.yaml') {
                            content = yaml.load(content)
                        }
                        if (kvClient) {
                            let dkey = `${type}/@${portlet}/${key}`
                            kvClient.set(dkey, content, { duration: debug ? '1m' : '10m' }).catch(ex => {
                                $logger.error(`Fails to send ${dkey} to discovery server`, ex)
                            })
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
            this.assetCaches[type].enumerate(true)
        }
    }
    loadAssets(type, extName, handler, interval = '3s') {
        this.createAssetsCache(type, extName)
        const doRefresh = () => {
            if (this.standalone) {
                let cache = this.assetCaches[type]
                cache.enumerate(true).then(rs => {
                    handler(_.mapValues(rs, r => r.content))
                })
            } else {
                let kvClient = this.kvClient
                kvClient.get(`${type}/*`).then(rs => {
                    let result = {}
                    _.each(rs, (r, key) => {
                        key = key.substring(key.indexOf('/', key.indexOf('@')) + 1)
                        result[key] = r
                    })
                    handler(result)
                }).catch(ex => {
                    $logger.error(`Fails to refresh assets ${type}.`, ex)
                })
            }
        }
        doRefresh()
        setInterval(() => {
            doRefresh()
        }, duration(interval))
    }
}

function setupPortletServer(config) {
    if (!config.global)
        config.global = '$portlet'

    return global[config.global] = new PortletServer(config)
}

module.exports = {
    ...require('./xss'),
    setupPortletServer
}