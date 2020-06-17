const _ = require('lodash')
const { duration } = require('@vimesh/utils')
const sinon = require('sinon')

const clock = sinon.useFakeTimers({
    now: new Date(),
    shouldAdvanceTime: true
})

const COUNT = 10000
const { setupLogger } = require('@vimesh/logger')
const { GrpcStatus } = require('@vimesh/grpc')
const { setupMongoDB } = require('@vimesh/mongodb')
const { setupDiscoveryService, createKeyValueClient } = require('..')
setupLogger()

setupMongoDB({
    databases: {
        main: {
            uri: "mongodb://localhost/unit_test"
        }
    }
})

let server = setupDiscoveryService({
    port: 2001,
    type: 'mongodb',
    database: 'main'
})
let kvClient = createKeyValueClient({ url: 'localhost:2001' })
beforeAll(() => {
    return $mongodb.connected
})

test('set', () => {
    return Promise.all([
        kvClient.set("name", 'jacky'),
        kvClient.set("all/users/jacky", { email: "jacky@gmail.com" }),
        kvClient.set("all/users/tommy", { email: 'tommy@test.com' }),
        kvClient.set("menus/account", 'company1'),
    ]).then(rs => {
        expect(rs[0]).toBeTruthy()
    })
})
test('get', () => {
    return kvClient.get('name').then(r => {
        expect(r).toBe('jacky')
        return kvClient.get('all/users*')
    }).then(r => {
        expect(r['all/users/jacky']).toEqual({ email: "jacky@gmail.com" })
        expect(r['all/users/tommy']).toEqual({ email: 'tommy@test.com' })

    })
})
test('keys & del', () => {
    return kvClient.keys('all/').then(keys => {
        expect(_.sortBy(keys)).toEqual(_.sortBy(['all/users/jacky', 'all/users/tommy']))
        return kvClient.del('all/users/tommy')
    }).then(r => {
        return kvClient.keys('all/').then(keys => {
            expect(keys).toEqual(['all/users/jacky'])
        })
    })
})
test('set with duration', () => {
    return kvClient.set("name", 'tommy', { duration: '10s' })
        .then(r => {
            return kvClient.get('name').then(r => {
                expect(r).toBe('tommy')
                clock.tick(duration('20s'))
            })
        }).then(r => {
            return kvClient.get('name').then(r => {
                expect(r).toBeNull()
            })
        })
})

test('many set', () => {
    let tasks = []
    for (let i = 0; i < COUNT; i++) {
        tasks.push(kvClient.set(`many/users/u${i}`, { email: `u${i}@gmail.com` }))
    }
    return Promise.all(
        tasks
    ).then(rs => {
        expect(rs[0]).toBeTruthy()
    })
}, 1000 * 60)
test('many get', () => {
    let tasks = []
    for (let i = 0; i < COUNT; i++) {
        tasks.push(kvClient.get(`many/users/u${i}`))
    }
    return Promise.all(
        tasks
    ).then(rs => {
        expect(rs[0].email).toBe(`u0@gmail.com`)
        expect(rs[COUNT - 1].email).toBe(`u${COUNT - 1}@gmail.com`)
    })
}, 1000 * 60)


test('get after server shutdown', () => {
    server.forceShutdown()
    return kvClient.get({ key: 'name' }).catch(ex => {
        expect(ex.code).toBe(GrpcStatus.INTERNAL)
    })
})

