const _ = require('lodash')
const evaluate = require('simple-evaluate').default

function getValue(context, perm) {
    let rsc, action, scope = null
    let pos = perm.indexOf('.')
    if (pos == -1) {
        rsc = perm
        action = '*'
    } else {
        rsc = perm.substring(0, pos)
        action = perm.substring(pos + 1)
    }
    pos = rsc.indexOf('@')
    if (pos != -1) {
        scope = rsc.substring(pos + 1)
        rsc = rsc.substring(0, pos)
    }
    if (scope) {
        if (context[`*@${scope}.*`]) return true
        if (context[`${rsc}@${scope}.*`]) return true
        return !!context[`${rsc}@${scope}.${action}`]
    } else {
        if (context['*.*']) return true
        if (context[`${rsc}.*`]) return true
        return !!context[`${rsc}.${action}`]
    }
}
function applyScopeToPermissions(permMap, scope) {
    if (_.isObject(scope)) {
        permMap = _.mapKeys(permMap, (v, k) => {
            let l = k.indexOf('@{')
            let r = k.indexOf('}')
            if (l != -1 && l < r && _.has(scope, k.substring(l + 2, r))) {
                return k.substring(0, l + 1) + scope[k.substring(l + 2, r)] + k.substring(r + 1)
            }
            return k
        })
    }
    return permMap
}
function applyScopeToPermissionFormular(formular, scope) {
    _.each(_.keys(scope), k => {
        formular = formular.replace(new RegExp(`{${k}}`, 'g'), `${scope[k]}`)
    })
    return formular
}
function evaluatePermissionFormular(formular, ownedPermissions, scope) {
    if (!formular) return true
    try {
        if (_.isObject(scope)) {
            ownedPermissions = applyScopeToPermissions(ownedPermissions, scope)
            formular = applyScopeToPermissionFormular(formular, scope)
        }
        return evaluate(ownedPermissions, formular, { getValue })
    } catch (ex) {
        $logger.error(`Fails to evaluate permission formular(${formular}). `, ex)
        return false
    }
}

function empower(perm, result, scope) {
    let permMap = {}
    if (undefined === scope) {
        if (undefined === result)
            result = true
        else if (_.isObject(result)) {
            scope = result
            result = true
        } else {
            result = !!result
        }
    }

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
        if (k.indexOf('.') == -1) $logger.warn('Permission id must follow format "{resource}(@{scope}).{action}"')
    })
    return applyScopeToPermissions(permMap, scope)
}

module.exports = {
    empower,
    evaluatePermissionFormular
}