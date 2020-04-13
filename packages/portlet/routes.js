
const _ = require('lodash')
const path = require('path')
const fs = require('graceful-fs')
const mkdirp = require('mkdirp')
const formidable = require('formidable')
const { retryPromise } = require('@vimesh/utils')
const { formatError, formatOK } = require('./utils')
const HTTP_METHODS = ['all', 'get', 'post', 'put', 'delete', 'patch', 'config', 'head']
function convertParameters(params, config) {
    try {
        _.each(params, (v, k) => {
            switch (config[k]) {
                case 'integer':
                case 'float':
                case 'number':
                    params[k] = +v; break;
                case 'object': params[k] = JSON.parse(v); break;
            }
        })
    } catch (ex) {
        $logger.error(`Fails to convert ${JSON.stringify(params)} with config ${JSON.stringify(config)}`)
    }
}
function bodyParserMiddleware(req, res, next) {
    let context = this
    let options = {multiples: true}
    if (context.uploadDir) options.uploadDir = context.uploadDir
    let form = formidable(options)
    form.parse(req, (err, fields, files) => {
        if (err) return next(err)
        req.body = fields
        req.files = files
        next()
    })
}
function wrappedMiddleware(req, res, next) {
    let context = this
    let portletServer = context.portletServer
    let portlet = context.portlet
    let mlayout = context.layout
    let handler = context.handler
    let current = context.current
    let action = context.action
    let viewEngine = context.viewEngine
    retryPromise(() => {
        let ready = portletServer.menusReady && portletServer.i18nReady
        if (!ready) $logger.warn(`Server is not ready (menu: ${portletServer.menusReady}, i18n:${portletServer.i18nReady})!`)
        return ready ? Promise.resolve() : Promise.reject(Error())
    }).then(() => {
        res.locals.$path = req.path
        res.locals.$language = portletServer.config.language
        res.locals._i18nItems = portletServer.mergedI18nItems || {}
        res.locals._menusByZone = portletServer.allMenusByZone
        res.locals.$portlet = portlet
        res.locals.$user = req.user
        res.locals.$session = req.session
        res.locals._helperPostProcessor = []
        res.locals.layout = _.isFunction(mlayout) ? mlayout(req) : mlayout
        res.ok = function (msg, code) {
            res.json(formatOK(msg, code))
        }
        res.error = function (err, code) {
            res.status(500).json(formatError(err, code))
        }
        res.i18n = function (names) {
            if (_.isString(names)) names = _.map(names.split(';'), r => r.trim())
            return _.merge(..._.map(names, name => {
                if (!name) return ''
                let p1 = name.indexOf('(')
                let p2 = name.indexOf(')')
                let fields = null
                if (p1 > 0 && p2 > p1) {
                    fields = _.map(name.substring(p1 + 1, p2).split(','), r => r.trim())
                    name = name.substring(0, p1).trim()
                }
                let lang = res.locals.$language
                let items = res.locals._i18nItems
                let ls = _.keys(_.omit(items, '*'))
                if (!lang && ls.length > 0) lang = ls[0]
                let result = _.get(items[lang], name) || _.get(items['*'], name)
                if (!result) {
                    $logger.error(`I18n item "${name}" does not have any translation!`)
                    return {}
                }
                return fields && fields.length > 0 ? _.pick(result, fields) : result
            }))
        }
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
        let inputs = context.inputs
        if (inputs) {
            convertParameters(req.query, inputs.query)
            convertParameters(req.params, inputs.params)
        }
        handler(req, res, next)
    })
}
function scanRoutes(portletServer, current) {
    const app = portletServer.app
    let pipelines = _.clone(current.pipelines || {})
    let layout = current.layout
    let before = _.clone(current.before || [])
    let after = _.clone(current.after || [])
    let portlet = portletServer.portlet
    let viewEngine = portletServer.viewEngine

    if (!current.dir || !fs.existsSync(current.dir) || current.dir[0] == '_') return

    if (fs.existsSync(path.join(current.dir, '_.js'))) {
        let methods = require(path.join(current.dir, '_.js'))
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
        if (methods.setup) {
            $logger.info(`Setup ${portlet ? '/@' + portlet : ''}${current.urlPath}`)
            methods.setup(portletServer)
        }
    }
    _.each(fs.readdirSync(current.dir), f => {
        if (f[0] == '_') return
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
            if (methods.setup) {
                $logger.info(`Setup ${portlet ? '/@' + portlet : ''}${current.urlPath}`)
                methods.setup(portletServer)
            }
            methods = _.pick(methods, HTTP_METHODS)
            if (_.keys(methods).length === 0){
                $logger.warn(`${fullPath} has no HTTP handlers`)
            }
            _.each(methods, (m, k) => {
                let mbefore = _.clone(before)
                let mafter = _.clone(after)
                let mcontext = { portletServer, portlet, current, action, viewEngine, layout }
                if (_.isFunction(m)) {
                    mcontext.handler = m
                } else if (_.isPlainObject(m)) {
                    if (!_.isFunction(m.handler)) {
                        $logger.error('Route handler must be a function!', Error('No http request handler!'))
                    }
                    if (m.before && m.before.length > 0) {
                        if (m.before[0] === '|')
                            mbefore = _.slice(m.before, 1)
                        else
                            mbefore = _.concat(mbefore, m.before)
                    }
                    if (m.after && m.after.length > 0) {
                        if (m.after[m.after.length - 1] === '|')
                            mafter = _.slice(0, m.after.length - 1)
                        else
                            mafter = _.concat(m.after, mafter)
                    }
                    if (m.layout) mcontext.mlayout = m.layout
                    mcontext.handler = m.handler
                    mcontext.inputs = m.inputs
                } else {
                    $logger.error('Route handler must be a function or an object with {before:, handler:, after:}')
                    return
                }
                let bpContext = _.pick(portletServer.config, 'uploadDir')
                if (bpContext.uploadDir) mkdirp(bpContext.uploadDir)
                let allHandlers = _.concat(
                    _.bind(bodyParserMiddleware, bpContext),
                    mbefore,
                    _.bind(wrappedMiddleware, mcontext),
                    mafter)
                allHandlers = _.map(allHandlers, h => _.isFunction(h) ? h : pipelines[h])
                let realUrlPath = `${portlet ? '/@' + portlet : ''}${current.urlPath}/${action === 'index' ? '' : action}`.replace(/\[/g, ':').replace(/\]/g, '')
                if (portletServer.config.logRoutes) $logger.info(`ROUTE ${k.toUpperCase()} ${realUrlPath}`)
                app[k](realUrlPath, ...allHandlers)
            })
        }
    })
}
function setupRoutes(portletServer) {
    let config = portletServer.config
    let routesDir = portletServer.routesDir
    let pipelinesDir = portletServer.pipelinesDir
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

    if (fs.existsSync(pipelinesDir)) {
        _.each(fs.readdirSync(pipelinesDir), f => {
            let ext = path.extname(f)
            if (ext === '.js') {
                let methods = require(path.join(pipelinesDir, f))
                root.pipelines = _.merge(root.pipelines, methods)
            }
        })
    }

    scanRoutes(portletServer, root)
}
module.exports = {
    setupRoutes
}