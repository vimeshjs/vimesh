function get(req, res, next) {
    let cond = req.query.cond || {}
    let pageIndex = +(req.query.pageIndex || 1)
    let pageSize = +(req.query.pageSize || 10)
    let skip = (pageIndex - 1) * pageSize
    let limit = pageSize
    $mock.users.select({ cond, skip, limit }).then(r => {
        res.json(r)
    })
}

module.exports = {
    get
}