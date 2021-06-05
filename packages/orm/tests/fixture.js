const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { setupOrm } = require('..')

const config = {
    databases: {
        main: {
            uri: `sqlite:${__dirname}/mnt/test.db`,
            //debug: true
        }
    }
}
setupLogger({ level: 'debug', console: {} })
setupOrm(_.merge(config, global.extraConfig), __dirname + '/models')