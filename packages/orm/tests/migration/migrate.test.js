const _ = require('lodash')
const { Op } = require("sequelize");
const { setupLogger } = require('@vimesh/logger')
const { setupOrm } = require('@vimesh/orm')
const config = {
    databases: {
        main: {
            uri: `sqlite:${__dirname}/mnt/test.db`,
            debug: true,
            //sync: true,
            migration: {
                execute: true
            }
        }
    }
}
setupLogger({ level: 'debug', console: {} })
setupOrm(config, `${__dirname}/models`, `${__dirname}/migrations`)
//setupOrm(config, `${__dirname}/models`)

beforeAll(async function () {
    await $orm.connected
}, 1000 * 60)

test('create user', async function () {
    const {User} = $orm.dao
    let u = await User.get(1)
    expect(u.blocked).toBe(false)
})
