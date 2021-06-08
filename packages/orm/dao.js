const _ = require('lodash')
const moment = require('moment')
const Promise = require('bluebird')
const { DataTypes, Op } = require('sequelize')
const { formatDate, duration } = require('@vimesh/utils')

function attachMethodToDao(dao, name, func) {
    if (!dao[name]) {
        dao[name] = _.bind(func, dao, $orm.models)
    }
}

function getPaths(name, results, keys, index, path, obj) {
    if (!obj || index >= keys.length) return
    let key = keys[index]
    let last = index == keys.length - 1
    let v = obj[key]
    if (v) {
        if (_.isArray(v)) {
            _.each(v, (vi, i) => {
                if (last) {
                    let pi = path + (path ? '.' : '') + `${name}[${i}]`
                    results.push({ path: pi, val: vi })
                } else {
                    let pi = path + (path ? '.' : '') + `${key}[${i}]`
                    getPaths(name, results, keys, index + 1, pi, vi)
                }
            })
        } else {
            if (last) {
                path += (path ? '.' : '') + name
                results.push({ path: path, val: v })
            } else {
                path += (path ? '.' : '') + key
                getPaths(name, results, keys, index + 1, path, v)
            }
        }
    }

}

function checkAndConvert(name, checkResults, convert, path, props, obj) {
    if (!obj) return
    _.each(props, (type, k) => {
        let v = obj[k]
        if (!v) return
        let at = `${name}${path}.${k}`
        let msgWrongType = `Wrong type @ ${at} (${type}): ` + JSON.stringify(v)
        let msgFailsToConvert = `Fails to convert @ ${at} (${type}): ` + JSON.stringify(v)
        let msgConvert = `Convert @ ${at} (${type}): ` + JSON.stringify(v) + ' -> '
        if (type === 'ObjectId') {
            if (!ObjectID.isValid(v)) {
                checkResults.push(msgWrongType)
                $logger.warn(msgWrongType)
            }
        } else if (type === 'boolean') {
            if (!_.isBoolean(v)) {
                checkResults.push(msgWrongType)
                $logger.warn(msgWrongType)
            }
        } else if (type === 'string') {
            if (!_.isString(v)) {
                checkResults.push(msgWrongType)
                $logger.warn(msgWrongType)
            }
        } else if (type === 'object') {
            if (!_.isObject(v)) {
                checkResults.push(msgWrongType)
                $logger.warn(msgWrongType)
            }
        } else if (type === 'date') {
            if (!_.isDate(v)) {
                if (convert) {
                    try {
                        if (!v)
                            delete obj[k]
                        else {
                            if (moment(v).isValid()) {
                                obj[k] = moment(v).toDate()
                                $logger.warn(msgConvert + formatDate(obj[k]))
                            } else {
                                checkResults.push(msgFailsToConvert)
                                $logger.error(msgFailsToConvert)
                            }
                        }
                    } catch (ex) {
                        checkResults.push(msgFailsToConvert)
                        $logger.error(msgFailsToConvert, ex)
                    }
                } else {
                    checkResults.push(msgWrongType)
                    $logger.warn(msgWrongType)
                }
            }
        } else if (type === 'number') {
            if (!_.isNumber(v)) {
                if (convert) {
                    try {
                        if (!v)
                            delete obj[k]
                        else {
                            let num = +v
                            obj[k] = num
                            $logger.warn(msgConvert + num)
                        }
                    } catch (ex) {
                        checkResults.push(msgFailsToConvert)
                        $logger.error(msgFailsToConvert, ex)
                    }
                } else {
                    checkResults.push(msgWrongType)
                    $logger.warn(msgWrongType)
                }
            }
        } else if (_.isArray(type)) {
            if (!_.isArray(v)) {
                checkResults.push(msgWrongType)
                $logger.warn(msgWrongType)
            } else {
                if (_.isString(type[0])) {
                    let ntype = []
                    _.each(v, (vi, i) => ntype.push(type[0]))
                    checkAndConvert(name, checkResults, convert, `${path}.${k}`, ntype, v)
                } else {
                    _.each(v, (item, i) => {
                        checkAndConvert(name, checkResults, convert, `${path}.${k}[${i}]`, type[0], item)
                    })
                }
            }
        } else if (_.isObject(type)) {
            checkAndConvert(name, checkResults, convert, `${path}.${k}`, type, v)
        } else {
            if ($orm.schemas.types[type]) {
                checkAndConvert(name, checkResults, convert, `${path}.${k}`, $orm.schemas.types[type].properties, v)
            } else {
                checkResults.push(msgWrongType)
                $logger.warn(msgWrongType)
            }
        }

    })
}


