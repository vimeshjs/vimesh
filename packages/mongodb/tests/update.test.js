global.extraConfig = {
    onBeforeSetup() {
        return Promise.all([
            $dao.Ids.delete($dao.Orders.getAutoIdName()),
            $models.Orders.remove({})
        ])
    }
}
require('./fixture.js')
const Promise = require('bluebird')
const { getObjectID } = require('../utils')
const didp1 = getObjectID()
const didp2 = getObjectID()
const didc11 = getObjectID()
const didc12 = getObjectID()
const didc21 = getObjectID()
const didc22 = getObjectID()
beforeAll(function () {
    return $mongodb.connected.then(() => {
        return Promise.all(
            [
                $models.Departments.remove({})
            ]
        )
    })
}, 1000 * 60)
test('set departments', function () {

    return Promise.all(
        [
            $dao.Departments.set([
                { _id: didp1, name: 'p1', sub_deps: [didc11, didc12] },
                { _id: didp2, name: 'p2', sub_deps: [didc21, didc22] },
                { _id: didc11, name: 'c11' },
                { _id: didc12, name: 'c12' },
                { _id: didc21, name: 'c21' },
                { _id: didc22, name: 'c22' }
            ]),
            $dao.Departments.set([
                { name: 'set1', enabled: false },
                { name: 'set2' }
            ]),
            $dao.Departments.add([
                { name: 'add1' },
                { name: 'add2', enabled: false }
            ])
        ]
    ).then(r => {
        return $dao.Departments.get(didc21).then(r => {
            expect(r.name).toBe('c21')
        }).then(r => {
            return $dao.Departments.get({ name: 'add2' }).then(r => {
                expect(r.name).toBe('add2')
                expect(r.enabled).toBeFalsy()
            })
        })
    })
})

test('use $when$ with set', function () {
    return $dao.Departments.set({
        _id: false,
        $when$: { name: 'add2' },
        enabled: true
    }).then(r => {
        return $dao.Departments.get({ name: 'add2' }).then(r => {
            expect(r.name).toBe('add2')
            expect(r.enabled).toBeTruthy()
        })
    }).then(r => {
        return $dao.Departments.set({
            _id: didc22,
            name: 'protect me',
            enabled: true
        })
    }).then(r => {
        return $dao.Departments.get(didc22).then(r => {
            expect(r.name).toBe('protect me')
            expect(r.enabled).toBeTruthy()
        })
    }).then(r => {
        return $dao.Departments.set({
            _id: didc22,
            $when$: { enabled: false },
            name: 'you can not change me'
        })
    }).then(r => {
        return $dao.Departments.get(didc22).then(r => {
            expect(r.name).toBe('protect me')
            expect(r.enabled).toBeTruthy()
        })
    })
})

test('use empty _id with set', function () {
    return Promise.each([
        $dao.Orders.set({ user_name: 'Tom' }),
        $dao.Orders.set({ _id: '', user_name: 'Peter' }),
        $dao.Orders.set({ _id: null, user_name: 'Jacky' })
    ], r => r).then(rs => {
        return Promise.each([
            $dao.Orders.get({ user_name: 'Tom' }),
            $dao.Orders.get({ user_name: 'Peter' }),
            $dao.Orders.get({ user_name: 'Jacky' })
        ], r => r)
    }).then(rs => {
        expect(rs[0]._id).toBe(1000)
        expect(rs[1]._id).toBe(1001)
        expect(rs[2]._id).toBe(1002)
    })
})