const _ = require('lodash')

function formatError(err, code) {
    let json = {
        status: 'error',
        message: _.isString(err) ? err : err && err.message || err + '',
        code
    }
    return json
}

function formatOK(msg, code) {
    let json = {
        status: 'ok',
        message: msg,
        code
    }
    return json
}

function evaluatePermissionFormular(formular, ownedPermissions, allPermissions){
    if (_.isBoolean(formular)) return formular
    if (!ownedPermissions) return false
    _.each(_.omit(allPermissions, '_meta'), (ps, rsc) => {
        _.each(_.omit(ps, '_meta'), (p, k) => {
            let key = `${rsc}.${k}`
            let result = ownedPermissions[key] ? 'true' : 'false'
            formular = formular.split(key).join(result)
        })
    })
    _.each(ownedPermissions, (v, key) => {
        if (!_.isPlainObject(v)){
            let result = v ? 'true' : 'false'
            formular = formular.split(key).join(result)
        }
    })
    try{
        return eval(formular)
    }catch(ex){
        $logger.error(`Fails to evaluate permission formular(${formular}). `, ex)
        return false
    }
}

module.exports = {
    formatOK,
    formatError,
    evaluatePermissionFormular
}