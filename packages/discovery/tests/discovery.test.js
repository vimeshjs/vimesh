const _ = require('lodash')
const { setupLogger } = require('@vimesh/logger')
const { GrpcStatus } = require('@vimesh/grpc')
const { setupDiscoveryService, createKeyValueClient } = require('..')
setupLogger()
let server = setupDiscoveryService({ port: 2000 })
let kvClient = createKeyValueClient({ url: 'localhost:2000' })
test('set', () => {
    return Promise.all([
        kvClient.set({ key: "name", value: 'jacky' }),
        kvClient.set({ key: "all/users/jacky", value: JSON.stringify({ email: "jacky@gmail.com" }) }),
        kvClient.set({ key: "all/users/tommy", value: JSON.stringify({ email: 'tommy@test.com' }) }),
        kvClient.set({ key: "menus/account", value: 'company1' }),
    ]).then(rs => {
        expect(rs[0]).toBeTruthy()
    })
})
test('get', () => {
    return kvClient.get({ key: 'name' }).then(r => {
        expect(r.data.name).toBe('jacky')
        return kvClient.get({ key: 'all/users', recurse: true })
    }).then(r => {
        expect(r.data['all/users/jacky']).toBe(JSON.stringify({ email: "jacky@gmail.com" }))
        expect(JSON.parse(r.data['all/users/tommy'])).toEqual({ email: 'tommy@test.com' })

    })
})
test('keys & del', () => {
    return kvClient.keys({ key: 'all/' }).then(r => {
        expect(_.sortBy(r.keys)).toEqual(_.sortBy(['all/users/jacky', 'all/users/tommy']))
        return kvClient.del({ key: 'all/users/tommy' })
    }).then(r => {
        return kvClient.keys({ key: 'all/' }).then(r => {
            expect(r.keys).toEqual(['all/users/jacky'])
        })
    })
})

test('get after server shutdown', () => {
    server.forceShutdown()
    return kvClient.get({ key: 'name' }).catch(ex => {
        expect(ex.code).toBe(GrpcStatus.UNAVAILABLE)
    })
})