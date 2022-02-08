const _ = require('lodash')
const { evaluatePermissionFormular, empower } = require('./utils')

function allow(perm, options) {
    if (!options) {
        $logger.error('Permission must be provided in allow helper!')
        return
    }
    let permsOfCurrentUser = options.data.root.$permissions || {}
    let allowed = evaluatePermissionFormular(perm, permsOfCurrentUser)
    let content = options.fn(this)
    return allowed ? content : ''
}

module.exports = (portlet) => {
    portlet.allPermissions = {}
    portlet.on('decorateResponse', (req, res) => {
        res.locals.$permissions = {}

        res.locals.$allow = res.allow = (perm, cond, scope) => {
            if (undefined === scope && _.isObject(cond)) {
                scope = cond
                cond = true
            }
            let allowed = evaluatePermissionFormular(perm, res.locals.$permissions, scope)
            return allowed && (undefined === cond || cond)
        }
        res.ensure = (perm, cond, scope) => {
            if (!res.allow(perm, cond, scope)) {
                $logger.error(`Access Forbidden (${JSON.stringify(req.user)}) @ ${req.path} `)
                throw Error('Access Forbidden!')
            }
        }
        res.empower = (perm, result, scope) => {
            _.merge(res.locals.$permissions, empower(perm, result, scope))
        }
    })

    portlet.on('beforeSetupRoutes', () => {
        portlet.loadAssets('permissions', '.yaml', (rs) => {
            portlet.allPermissions = _.merge({}, ..._.values(rs))
        })
    })

    portlet.registerHbsHelpers({ allow })
}
