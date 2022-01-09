const _ = require('lodash')
const http = require('http')
const path = require('path')
const fs = require('graceful-fs')
const EventEmitter = require('events');
const cookieParser = require('cookie-parser')
const { getCRC16, duration } = require('@vimesh/utils')
const express = require('express')
const compression = require('compression')
const { setupRoutes } = require('./routes')
const { setupRemoteApis } = require('./remote-apis')
const { setupProxy } = require('./proxy')
const { setupAssets } = require('./assets')
const { createViewEngine } = require('./view-engine')
const { formatError } = require('./utils')
const { setupRedirects } = require('./redirects')
const defaultHbsHelpers = require('./hbs-helpers')
const { createStorage, createScopedStorage, createCacheForScopedStorage } = require('@vimesh/storage')

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
        let extName = this.extName = '.hbs'

        this.config = config
        this.assetCaches = {}
        this.allMenusByZone = {}
        this.mergedI18nItems = {}
        this.allPermissions = {}
        this.allExtensionsByZone = {}
        this.allEnums = {}
        this.allHbsHelpers = _.clone(defaultHbsHelpers)
        this.beforeAll = []
        this.menusReady = false
        this.i18nReady = false
        this.startedAt = new Date()
        let pkgPath = path.join(process.cwd(), 'package.json')
        this.version = config.version || (fs.existsSync(pkgPath) ? require(pkgPath).version || '0' : '0')

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
        this.storages = {}
        _.each(config.storages, (sconfig, name) => {
            let storage = createStorage(sconfig)
            let bucket = sconfig.bucket || 'default'
            storage.hasBucket(bucket).then(exists => {
                if (!exists) storage.createBucket(bucket)
            })
            let scopedStorage = createScopedStorage(storage, bucket, sconfig.prefix)
            let cache = createCacheForScopedStorage(scopedStorage, sconfig.cacheDir, sconfig.cacheOptions)
            this.storages[name] = { storage: scopedStorage, cache }
        })
        app.enable('trust proxy')
        app.disable('x-powered-by')
        app.disable('etag')

        app.set('views', routesDir)

        this.viewEngine = createViewEngine(this)
        app.engine(extName, this.viewEngine)
        app.set('view engine', extName)

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
                        }catch(ex){
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

        setupRemoteApis(this)
        this.emit('beforeSetupRoutes')
        setupRoutes(this)
        this.emit('afterSetupRoutes')

        setupAssets(this)
        setupProxy(this)

        setupRedirects(this)

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