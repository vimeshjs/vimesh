const _ = require('lodash')
const { Op } = require("sequelize");
require('./fixture.js')

beforeAll(async function () {
    await $orm.connected
}, 1000 * 60)

test('group users', async function () {
    const { User } = $orm.dao
    await User.set({ id: 'u001', no: 1, resume: 'name : 111', department: 'DepA' })
    await User.set({ id: 'u002', no: 2, resume: 'name : 222', department: 'DepB' })
    await User.add({ id: 'u003', email: '3@company.com', no: 3, blocked: true, department: 'DepC' })
    await User.add({ id: 'u004', email: '4@company.com', no: 4, blocked: true, department: 'DepA' })
    await User.add({ id: 'u005', email: '5@company.com', no: 5, blocked: true, department: 'DepA' })
    await User.add({ id: 'u006', email: '6@company.com', no: 6, department: 'DepB' })
    await User.add({ id: 'u007', email: '7@company.com', no: 7, department: 'DepB' })
    await User.add({ id: 'u008', email: '8@company.com', no: 8, department: 'DepC' })

    let r = await User.select({}, {
        attributes: ['department as dep', 'blocked', 'count(id) as count', 'max(no) as maxNo'],
        group: ['department', 'blocked']
    })
    expect(r.data).toEqual([
        { dep: 'DepA', blocked: null, count: 1, maxNo: 1 },
        { dep: 'DepA', blocked: true, count: 2, maxNo: 5 },
        { dep: 'DepB', blocked: null, count: 3, maxNo: 7 },
        { dep: 'DepC', blocked: null, count: 1, maxNo: 8 },
        { dep: 'DepC', blocked: true, count: 1, maxNo: 3 }
    ])
})

