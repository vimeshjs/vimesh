function get(req, res) {
    $mock.users.get(req.user.id).then(r => {
        res.show(r)
    })
}

module.exports = {
    get: {
        handler: get
    }
}