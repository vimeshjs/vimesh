function get(req, res, next){
    res.clearCookie('jwt')
    res.redirect('/@account/login')
}
module.exports = {
    get
}