
const _ = require('lodash')
const css = require('css')
const path = require('path')
const beautify = require('js-beautify')
const minify = require('html-minifier')
const layoutPattern = /{{!<\s+([@A-Za-z0-9\._\-\/]+)\s*}}/
const classNames = /class\s*=\s*['\"](?<class>[^'\"]*)['\"]/g
const allHelpers = [require('./hbs-helpers')]
function registerHelpers(helpers) {
    allHelpers.push(helpers)
}
function HbsViewEngine(config) {
    this.extName = config.extName || '.hbs'
    this.views = config.views
    this.defaultLayout = config.defaultLayout
    this.layouts = config.layouts
    this.partials = config.partials
    this.alias = config.alias
    this.portlet = config.portlet
    this.pretty = config.pretty
    this.htmlMinify = config.htmlMinify
    _.each(this.views, item => item.cache.enumerate())
    _.each(this.layouts, item => item.cache.enumerate())
    _.each(this.partials, item => item.cache.enumerate())
}
function extractLayout(view) {
    let matches = view.source.match(layoutPattern);
    return matches ? matches[1] : null
}
function renderWithLayout(context) {
    let layoutName = extractLayout(context.view) || context.layout
    let options = { partials: context.partials, helpers: context.helpers }
    let body = context.view.template(context.locals, options)
    //$logger.debug(`Render @${context.view.portlet}/${context.view.path} ${layoutName ? 'with layout ' + layoutName : ''}`)
    if (layoutName) {
        layoutName = context.alias.layouts && context.alias.layouts[layoutName] || layoutName
        let layoutView = context.layouts[layoutName]
        if (layoutView) {
            context.locals.body = body
            context.view = layoutView
            context.layout = null
            return renderWithLayout(context)
        } else {
            $logger.error(`Could not found layout "${layoutName}"`)
        }
    }
    return Promise.resolve(body)
}
HbsViewEngine.prototype.render = function (filename, context, callback) {
    let key = filename
    if (_.endsWith(key, this.extName)) {
        path.relative(context.settings.views, filename)
        key = key.substring(0, key.length - this.extName.length)
    }
    let targetPortlet = null
    if (this.alias.views && this.alias.views[key]) key = this.alias.views[key]
    let view = null
    if (key[0] === '@') {
        let pos = key.indexOf('/')
        targetPortlet = key.substring(1, pos)
        key = key.substring(pos + 1)
        if (targetPortlet === this.portlet)
            targetPortlet = null
    }
    Promise.all(_.map(this.views, item => item.cache.enumerate())).then(rs => {
        let found = null
        _.find(rs, (r, i) => {
            if (targetPortlet) {
                let portlet = this.views[i].portlet || this.portlet
                if (targetPortlet === portlet && r[key]) {
                    found = r[key]
                    return true
                }
            } else {
                if (r[key]) {
                    found = r[key]
                    return true
                }
            }
            return false
        })
        return found || Promise.reject(Error(`View ${key} is not found!`))
    }).then(r => {
        view = r
        return Promise.all([
            Promise.all(_.map(this.layouts, item => item.cache.enumerate())),
            Promise.all(_.map(this.partials, item => item.cache.enumerate()))
        ])
    }).then(rs => {
        let allPartials = {}
        _.each(rs[1], (ps, i) => {
            let portlet = this.partials[i].portlet
            _.each(ps, (p, k) => {
                if (!p || !p.template) return $logger.error(`Partitial @${portlet}/${k} is missing`)
                if (portlet) {
                    if (!allPartials[`${k}`]) allPartials[`${k}`] = p.template
                    allPartials[`@${portlet}/${k}`] = p.template
                } else {
                    allPartials[`${k}`] = p.template
                    allPartials[`@${this.portlet}/${k}`] = p.template
                }
            })
        })
        let allLayouts = {}
        _.each(rs[0], (ls, i) => {
            let portlet = this.partials[i].portlet
            _.each(ls, (l, k) => {
                if (portlet) {
                    if (!allLayouts[`${k}`]) allLayouts[`${k}`] = l
                    allLayouts[`@${portlet}/${k}`] = l
                } else {
                    allLayouts[`${k}`] = l
                    allLayouts[`@${this.portlet}/${k}`] = l
                }
            })
        })
        return renderWithLayout({
            portlet: this.portlet,
            alias: this.alias,
            layouts: allLayouts,
            partials: allPartials,
            helpers: _.merge(...allHelpers, context.helpers),
            layout: context.layout || this.layout,
            locals: context,
            data: {},
            view: view
        })
    }).then(html => {
        if (context._tailwindAllClasses && context._tailwindStylesList){     
            let missedClasses = {}
            let match
            while((match = classNames.exec(html)) !== null){
                _.each(match.groups.class.split(' '), cls => {
                    cls = _.trim(cls)
                    if (cls && context._tailwindAllClasses[cls] && 
                        (!context._tailwindUsedClasses || !context._tailwindUsedClasses[cls])){
                        missedClasses[cls] = 1
                    }
                })
            }
            if (_.keys(missedClasses).length > 0){
                let items = _.map(_.keys(missedClasses), cls => context._tailwindAllClasses[cls])
                let ruleIdMap = _.merge(...items)
                let cssContent = _.map(_.sortBy(_.keys(ruleIdMap), i => +i), index => {
                    return css.stringify(context._tailwindStylesList[index])
                }).join('\n')
                html = html.replace('/* TAILWINDCSS AUTO INJECTION PLACEHOLDER */', [
                    '/* --- Tailwind CSS Auto Injected Styles --- */',
                    cssContent,
                    '/* ------------------------------------- */'
                ].join('\n'))
            } else {
                html = html.replace('/* TAILWINDCSS AUTO INJECTION PLACEHOLDER */', '')
            }
        }
        if (this.pretty) {
            html = beautify.html(html)
        } else {
            if (this.htmlMinify){
                html = minify.minify(html, {
                    minifyCSS: true,
                    minifyJS: true,
                    collapseWhitespace: true,
                    processScripts: [
                        'text/javascript',
                        'text/ecmascript',
                        'text/jscript',
                        'application/javascript',
                        'application/x-javascript',
                        'application/ecmascript'
                    ]
                })
            }
        }
        callback(null, html)
    }).catch(ex => {
        callback(ex)
    })
}

function createHbsViewEngine(config) {
    let hve = new HbsViewEngine(config)
    return _.bind(hve.render, hve)
}
module.exports = {
    registerHelpers,
    createHbsViewEngine
}