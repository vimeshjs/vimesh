
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

function sharedResourcesMiddleware(caches, req, res, next) {
    if (!caches) return next()
    let file = req.query.file
    let md5 = req.query.md5
    if (file === '*') {
        caches.enumerate(req.query.content === 'true').then(rs => {
            res.json(rs)
        }).catch(ex => {
            res.json([])
        })
    } else {
        caches.get(file).then(r => {
            if (r.md5 === md5)
                res.json({ md5 })
            else
                res.json(r)
        }).catch(ex => {
            res.json({})
        })
    }
}

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
    }
    portletServer.app.get(`/_${type}`, _.bind(sharedResourcesMiddleware, null, portletServer.sharedResourcesCaches[type]))
}

function runResourceJobs(portletServer) {
    let interval = portletServer.config.resourcesJobInterval || '3s'
    $logger.info(`Resources refresh with interval ${interval}`)
    setInterval(() => {
        let portlet = portletServer.portlet
        let peers = portletServer.config.peers
        if (_.keys(peers).length > 0) {
            let names = _.keys(peers)
            portletServer.sharedResourcesCaches['menus'].enumerate(true).then(all => {
                Promise.all(_.map(names, name => axios.get(`${peers[name]}/_menus?file=zones`))).then(rs => {
                    _.each(rs, (r, i) => {
                        let name = names[i]
                        let url = peers[name]
                        _.each(r.data.content, zone => {
                            let allInZone = _.filter(_.keys(all), key => _.startsWith(key, `${zone}/`))
                            if (allInZone.length > 0) {
                                let menus = _.merge(..._.map(_.values(_.pick(all, allInZone)), r => r.content))
                                let data = { portlet, zone, menus, version: `${portletServer.version}.${portletServer.startedAt.valueOf()}` }
                                axios.post(`${url}/_menus/merge`, data).catch(ex => {
                                    $logger.error('Fails to merge menus.', ex)
                                })
                            }
                        })
                    })
                }).catch(ex => {
                    $logger.error('Fails to load zones.', ex)
                })
            })
            Promise.all(_.map(names, name => axios.get(`${peers[name]}/_menus/merge`))).then(rs => {
                _.each(rs, r => portletServer.allMenusByZone = _.merge(portletServer.allMenusByZone, r.data))                
            }).then(r => {
                portletServer.menusReady = true
            }).catch(ex => {
                $logger.error('Fails to receive merged menus.', ex)
            })

            Promise.all(_.map(names, name => axios.get(`${peers[name]}/_i18n?file=*&content=true`))).then(rs => {
                _.each(rs, r => {
                    mergeI18nItems(portletServer.mergedI18nItems, r.data)
                })
            }).then(r => {
                portletServer.i18nReady = true
            }).catch(ex => {
                $logger.error('Fails to receive i18n items.', ex)
            })
        } else {
            portletServer.menusReady = true
            portletServer.i18nReady = true
        }

        portletServer.sharedResourcesCaches['menus'].enumerate(true).then(all => {
            if (all.zones) {
                _.each(all.zones.content, zone => {
                    let allInZone = _.filter(_.keys(all), key => _.startsWith(key, `${zone}/`))
                    if (allInZone.length > 0) {
                        let val = _.merge(..._.map(_.values(_.pick(all, allInZone)), r => r.content))
                        _.set(portletServer.allMenusByZone, `${portletServer.portlet}.${zone}`, val)
                    }
                })
            }
        })

        portletServer.sharedResourcesCaches['i18n'].enumerate(true).then(all => {
            mergeI18nItems(portletServer.mergedI18nItems, all)
        })

    }, duration(interval))
}
function mergeI18nItems(all, itemsToMerge) {
    _.each(itemsToMerge, (val, prefix) => {
        prefix = prefix.replace(/\//g, '.')
        _.each(val.content, (trans, key) => {
            if (!(/^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(key))){
                $logger.error(`Wrong i18n key ${key}`)
                return
            }
            if (_.isString(trans)){
                _.set(all, `*.${prefix}.${key}`, trans)
            }else {
                _.each(trans, (text, lang) => {
                    _.set(all, `${lang}.${prefix}.${key}`, text)
                })
            }
        })
    })
}
function setupSharedResources(portletServer) {
    let app = portletServer.app

    mountSharedResourcesMiddleware(portletServer, 'layouts')
    mountSharedResourcesMiddleware(portletServer, 'partials')
    mountSharedResourcesMiddleware(portletServer, 'views')
    mountSharedResourcesMiddleware(portletServer, 'menus', '.yaml')
    mountSharedResourcesMiddleware(portletServer, 'i18n', '.yaml')

    app.post('/_menus/merge', (req, res, next) => {
        let portlet = req.body.portlet
        let zone = req.body.zone
        _.set(portletServer.allMenusByZone, `${portlet}.${zone}`, req.body.menus)
        res.json({})
    })

    app.get('/_menus/merge', (req, res, next) => {
        res.json(portletServer.allMenusByZone)
    })

    runResourceJobs(portletServer)
}
module.exports = {
    setupSharedResources
}