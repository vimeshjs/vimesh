const _ = require('lodash')
let storageAvatar, cacheAvatar
function setup({ storages }) {
    storageAvatar = storages.avatar.storage
    cacheAvatar = storages.avatar.cache
}
function get(req, res) {
    let data = { i18n: res.i18n('models.users;common') }
    Promise.all([
        (req.query.id ? $mock.users.get(req.query.id) : Promise.resolve({}))
    ]).then(rs => {
        data.form = rs[0] || {}
        res.show(data)
    })
}
function post(req, res) {
    let avatarToken = req.body.form.avatarToken
    let tokenPath = `temp/${avatarToken}`
    let user = _.omit(req.body.form, 'avatarToken')
    return (avatarToken ? cacheAvatar.get(tokenPath) : Promise.resolve()).then(stat => {
        if (stat){
            user.avatar = `${stat.md5}-${user._id}-${stat.meta.name}`
        }
    }).then(r => {
        return $mock.users[req.body.editMode ? 'set' : 'add'](user).then(r => {
            if (avatarToken){
                return storageAvatar.copyObject(tokenPath, user.avatar).then(r => {
                    return storageAvatar.deleteObject(tokenPath)
                })
            }
        })
    }).then(r => {
        res.ok(res.i18n('common.ok_submit'))
    }).catch(ex => {
        $logger.error(`Fails to save user! (${req.body})`, ex)
        res.error(res.i18n('common.err_submit'))
    })
}
module.exports = {
    setup,
    get,
    post
}