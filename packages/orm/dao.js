const _ = require('lodash')
const moment = require('moment')
const Promise = require('bluebird')
const Sequelize = require('sequelize')
const { formatDate, duration } = require('@vimesh/utils')
const { DataTypes, Op } = Sequelize
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
function createAssociation(models, modelName, name, def) {
    let model = models[modelName]
    let assoc = null
    let aoptions = _.omit(def, 'type')
    aoptions.as = name
    let type = def.type
    if (_.endsWith(def.type, '*')) {
        type = def.type.substring(0, def.type.length - 1)
        if (_.startsWith(type, '@')) {
            type = type.substring(1)
            $logger.debug(`ASSOC ${modelName}.${name} hasMany ${type} (${JSON.stringify(aoptions)})`)
            assoc = model.hasMany(models[type], aoptions)
        } else {
            $logger.debug(`ASSOC ${modelName}.${name} belongsToMany ${type} (${JSON.stringify(aoptions)})`)
            assoc = model.belongsToMany(models[type], aoptions)
        }
    } else {
        if (_.startsWith(def.type, '@')) {
            type = def.type.substring(1)
            $logger.debug(`ASSOC ${modelName}.${name} hasOne ${type} (${JSON.stringify(aoptions)})`)
            assoc = model.hasOne(models[type], aoptions)
        } else {
            $logger.debug(`ASSOC ${modelName}.${name} belongsTo ${def.type} (${JSON.stringify(aoptions)})`)
            assoc = model.belongsTo(models[type], aoptions)
        }
    }
    def.source = modelName
    def.target = type
    assoc._config = def
    return assoc
}
function normalizeInclude(dao, options) {
    let associations = dao.associations
    if (options.attributes) {
        options.attributes = _.map(options.attributes, attr => {
            if (_.isString(attr)) {
                let p1 = attr.indexOf('(')
                let p2 = attr.indexOf(')')
                let pas = attr.indexOf(' as ')
                if (p2 > p1 && p1 > 0) {
                    let func = _.trim(attr.substring(0, p1))
                    let field = _.trim(attr.substring(p1 + 1, p2))
                    let as = _.trim(attr.substring(p2 + 1))
                    if (_.startsWith(as, 'as ')) {
                        as = _.trim(as.substring(3))
                    }
                    attr = [Sequelize.fn(func, Sequelize.col(field)), as]
                } else if (pas > 0) {
                    attr = [_.trim(attr.substring(0, pas)), _.trim(attr.substring(pas + 4))]
                }
            }
            return attr
        })
    }
    if (options.include) {
        options.include = _.map(options.include, i => {
            if (_.isPlainObject(i)) {
                let assoc = associations[i.as]
                if (!assoc) {
                    $logger.error(`Association ${dao.getName()}.${i.as} does not exist!`)
                } else {
                    i.association = assoc
                    if (i.cond) {
                        i.where = buildWhere(i.cond)
                        delete i.cond
                    }
                    if (i.through && i.through.cond) {
                        i.through.where = buildWhere(i.through.cond)
                        delete i.through.cond
                    }
                    if (i.include) {
                        normalizeInclude($orm.dao[assoc._config.target], i)
                    }
                }
                return i
            }
            return { association: associations[i] }
        })
    } else {
        if (!options.group) {
            options.include = []
            _.each(associations, assoc => {
                if (assoc._config && true !== assoc._config.lazy) {
                    options.include.push({ association: assoc })
                }
            })
        }
    }
}
function normalizeOptions(dao, options) {
    options = _.cloneDeep(options)
    if (!options) options = {}
    if (options.debug) {
        delete options.debug
        options.logging = _.bind($logger.debug, $logger)
    }
    normalizeInclude(dao, options)
    return options
}

