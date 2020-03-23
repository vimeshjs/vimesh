'use strict';

const _ = require('lodash')
const path = require('path')
const fs = require('graceful-fs')
const { getCRC16 } = require('@vimesh/utils')
const { setupGraphQLService } = require('@vimesh/graphql')
const express = require('express')
const helpers = require('./helpers')
const ExpressHandlebars = require('./express-handlebars')

const HTTP_METHODS = ['all', 'get', 'post', 'put', 'delete', 'patch', 'options', 'head']

function scanRoutes(app, current) {
    const LOG_ROUTES = app.get('log routes')
    let pipelines = _.clone(current.pipelines || {})
    let layout = current.layout
    let before = _.clone(current.before || [])
    let after = _.clone(current.after || [])
    let portlet = app.get('portlet')

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
            scanRoutes(app, child)
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
                if (LOG_ROUTES) $logger.info(`ROUTE ${k.toUpperCase()} ${realUrlPath}`)
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

function setupViewServer(options) {
    let portlet = options.portlet
    let port = options.port || calcPortFromPortletName(portlet)
    let app = express()
    let routesDir = path.join(process.cwd(), options.routesDir || 'routes')
    let sharedDir = path.join(process.cwd(), options.sharedDir || 'shared')
    let layoutsDir = path.join(sharedDir, 'layouts')
    let partialsDir = path.join(sharedDir, 'partials')
    let pipelinesDir = path.join(sharedDir, 'pipelines')

    app.enable('trust proxy')
    app.disable('x-powered-by')
    app.disable('etag')
    app.set('portlet', options.portlet || '')

    app.set('views', routesDir)

    let config = {
        extname: '.hbs',
        layoutsDir: layoutsDir,
        partialsDir: partialsDir,
        helpers: helpers,
    }
    if (options.layout) config.defaultLayout = options.layout
    let hbs = new ExpressHandlebars(config)

    app.engine('.hbs', hbs.engine)
    app.set('view engine', '.hbs')
    app.set('log routes', !!options.logRoutes)

    let root = {
        portlet: portlet,
        parent: null,
        urlPath: '',
        dir: routesDir,
        pipelines: {},
        before: [],
        after: [],
        layout: options.layout,
        routes: []
    }

    if (fs.existsSync(pipelinesDir)) {
        console.log(pipelinesDir)
        _.each(fs.readdirSync(pipelinesDir), f => {
            let ext = path.extname(f)
            if (ext === '.js') {
                let methods = require(path.join(pipelinesDir, f))
                root.pipelines = _.merge(root.pipelines, methods)
            }
        })
    }
    scanRoutes(app, root)

    app.use(express.static(options.publicDir || 'public'))

    app.use(function (err, req, res, next) {
        $logger.error("500 (" + req.url + ")", err)
        if (req.xhr || err.code === 'EBADCSRFTOKEN') {
            res.status(500).json(normalizeError(err))
        } else {
            res.locals.error = normalizeError(err)
            res.status(500).render(`500`)
        }
    })

    app.use(function (req, res, next) {
        $logger.error("404 (" + req.url + ") ");
        if (req.xhr) {
            res.status(404).json(normalizeError('404'))
        } else {
            res.locals.error = normalizeError('404')
            res.status(404).render(`404`)
        }
    })
    app.listen(port, function () {
        $logger.info(`Portlet ${portlet} starts on port ${port} with node.js ${process.version}`)
    })

    if (options.mockDir) {
        setupGraphQLService({
            path: path.join(options.mockDir, 'graphql'),
            attach: {
                to: app
            }
        })
    }
    return app
}

module.exports = {
    ...require('./xss'),
    normalizeError,
    setupViewServer
}