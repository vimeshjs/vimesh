require('./fixture.js')
beforeAll(async function () {
    await $mongodb.connected
})
test('create user', async function () {
    await $dao.Users.save({ _id: 'u001', email: 'u001@email.com' })
    await $dao.Users.save({ _id: 'idToDelete', email: 'idToDelete@email.com' })
    let u1 = await $dao.Users.get('u001')
    expect(u1.email).toBe('u001@email.com')
    let ud = await $dao.Users.get('idToDelete')
    expect(ud.email).toBe('idToDelete@email.com')
    let r = await $dao.Users.recycle('idToDelete')
    expect(r.ok).toBe(1)
    expect(r.data._id).toBe('idToDelete')
    ud = await $dao.Users.get('idToDelete')
    expect(ud).toBeNull()
})
test('set user email', async function () {
    await $dao.Users.set('u001', { email: 'u001.modified@email.com', name: 'test 001' })
    let u1 = await $dao.Users.get('u001')
    expect(u1.email).toBe('u001.modified@email.com')
    await $dao.Users.set('u001', { $unset: { email: 1 } })
    u1 = await $dao.Users.get('u001')
    expect(u1.email).toBeUndefined()
    expect(u1.name).toBe('test 001')
})
test('get permissions', async function () {
    await $dao.Users.set('u001',
        {
            roles: ['special'],
            departments: [{ id: 2, position: '总监' }, { id: 3, position: '组长' }]
        })
    await $dao.Roles.set('special', { permissions: ['sp-read'] })
    await $dao.Roles.set('gl', { permissions: ['project-read', 'project-write'] })
    await $dao.Roles.set('dir', { permissions: ['report1', 'revenue-adjust'] })
    await $dao.Departments.set(2, { name: '研发部', positions: [{ name: '总监', role: 'dir' }, { name: '副总监', role: 'dir' }] })
    await $dao.Departments.set(3, { name: '项目一组', positions: [{ name: '组长', role: 'gl' }] })

    let perms = await $dao.Users.getPermissions('u001')
    console.log(perms)
    expect(perms.sort()).toEqual([
        'report1',
        'revenue-adjust',
        'project-read',
        'project-write',
        'sp-read'
    ].sort())
})
test('insert user', async function () {
    let user = { email: 'myemail@company.com' }
    await $dao.Users.add(user)
    expect(await $dao.Users.get(user._id)).toEqual(user)
})
test('list all users', async function () {
    let users = await $dao.Users.select()
    expect(users.data.length).toBe(2)
})