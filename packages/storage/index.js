
const {createLocalStorage } = require('./storage-local')
const {createMinioStorage } = require('./storage-minio')

function createStorage(config){
    switch(config.type){
        case 'minio': return createMinioStorage(config)
    }
    return createLocalStorage(config)
}

module.exports = {
    createStorage
}