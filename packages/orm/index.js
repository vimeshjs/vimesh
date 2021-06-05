const _ = require('lodash')
const glob = require("glob")
const path = require('path')
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
        options.logging = _.bind($logger.debug, $logger)
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
    }).then(r => {
        if (!config.migrationsDir) return
    }).then(r => {
        if (config.onBeforeSetup) return config.onBeforeSetup()
    }).then(r => {
        let allSetups = []
        _.each($orm.dao, function (dao, name) {
            if (!dao.$setup) return
            $logger.debug(`SETUP ${name}`)
            let promise = dao.$setup()
            if (promise) allSetups.push(promise)
        })
        return Promise.all(allSetups).then(function () {
            $logger.info('All setups finish!')
        })
    })
}

module.exports = {
    setupOrm
}