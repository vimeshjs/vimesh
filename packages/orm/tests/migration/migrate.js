#!/usr/bin/env node
const _ = require('lodash')
const commandLineArgs = require('command-line-args')
const { setupLogger } = require('@vimesh/logger')
const { setupOrm } = require('@vimesh/orm')

const optionDefinitions = [
    { name: 'checkpoint', alias: 'c', type: String, description: 'Create migration checkpoint' },
    { name: 'execute', alias: 'x', type: Boolean, description: 'Execute pending migrations' },
    { name: 'help', alias: 'h', type: Boolean, description: 'Show help' }
]

const options = commandLineArgs(optionDefinitions)

if (options.help) {
    optionDefinitions.forEach((option) => {
        let alias = (option.alias) ? ` (-${option.alias})` : '\t';
        console.log(`\t --${option.name}${alias} \t${option.description}`);
    });
    process.exit(0);
}
const config = {
    databases: {
        main: {
            uri: `sqlite:${__dirname}/mnt/test.db`,
            debug: true,
            migration: {
                checkpoint: options.checkpoint,
                execute: options.execute
            }
        }
    }
}
setupLogger({ debug: true, console: {} })
setupOrm(config, `${__dirname}/models`, `${__dirname}/migrations`)
