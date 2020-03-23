
function get(req, res) {
    res.show({
        title: 'account',
        hello: 'world'
    })
}

module.exports = {
    layout: 'main',
    get
}