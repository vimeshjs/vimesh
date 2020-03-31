
function get(req, res){
    let data = {
        i18n : res.i18n('models.users; common (ok, cancel)')
    }
    res.show(data)
}

module.exports = {
    get
}