const _ = require('lodash')
const fs = require('fs')
const glob = require('glob')
const { createStorage } = require('..')
const root = `${__dirname}/d1/d2/d3`
let storage = null
function removeAll(dir) {
    let fns = glob.sync(`${dir}/**`)
    _.each(_.reverse(fns), function (fn) {
        let stat = fs.statSync(fn)
        if (stat.isFile()) {
            fs.unlinkSync(fn)
        } else {
            fs.rmdirSync(fn)
        }
    })
}
beforeAll(() => {
    removeAll(`${__dirname}/d1`)
    storage = createStorage({ root })
})
test('auto create root folder', function () {
    expect(fs.existsSync(root)).toBeTruthy()
})

test('create buckets', function () {
    return storage.createContainer('bucket-001', {}).then(() => {
        return storage.isContainer('bucket-001').then(r => {
            expect(r).toBeTruthy()
            return storage.isContainer('bucket-xxx')
        }).then(r => {
            expect(r).toBeFalsy()
            return storage.createContainer('bucket-002').then(r => storage.isContainer('bucket-002'))
        }).then(r => {
            expect(r).toBeTruthy()
        })
    })
})

test('list buckets', function () {
    return storage.listContainers().then(rs => {
        expect(rs).toEqual(['bucket-001', 'bucket-002'])
    })
})

test('get and put object', function () {
    return storage.putObject('bucket-001', 'folder1/a.txt', 'Hi this is a').then(r => {
        return storage.getObjectAsString('bucket-001', 'folder1/a.txt').then(r => {
            expect(r).toBe('Hi this is a')
            expect(storage.getObject('bucket-003', 'folder1/a.txt')).rejects.toThrow()
            expect(storage.getObject('bucket-002', 'folder1/a.txt')).rejects.toThrow()
        })
    })
})

test('list, delete, stat object', function () {

    return Promise.all([
        storage.putObject('bucket-001', 'folder1/b.txt', 'Hi this is a'),
        storage.putObject('bucket-001', 'folder2/c.txt', 'Hi this is c'),
        storage.putObject('bucket-001', 'folder2/d.txt', 'Hi this is d'),
    ]).then(r => {
        return storage.listObjects('bucket-001', 'folder2/').then(files => {
            expect(files).toEqual(['folder2/c.txt', 'folder2/d.txt'])
            return storage.deleteObject('bucket-001', 'folder2/c.txt').then(r => {
                return storage.listObjects('bucket-001', 'folder2/')
            })
        }).then(files => {
            expect(files).toEqual(['folder2/d.txt'])
            return storage.statObject('bucket-001', 'folder1/a.txt').then(r => {
                expect(r.size).toBe('Hi this is a'.length)
            })
        })
    })
})


test('put stream', function () {
    return storage.putObject('bucket-001', 'folder1/streamfile.js', fs.createReadStream(__dirname + '/local.test.js'), { meta: { 'content-type': 'text/javascript' } }).then(r => {
        return storage.getObjectAsBuffer('bucket-001', 'folder1/streamfile.js').then(r => {
            expect(r.toString().indexOf("'bucket-001', 'folder1/streamfile.js'") !== -1).toBeTruthy()
            return storage.statObject('bucket-001', 'folder1/streamfile.js')
        }).then(stat => {
            expect(stat.meta['content-type']).toBe('text/javascript')
        })
    })
})