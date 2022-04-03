const _ = require('lodash')

const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

const { setupLogger } = require('@vimesh/logger')
const { setupMongoDB } = require('..')

const config = {
    databases: {
        main: {
            uri: "mongodb://admin:pass4admin@localhost:10000/alone_unit_test",
        },
        shard: {
            uri: "mongodb://root:password123@localhost:20000/shard_unit_test",
            ensureSharded: true
        }
    },
    async onBeforeCreateDao() {
        await $mongodb.databases.main.database.dropDatabase()
        await $mongodb.databases.shard.database.dropDatabase()
    }
}

setupLogger()
setupMongoDB(_.merge(config, global.extraConfig), __dirname + '/models')