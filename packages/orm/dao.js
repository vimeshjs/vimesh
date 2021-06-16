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

const DTMAPPING = {
    'string': DataTypes.STRING,
    'text': DataTypes.TEXT,
    'boolean': DataTypes.BOOLEAN,
    'int': DataTypes.INTEGER,
    'number': DataTypes.NUMBER,
    'date': DataTypes.DATE,
    'decimal': DataTypes.DECIMAL,
    'json': DataTypes.JSON
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

function toJson(obj) {
    if (_.isArray(obj)) return _.map(obj, i => toJson(i))
    if (obj && obj.toJSON) return obj.toJSON()
    return obj
}
$orm.dao.toJson = toJson
$orm.dao.toWhere = buildWhere

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

    let tableName = mapping.collection || mapping.table
    if (affix) {
        fullname = name + affix
        tableName = tableName + affix
    }
    let assocCreators = {}
    let associations = {}
    let definition = {}
    _.each(schema.properties, (v, k) => {
        if (_.isString(v)) v = { type: v }
        if (!v.type) {
            $logger.warn(`No type found for ${name}.${k} : ${JSON.stringify(v)}`)
        }

        let def = _.cloneDeep(v)
        if (DTMAPPING[v.type]) {
            def.type = DTMAPPING[v.type]
            if (v.required) def.allowNull = false
            if (undefined !== v.default) def.defaultValue = v.default
            if (v.auto) def.autoIncrement = true
            if (v.primary) {
                def.primaryKey = true
                primaryKey = k
            }
            definition[k] = def
        } else {
            // It is an association
            assocCreators[k] = () => {
                let assoc = null
                let aoptions = _.omit(v, 'type')
                aoptions.as = k
                if (_.endsWith(def.type, '*')) {
                    let type = def.type.substring(0, def.type.length - 1)
                    if (_.startsWith(type, '@')) {
                        def.itype = type = type.substring(1)
                        $logger.debug(`ASSOC ${name} hasMany ${type} (${JSON.stringify(aoptions)})`)
                        assoc = $orm.models[name].hasMany($orm.models[type], aoptions)
                    } else {
                        def.itype = type
                        $logger.debug(`ASSOC ${name} belongsToMany ${type} (${JSON.stringify(aoptions)})`)
                        assoc = $orm.models[name].belongsToMany($orm.models[type], aoptions)
                    }
                } else {
                    if (_.startsWith(def.type, '@')) {
                        let type = def.itype = def.type.substring(1)
                        $logger.debug(`ASSOC ${name} hasOne ${type} (${JSON.stringify(aoptions)})`)
                        assoc = $orm.models[name].hasOne($orm.models[type], aoptions)
                    } else {
                        def.itype = def.type
                        $logger.debug(`ASSOC ${name} belongsTo ${def.type} (${JSON.stringify(aoptions)})`)
                        assoc = $orm.models[name].belongsTo($orm.models[def.type], aoptions)
                    }
                }
                assoc._config = def
                return assoc
            }
        }
    })
    if (!primaryKey) {
        primaryKey = 'id'
        if (definition[primaryKey])
            definition[primaryKey].primaryKey = true
    }

    let moptions = _.pick(mapping, 'timestamps', 'version', 'underscored', 'paranoid', 'indexes')
    if (undefined === moptions.underscored) moptions.underscored = true
    if (undefined === moptions.timestamps) moptions.timestamps = false
    if (mapping.recyclable) {
        moptions.timestamps = true
        moptions.paranoid = true
    }
    if (tableName)
        moptions.tableName = tableName

    model = database.define(name, definition, moptions)

    if (mapping.sync) {
        $logger.warn(`Model ${fullname} is synchronizing its schema with database ${mapping.database} (options : ${JSON.stringify(mapping.sync)})`)
        if (_.isObject(mapping.sync))
            model.sync(mapping.sync)
        else
            model.sync()
    }

    if ($orm.dao[fullname]) return $orm.dao[fullname]
    $orm.models[fullname] = model
    let dao = function (obj) {
        return model.build(obj)
    }
    dao.schema = schema
    dao.model = model
    dao.associations = associations
    dao.assocCreators = assocCreators
    dao.primaryKey = primaryKey

    _.each(mapping.methods, (method, methodName) => {
        dao[methodName] = _.bind(method, dao, $orm.models)
        //$logger.info('DAO $dao.' + name + '.' + methodName)
    })

    function normalizeOptions(options) {
        if (!options) options = {}
        if (options.debug) {
            delete options.debug
            options.logging = _.bind($logger.debug, $logger)
        }
        if (options.include) {
            options.include = _.map(options.include, i => _.isPlainObject(i) ? i : { association: associations[i] })
        } else {
            options.include = []
            _.each(associations, assoc => {
                if (true !== assoc._config.lazy) {
                    options.include.push({ association: assoc })
                }
            })
        }
        return options
    }

    attachMethodToDao(dao, 'get', function ({ }, idOrCond, options) {
        options = normalizeOptions(options)
        return (_.isPlainObject(idOrCond) ?
            model.findOne({ where: buildWhere(idOrCond) }) :
            model.findByPk(idOrCond, options)).then(r => options.native ? r : toJson(r))
    })
    attachMethodToDao(dao, '_get', function ({ }, id, options) {
        return this.get(id, { ...options, native: true })
    })
    attachMethodToDao(dao, 'set', async function ({ }, data, options) {
        options = normalizeOptions(options)
        let assocs = {}
        let dataToUpdate = {}
        _.each(data, (v, k) => {
            if (this.associations[k]) {
                assocs[k] = this.associations[k]
            } else {
                dataToUpdate[k] = v
            }
        })
        return model.upsert(dataToUpdate, options).then(async ([r]) => {
            let keys = _.keys(assocs)
            if (keys.length > 0) {
                let self = await dao._get(r[primaryKey])
                for (let i = 0; i < keys.length; i++) {
                    let key = keys[i]
                    let val = data[key]
                    let assoc = assocs[key]
                    let target = $orm.dao[assoc._config.itype]
                    if (_.isArray(val)) {
                        let cond = { [target.primaryKey]: { $in: val } }
                        let dataToSet = await target._select({ cond })
                        await self[`set${_.capitalize(keys[i])}`](dataToSet.data)
                    } else {
                        await self[`set${_.capitalize(keys[i])}`](await target._get(val))
                    }
                }
            }
            return options.native ? r : toJson(r)
        })
    })
    attachMethodToDao(dao, '_set', function ({ }, data, options) {
        return this.set(data, { ...options, native: true })
    })
    attachMethodToDao(dao, 'add', async function ({ }, data, options) {
        options = normalizeOptions(options)
        let assocs = {}
        let dataToAdd = {}
        _.each(data, (v, k) => {
            if (this.associations[k]) {
                assocs[k] = this.associations[k]
            } else {
                dataToAdd[k] = v
            }
        })
        return model.create(dataToAdd, options).then(async (r) => {
            let keys = _.keys(assocs)
            if (keys.length > 0) {
                let self = await dao._get(r[primaryKey])
                for (let i = 0; i < keys.length; i++) {
                    let key = keys[i]
                    let val = data[key]
                    let assoc = assocs[key]
                    let target = $orm.dao[assoc._config.itype]
                    if (_.isArray(val)) {
                        let cond = { [target.primaryKey]: { $in: val } }
                        let dataToSet = await target._select({ cond })
                        await self[`set${_.capitalize(keys[i])}`](dataToSet.data)
                    } else {
                        await self[`set${_.capitalize(keys[i])}`](await target._get(val))
                    }
                }
            }
            return options.native ? r : toJson(r)
        })
    })
    attachMethodToDao(dao, '_add', function ({ }, data, options) {
        return this.add(data, { ...options, native: true })
    })
    attachMethodToDao(dao, 'delete', function ({ }, idOrCond, options) {
        options = normalizeOptions(options)
        options.where = _.isPlainObject(idOrCond) ? buildWhere(idOrCond) : { [primaryKey]: idOrCond }
        options.force = true
        return model.destroy(options)
    })
    attachMethodToDao(dao, 'recycle', function ({ }, idOrCond, options) {
        options = normalizeOptions(options)
        options.where = _.isPlainObject(idOrCond) ? buildWhere(idOrCond) : { [primaryKey]: idOrCond }
        options.force = false
        return model.destroy(options)
    })
    attachMethodToDao(dao, 'restore', function ({ }, idOrCond, options) {
        options = normalizeOptions(options)
        options.where = _.isPlainObject(idOrCond) ? buildWhere(idOrCond) : { [primaryKey]: idOrCond }
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
            return returnCount ?
                { data: options.native ? result.rows : toJson(result.rows), count: result.count } :
                { data: options.native ? result : toJson(result) }
        })
    })
    attachMethodToDao(dao, '_select', function ({ }, params, options) {
        return this.select(params, { ...options, native: true })
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