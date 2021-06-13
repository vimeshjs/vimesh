const _ = require('lodash')
const { Op } = require("sequelize");
require('./fixture.js')
beforeAll(async function () {
    await $orm.connected
}, 1000 * 60)

test('create role', async function () {
    const { Role } = $orm.dao
    let r = await Role.add({ name: 'r1', permissions: ['p1', 'p2'] })
    await expect(async () => {
        await Role.add({ id: r.id, name: 'r2', permissions: ['p3', 'p2'] })
    }).rejects.toThrow()
    let id = r.id
    r = await Role.get(id)
    await Role.set({ id, name: 'r1-modified' })
    r = await Role.get(id)
    //console.log(JSON.stringify(r, null, 2))
    expect(r.name).toBe('r1-modified')
    expect(r.permissions).toEqual(['p1', 'p2'])
    let r2 = await Role.add({ id: 100, name: 'r2', permissions: ['p3', 'p2'] })
    let r3 = await Role.add({ name: 'r3', permissions: ['p1', 'p2'] })
    expect(r2.id).toBe(100)
    expect(r3.id).toBe(101)
})