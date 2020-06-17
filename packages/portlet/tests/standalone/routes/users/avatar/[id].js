const _ = require('lodash')
const { getFullUrl } = require('@vimesh/utils')
let cacheAvatar
function setup({ storages }) {
    cacheAvatar = storages.avatar.cache
}
function get(req, res) {
    let filePath = req.params.id
    cacheAvatar.get(getFullUrl(filePath, req.query)).then(stat => {
        if (!stat || !stat.localFilePath) return next()
        let type = _.get(stat, 'meta.type')
        if (type) res.set('Content-Type', type)
        res.sendFile(stat.localFilePath)
    })
}

module.exports = {
    setup,
    get: {
        before: ['|'],
        handler: get
    }
}