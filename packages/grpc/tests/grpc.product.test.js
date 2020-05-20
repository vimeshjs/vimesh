const {timeout} = require('@vimesh/utils')
const { createGrpcClient, GrpcStatus } = require('..')

const server = require('./grpcProductServer')

let client = createGrpcClient({
    path: __dirname + '/services/product',
    url: 'localhost:2000'
})
beforeAll(() => {
    return timeout('3s')
}) 
afterAll(() => {
    server.forceShutdown()
})
test('find all', (done) => {
    client.ProductService.listProducts(null, (err, result) => {
        expect(result.products.length).toBe(3)
        expect(result.products[2].name).toBe('prod three')
        done()
    })
})

test('find id=2', (done) => {
    client.ProductService.readProduct({ id: 2 }, (err, result) => {
        expect(result.id).toBe(2)
        expect(result.name).toBe('prod two')
        done()
    })
})


test('add name=added', (done) => {
    client.ProductService.createProduct({ name: 'added' }, (err, r1) => {
        expect(r1.status).toBe('success')
        client.ProductService.readProduct({ id: 1001 }, (err, r2) => {
            expect(r2.id).toBe(1001)
            expect(r2.name).toBe('added')
            done()
        })
    })
})

test('update name=updated', (done) => {

    client.ProductService.updateProduct({ id: 1001, name: 'updated' }, (err, r1) => {
        expect(r1.status).toBe('success')
        client.ProductService.readProduct({ id: 1001 }, (err, r2) => {
            expect(r2.id).toBe(1001)
            expect(r2.name).toBe('updated')
            done()
        })
    })
})

test('delete is not implemented', (done) => {
    client.ProductService.deleteProduct({ id: 1001 }, (ex) => {
        expect(ex.code).toBe(GrpcStatus.UNIMPLEMENTED)
        done()
    })
})
