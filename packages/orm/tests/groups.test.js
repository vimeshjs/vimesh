const _ = require('lodash')
const { Op } = require("sequelize");
require('./fixture.js')
beforeAll(async function () {
    await $orm.connected
}, 1000 * 60)

test('native way for groups and roles', async function () {
    const { Group, Role, toJson: J } = $orm.dao

    let r1 = await Role.add({ name: 'r1', permissions: ['p1', 'p2'] })
    let r2 = await Role.add({ name: 'r2', permissions: ['p3', 'p2'] })
    let r3 = await Role.add({ name: 'r3', permissions: ['p3', 'p4', 'p5'] })

    let g1 = await Group.add({ name: 'group1', roles: [r1.id, r2.id] })
    let g2 = await Group.add({ name: 'group2', roles: [2, 3] })
    await Group.set({ id: g2.id, roles: [1, 2] })
    let g = await Group.get(2)
    expect(_.map(g.roles, r => r.id)).toEqual([1, 2])

})

test('new way for groups and roles', async function () {
    const { Group } = $orm.dao

    let g3 = await Group.add({ name: 'group3' })
    await Group.set({ id: g3.id, roles: [1, 3] })
    let g = await Group.get(g3.id)
    expect(_.map(g.roles, r => r.id)).toEqual([1, 3])

})