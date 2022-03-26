const _ = require('lodash')

const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

const { setupLogger } = require('@vimesh/logger')
const { setupMongoDB } = require('..')

const config = {
    databases: {
        main: {
            uri: "mongodb://admin:pass4admin@localhost:10000/unit_test",
            authSource : 'admin'
        }
    },
    async onBeforeCreateDao() {
        await $mongodb.databases.main.database.dropDatabase()
    }
}

setupLogger()
setupMongoDB(_.merge(config, global.extraConfig), __dirname + '/models')