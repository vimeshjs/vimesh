const _ = require('lodash')
const path = require('path')
let storageAvatar
function setup({ storages }) {
    storageAvatar = storages.avatar.storage
}

function post(req, res) {
    let file = req.files.file
    let localFilePath = file.path
    let fid = path.basename(localFilePath)
    let meta = _.pick(file, 'name', 'type')
    storageAvatar.putObjectAsFile(`temp/${fid}`, localFilePath, { meta }).then(r => {
        res.json({ token: fid })
    })
}

module.exports = {
    setup,
    post
}