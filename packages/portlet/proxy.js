
const httpProxy = require('http-proxy')
const { createMemoryCache } = require('@vimesh/cache')
function setupProxy(portletServer) {
    const portlet = portletServer.portlet
    const app = portletServer.app
    const kvClient = portletServer.kvClient
    const proxy = httpProxy.createProxy()
    const cache = createMemoryCache({
        maxAge: '1h',
        onRefresh: function (key) {
            if (!kvClient) return Promise.reject(Error('Discovery server is not ready'))
            return kvClient.get(`portlets/@${key}`).catch(ex => null)
        }
    })
    app.use(function (req, res, next) {
        let parts = req.path.split('/')
        if (parts.length > 1 && parts[1][0] === '@') {
            let name = parts[1].substring(1)
            if (name == portlet) return next()
            return cache.get(name).then(url => {
                if (!url) return next()
                if (url.indexOf('://') == -1) url = `http://${url}`
                proxy.web(req, res, {
                    target: url
                })
            }).catch(ex => {
                next()
            })
        }
        next()
    })
}

module.exports = {
    setupProxy
}