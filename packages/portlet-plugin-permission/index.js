const _ = require('lodash')
const { evaluatePermissionFormular } = require('./utils')

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

        res.locals.$allow = res.allow = (perm, cond) => {
            let allowed = evaluatePermissionFormular(perm, res.locals.$permissions)
            return allowed && (cond === undefined || cond)
        }
        res.ensure = (perm, cond) => {
            if (!res.allow(perm, cond)) {
                $logger.error(`Access Forbidden (${JSON.stringify(req.user)}) @ ${req.path} `)
                throw Error('Access Forbidden!')
            }
        }
        res.empower = (perm, result) => {
            let permMap = {}
            if (undefined === result)
                result = true
            else
                result = !!result

            if (_.isString(perm))
                permMap[perm] = result
            else if (_.isArray(perm)) {
                _.each(perm, k => permMap[k] = result)
            } else if (_.isPlainObject(perm)) {
                permMap = _.mapValues(perm, v => !!v)
            } else {
                $logger.warn(`Unable to empower ${perm}`)
            }
            _.each(permMap, (v, k) => {
                if (_.indexOf(k, '.') == -1) $logger.warn('Permission id must follow format "{resource}.{action}"')
            })
            res.locals.$permissions = _.merge(res.locals.$permissions, permMap)
        }
    })

    portlet.on('beforeSetupRoutes', () => {
        portlet.loadAssets('permissions', '.yaml', (rs) => {
            portlet.allPermissions = _.merge({}, ..._.values(rs))
        })
    })

    portlet.registerHbsHelpers({ allow })
}
