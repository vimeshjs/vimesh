const fs = require("fs")
const path = require("path")
const _ = require("lodash")
const Umzug = require('umzug')
const mkdirp = require('mkdirp')
const migrate = require("./lib/migration-impl")

function generate(sequelize, name, checkpoint, migrationsDir, migrationModel) {
    const mname = checkpoint
    const currentState = { tables: {} }
    const dbMigrationsDir = `${migrationsDir}/${name}`
    let previousState = { revision: 0, version: 1, tables: {} }
    if (!fs.existsSync(dbMigrationsDir))
        mkdirp.sync(dbMigrationsDir)
    let current = ''
    _.each(fs.readdirSync(dbMigrationsDir), f => {
        if (_.endsWith(f, '.json') && fs.existsSync(path.join(dbMigrationsDir, f.substring(0, f.length - 5) + '.js'))) {
            if (f > current) current = f
        }
    })
    try {
        if (current)
            previousState = JSON.parse(fs.readFileSync(path.join(dbMigrationsDir, current)))
    } catch (e) { }
    let models = sequelize.models
    delete models[migrationModel]
    currentState.tables = migrate.reverseModels(sequelize, models)
    let actions = migrate.parseDifference(previousState.tables, currentState.tables)
    migrate.sortActions(actions);
    let migration = migrate.getMigration(actions)
    if (migration.commandsUp.length === 0) {
        $logger.info(`No changes found for ${name}`)
        return
    }
    _.each(migration.consoleOut, (v) => { $logger.warn("MIGRATION " + v) })

    if (mname) {
        currentState.revision = previousState.revision + 1
        let info = migrate.writeMigration(currentState, migration, dbMigrationsDir, mname)
        $logger.info(`Migration ${info.file} has been saved`)
    }

}

async function execute(sequelize, name, migrationsDir, migrationModel) {
    const umzug = new Umzug({
        migrations: {
            path: `${migrationsDir}/${name}`,
            pattern: /\.js$/,
            params: [
                sequelize.getQueryInterface(),
                _.bind($logger.debug, $logger)
            ]
        },
        storage: 'sequelize',
        storageOptions: {
            sequelize,
            modelName: migrationModel,
            tableName: _.snakeCase(migrationModel)
        },
        logging: msg => $logger.debug(msg)
    })
    try {
        await umzug.up();
    } catch (e) {
        $logger.error(`Fails to migrate database ${name}`, e)
    }

}

module.exports = {
    generate,
    execute
}