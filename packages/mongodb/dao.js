const _ = require('lodash')
const moment = require('moment')
const { ObjectID } = require('mongodb')
const Promise = require('bluebird')
const { formatDate, duration } = require('@vimesh/utils')
const { toObjectID, getObjectID } = require('./utils')

function attachMethodToDao(dao, name, func) {
    if (!dao[name]) {
        dao[name] = _.bind(func, dao, $models)
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
            if ($schemas.types[type]) {
                checkAndConvert(name, checkResults, convert, `${path}.${k}`, $schemas.types[type].properties, v)
            } else {
                checkResults.push(msgWrongType)
                $logger.warn(msgWrongType)
            }
        }

    })
}

function createDao(schema, name, affix) {
    let mapping = schema.$mapping
    if (!mapping) {
        $logger.error(`Model ${name} has no database mappings!`)
        return
    }
    if (!$mongodb.databases[mapping.database]) {
        $logger.error(`Model ${name} database ${mapping.database} is not defined!`)
        return
    }
    let database = $mongodb.databases[mapping.database].database
    let fullname = name
    let model = null
    if (affix) {
        fullname = name + affix
        model = database.collection(mapping.collection + affix)
    } else {
        model = database.collection(mapping.collection)
    }
    if ($dao[fullname]) return $dao[fullname]
    $models[fullname] = model
    let dao = { schema: schema, model: model }
    let auto = null
    if (mapping.autoincrement) {
        auto = {
            start: 1,
            step: 1
        }
        if (_.isInteger(mapping.autoincrement.start))
            auto.start = mapping.autoincrement.start
        if (_.isInteger(mapping.autoincrement.step))
            auto.step = mapping.autoincrement.step
    }
    _.each(mapping.methods, (method, methodName) => {
        dao[methodName] = _.bind(method, dao, $models)
        //$logger.info('DAO $dao.' + name + '.' + methodName)
    })
    if (auto && !affix) {
        let _setup = dao['$setup']
        dao['$setup'] = function () {
            return Promise.all([
                model.findOne({}, { fields: { _id: 1 }, sort: { _id: -1 } }),
                $dao.Ids.getId(dao.getAutoIdName())
            ]).then(rs => {
                let max = rs[0] && rs[0]._id
                let id = rs[1]
                if (max > id) {
                    $logger.warn(`Next id ${id} is smaller than max id ${max}`)
                    auto.start = max + auto.step
                }
                if (id < auto.start) {
                    return $dao.Ids.setId(dao.getAutoIdName(), auto.start).then(r => {
                        $logger.info(`Reset AutoIncrement ID to ${auto.start}`)
                        if (_setup) return _setup()
                    })
                } else if (_setup)
                    return _setup()
            })
        }
    }
    dao.getAutoIdName = function () {
        return fullname + '_id'
    }
    attachMethodToDao(dao, 'getCollectionSet', function ({ }, affix = '_') {
        let prefix = mapping.collection + affix
        return database.collections().then(rs => {
            let names = []
            _.each(rs, cn => {
                if (cn.s.name.indexOf(prefix) == 0) names.push(cn.s.name)
            })
            return _.sortBy(names)
        })
    })
    attachMethodToDao(dao, 'addFullId', function ({ }, data) {
        if (!data) return
        let array = _.isArray(data) ? data : [data]
        if (mapping && mapping.id_prefix) {
            _.each(array, item => {
                item._fid = mapping.id_prefix + '_' + item._id
            })
        } else {
            _.each(array, item => {
                item._fid = item._id
            })
        }
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
            let model = $schemas.models[tmodel]
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
                return $models[tmodel].find(cond).toArray().then(refItems => {
                    $dao[tmodel].addFullId(refItems)
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
    attachMethodToDao(dao, 'get', function ({ }, id) {
        if (_.isPlainObject(id))
            return model.findOne(id)

        let idtype = schema.properties._id
        if (idtype === 'number')
            id = +id
        else if (idtype === 'ObjectId')
            id = toObjectID(id)
        return model.findOne({ _id: id })
    })
    function fixId(data, check, convert) {
        let checkResults = []
        let idtype = schema.properties._id
        if (data._id === false) {
            // Do not fix id
        } else if (undefined !== data._id && null !== data._id && '' !== data._id) {
            if (idtype === 'number')
                data._id = +data._id
            else if (idtype === 'ObjectId')
                data._id = toObjectID(data._id)
        } else if (auto && idtype === 'number') {
            return $dao.Ids.getNextId(dao.getAutoIdName(), auto.step).then(nid => {
                data._id = nid
                if (check || convert)
                    checkAndConvert(name, checkResults, convert, "", schema.properties, data)
                return data
            })
        } else {
            if (idtype === 'ObjectId')
                data._id = getObjectID()
        }
        if (check || convert)
            checkAndConvert(name, checkResults, convert, "", schema.properties, data)
        return Promise.resolve(data)
    }
    attachMethodToDao(dao, 'set', function ({ }, id, data) {
        if (!data) {
            data = id
        } else if (!_.isArray(data)) {
            data._id = id
        }
        let all = _.isArray(data) ? data : [data]
        return Promise.each(all, item => fixId(item, true, mapping.autoconvert || false)).then(() => {
            let ops = _.map(all, item => {
                let cond = item._id === false ? {} : { _id: item._id }
                if (item['$when$']) cond = _.extend(cond, item['$when$'])
                if (_.keys(cond).length == 0) {
                    $logger.warn('Filter must be specific when "set" a document')
                }
                let update = item.$raw
                if (!update){
                    update = { $set: _.omit(item, '_id', '$when$', '$insert$', '$unset') }
                    if (item['$insert$']) update.$setOnInsert = item['$insert$']
                    if (item['$unset']) update.$unset = item['$unset']
                }
                if (_.keys(update.$set).length == 0) delete update.$set
                return {
                    updateOne: {
                        filter: cond,
                        update: update,
                        upsert: !item['$when$']
                    }
                }
            })
            if (ops.length == 0) return Promise.resolve(true)
            return model.bulkWrite(ops, { ordered: true, w: 1 }).then((r) => {
                return !!r.result.ok
            })
        })
    })
    attachMethodToDao(dao, 'add', function ({ }, data) {
        let all = _.isArray(data) ? data : [data]
        return Promise.each(all, item => fixId(item, true, mapping.autoconvert || false)).then(() => {
            return model.insertMany(all, { ordered: false }).then((r) => {
                return !!r.result.ok
            })
        })
    })
    attachMethodToDao(dao, 'delete', function ({ }, idOrCond) {
        if (!idOrCond) return Project.reject('Must specify a delete condition')
        let cond = idOrCond
        if (!_.isPlainObject(idOrCond)) {
            let idtype = schema.properties._id
            if (idtype === 'number')
                cond = { _id: +idOrCond }
            else if (idtype === 'ObjectId')
                cond = { _id: toObjectID(idOrCond) }
            else
                cond = { _id: idOrCond }
        }
        return model.remove(cond).then(r => {
            return r && r.result || { ok: 0 }
        })
    })
    attachMethodToDao(dao, 'count', function ({ }, query, options) {
        return model.countDocuments(query || {}, options || {})
    })
    attachMethodToDao(dao, 'aggregate', function ({ }, pipelines) {
        return new Promise(function (resolve, reject) {
            model.aggregate(pipelines).toArray(function (err, items) {
                if (err) reject(err);
                else resolve({ data: items });
            });
        });
    })
    attachMethodToDao(dao, 'find', function ({ }, query) {
        return model.find(query)
    })
    attachMethodToDao(dao, 'lastid', function () {
        return new Promise(function (resolve, reject) {
            if (auto) {
                $dao.Ids.getNextId(dao.getAutoIdName(), auto.step).then(nid => {
                    resolve({ id: nid })
                }).catch(r => {
                    reject(r)
                })
            } else {
                resolve()
            }
        })
    })
    attachMethodToDao(dao, 'bulk', function () {
        //if (!params) params = {}
        //let query = params.query || params.cond || {}
        return model.initializeOrderedBulkOp();
    })

    attachMethodToDao(dao, 'recycle', function ({ }, id) {
        let idtype = schema.properties._id
        if (idtype === 'number')
            id = +id
        else if (idtype === 'ObjectId')
            id = toObjectID(id)
        return model.findAndRemove({ _id: id }).then(r => {
            if (r.value)
                $dao.RecycleBin.set({ model: name, data: r.value, at: new Date })
            return { ok: r.ok, data: r.value }
        })
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
    attachMethodToDao(dao, 'listAllWithAffix', function ({ }) {
        let prefix = `${mapping.collection}_`
        return database.listCollections().toArray().then(r => {
            return _.map(
                _.filter(r, c => c.name.indexOf(prefix) == 0),
                c => +c.name.substring(prefix.length)
            )
        })
    }),
        attachMethodToDao(dao, 'select', function ({ }, params) {
            if (!params) params = {}
            let query = params.query || params.cond || {}
            let skip = +(params.skip || 0)
            let size = +(params.limit || params.size || 0)
            let sort = params.sort
            let returnCount = !!params.count
            let affix = params.affix

            if (affix) {
                let format = mapping.affix && mapping.affix.format || 'YYYYMMDD'
                if (!size) return Promise.reject('Size must be set in case of affix select')
                if (affix.begin && affix.end) {
                    let prefix = `${mapping.collection}_`
                    let begin = +formatDate(affix.begin, format)
                    let end = +formatDate(affix.end, format)
                    let asc = begin <= end
                    let listByDate = []
                    let count = 0
                    return dao.listAllWithAffix().then(r =>
                        _.sortBy(_.filter(r, cur => cur >= Math.min(begin, end) && cur <= Math.max(begin, end)), dt => asc ? dt : -dt)
                    ).then(dts => {
                        return Promise.all(_.map(dts, dt => {
                            return dao._(dt + '').count(query)
                        })).then(rs => {
                            listByDate = _.map(dts, (dt, index) => {
                                count += rs[index]
                                return { date: dt, count: rs[index] }
                            })
                        })
                    }).then(r => {
                        let remainedSize = size
                        let skipped = 0
                        let tasks = []
                        for (let i = 0; i < listByDate.length && remainedSize > 0; i++) {
                            let cur = listByDate[i]
                            if (cur.count > 0) {
                                if (skipped < skip) {
                                    let remainedSkip = skip - skipped
                                    let curSkip = Math.min(cur.count, remainedSkip)
                                    skipped += curSkip
                                    if (curSkip < cur.count) {
                                        let curSize = Math.min(remainedSize, cur.count - curSkip)
                                        remainedSize -= curSize
                                        tasks.push({ date: cur.date, skip: curSkip, size: curSize })
                                    }
                                } else {
                                    let curSize = Math.min(remainedSize, cur.count)
                                    remainedSize -= curSize
                                    tasks.push({ date: cur.date, skip: 0, size: curSize })
                                }
                            }
                        }
                        return Promise.all(_.map(tasks, t => dao._(t.date + '').select(
                            { cond: query, skip: t.skip, size: t.size, sort: sort, count: false }
                        ))).then(rs => {
                            let result = { data: [], count: count }
                            if (affix.debug) {
                                result.tasks = tasks
                                result.from = listByDate
                            }
                            _.each(rs, r => {
                                result.data = _.concat(result.data, r.data)
                            })
                            return result
                        })
                    })
                } else {
                    return Promise.reject('affix select must specific the begin and end date')
                }
            }

            let cursor = model.find(query)
            if (skip)
                cursor.skip(skip)
            if (size)
                cursor.limit(size)
            if (sort)
                cursor.sort(sort)
            return cursor.toArray().then(items => {
                let joined = params.join ? dao.join(items, params.join) : Promise.resolve(items)
                return joined.then(r => {
                    if (params.add_full_id !== false) dao.addFullId(items)
                    if (params.fields) {
                        let fields = _.trim(params.fields)
                        let omit = false
                        if (_.isString(fields)) {
                            omit = fields[0] == '-'
                            if (omit) fields = _.trim(fields.substring(1))
                        } else {
                            omit = fields[0] == '-'
                            fields = _.slice(fields, 1)
                        }
                        fields = _.map(fields.split(','), _.trim)
                        items = _.map(items, item => omit ? _.omit(item, fields) : _.picks(item, fields))
                    }
                    if (returnCount) {
                        return model.count(query).then(count => {
                            return { data: items, count: count }
                        })
                    } else {
                        return { data: items }
                    }
                })
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
    $dao[fullname] = dao;
    $logger.debug(`MODEL ${name} -> ${mapping.database}/${mapping.collection}`)
    _.each(mapping.indexes, (index) => {
        if (!index.options) index.options = {}
        let iarr = []
        if (index.options.expires) {
            index.options.expireAfterSeconds = duration(index.options.expires) / 1000
            delete index.options.expires
        }
        if (index.keys) iarr.push(model.ensureIndex(index.keys, index.options));
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