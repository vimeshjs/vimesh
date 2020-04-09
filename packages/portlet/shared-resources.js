
const _ = require('lodash')
const path = require('path')
const fs = require('graceful-fs')
const yaml = require('js-yaml')
const glob = require('glob')
const axios = require('axios')
const Promise = require('bluebird')
const { getMD5, duration } = require('@vimesh/utils')
const { createMemoryCache } = require('@vimesh/cache')
const accessAsync = Promise.promisify(fs.access)
const readFileAsync = Promise.promisify(fs.readFile)
const globAsync = Promise.promisify(glob)

function mountSharedResourcesMiddleware(portletServer, type, extName) {
    let sharedDir = portletServer.sharedDir
    if (!extName) extName = portletServer.extName
    if (!portletServer.sharedResourcesCaches[type]) {
        portletServer.sharedResourcesCaches[type] = createMemoryCache({
            maxAge: portletServer.config.debug ? '3s' : '1d',
            updateAgeOnGet: false,
            onEnumerate: () => {
                let dir = path.join(sharedDir, type)
                return globAsync(`${dir}/**/*${extName}`).then(files => {
                    return _.map(files, f => {
                        f = f.replace(/\\/g, '/')
                        let rf = path.relative(dir, f)
                        return rf.substring(0, rf.length - extName.length)
                    })
                })
            },
            onRefresh: function (key) {
                let file = path.join(sharedDir, type, key + extName)
                //$logger.debug(`Loading shared/${type}/${key} `)                
                return accessAsync(file).then(r => {
                    return readFileAsync(file)
                }).then(r => {
                    let content = r.toString()
                    if (extName === '.yaml') {
                        content = yaml.load(content)
                    }
                    let portlet = portletServer.portlet
                    if (portletServer.kvClient) {
                        let dkey = `${type}/@${portlet}/${key}`                        
                        portletServer.kvClient.set(dkey, content, {duration : '1m'}).catch(ex => {
                            $logger.error(`Fails to send ${dkey} to discovery server`, ex)
                        })
                    }
                    return {
                        content,
                        md5: getMD5(r)
                    }
                }).catch(ex => {
                    $logger.error(`Fails to load ${file}.`, ex)
                    return null
                })
            }
        })
        portletServer.sharedResourcesCaches[type].enumerate(true)
    }

}

function runResourceJobs(portletServer) {
    setInterval(() => {
        let portlet = portletServer.portlet
        
        _.each(portletServer.sharedResourcesCaches, cache => cache.enumerate(true))

        let kvClient = portletServer.kvClient
        kvClient.get('menus/*').then(rs => {
            portletServer.allMenusByZone  = {}
            _.each(rs, (r, key) => {
                key = key.substring(key.indexOf('/', key.indexOf('@')) + 1)
                let pos = key.indexOf('/')
                let zone = pos == -1 ? key : key.substring(0, pos)
                portletServer.allMenusByZone[zone] = _.merge(portletServer.allMenusByZone[zone], r)
            })
        }).then(r => {
            portletServer.menusReady = true
        }).catch(ex => {
            $logger.error('Fails to receive merged menus.', ex)
        })

        kvClient.get('i18n/*').then(rs => {
            _.each(rs, (r, key) => {
                key = key.substring(key.indexOf('/', key.indexOf('@')) + 1)
                let data = {}
                data[key] = r
                mergeI18nItems(portletServer.mergedI18nItems, data)
            })
        }).then(r => {
            portletServer.i18nReady = true
        }).catch(ex => {
            $logger.error('Fails to receive i18n items.', ex)
        })
    }, duration('3s'))
}
function mergeI18nItems(all, itemsToMerge) {
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
}
function setupSharedResources(portletServer) {
    if (!portletServer.kvClient) {
        $logger.warn('There are no discovery server found.')
        return
    }

    mountSharedResourcesMiddleware(portletServer, 'layouts')
    mountSharedResourcesMiddleware(portletServer, 'partials')
    mountSharedResourcesMiddleware(portletServer, 'views')
    mountSharedResourcesMiddleware(portletServer, 'menus', '.yaml')
    mountSharedResourcesMiddleware(portletServer, 'i18n', '.yaml')

    runResourceJobs(portletServer)

}
module.exports = {
    setupSharedResources
}