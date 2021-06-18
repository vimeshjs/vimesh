const _ = require('lodash')
const { Op } = require("sequelize");
require('./fixture.js')

beforeAll(async function () {
    await $orm.connected
}, 1000 * 60)

test('create user', async function () {
    const { User } = $orm.dao
    await User.add({ id: 'u001', email: 'u001@email.com' })
    let r = await User.get('u001')
    expect(r.email).toBe('u001@email.com')
})

test('set user email', async function () {
    const { User } = $orm.dao
    await User.set({ id: 'u001', email: 'u001.modified@email.com', name: 'test 001' })
    let r = await User.get('u001')
    expect(r.email).toBe('u001.modified@email.com')
    await User.set({ id: 'u001', email: null })
    r = await User.get('u001')
    expect(r.email).toBeNull()
    expect(r.name).toBe('test 001')
})

test('insert user', async function () {
    const { User } = $orm.dao
    let user = { id: 'new', email: 'new@company.com' }
    await User.add(user)
    let r = await User.get(user.id)
    expect(_.pick(r, 'email', 'id')).toEqual(user)
})

test('upsert user', async function () {
    const { User } = $orm.dao
    let user = { id: 'u002', email: 'u002@company.com' }
    let r = await User.set(user)
    r = await User.get('u002')
    expect(_.pick(r, 'email', 'id')).toEqual(user)
})

test('delete user', async function () {
    const { User } = $orm.dao
    let r = await User.get('new')
    expect(r.id).toEqual('new')
    await User.delete({ id: 'new' })
    r = await User.get('new', {})
    expect(r).toBeNull()
    await User.restore({ id: 'new' })
    r = await User.get('new')
    expect(r).toBeNull()
    let count = await User.count()
    expect(count).toEqual(2)

    await User.recycle({ id: 'u001' })
    r = await User.get('u001')
    expect(r).toBeNull()
    count = await User.count()
    expect(count).toEqual(1)
    count = await User.count({}, { paranoid: false })
    expect(count).toEqual(2)
    await User.restore({ id: 'u001' })
    r = await User.get('u001')
    expect(r.id).toEqual('u001')
    count = await User.count()
    expect(count).toEqual(2)
})


test('find users', async function () {
    const { User } = $orm.dao
    await User.set({ id: 'u001', no: 1, resume: 'name : 111' })
    await User.set({ id: 'u002', no: 2, resume: 'name : 222' })
    await User.add({ id: 'u003', email: '3@company.com', no: 3, blocked: true })
    await User.add({ id: 'u004', email: '4@company.com', no: 4, blocked: true })
    await User.add({ id: 'u005', email: '5@company.com', no: 5, blocked: true })
    await User.add({ id: 'u006', email: '6@company.com', no: 6 })
    await User.add({ id: 'u007', email: '7@company.com', no: 7 })
    await User.add({ id: 'u008', email: '8@company.com', no: 8 })
    await User.recycle({ id: 'u004' })

    let r = await User.select()
    expect(r.data.length).toEqual(7)
    r = await User.select({ cond: { blocked: true }, count: true, skip: 1, limit: 2, sort: [['email', 'DESC']] }, { paranoid: false })

    expect(r.count).toEqual(3)
    expect(r.data.length).toEqual(2)
    expect(r.data[0].email).toEqual('4@company.com')


    r = await User.select({ cond: { no: [3, 6, 8, 4, 100] } })
    expect(r.data.length).toEqual(3)

    let cond = { $or: [{ no: { $eq: 7 } }, { email: { $like: '8%' } }] }
    r = await User.select({ cond, sort: [['no', 'DESC']] })
    //console.log(r.data)
    expect(r.data.length).toEqual(2)
    expect(r.data[0].no).toEqual(8)
    expect(r.data[1].no).toEqual(7)
})


test('1:m association between user and actions', async function () {
    let { User, UserAction } = $orm.dao
    // use Sequelize native methods to create
    let ua = await UserAction.add({ action: 'GET', data: { request: { param1: "val1" }, response: { content: { ok: 1 } } } })
    await UserAction.set({ id: ua.id, userId: 'u001' })
    ua = await UserAction.get(ua.id)
    expect(ua.user.id).toBe('u001')

    // directly set associated foreign key
    let ua2 = await UserAction.add({ userId: 'u002', action: 'GET', data: { request: { param1: "val2" }, response: { content: { ok: 1 } } } })
    expect(ua2.user).toBeUndefined()
    expect(ua2.userId).toBe('u002')
    ua = await UserAction.get(ua2.id)
    expect(ua.user.id).toBe('u002')

    let u2 = await User.get('u002')
    expect(u2.actions).toBeUndefined
    u2 = await User.get('u002', { include: ['actions'] })
    expect(u2.actions[0].data.request.param1).toBe('val2')
})

test('1:1 association between user and resume', async function () {
    let { User, Resume } = $orm.dao

    await Resume.add({ ownerId: 'u001', content: 'this is 001' })
    let u = await User.get('u001')
    expect(u.resume.content).toBe('this is 001')

    let r2 = await Resume.add({ content: 'this is 002' })
    await User.set({ id: 'u002', resume: r2.id })
    u = await User.get('u002')
    expect(u.resume.content).toBe('this is 002')
    r2 = await Resume.get(r2.id)
    expect(r2.owner.id).toBe('u002')

    let rn = await Resume.add({ content: 'this is new' })
    await User.set({ id: 'u002', resume: rn.id })
    u = await User.get('u002')
    expect(u.resume.content).toBe('this is new')
    r2 = await Resume.get(r2.id)
    expect(r2.owner).toBeNull()
})

test('user password', async function () {
    let { User } = $orm.dao
    await User.setPlainPassword('u005', 'pass5')
    await User.setPlainPassword('u006', 'passxxxx')
    expect(await User.authenticate('u005', 'pass5')).toBe(true)
    expect(await User.authenticate('u006', 'pass6')).toBe(false)
    expect(await User.authenticate('u006', 'passxxxx')).toBe(true)
})