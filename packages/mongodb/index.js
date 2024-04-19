const _ = require('lodash')
const { glob } = require("glob")
const path = require('path')
const { URL } = require('url')
const { MongoClient } = require('mongodb')
const { retryPromise } = require('@vimesh/utils')
global.$mongodb = { databases: {} }
global.$models = {}
global.$dao = {}
global.$aggregator = {}
const loadModels = require('./models')
const createDao = require('./dao.js')
require('./aggregator.js')
function connectTo(dbUri, dbName, options, name, debug, admin, remains) {
    let urlObj = new URL(dbUri)
    if (urlObj.searchParams.has('ensureSharded')) {
        options.ensureSharded = urlObj.searchParams.get('ensureSharded') !== 'false'
        urlObj.searchParams.delete('ensureSharded')
        urlObj.search = urlObj.searchParams.toString()
        dbUri = urlObj.toString()
    }
    remains[name] = dbUri
    $logger.info("Connecting " + name + ":" + dbUri)
    let ensureSharded = !!options.ensureSharded
    options = _.omit(options, 'ensureSharded')
    const client = new MongoClient(dbUri, options)
    return client.connect().then(r => {
        $logger.info("DB " + name + " options : " + JSON.stringify(client.options))
        let db = client.db(dbName);
        let result = { database: db, client: client, ensureSharded }
        $mongodb.databases[name] = result
        delete remains[name]
        $logger.info('DB ' + name + ' >>> (' + _.keys(remains) + ')')
        return result
    }).catch(ex => {
        $logger.error("Cannot connect to MongoDB : ", ex)
    })
}

function setupMongoDB(config, modelRoot, baseDb) {
    let dbConfigs = config.databases || config
    let dbNames = _.keys(dbConfigs)
    if (dbNames.length == 0) {
        $logger.error('There are no MongoDB databases defined!')
        return
    }
    if (!baseDb) baseDb = dbNames[0]
    loadModels(__dirname + '/models', baseDb)
    loadModels(modelRoot, baseDb)
    let remains = {}
    let databases = _.mapValues(dbConfigs, function (v, k) {
        let uri = v.uri
        var dbName = v.dbName
        let options = _.omit(v, 'uri', 'dbName')
        if (!options.authSource) options.authSource = 'admin'
        return retryPromise(
            _.bind(connectTo, null, uri, dbName, options, k, config.DB_DEBUG || v.DEBUG || false, v.ADMIN || false, remains),
            10000
        )
    })

    $mongodb.connected = Promise.all(_.values(databases)).then(() => {
        if (config.onBeforeCreateDao) return config.onBeforeCreateDao()
    }).then(() => {
        $logger.info('All databases are connected!')
        _.each($schemas.models, (schema, name) => {
            createDao(schema, name)
        })
    }).then(r => {
        if (!config.migrationsDir) return
        let all = []
        _.each(glob.sync(config.migrationsDir + "/*"), function (f) {
            let ext = path.extname(f)
            let name = path.basename(f)
            let key = f
            if (ext) {
                key = f.substring(0, f.length - ext.length)
                name = name.substring(0, name.length - ext.length)
            }
            let promise = models.Migrations.findOne({ _id: name }).then(r => {
                let testMode = name[0] === '@'
                if (!r || testMode) {
                    $logger.info('Migrating ' + name)
                    let func = require(f)
                    let data = {
                        _id: name,
                        at: new Date(),
                        logs: []
                    }
                    return func(models, function (log) {
                        data.logs.push({
                            log: log,
                            at: new Date()
                        })
                        $logger.info('Migration ' + name + ' > ' + log)
                    }).then(function () {
                        data.fat = new Date()
                        if (!testMode)
                            return models.Migrations.insert(data)
                    }).catch((err) => {
                        data.fat = new Date()
                        data.err = err + ''
                        if (!testMode)
                            return models.Migrations.insert(data)
                    })
                }
            })

            if (promise) all.push(promise)
        })
        return Promise.all(all)
    }).then(r => {
        if (config.onBeforeSetup) return config.onBeforeSetup()
    }).then(r => {
        let allSetups = []
        _.each($dao, function (dao, name) {
            if (!dao.$setup) return
            $logger.debug(`SETUP ${name}`)
            let promise = dao.$setup()
            if (promise) allSetups.push(promise)
        })
        return Promise.all(allSetups).then(function () {
            $logger.info('All setups finish!')
        })
    }).then(r => {
        let tasks = []
        _.each($mongodb.databases, db => {
            if (db.ensureSharded)
                tasks.push(db.database.admin().command({ enableSharding: db.database.databaseName }))
        })
        return Promise.all(tasks)
    })
}

module.exports = {
    ...require('./utils'),
    ...require('./report-engine'),
    ...require('./transform-engine'),
    setupMongoDB
}