const _ = require('lodash')
const path = require('path')
const fs = require('graceful-fs')
const { getCRC16 } = require('@vimesh/utils')
const { setupGraphQLService } = require('@vimesh/graphql')
const express = require('express')
const compression = require('compression')
const helpers = require('./helpers')
const ExpressHandlebars = require('./express-handlebars')

const HTTP_METHODS = ['all', 'get', 'post', 'put', 'delete', 'patch', 'config', 'head']

function scanRoutes(context, current) {
    const app = context.app
    let pipelines = _.clone(current.pipelines || {})
    let layout = current.layout
    let before = _.clone(current.before || [])
    let after = _.clone(current.after || [])
    let portlet = context.portlet

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
            scanRoutes(context, child)
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
                    res.locals.portlet = portlet
                    res.locals.layout = _.isFunction(mlayout) ? mlayout(req) : mlayout
                    res.show = function (viewPath, data) {
                        if (!data) {
                            data = viewPath
                            viewPath = `${current.urlPath}/${action}`.substring(1) // Remove the first '/'r
                        }
                        res.render(viewPath, data)
                    }
                    handler(req, res, next)
                }
                let allHandlers = _.concat(mbefore, wrappedHandler, mafter)
                allHandlers = _.map(allHandlers, h => _.isFunction(h) ? h : pipelines[h])
                let realUrlPath = `${portlet ? '/@' + portlet : ''}${current.urlPath}/${action === 'index' ? '' : action}`.replace(/\[/g, ':').replace(/\]/g, '')
                if (context.config.logRoutes) $logger.info(`ROUTE ${k.toUpperCase()} ${realUrlPath}`)
                app[k](realUrlPath, ...allHandlers)
            })
        }
    })
}

function normalizeError(err, errCode) {
    let json = { error: { message: _.isString(err) ? err : err && err.message || err + '' } }
    if (errCode !== undefined) json.error.code = errCode
    return json
}

function shareFiles(dir, req, res, next) {
    let filePath = req.query.path

    let fullPath = path.join(dir, req.path) + '.hbs'
    res.sendFile(fullPath)
}

function calcPortFromPortletName(portlet) {
    return 10000 + getCRC16(portlet) % 10000
}

function setupPortletServer(config) {
    let portlet = config.name
    let port = config.port || calcPortFromPortletName(portlet)
    let app = express()
    let rootDir = config.rootDir || process.cwd()
    let routesDir = path.join(rootDir, config.routesDir || 'routes')
    let sharedDir = path.join(rootDir, config.sharedDir || 'shared')
    let layoutsDir = path.join(sharedDir, 'layouts')
    let partialsDir = path.join(sharedDir, 'partials')
    let pipelinesDir = path.join(sharedDir, 'pipelines')
    let mockDir = path.join(rootDir, config.mock && config.mock.dir || 'mock')

    app.enable('trust proxy')
    app.disable('x-powered-by')
    app.disable('etag')

    app.set('views', routesDir)


    let hbsOptions = {
        extname: '.hbs',
        layoutsDir: layoutsDir,
        partialsDir: partialsDir,
        helpers: helpers,
    }
    if (config.layout) hbsOptions.defaultLayout = config.layout
    let hbs = new ExpressHandlebars(hbsOptions)

    app.engine('.hbs', hbs.engine)
    app.set('view engine', '.hbs')

    if (config.logRequests) {
        app.use(require("morgan")(config.logRequests.format || 'dev', { "stream": { write: message => $logger.debug(message.trim()) } }))
    }

    let context = { app, config, portlet }
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
    scanRoutes(context, root)

    app.use(`/@${portlet}`, express.static(config.publicDir || 'public', {
        maxAge: '1d'
    }))

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

        const portlets = config.mock.portlets
        if (portlets) {
            const httpProxy = require('http-proxy')
            const proxy = httpProxy.createProxy()
            _.each(portlets, (url, name) => {
                $logger.info(`Proxy /@${name} to ${url}`)
            })
            app.use(function (req, res, next) {
                let parts = req.path.split('/')
                if (parts.length > 1 && parts[1][0] === '@') {
                    let name = parts[1].substring(1)
                    if (portlets[name]) {
                        return proxy.web(req, res, {
                            target: portlets[name]
                        })
                    }
                }
                next()
            })
        }
    }

    app.use(function (err, req, res, next) {
        $logger.error("500 (" + req.url + ")", err)
        if (req.xhr) {
            res.status(err.status || 500).json(normalizeError(err))
        } else {
            res.status(err.status || 500).render(`500`, normalizeError(err))
        }
    })

    app.use(function (req, res, next) {
        $logger.error("404 (" + req.url + ") ");
        if (req.xhr) {
            res.status(404).json(normalizeError('404'))
        } else {
            res.status(404).render(`404`, normalizeError('404'))
        }
    })

    app.listen(port, function () {
        $logger.info(`Portlet ${portlet} starts on port ${port} with node.js ${process.version}`)
        $logger.info(`Url http://localhost:${port}/@${portlet}/`)
    })

    return app
}

module.exports = {
    ...require('./xss'),
    normalizeError,
    setupPortletServer
}