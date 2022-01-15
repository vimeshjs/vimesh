const _ = require('lodash')

function getSortedExtensions(index, extensions, allow) {
    extensions = _.filter(_.map(_.entries(extensions), ar => _.extend({ _name: ar[0] }, ar[1])), m => {
        let perm = _.get(m, '_meta.permission')
        if (perm && !allow(perm)) return false
        if (!m._meta)
            $logger.warn(`Extension config (${JSON.stringify(m)}) has no _meta definition.`)
        return !!m._meta
    })
    extensions = _.sortBy(extensions, m => _.get(m, '_meta.sort') || _.get(m, '_meta.order') || 1)
    return _.filter(_.map(extensions, m => {
        let mindex = `${index}.${m._name}`
        let children = getSortedExtensions(mindex, _.omit(m, '_name', '_meta'), allow)
        let item = _.extend({ index: mindex }, m._meta)
        if (children.length > 0) item.children = children
        return item
    }))
}

module.exports = {
    getSortedExtensions
}