const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { setupOrm } = require('@vimesh/orm')

const config = {
    databases: {
        main: {
            uri: `sqlite:${__dirname}/mnt/test.db`,
            //debug: true,
            sync: {force : true},
            
            migration: {
                checkpoint: 'test'
            }
            
        }
    }
}
setupLogger({ level: 'debug', console: {} })
setupOrm(_.merge(config, global.extraConfig), `${__dirname}/models` , `${__dirname}/migrations`)