function createDao(schema, name) {
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
    let primaryKey = null
    let model = null
    let tableName = mapping.collection || mapping.table
    let associations = {}
    let definition = {}
    _.each(schema.properties, (v, k) => {
        if (_.isString(v)) v = { type: v }
        if (!v.type) {
            $logger.warn(`No type found for ${name}.${k} : ${JSON.stringify(v)}`)
        }

        let def = _.omit(v, 'required', 'default', 'auto', 'primary')
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
            associations[k] = def
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

    $logger.debug(`MODEL ${mapping.database}/${name} `)
    _.each(mapping.indexes, (index) => {
        $logger.debug(`INDEX ${name} ${JSON.stringify(index)} `)
    })
    $orm.models[name] = model = database.define(name, definition, moptions)

    if (mapping.sync) {
        $logger.warn(`Model ${name} is synchronizing its schema with database ${mapping.database} (options : ${JSON.stringify(mapping.sync)})`)
        if (_.isObject(mapping.sync))
            model.sync(mapping.sync)
        else
            model.sync()
    }

    $orm.models[name] = model
    let dao = $orm.dao[name] = function (obj) {
        return model.build(obj)
    }
    dao.schema = schema
    dao.associations = associations
    dao.primaryKey = primaryKey

    _.each(mapping.methods, (method, methodName) => {
        dao[methodName] = _.bind(method, dao, $orm.models)
        //$logger.info('DAO $dao.' + name + '.' + methodName)
    })

    attachMethodToDao(dao, 'get', function ({ }, idOrCond, options) {
        options = normalizeOptions(dao, options)
        return (_.isPlainObject(idOrCond) ?
            model.findOne({ where: buildWhere(idOrCond) }) :
            model.findByPk(idOrCond, options)).then(r => options.native ? r : toJson(r))
    })
    attachMethodToDao(dao, '_get', function ({ }, id, options) {
        return this.get(id, { ...options, native: true })
    })
    attachMethodToDao(dao, 'set', async function ({ }, data, options) {
        options = normalizeOptions(dao, options)
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
                    let target = $orm.dao[assoc._config.target]
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
        options = normalizeOptions(dao, options)
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
                    let target = $orm.dao[assoc._config.target]
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
    attachMethodToDao(dao, 'update', async function ({ }, data, options) {
        options = normalizeOptions(dao, options)
        if (options.cond) {
            options.where = buildWhere(options.cond)
            delete options.cond
        }
        let assocs = {}
        let dataToUpdate = {}
        _.each(data, (v, k) => {
            if (this.associations[k]) {
                assocs[k] = this.associations[k]
            } else {
                dataToUpdate[k] = v
            }
        })
        return model.update(dataToUpdate, options)
    })
    attachMethodToDao(dao, 'delete', function ({ }, idOrCond, options) {
        options = normalizeOptions(dao, options)
        options.where = _.isPlainObject(idOrCond) ? buildWhere(idOrCond) : { [primaryKey]: idOrCond }
        options.force = true
        return model.destroy(options)
    })
    attachMethodToDao(dao, 'recycle', function ({ }, idOrCond, options) {
        options = normalizeOptions(dao, options)
        options.where = _.isPlainObject(idOrCond) ? buildWhere(idOrCond) : { [primaryKey]: idOrCond }
        options.force = false
        return model.destroy(options)
    })
    attachMethodToDao(dao, 'restore', function ({ }, idOrCond, options) {
        options = normalizeOptions(dao, options)
        options.where = _.isPlainObject(idOrCond) ? buildWhere(idOrCond) : { [primaryKey]: idOrCond }
        return model.restore(options)
    })
    attachMethodToDao(dao, 'count', function ({ }, cond, options) {
        options = normalizeOptions(dao, options)
        options.where = buildWhere(cond)
        return model.count(options)
    })
    attachMethodToDao(dao, 'getMappings', function ({ }) {
        return mapping
    })
    attachMethodToDao(dao, 'getName', function ({ }) {
        return name
    })
    attachMethodToDao(dao, 'getDatabase', function ({ }) {
        return database
    })
    attachMethodToDao(dao, 'getDatabaseName', function ({ }) {
        return mapping.database
    })
    attachMethodToDao(dao, 'select', function ({ }, params, options) {
        if (!params) params = {}
        options = normalizeOptions(dao, options)
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
    return dao
}

module.exports = {
    createDao,
    createAssociation
}