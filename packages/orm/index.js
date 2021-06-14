﻿const _ = require('lodash')
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

const migrationModel = 'MigrationHistory'

async function connectTo(config) {
    let name = config.name
    let debug = config.debug
    let dbUri = config.uri
    let options = {}
    if (!debug)
        options.logging = false
    else
        options.logging = (msg) => $logger.debug(msg + '')
    $logger.info(`Connecting ${name} (${JSON.stringify(config)})`)
    const sequelize = new Sequelize(dbUri, options)
    $orm.databases[name] = sequelize
    sequelize._config = config
    await sequelize.authenticate();
    //$logger.info("DB " + name + )
}

function setupOrm(config, modelsDir, migrationsDir) {
    if (!modelsDir){  
        throw Error('ORM models directory is not set!')   
    }
    if (!migrationsDir){   
        throw Error('ORM migrations directory is not set!')     
    }
    let baseDb = null
    let dbNames = _.keys(config.databases)
    if (dbNames.length == 0) {
        $logger.error('There are no databases defined!')
        return
    }
    if (!baseDb) baseDb = dbNames[0]
    loadModels(modelsDir, baseDb)
    let databases = _.mapValues(config.databases, function (v, k) {
        return retryPromise(
            _.bind(connectTo, null, { name: k, ...v }),
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
            $logger.info(
                allSync.length == 0 ?
                    `No databases should be synchronized!` :
                    `Databases (${allSyncDbNames.join(',')}) have been synchronized!`)
        })
    }).then(async (r) => {
        const { generate, execute } = require('./migration')
        let keys = _.keys($orm.databases)
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i]
            let db = $orm.databases[key]
            let dbConfig = db._config
            if (undefined !== dbConfig.migration) {
                let checkpoint = _.get(dbConfig, 'migration.checkpoint')
                let run = _.get(dbConfig, 'migration.execute')
                generate(db, key, checkpoint, migrationsDir, migrationModel)
                if (run) await execute(db, key, migrationsDir, migrationModel)
            }
        }
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