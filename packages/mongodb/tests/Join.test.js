require('./fixture.js')

const { getObjectID } = require('../utils')
beforeAll(async function () {
    let cid = getObjectID()
    let didp1 = getObjectID()
    let didp2 = getObjectID()
    let didc11 = getObjectID()
    let didc12 = getObjectID()
    let didc21 = getObjectID()
    let didc22 = getObjectID()
    await $mongodb.connected
    await $dao.Roles.set({ _id: 'r1', permissions: ['p1'] })
    await $dao.Roles.set({ _id: 'r2', permissions: ['p2'] })
    await $dao.Companies.set({ _id: cid, name: 'test company', sub_deps: [didp1, didp2] })
    await $dao.Departments.set([
        { _id: didp1, name: 'p1', sub_deps: [didc11, didc12] },
        { _id: didp2, name: 'p2', sub_deps: [didc21, didc22] },
        { _id: didc11, name: 'c11' },
        { _id: didc12, name: 'c12' },
        { _id: didc21, name: 'c21' },
        { _id: didc22, name: 'c22' }
    ])
    await $dao.Departments.set([
        { name: 'set1' },
        { name: 'set2' }
    ])
    await $dao.Departments.add([
        { name: 'add1' },
        { name: 'add2' }
    ])
    await $dao.Departments.add({ name: 'add3' })
    await $dao.Users.set({ _id: 'test', company_id: cid.toString(), roles: ['r1', 'r2'], email: 'test@test.com' })

})
test('user join company', async function () {
    let { data: all } = await $dao.Users.select({
        cond: { _id: 'test' }, join: [
            'company_id > company : Companies',
            'company_id > comp_name : Companies/name',
            'roles > fullRoles : Roles',
            'company.sub_deps > deps : Departments',
            'company.deps.sub_deps > deps : Departments'
        ]
    })

    //console.log(JSON.stringify(all, null, 2))
    expect(all[0].company && all[0].company.name).toBe('test company')
    expect(all[0].fullRoles.length).toBe(2)
    expect(all[0].fullRoles[1]._id).toBe('r2')

    expect(all[0].company.deps[0].name).toBe('p1')
    expect(all[0].company.deps[0].deps[1].name).toBe('c12')
})