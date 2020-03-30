const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { setupMongoDB } = require('..')

const config = {
    databases : {
        main : {
            uri : "mongodb://localhost/unit_test"
        }
    }
}
setupLogger()
setupMongoDB(_.merge(config, global.extraConfig), __dirname + '/models')