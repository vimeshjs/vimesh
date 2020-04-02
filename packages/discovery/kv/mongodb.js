const _ = require('lodash')
const { MongoClient } = require('mongodb')

function MongodbKeyValueStore(options) {
    $mongodb.connected.then(() => {
        let dbs = $mongodb.databases
        let db = dbs[options.database || dbs[_.keys[dbs][0]]].database
        this.collection = db.collection(options.kvCollection || '_kvstore')
        setInterval(() => {
            this.clean()
        }, 1000)
    })
}

MongodbKeyValueStore.prototype.clean = function () {
    if (!this.collection) return
    this.collection.remove({ $and: [{ expires: { $exists: true } }, { expires: { $lt: new Date() } }] })
}

MongodbKeyValueStore.prototype.get = function (key) {
    if (!this.collection) return Promise.reject('Mongodb is not ready')
    key = _.trim(key)
    if (_.endsWith(key, '*')) {
        key = _.trimEnd(key, '*')
        return this.collection.find({ _id: new RegExp(`^${key}`) }).toArray().then(rs => {
            let results = {}
            _.each(rs, r => results[r._id] = r.value)
            return results
        })
    } else {
        return this.collection.findOne({ _id: key }).then(r => {
            let results = {}
            if (r) results[r._id] = r.value
            return results
        })
    }
}

MongodbKeyValueStore.prototype.keys = function (key) {
    if (!this.collection) return Promise.reject('Mongodb is not ready')
    return this.collection.find({ _id: new RegExp(`^${key}`) }).toArray().then(rs => {
        return _.map(rs, r => r._id)
    })
}

MongodbKeyValueStore.prototype.set = function (key, value, options) {
    if (!this.collection) return Promise.reject('Mongodb is not ready')
    let data = { value }
    if (options.expires) data.expires = options.expires
    return this.collection.updateOne({ _id: key }, { $set: data }, { upsert: true }).then(r => true)
}

MongodbKeyValueStore.prototype.del = function (key) {
    if (!this.collection) return Promise.reject('Mongodb is not ready')
    return this.collection.remove({ _id: key }).then(r => true)
}

module.exports = {
    MongodbKeyValueStore
}