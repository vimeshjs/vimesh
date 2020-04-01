const _ = require('lodash')

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
    $mock.users[req.body.editMode ? 'set' : 'add'](req.body.form).then(r => {
        res.ok(res.i18n('common.ok_submit'))
    }).catch(ex => {
        $logger.error(`Fails to save user! (${req.body})`, ex)
        res.error(res.i18n('common.err_submit'))
    })
}
module.exports = {
    get,
    post
}