const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const css = require('css')

let tailwindStyles = null
let tailwindStylesList = []
let tailwindStylesMap = {}
function addRule(parent, rule, selector) {
    if (selector[0] !== '.') return
    selector = selector.substring(1)
    let pos = selector.lastIndexOf('\\:')
    let prefix = ''
    if (pos != -1) {
        prefix = selector.substring(0, pos + 2)
        selector = selector.substring(pos + 2)
    }
    pos = selector.indexOf(':')
    if (pos != -1) {
        selector = selector.substring(0, pos)
    }
    selector = (prefix + selector).replace(/\\/g, '')
    if (!tailwindStylesMap[selector]) tailwindStylesMap[selector] = {}
    let index = tailwindStylesList.length
    tailwindStylesMap[selector][index] = 1
    let rules = [rule]
    if (parent) {
        parent = Object.create(parent)
        parent.rules = [rule]
        rules = [parent]
    }
    let ss = {
        type: 'stylesheet',
        stylesheet: { rules }
    }
    tailwindStylesList.push(ss)
}

function preloadTailwindCss(cssFile) {
    let cssTailwind = fs.readFileSync(cssFile || path.join(__dirname, '/tailwind@1.2.0.min.css'))
    tailwindStyles = css.parse(cssTailwind.toString())
    _.each(tailwindStyles.stylesheet.rules, (rule, i) => {
        if (rule.selectors) {
            _.each(rule.selectors, selector => addRule(null, rule, selector))
        } else if (rule.rules) {
            _.each(rule.rules, r => {
                _.each(r.selectors, selector => addRule(rule, r, selector))
            })
        }
    })
}

function tailwindUse(usedClasses, options) {
    if (!options.data.root._tailwindStyles) options.data.root._tailwindStyles = {}
    if (!options.data.root._tailwindUsedClasses) options.data.root._tailwindUsedClasses = {}
    if (!options.data.root._tailwindAllClasses) {
        if (!tailwindStyles) preloadTailwindCss(options.data.root._handlebarSettings.tailwindCssFile)
        options.data.root._tailwindAllClasses = tailwindStylesMap
    }
    let items = _.map(usedClasses.split(/\s+/), s => {
        s = _.trim(s)
        if (s && !tailwindStylesMap[s]) {
            $logger.warn(`Could not find tailwind selector for "${s}"`)
            return null
        }
        options.data.root._tailwindUsedClasses[s] = 1
        return tailwindStylesMap[s]
    })
    options.data.root._tailwindStyles = _.merge({}, options.data.root._tailwindStyles, ...items)
}

function tailwindApply(usedClasses, options) {
    let items = _.map(usedClasses.split(/\s+/), s => {
        s = _.trim(s)
        if (s && !tailwindStylesMap[s]) {
            $logger.warn(`Could not find tailwind selector for "${s}"`)
        }
        return tailwindStylesMap[s]
    })
    let ruleIdMap = _.merge({}, ...items)
    return _.map(_.sortBy(_.keys(ruleIdMap), i => +i), index => {
        let lines = css.stringify(tailwindStylesList[index]).split('\n')
        return lines.slice(1, lines.length - 1).join('')
    }).join('')
}

const CLASS_NAMES = /class\s*=\s*['\"](?<class>[^'\"]*)['\"]/g
const TAILWIND_PLACEHOLDER = '/* TAILWINDCSS AUTO INJECTION PLACEHOLDER */'
function injectTailwindStyles(params, context, html) {
    if (context._tailwindAllClasses && context._tailwindStylesList) {
        let missedClasses = {}
        let match
        while ((match = CLASS_NAMES.exec(html)) !== null) {
            _.each(match.groups.class.split(' '), cls => {
                cls = _.trim(cls)
                if (cls && context._tailwindAllClasses[cls] &&
                    (!context._tailwindUsedClasses || !context._tailwindUsedClasses[cls])) {
                    missedClasses[cls] = 1
                }
            })
        }
        if (_.keys(missedClasses).length > 0) {
            let items = _.map(_.keys(missedClasses), cls => context._tailwindAllClasses[cls])
            let ruleIdMap = _.merge({}, ...items)
            let cssContent = _.map(_.sortBy(_.keys(ruleIdMap), i => +i), index => {
                return css.stringify(context._tailwindStylesList[index])
            }).join('\n')
            return [
                '/* --- Tailwind CSS Auto Injected Styles --- */',
                cssContent,
                '/* ------------------------------------- */'
            ].join('\n')
        }
    }
    return ''
}
function tailwindBlock(options) {
    if (!options.data.root._tailwindAllClasses) {
        if (!tailwindStyles) preloadTailwindCss(options.data.root._handlebarSettings.tailwindCssFile)
        options.data.root._tailwindAllClasses = tailwindStylesMap
    }
    if (!options.data.root._tailwindStylesList) options.data.root._tailwindStylesList = tailwindStylesList
    let cssContent = ''
    if (options.data.root._tailwindStyles) {
        cssContent = _.map(_.sortBy(_.keys(options.data.root._tailwindStyles), i => +i), index => {
            return css.stringify(tailwindStylesList[index])
        }).join('\n')
    }
    options.data.root._postProcessors.push({
        order: 10000,
        placeholder: TAILWIND_PLACEHOLDER,
        processor: injectTailwindStyles
    })
    return ['<style>', TAILWIND_PLACEHOLDER, cssContent, '</style>'].join('\n')
}

module.exports = (portlet) => {
    portlet.on('decorateResponse', (req, res) => {
        res.locals._handlebarSettings = _.get(portlet.config, 'handlebars.settings') || {}
    })
    portlet.registerHbsHelpers({
        tailwindUse,
        twUse: tailwindUse,
        tailwindApply,
        twApply: tailwindApply,
        tailwindBlock,
        twBlock: tailwindBlock
    })
}