const DTMAPPING = {
    'string': DataTypes.STRING,
    'text': DataTypes.TEXT,
    'boolean': DataTypes.BOOLEAN,
    'int': DataTypes.INTEGER,
    'number': DataTypes.NUMBER,
    'date': DataTypes.DATE,
    'decimal': DataTypes.DECIMAL
}

//https://sequelize.org/master/manual/model-querying-basics.html#operators
const OPMAPPING = {
    '$or': Op.or,
    '$and': Op.and,
    '$is': Op.is,
    '$not': Op.not,
    '$eq': Op.eq,
    '$ne': Op.ne,

    '$in': Op.in,
    '$nin': Op.notIn,
    '$like': Op.like,
    '$nlike': Op.notLike,
    '$lt': Op.lt,
    '$lte': Op.lte,
    '$gt': Op.gt,
    '$gte': Op.gte,

    '$between': Op.between,
    '$nbetween': Op.notBetween
}

function buildWhere(cond) {
    if (_.isArray(cond)) {
        return _.map(cond, i => buildWhere(i))
    }
    if (!_.isPlainObject(cond))
        return cond
    let where = {}
    _.each(cond, (v, k) => {
        if (OPMAPPING[k]) {
            where[OPMAPPING[k]] = buildWhere(v)
        } else {
            where[k] = buildWhere(v)
        }
    })
    return where
}

function normalizeOptions(options) {
    if (!options) return {}
    if (options.debug) {
        delete options.debug
        options.logging = _.bind($logger.debug, $logger)
    }
    return options
}

function toJson(obj) {
    if (_.isArray(obj)) return _.map(obj, i => toJson(i))
    if (obj && obj.toJSON) return obj.toJSON()
    return obj
}

