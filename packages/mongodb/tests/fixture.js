const { setupLogger } = require('@vimesh/logger')
const { setupMongoDB } = require('..')

const config = {
    DATABASES : {
        default : {
            URI : "mongodb://localhost/unit_test"
        }
    }
}
setupLogger()
setupMongoDB(config, __dirname + '/models', 'default')