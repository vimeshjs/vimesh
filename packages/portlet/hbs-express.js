
const _ = require('lodash')
const path = require('path')
const fs = require('graceful-fs')
const { getCRC16, getMD5 } = require('@vimesh/utils')
const helpers = require('./hbs-helpers')
const handlebars = require('handlebars')
const layoutPattern = /{{!<\s+([@A-Za-z0-9\._\-\/]+)\s*}}/;

function HbsViewEngine(config) {
    this.extName = config.extName || '.hbs'
    this.views = config.views
    this.defaultLayout = config.defaultLayout
    this.layouts = config.layouts
    this.partials = config.partials
    this.alias = config.alias
    this.portlet = config.portlet
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
    let body = context.view.template(context.locals, { partials: context.partials })
    if (layoutName) {
        layoutName = context.alias.layouts && context.alias.layouts[layoutName] || layoutName
        let layoutView = context.layouts[layoutName[0] == '@' ? layoutName : `@${context.portlet}/${layoutName}`]
        if (layoutView) {
            context.locals.body = body
            return renderWithLayout(_.defaults({ data: { body }, view: layoutView, layout: null }, context))
        }
    }
    return Promise.resolve(body)
}
HbsViewEngine.prototype.render = function (filename, context, callback) {
    let key = filename
    if (_.endsWith(key, this.extName)){
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
            if (!targetPortlet && !this.views[i].portlet || targetPortlet === this.views[i].portlet) {
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
                if (portlet) {
                    allPartials[`@${portlet}/${k}`] = p
                } else {
                    allPartials[`${k}`] = p
                    allPartials[`@${this.portlet}/${k}`] = p
                }
            })
        })
        let allLayouts = {}
        _.each(rs[0], (ls, i) => {
            let portlet = this.partials[i].portlet
            _.each(ls, (l, k) => {
                if (portlet) {
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
            partials: _.map(allPartials, p => p.template),
            layout: context.layout || this.layout,
            locals: context,
            data: {},
            view: view
        })
    }).then(r => {
        callback(null, r)
    })
}

function createHbsViewEngine(config) {
    let hve = new HbsViewEngine(config)
    return _.bind(hve.render, hve)
}
module.exports = {
    createHbsViewEngine
}