const { loadConfigs } = require('@vimesh/utils')
const { setupLogger } = require('@vimesh/logger')
const { setupMongoDB } = require('@vimesh/mongodb')
const { setupDiscoveryService } = require('@vimesh/discovery')
let context = {
    configsDir: __dirname + '/configs',
    env : process.env
}
let configs = loadConfigs(context, 'common', process.env.NODE_ENV || 'development')

setupLogger(configs.logger)

setupMongoDB(configs.mongodb)

setupDiscoveryService(configs.discovery)