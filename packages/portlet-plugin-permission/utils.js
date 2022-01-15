const _ = require('lodash')
const evaluate = require('simple-evaluate').default

function getValue(context, perm) {
    if (context['*.*']) return true
    let rsc, action
    let pos = _.indexOf(perm, '.')
    if (pos == -1) {
        rsc = perm
        action = '*'
    } else {
        rsc = perm.substring(0, pos)
        action = perm.substring(pos + 1)
    }
    if (context[`${rsc}.*`]) return true
    return !!context[`${rsc}.${action}`]
}

function evaluatePermissionFormular(formular, ownedPermissions) {
    if (!formular) return true
    try {
        return evaluate(ownedPermissions || {}, formular, { getValue })
    } catch (ex) {
        $logger.error(`Fails to evaluate permission formular(${formular}). `, ex)
        return false
    }
}

module.exports = {
    evaluatePermissionFormular
}