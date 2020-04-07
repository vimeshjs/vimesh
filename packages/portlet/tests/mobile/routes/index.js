function get(req, res, next){
    let data = {i18n : res.i18n('pages.index')}
    res.show(data)
}

module.exports = {
    get
}