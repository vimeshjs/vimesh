
const _ = require('lodash')
const path = require('path')
const fs = require('graceful-fs')
const { retryPromise } = require('@vimesh/utils')
const HTTP_METHODS = ['all', 'get', 'post', 'put', 'delete', 'patch', 'config', 'head']

function convertParameters(params, config) {
    try {
        _.each(params, (v, k) => {
            switch (config[k]) {
                case 'integer': params[k] = +v; break;
                case 'object': params[k] = JSON.parse(v); break;
            }
        })
    } catch (ex) {
        $logger.error(`Fails to convert ${JSON.stringify(params)} with config ${JSON.stringify(config)}`)
    }
}

let wrappedMiddleware = function (context, req, res, next) {
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
        res.locals._path = req.path
        res.locals._language = portletServer.config.language
        res.locals._i18nItems = portletServer.mergedI18nItems || {}
        res.locals._menusByZone = _.merge(..._.values(portletServer.allMenusByZone))
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
            if (methods.setup) {
                $logger.info(`Setup ${portlet ? '/@' + portlet : ''}${current.urlPath}`)
                methods.setup({
                    mock: portletServer.config.mock
                })
            }
            methods = _.pick(methods, HTTP_METHODS)
            _.each(methods, (m, k) => {
                let mbefore = _.clone(before)
                let mafter = _.clone(after)
                let mcontext = {portletServer, portlet, current, action, viewEngine, layout}
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
                let allHandlers = _.concat(mbefore, _.bind(wrappedMiddleware, null, mcontext), mafter)
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