const _ = require('lodash')
const Promise = require('bluebird')
const { Sequelize } = require('sequelize')
const { retryPromise } = require('@vimesh/utils')
global.$orm = {
    databases: {},
    models: {},
    dao: {}
}
const loadModels = require('./models')
const createDao = require('./dao.js')
async function connectTo(dbUri, options, name, debug) {
    options = options || {}
    if (!debug)
        options.logging = false
    else
        options.logging = (msg) => $logger.debug(msg + '')
    $logger.info("Connecting " + name + ":" + dbUri + " options : " + JSON.stringify(options))
    const sequelize = new Sequelize(dbUri, options)
    $orm.databases[name] = sequelize
    await sequelize.authenticate();
    //$logger.info("DB " + name + )
}

function setupOrm(config, modelRoot, baseDb) {
    let dbNames = _.keys(config.databases)
    if (dbNames.length == 0) {
        $logger.error('There are no databases defined!')
        return
    }
    if (!baseDb) baseDb = dbNames[0]
    loadModels(modelRoot, baseDb)
    let databases = _.mapValues(config.databases, function (v, k) {
        let uri = v.uri
        let options = {}
        return retryPromise(
            _.bind(connectTo, null, uri, options, k, v.debug),
            10000
        )
    })

    $orm.connected = Promise.all(_.values(databases)).then(() => {
        $logger.info('All databases are connected!')
        _.each($orm.schemas.models, (schema, name) => {
            createDao(schema, name)
        })

        _.each($orm.dao, (dao, name) => {
            if (_.entries(dao.assocCreators).length > 0) {
                $logger.debug(`SETUP associations for ${name}`)
                _.each(dao.assocCreators, (func, k) => {
                    dao.associations[k] = func()
                })
                delete dao.assocCreators
            }
        })

        let allSync = []
        let allSyncDbNames = []
        _.each($orm.databases, (db, name) => {
            let { sync } = config.databases[name]
            if (sync) {
                if (_.isPlainObject(sync)) {
                    allSyncDbNames.push(`${name}|${JSON.stringify(sync)}`)
                    allSync.push(db.sync(sync))
                } else {
                    allSyncDbNames.push(name)
                    allSync.push(db.sync())
                }
            }
        })
        return Promise.all(allSync).then(function () {
            $logger.info(`Databases (${allSyncDbNames}) have been synchronized!`)
        })
    }).then(r => {
        if (!config.migrationsDir) return
    }).then(r => {
        if (config.onBeforeSetup) return config.onBeforeSetup()
    }).then(r => {
        let allSetups = []
        _.each($orm.dao, (dao, name) => {            
            if (dao.$setup) {
                $logger.debug(`SETUP initializer for ${name}`)
                let promise = dao.$setup()
                if (promise) allSetups.push(promise)
            }
        })
        return Promise.all(allSetups).then(function () {
            $logger.info('All setups finish!')
        })
    })
}

module.exports = {
    setupOrm
}