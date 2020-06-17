const _ = require('lodash')
const {createMemoryCache} = require('@vimesh/cache')
let permCache

function getJwtSecret(config) {
    return _.get(config, 'passport.jwt.secret') || 'vimesh-secret'
}

function getPermissions(id, allPermissions){
    if (!permCache){
        permCache = createMemoryCache({
            maxAge: '1m',
            stale: true,
            onRefresh: (id) => {
                let perms = {}
                if (id == 'admin') {
                    _.each(allPermissions, (ps, rsc) => {
                        if (ps._meta) {
                            _.each(_.keys(_.omit(ps, '_meta')), p => perms[`${rsc}.${p}`] = true)        
                        }
                    })
                    return perms
                } else {
                    return perms
                }
            }
        })
    }
    return permCache.get(id)
}
module.exports = {
    getJwtSecret,
    getPermissions
}