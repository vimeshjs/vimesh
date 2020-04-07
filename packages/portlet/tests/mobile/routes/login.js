let authApi = null
function setup(portletServer) {
    authApi = portletServer.remoteApis.auth
}

function get(req, res, next) {
    let data = { i18n: res.i18n('pages.login') }
    res.show(data)
}

function post(req, res, next) {
    authApi.post('login?tokenIn=json', req.body).then(r => {
        const token = r.data.token
        res.cookie('jwt', token, { httpOnly: true })
        res.ok(res.i18n('pages.login.ok_login'))
    })
}

module.exports = {
    setup,
    get: {
        before: ['|'],
        handler: get
    },
    post: {
        before: ['|'],
        handler: post
    }
}