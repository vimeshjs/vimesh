function get(req, res, next){
    res.clearCookie('jwt')
    res.redirect('/')
}
module.exports = {
    get
}