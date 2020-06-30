
function get(req, res) {
    let data = {
        i18n: res.i18n('models.users;common')
    }
    res.show(data)
}

function recycle(req, res) {
    $mock.users.recycle(req.query.id).then(r => {
        res.ok(res.i18n('common.ok_delete'))
    }).catch(ex => {
        $logger.error(`Fails to save user! (${req.body})`, ex)
        res.error(res.i18n('common.err_delete'))
    })
}

module.exports = {
    get,
    delete: recycle
}