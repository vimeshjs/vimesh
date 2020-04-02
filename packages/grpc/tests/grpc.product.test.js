
const { createGrpcClient, GrpcStatus } = require('..')

const server = require('./grpcProductServer')

let client = createGrpcClient({
    path: __dirname + '/services/product/product.proto',
    url: 'localhost:2000'
})

afterAll(() => {
    server.forceShutdown()
})
test('find all', () => {
    return client.listProducts().then(result => {
        expect(result.products.length).toBe(3)
        expect(result.products[2].name).toBe('prod three')
    })
})

test('find id=2', () => {
    return client.readProduct({ id: 2 }).then(result => {
        expect(result.id).toBe(2)
        expect(result.name).toBe('prod two')
    })
})


test('add name=added', () => {
    return client.createProduct({ name: 'added' }).then(r1 => {
        expect(r1.status).toBe('success')
        return client.readProduct({ id: 1001 }).then(r2 => {
            expect(r2.id).toBe(1001)
            expect(r2.name).toBe('added')
        })
    })
})

test('update name=updated', () => {

    return client.updateProduct({ id: 1001, name: 'updated' }).then( r1 => {
        expect(r1.status).toBe('success')
        return client.readProduct({ id: 1001 }).then(r2 => {
            expect(r2.id).toBe(1001)
            expect(r2.name).toBe('updated')
        })
    })

})

test('delete is not implemented', () => {
    return client.deleteProduct({ id: 1001 }).catch(ex => {
        expect(ex.code).toBe(GrpcStatus.UNIMPLEMENTED)
    })
})
