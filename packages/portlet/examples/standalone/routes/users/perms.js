const _ = require('lodash')
const { getPermissions } = require('../_lib/utils')
function get(req, res) {
    if (req.query.id) {
        res.ensure('$users.view')
        getPermissions(req.query.id, res.locals._allPermissions).then(perms => {
            res.json(perms)
        })
    } else {
        res.json(res.locals.$permissions)
    }
}
module.exports = {
    get
}