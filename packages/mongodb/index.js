const _ = require('lodash')
const glob = require("glob")
const path = require('path')
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
    remains[name] = dbUri;
    $logger.info("Connecting " + name + ":" + dbUri)
    return new Promise(function (resolve, reject) {
        MongoClient.connect(dbUri, options, function (err, client) {
            if (err) {
                $logger.error("Cannot connect to MongoDB : ", err)
                reject(err);
            } else {
                $logger.info("DB " + name + " options : " + JSON.stringify(client.options))
                let db = client.db(dbName);
                let result = { database: db, client: client }
                $mongodb.databases[name] = result

                MongoClient.connect(dbUri, options, function (err, adminClient) {
                    delete remains[name]
                    $logger.info('DB ' + name + ' >>> (' + _.keys(remains) + ')')
                    if (err) {
                        $logger.warn("Cannot connect to admin: " + err + "@" + dbUri);
                        reject(err);
                    } else {
                        $logger.info("Connected to " + name + " admin @" + dbUri);
                        if (admin)
                            result.admin = adminClient.db(dbName).admin();
                        else
                            result.admin2 = adminClient.db(dbName).admin();
                        resolve(result)
                    }
                });
            }
        })
    })
}

function setupMongoDB(config, modelRoot, baseDb = 'base') {
    loadModels(__dirname + '/models', baseDb)
    loadModels(modelRoot, baseDb)
    let remains = {}
    let databases = _.mapValues(config.DATABASES, function (v, k) {
        var uri = v.URI;
        var dbName = v.DB;
        if (v.AUTO_RECONNECT === undefined)
            v.AUTO_RECONNECT = true
        let options = {};
        if (v.POOLSIZE)
            options.poolSize = v.POOLSIZE;
        // uri += (uri.indexOf('?') > 0 ? '&' : '?') + "poolSize=" + v.POOLSIZE      
        if (v.AUTO_RECONNECT)
            options.autoReconnect = v.AUTO_RECONNECT ? true : false;
        // uri += (uri.indexOf('?') > 0 ? '&' : '?') + "autoReconnect=" + (v.AUTO_RECONNECT ? "true" : "false") 
        if (v.READ_PREFERENCE)
            options.readPreference = v.READ_PREFERENCE;
        // uri += (uri.indexOf('?') > 0 ? '&' : '?') + "readPreference=" + v.READ_PREFERENCE
        if (v.USERNAME)
            options['auth.user'] = v.USERNAME;
        // uri += (uri.indexOf('?') > 0 ? '&' : '?') + "auth.user=" + v.USERNAME
        if (v.PASSWD)
            options['auth.password'] = v.PASSWD;
        // uri += (uri.indexOf('?') > 0 ? '&' : '?') + "auth.password=" + v.PASSWD
        if (v.AUTHMECHANISM)
            options.authMechanism = v.AUTHMECHANISM;
        // uri += (uri.indexOf('?') > 0 ? '&' : '?') + "authMechanism=" + v.AUTHMECHANISM
        if (v.AUTHSOURCE)
            options.authSource = v.AUTHSOURCE;
        // uri += (uri.indexOf('?') > 0 ? '&' : '?') + "authSource=" + v.AUTHSOURCE
        //options.useUnifiedTopology = true 
        return retryPromise(
            _.bind(connectTo, null, uri, dbName, options, k, config.DB_DEBUG || v.DEBUG || false, v.ADMIN || false, remains),
            10000
        )
    })

    $mongodb.connected = Promise.all(_.values(databases)).then(() => {
        $logger.info('All databases are connected!')
        _.each($schemas.models, (schema, name) => {
            createDao(schema, name)
        })
    }).then(r => {
        if (!config.MIGRATIONS_DIR) return
        let all = []
        _.each(glob.sync(config.MIGRATIONS_DIR + "/*"), function(f){
            let ext = path.extname(f)
            let name = path.basename(f)
            let key = f
            if (ext) {
                key = f.substring(0, f.length - ext.length)
                name = name.substring(0, name.length - ext.length)
            }
            let promise = models.Migrations.findOne({_id : name}).then(r => {
                let testMode = name[0] === '@'
                if (!r || testMode){
                    $logger.info('Migrating ' + name)
                    let func = require(f)
                    let data = {
                        _id : name,
                        at : new Date(),
                        logs : []
                    }
                    return func(models, function(log){
                        data.logs.push({
                            log : log,
                            at : new Date()
                        })
                        $logger.info('Migration ' + name + ' > ' + log)
                    }).then(function(){
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
    })
}

module.exports = {
    ...require('./utils'),
    setupMongoDB
}