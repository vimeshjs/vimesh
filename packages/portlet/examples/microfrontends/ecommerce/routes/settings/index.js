const _ = require('lodash')
const Promise = require('bluebird')
function get(req, res) {
    let data = {
        form: { name:'' },
        i18n: res.i18n('pages.ecommerce.settings;common(submit,reset)')
    }
    res.show(data)
}
function post(req, res) {
    let form = req.body.form
    Promise.each(_.keys(data), key => $dao.Settings.set({ _id: key, value: data[key] })).then(r => {
        res.json({})
    })
}
module.exports = {
    get,
    post
}