const path = require('path')
const fs = require('graceful-fs')
const Promise = require('bluebird')
const accessAsync = Promise.promisify(fs.access)

const {createLocalStorage } = require('./storage-local')
const {createMinioStorage } = require('./storage-minio')

function createStorage(config){
    switch(config.type){
        case 'local' : return createLocalStorage(config)
        case 'minio': return createMinioStorage(config)
    }
    throw Error(`Storage type "${config.type}" is not supported`)
}

function setupStorageMiddleware(app, basePath, storage, bucket, cacheDir){
    app.get(`${basePath}/file/*`, function(req, res){
        let filePath = path.relative(`${basePath}/file/`, req.path)
        let localFilePath = path.join(cacheDir, filePath)
        accessAsync(localFilePath).then(r => {
            res.sendFile(localFilePath)
        }).catch(ex => {
            return storage.getObjectAsFile(bucket, filePath, localFilePath).then(r => {
                res.sendFile(localFilePath)
            })
        }).catch(ex => {
            $logger.error(`Fails to send ${req.path}`)
        })
    })
}

module.exports = {
    createStorage,
    setupStorageMiddleware
}