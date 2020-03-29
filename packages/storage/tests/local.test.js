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
    storage = createStorage({ type: 'local', options: { root } })
})
test('auto create root folder', function () {
    expect(fs.existsSync(root)).toBeTruthy()
})

test('create buckets', function () {
    return storage.createBucket('bucket-001', {}).then(() => {
        return storage.hasBucket('bucket-001').then(r => {
            expect(r).toBeTruthy()
            return storage.hasBucket('bucket-xxx')
        }).then(r => {
            expect(r).toBeFalsy()
            return storage.createBucket('bucket-002').then(r => storage.hasBucket('bucket-002'))
        }).then(r => {
            expect(r).toBeTruthy()
        })
    })
})

test('list buckets', function () {
    return storage.listBuckets().then(rs => {
        expect(rs).toEqual(['bucket-001', 'bucket-002'])
    })
})

test('get and put object', function () {
    return storage.putObject('bucket-001', 'folder1/a.txt', 'Hi this is a').then(r => {
        return storage.getObjectAsString('bucket-001', 'folder1/a.txt').then(r => {
            expect(r).toBe('Hi this is a')
            expect(storage.getObject('bucket-003', 'folder1/a.txt')).rejects.toThrow()
            expect(storage.getObject('bucket-002', 'folder1/a.txt')).rejects.toThrow()
            expect(storage.getPartialObjectAsString('bucket-001', 'folder1/a.txt', 3, 7)).resolves.toBe('this is')
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
            expect(_.map(files, f => f.path)).toEqual(['folder2/c.txt', 'folder2/d.txt'])
            return storage.deleteObject('bucket-001', 'folder2/c.txt').then(r => {
                return storage.listObjects('bucket-001', 'folder2/')
            })
        }).then(files => {
            expect(_.map(files, f => f.path)).toEqual(['folder2/d.txt'])
            return storage.statObject('bucket-001', 'folder1/a.txt').then(r => {
                expect(r.size).toBe('Hi this is a'.length)
            })
        })
    })
})


test('put stream', function () {
    let jscontent = null
    return storage.putObject('bucket-001', 'folder1/streamfile.js', fs.createReadStream(__dirname + '/local.test.js'), { meta: { 'content-type': 'text/javascript' } }).then(r => {
        return storage.getObjectAsBuffer('bucket-001', 'folder1/streamfile.js').then(r => {
            jscontent = r.toString()
            expect(jscontent.indexOf("'bucket-001', 'folder1/streamfile.js'") !== -1).toBeTruthy()
            return storage.statObject('bucket-001', 'folder1/streamfile.js')
        }).then(stat => {
            expect(stat.meta['content-type']).toBe('text/javascript')
            return storage.getObjectAsFile('bucket-001', 'folder1/streamfile.js', `${__dirname}/tmp/downloaded.js`)
        }).then(r => {
            let buf = fs.readFileSync(`${__dirname}/tmp/downloaded.js`)
            expect(buf.toString()).toBe(jscontent)
        })
    })
})