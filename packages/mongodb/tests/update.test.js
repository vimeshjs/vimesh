require('./fixture.js')
const Promise = require('bluebird')
const { getObjectID } = require('../utils')
const didp1 = getObjectID()
const didp2 = getObjectID()
const didc11 = getObjectID()
const didc12 = getObjectID()
const didc21 = getObjectID()
const didc22 = getObjectID()
beforeAll(async function () {
    await $mongodb.connected
})
test('set departments', async function () {
    await $dao.Departments.set([
        { _id: didp1, name: 'p1', sub_deps: [didc11, didc12] },
        { _id: didp2, name: 'p2', sub_deps: [didc21, didc22] },
        { _id: didc11, name: 'c11' },
        { _id: didc12, name: 'c12' },
        { _id: didc21, name: 'c21' },
        { _id: didc22, name: 'c22' }
    ])
    await $dao.Departments.set([
        { name: 'set1', enabled: false },
        { name: 'set2' }
    ])
    await $dao.Departments.add([
        { name: 'add1' },
        { name: 'add2', enabled: false }
    ])
    let d1 = await $dao.Departments.get(didc21)
    expect(d1.name).toBe('c21')
    let d2 = await $dao.Departments.get({ name: 'add2' })
    expect(d2.name).toBe('add2')
    expect(d2.enabled).toBeFalsy()
})

test('use $when$ with set', async function () {
    await $dao.Departments.set({
        _id: false,
        $when$: { name: 'add2' },
        enabled: true
    })
    let d = await $dao.Departments.get({ name: 'add2' })
    expect(d.name).toBe('add2')
    expect(d.enabled).toBeTruthy()

    await $dao.Departments.set({
        _id: didc22,
        name: 'protect me',
        enabled: true
    })
    d = await $dao.Departments.get(didc22)
    expect(d.name).toBe('protect me')
    expect(d.enabled).toBeTruthy()

    await $dao.Departments.set({
        _id: didc22,
        $when$: { enabled: false },
        name: 'you can not change me'
    })
    d = await $dao.Departments.get(didc22)
    expect(d.name).toBe('protect me')
    expect(d.enabled).toBeTruthy()
})

test('use empty _id with set', async function () {
    let i
    const users = [
        { user_name: 'Tom' },
        { _id: '', user_name: 'Peter' },
        { _id: null, user_name: 'Jacky' }
    ]
    let foundUsers = []
    for (i = 0; i < users.length; i++) {
        let user = users[i]
        await $dao.Orders.set(user)
    }
    for (i = 0; i < users.length; i++) {
        let user = users[i]
        foundUsers[i] = await $dao.Orders.get({ user_name: user.user_name })
    }
    expect(foundUsers[0]._id).toBe(1000)
    expect(foundUsers[1]._id).toBe(1001)
    expect(foundUsers[2]._id).toBe(1002)
})