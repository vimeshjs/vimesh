const _ = require('lodash')
const { Op } = require("sequelize");
require('./fixture.js')
beforeAll(function () {
    return $orm.connected.then(() => {

        return Promise.all(
            [
                $orm.models.Users.sync({ force: true })
            ]
        )

    })
}, 1000 * 60)

test('create user', async function () {
    await $orm.dao.Users.add({ id: 'u001', email: 'u001@email.com' })
    let r = await $orm.dao.Users.get('u001')
    expect(r.email).toBe('u001@email.com')
})

test('set user email', async function () {
    await $orm.dao.Users.set({ id: 'u001', email: 'u001.modified@email.com', name: 'test 001' })
    let r = await $orm.dao.Users.get('u001')
    expect(r.email).toBe('u001.modified@email.com')
    await $orm.dao.Users.set({ id: 'u001', email: null })
    r = await $orm.dao.Users.get('u001')
    expect(r.email).toBeNull()
    expect(r.name).toBe('test 001')
})

test('insert user', async function () {
    let user = { id: 'new', email: 'myemail@company.com' }
    await $orm.dao.Users.add(user)
    let r = await $orm.dao.Users.get(user.id)
    expect(_.pick(r, 'email', 'id')).toEqual(user)
})

test('upsert user', async function () {
    let user = { id: 'u002', email: 'myemail@company.com' }
    let r = await $orm.dao.Users.set(user)
    r = await $orm.dao.Users.get('u002')
    expect(_.pick(r, 'email', 'id')).toEqual(user)
})

test('delete user', async function () {
    let r = await $orm.dao.Users.get('new')
    expect(r.id).toEqual('new')
    await $orm.dao.Users.delete({ id: 'new' })
    r = await $orm.dao.Users.get('new', {})
    expect(r).toBeNull()
    await $orm.dao.Users.restore({ id: 'new' })
    r = await $orm.dao.Users.get('new')
    expect(r).toBeNull()
    let count = await $orm.dao.Users.count()
    expect(count).toEqual(2)

    await $orm.dao.Users.recycle({ id: 'u001' })
    r = await $orm.dao.Users.get('u001')
    expect(r).toBeNull()
    count = await $orm.dao.Users.count()
    expect(count).toEqual(1)
    count = await $orm.dao.Users.count({}, { paranoid: false })
    expect(count).toEqual(2)
    await $orm.dao.Users.restore({ id: 'u001' })
    r = await $orm.dao.Users.get('u001')
    expect(r.id).toEqual('u001')
    count = await $orm.dao.Users.count()
    expect(count).toEqual(2)
})


test('find users', async function () {
    const { Users } = $orm.dao
    await Users.set({ id: 'u001', no: 1, resume: 'name : 111' })
    await Users.set({ id: 'u002', no: 2, resume: 'name : 222'  })
    await Users.add({ id: 'u003', email: '3@company.com', no: 3, blocked: true })
    await Users.add({ id: 'u004', email: '4@company.com', no: 4, blocked: true })
    await Users.add({ id: 'u005', email: '5@company.com', no: 5, blocked: true })
    await Users.add({ id: 'u006', email: '6@company.com', no: 6 })
    await Users.add({ id: 'u007', email: '7@company.com', no: 7 })
    await Users.add({ id: 'u008', email: '8@company.com', no: 8 })
    await Users.recycle({ id: 'u004' })

    let r = await Users.select()
    expect(r.data.length).toEqual(7)
    r = await Users.select({ cond: { blocked: true }, count: true, skip: 1, limit: 2, sort: [['email', 'DESC']] }, { paranoid: false })

    expect(r.count).toEqual(3)
    expect(r.data.length).toEqual(2)
    expect(r.data[0].email).toEqual('4@company.com')


    r = await Users.select({ cond: { no: [3, 6, 8, 4, 100] } })
    expect(r.data.length).toEqual(3)

    let cond = { $or: [{ no: { $eq: 7 } }, { email: { $like: '8%' } }] }
    r = await Users.select({ cond, sort: [['no', 'DESC']] }, {debug: true})
    expect(r.data.length).toEqual(2)
    expect(r.data[0].no).toEqual(8)
    expect(r.data[1].no).toEqual(7)
})
