const _ = require('lodash')
const path = require('path')
const axios = require('axios')
const fs = require('graceful-fs')
const bodyParser = require('body-parser')
const { getCRC16, duration } = require('@vimesh/utils')
const Promise = require('bluebird')
const express = require('express')
const compression = require('compression')
const { setupRoutes } = require('./routes')
const { setupSharedResources } = require('./shared-resources')
const { createViewEngine } = require('./view-engine')

function PortletServer(config) {
    let portlet = this.portlet = config.name
    let port = config.port || (10000 + getCRC16(portlet) % 10000)
    let app = this.app = express()
    let rootDir = config.rootDir || process.cwd()
    let routesDir = this.routesDir = path.join(rootDir, config.routesDir || 'routes')
    let sharedDir = this.sharedDir = path.join(rootDir, config.sharedDir || 'shared')
    this.layoutsDir = path.join(sharedDir, 'layouts')
    this.partialsDir = path.join(sharedDir, 'partials')
    this.viewsDir = path.join(sharedDir, 'views')
    this.pipelinesDir = path.join(sharedDir, 'pipelines')
    let mockDir = path.join(rootDir, config.mock && config.mock.dir || 'mock')
    let extName = this.extName = '.hbs'

    this.config = config
    this.sharedResourcesCaches = {}
    this.allMenusByZone = {}
    this.mergedI18nItems = {}
    this.menusReady = false
    this.i18nReady = false
    this.startedAt = new Date()
    let pkgPath = path.join(process.cwd(), 'package.json')
    this.version = fs.existsSync(pkgPath) ? require(pkgPath).version || '0' : '0'

    app.enable('trust proxy')
    app.disable('x-powered-by')
    app.disable('etag')

    app.set('views', routesDir)

    const viewEngine = this.viewEngine = createViewEngine(this)
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
    setupRoutes(this)

    app.use(`/@${portlet}`, express.static(config.publicDir || 'public', {
        maxAge: '1d'
    }))

    setupSharedResources(this)

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

    app.listen(port, () => {
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