const { readStreamToBuffer } = require('@vimesh/utils')

function Storage(type){
    this.type = type
}

Storage.prototype.getObjectAsBuffer = function(container, filePath){
    return this.getObject(container, filePath).then(stream => readStreamToBuffer(stream))
}

Storage.prototype.getObjectAsString = function(container, filePath){
    return this.getObjectAsBuffer(container, filePath).then(buffer => buffer.toString())
}

module.exports = Storage