const _ = require('lodash')

function T(name, options) {
    if (!name) return ''
    let lang = options.data.root.$language
    let items = options.data.root._i18nItems
    let ls = _.keys(_.omit(items, '*'))
    if (!lang && ls.length > 0) lang = ls[0]
    let fallbackText = _.capitalize(name.substring(name.lastIndexOf('.') + 1))
    return _.get(items[lang], name) || _.get(items['*'], name) || fallbackText
}

module.exports = (portlet) => {
    portlet.ready.i18n = false
    portlet.mergedI18nItems = {}
    portlet.on('decorateResponse', (req, res) => {
        res.locals.$language = portlet.config.language
        res.locals._i18nItems = portlet.mergedI18nItems 
        res.i18n = (names) => {
            if (_.isString(names)) names = _.map(names.split(';'), r => r.trim())
            let translations = _.merge(..._.map(names, name => {
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
                return fields && fields.length > 0 ? _.pick(result, fields) : { _: result }
            }))
            return translations._ && _.keys(translations).length == 1 ? translations._ : translations
        }
    })

    portlet.on('beforeSetupRoutes', () => {
        portlet.loadAssets('i18n', '.yaml', (itemsToMerge) => {
            let all = portlet.mergedI18nItems
            _.each(itemsToMerge, (val, prefix) => {
                prefix = prefix.replace(/\//g, '.')
                _.each(val, (trans, key) => {
                    if (!key || key.indexOf('.') != -1) {
                        $logger.error(`I18n key (${key}) could not be empty or contain "."`)
                        return
                    }
                    if (_.isString(trans)) {
                        _.set(all, `*.${prefix}.${key}`, trans)
                    } else {
                        _.each(trans, (text, lang) => {
                            _.set(all, `${lang}.${prefix}.${key}`, text)
                        })
                    }
                })
            })
            portlet.ready.i18n = true
        })
    })

    portlet.registerHbsHelpers({ T })
}
