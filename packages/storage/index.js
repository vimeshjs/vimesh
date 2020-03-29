
const {createLocalStorage } = require('./storage-local')
const {createMinioStorage } = require('./storage-minio')

function createStorage(config){
    switch(config.type){
        case 'local' : return createLocalStorage(config)
        case 'minio': return createMinioStorage(config)
    }
    throw Error(`Storage type "${config.type}" is not supported`)
}

function createFileMiddlewareWithStorage(){

}

module.exports = {
    createStorage,
    createFileMiddlewareWithStorage
}