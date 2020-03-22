require('./fixture.js')

const { getObjectID } = require('../utils')
beforeAll(function () {
    let cid = getObjectID()
    let didp1 = getObjectID()
    let didp2 = getObjectID()
    let didc11 = getObjectID()
    let didc12 = getObjectID()
    let didc21 = getObjectID()
    let didc22 = getObjectID()
    return $mongodb.connected.then(() => {
        return Promise.all(
            [
                $models.Users.remove({}),
                $models.Companies.remove({}),
                $models.Roles.remove({}),
                $models.Departments.remove({}),
            ]
        )
    }).then(() => {
        return Promise.all(
            [
                $dao.Roles.set({ _id: 'r1', permissions: ['p1'] }),
                $dao.Roles.set({ _id: 'r2', permissions: ['p2'] }),
                $dao.Companies.set({ _id: cid, name: 'test company', sub_deps: [didp1, didp2] }),
                $dao.Departments.set([
                    { _id: didp1, name: 'p1', sub_deps: [didc11, didc12] },
                    { _id: didp2, name: 'p2', sub_deps: [didc21, didc22] },
                    { _id: didc11, name: 'c11' },
                    { _id: didc12, name: 'c12' },
                    { _id: didc21, name: 'c21' },
                    { _id: didc22, name: 'c22' }
                ]),
                $dao.Departments.set([
                    { name: 'set1' },
                    { name: 'set2' }
                ]),
                $dao.Departments.add([
                    { name: 'add1' },
                    { name: 'add2' }
                ]),
                $dao.Departments.add({ name: 'add3' }),
                $dao.Users.set({ _id: 'test', company_id: cid.toString(), roles: ['r1', 'r2'], email: 'test@test.com' })
            ]
        )
    })
}, 1000 * 60)
test('user join company', function () {
    return $dao.Users.select({ cond: { _id: 'test' } }).then(r => {
        all = r.data
        //console.log(all)
        return $dao.Users.join(all,
            'company_id > company : Companies',
            'company_id > comp_name : Companies/name',
            'roles > fullRoles : Roles',
            'company.sub_deps > deps : Departments',
            'company.deps.sub_deps > deps : Departments').then(all => {
                //console.log(JSON.stringify(all, null, 2))
                expect(all[0].company && all[0].company.name).toBe('test company')
                expect(all[0].fullRoles.length).toBe(2)
                expect(all[0].fullRoles[1]._id).toBe('r2')

                expect(all[0].company.deps[0].name).toBe('p1')
                expect(all[0].company.deps[0].deps[1].name).toBe('c12')
            })
    })
})