function createDao(schema, name, affix) {
    let mapping = schema.$mapping
    if (!mapping) {
        $logger.error(`Model ${name} has no database mappings!`)
        return
    }
    if (!$orm.databases[mapping.database]) {
        $logger.error(`Model ${name} database ${mapping.database} is not defined!`)
        return
    }
    let database = $orm.databases[mapping.database]
    let fullname = name
    let primaryKey = null
    let model = null
    if (undefined === mapping.timestamps)
        mapping.timestamps = true
    if (undefined === mapping.recyclable)
        mapping.recyclable = true

    let tableName = mapping.collection || mapping.table
    if (affix) {
        fullname = name + affix
        tableName = tableName + affix
    }

    let definition = {}
    _.each(schema.properties, (v, k) => {
        definition[k] = {
            type: DTMAPPING[v]
        }
    })
    if (!primaryKey && definition['id']) {
        primaryKey = 'id'
        definition[primaryKey].primaryKey = true
    }
    model = database.define(tableName, definition, {
        tableName,
        timestamps: !!mapping.timestamps,
        paranoid: !!mapping.recyclable
    })

    if (mapping.sync) {
        $logger.warn(`Model ${fullname} is synchronizing its schema with database ${mapping.database} (options : ${JSON.stringify(mapping.sync)})`)
        if (_.isObject(mapping.sync))
            model.sync(mapping.sync)
        else
            model.sync()
    }

    if ($orm.dao[fullname]) return $orm.dao[fullname]
    $orm.models[fullname] = model
    let dao = { schema: schema, model: model }

    _.each(mapping.methods, (method, methodName) => {
        dao[methodName] = _.bind(method, dao, $orm.models)
        //$logger.info('DAO $dao.' + name + '.' + methodName)
    })
    // abc.ciid > ci : CollectionItems
    attachMethodToDao(dao, 'join', function ({ }, array, ...settings) {
        if (!array) return
        if (!_.isArray(array)) array = [array]
        if (_.isArray(settings[0])) settings = settings[0]
        return Promise.each(settings, setting => {
            let parts = setting.split('\>')
            if (parts.length != 2) {
                $logger.error(`Fails to join @${name} : ${setting}`)
                return
            }
            let spath = _.trim(parts[0])
            let spathParts = spath.split('\.')
            parts = parts[1].split(':')
            if (parts.length != 2) {
                $logger.error(`Fails to join @${name} : ${setting}`)
                return
            }
            let tkey = _.trim(parts[0])
            let tmodel = _.trim(parts[1])
            let tpath = ''
            parts = tmodel.split('\/')
            if (parts.length == 2) {
                tmodel = _.trim(parts[0])
                tpath = _.trim(parts[1])
            }
            let p1 = tmodel.indexOf('(')
            let p2 = tmodel.indexOf(')')
            let idkey = '_id'
            let idToArray = false
            if (p1 != -1 && p2 > p1) {
                idkey = _.trim(tmodel.substring(p1 + 1, p2))
                if (idkey[idkey.length - 1] == '*') {
                    idkey = _.trim(idkey.substring(0, idkey.length - 1))
                    idToArray = true
                }
                tmodel = _.trim(tmodel.substring(0, p1))
            }
            let model = $orm.schemas.models[tmodel]
            let ttype = model.properties[idkey]
            let idmap = {}
            let actions = _.map(array, item => {
                let results = []
                getPaths(tkey, results, spathParts, 0, '', item)
                _.each(results, item => {
                    if (idmap[item.val] === undefined) {
                        if (ttype == 'ObjectId') {
                            idmap[item.val] = toObjectID(item.val)
                        } else if (ttype == 'number') {
                            idmap[item.val] = +item.val
                        } else if (ttype == 'string') {
                            idmap[item.val] = item.val.toString()
                        } else {
                            idmap[item.val] = item.val
                        }
                    }
                })
                return results
            })
            let idset = _.values(idmap)
            if (idset.length > 0) {
                let cond = {}
                cond[idkey] = { $in: idset }
                return $orm.models[tmodel].find(cond).toArray().then(refItems => {
                    $orm.dao[tmodel].addFullId(refItems)
                    let refMap = {}
                    _.each(refItems, item => {
                        if (idToArray) {
                            if (!refMap[item[idkey]])
                                refMap[item[idkey]] = [item]
                            else
                                refMap[item[idkey]].push(item)
                        } else {
                            refMap[item[idkey]] = item
                        }
                    })
                    _.each(actions, (results, i) => {
                        let obj = array[i]
                        _.each(results, r => {
                            if (tpath && tpath.indexOf(',') != -1) {
                                let sparts = tpath.split(',')
                                let tparts = r.path.split(',')
                                let pos = tparts[0].lastIndexOf('.')
                                if (pos != -1) {
                                    let prefix = tparts[0].substring(0, pos + 1)
                                    for (let i = 1; i < tparts.length; i++) {
                                        tparts[i] = prefix + tparts[i]
                                    }
                                }
                                if (sparts.length != tparts.length)
                                    $logger.error(`Wrong join config : ${setting} @${name}`)
                                _.each(sparts, (sp, i) => {
                                    let refObj = _.get(refMap[r.val], _.trim(sp))
                                    _.set(obj, _.trim(tparts[i]), refObj)
                                })
                            } else {
                                let refObj = tpath ? _.get(refMap[r.val], tpath) : refMap[r.val]
                                _.set(obj, r.path, refObj)
                            }
                        })
                    })
                })
            }
        }).then(() => array)
    })
    attachMethodToDao(dao, 'check', function ({ }, data) {
        let convert = false
        let checkResults = []
        checkAndConvert(name, checkResults, convert, "", schema.properties, data)
        return checkResults.length == 0
    })
    attachMethodToDao(dao, 'convert', function ({ }, data) {
        let convert = true
        let checkResults = []
        checkAndConvert(name, checkResults, convert, "", schema.properties, data)
        return checkResults.length == 0
    })
    attachMethodToDao(dao, 'get', function ({ }, id, options) {
        return model.findByPk(id, normalizeOptions(options)).then(r => {
            return toJson(r)
        })
    })
    attachMethodToDao(dao, 'set', function ({ }, data, options) {
        return model.upsert(data, normalizeOptions(options))
    })
    attachMethodToDao(dao, 'add', function ({ }, data, options) {
        return model.create(data, normalizeOptions(options))
    })
    attachMethodToDao(dao, 'delete', function ({ }, cond, options) {
        options = normalizeOptions(options)
        options.where = buildWhere(cond)
        options.force = true
        return model.destroy(options)
    })
    attachMethodToDao(dao, 'recycle', function ({ }, cond, options) {
        options = normalizeOptions(options)
        options.where = buildWhere(cond)
        options.force = false
        return model.destroy(options)
    })
    attachMethodToDao(dao, 'restore', function ({ }, cond, options) {
        options = normalizeOptions(options)
        options.where = buildWhere(cond)
        return model.restore(options)
    })
    attachMethodToDao(dao, 'count', function ({ }, cond, options) {
        options = normalizeOptions(options)
        options.where = buildWhere(cond)
        return model.count(options)
    })
    attachMethodToDao(dao, 'getMappings', function ({ }) {
        return mapping
    })
    attachMethodToDao(dao, 'getModel', function ({ }) {
        return model
    })
    attachMethodToDao(dao, 'getName', function ({ }) {
        return name
    })
    attachMethodToDao(dao, 'getFullName', function ({ }) {
        return fullname
    })
    attachMethodToDao(dao, 'getDatabase', function ({ }) {
        return database
    })
    attachMethodToDao(dao, 'select', function ({ }, params, options) {
        if (!params) params = {}
        options = normalizeOptions(options)
        options.where = buildWhere(params.query || params.cond || {})
        let skip = +(params.skip || 0)
        if (skip) options.offset = skip
        let size = +(params.limit || params.size || 0)
        if (size) options.limit = size
        let sort = params.sort || params.order
        if (sort) options.order = sort
        let returnCount = !!params.count
        return (returnCount ? model.findAndCountAll(options) : model.findAll(options)).then(result => {
            return returnCount ? { data: toJson(result.rows), count: result.count } : { data: toJson(result) }
        })
    })
    if (!affix) {
        attachMethodToDao(dao, '_', function ({ }, date) {
            let format = mapping.affix && mapping.affix.format || 'YYYYMMDD'
            if (!date) {
                date = moment.utc()
            }
            if (!_.isString(date) && !_.isNumber(date)) {
                date = formatDate(date, format)
            }
            return createDao(schema, name, '_' + date)
        })
    }
    $orm.dao[fullname] = dao;
    $logger.debug(`MODEL ${name} -> ${mapping.database}/${mapping.collection}`)
    _.each(mapping.indexes, (index) => {
        if (!index.options) index.options = {}
        let iarr = []

        //if (index.keys) iarr.push(model.ensureIndex(index.keys, index.options));
        if (iarr.length > 0)
            Promise.all(iarr).then(r => {
                $logger.debug(`INDEX ${name} ${JSON.stringify(index.keys)} ${JSON.stringify(index.options)} `)
            }).catch(err => {
                $logger.error(`INDEX ${name} ${JSON.stringify(index.keys)} ${JSON.stringify(index.options)}`, err)
            });
    })
    return dao
}

module.exports = createDao