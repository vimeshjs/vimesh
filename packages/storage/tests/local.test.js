const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const { glob } = require('glob')
const { timeout } = require('@vimesh/utils')
const express = require('express')
const { createStorage, createScopedStorage, createCacheForScopedStorage } = require('..')
const { setupLogger } = require('@vimesh/logger')
const sinon = require('sinon')
const { duration } = require('@vimesh/utils')
const clock = sinon.useFakeTimers({
    now: new Date(),
    shouldAdvanceTime: true
})

setupLogger()
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
        storage.putObject('bucket-001', 'folder1/b.txt', 'Hi this is b'),
        storage.putObject('bucket-001', 'folder2/c.txt', 'Hi this is c'),
        storage.putObject('bucket-001', 'folder2/d.txt', 'Hi this is d'),
    ]).then(r => {
        return storage.listObjects('bucket-001', 'folder2/').then(files => {
            expect(_.map(files, f => f.path).sort()).toEqual(['folder2/c.txt', 'folder2/d.txt'].sort())
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
    return storage.putObjectAsFile('bucket-001', 'folder1/streamfile.js', __dirname + '/local.test.js', { meta: { 'content-type': 'text/javascript' } }).then(r => {
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

test('copy ', function () {
    return storage.copyObject('bucket-001', 'folder1/b.txt', 'folder1/b-001.txt').then(r => {
        return storage.getObjectAsString('bucket-001', 'folder1/b-001.txt').then(r => {
            expect(r).toBe('Hi this is b')
            return storage.copyObject('bucket-001', 'folder1/b-001.txt', 'folder1/d.txt')
        }).then(r => {
            return storage.getObjectAsString('bucket-001', 'folder1/d.txt').then(r => {
                expect(r).toBe('Hi this is b')
            })
        })
    })
})

test('move ', function () {
    return storage.moveObject('bucket-001', 'folder1/b-001.txt', 'folder1/b-moved.txt').then(r => {
        return storage.getObjectAsString('bucket-001', 'folder1/b-moved.txt').then(r => {
            expect(r).toBe('Hi this is b')
            expect(storage.getObject('bucket-001', 'folder1/b-001.txt')).rejects.toThrow()
        })
    })
})

test('express middleware', function () {
    const app = express()
    const port = 3000

    app.get('/', (req, res) => res.send('Storage Tests!'))

    let urlPath = '/@test/get'
    let scopedStorage = createScopedStorage(storage, 'bucket-001', 'folder1/')
    let cache = createCacheForScopedStorage(scopedStorage, `${__dirname}/tmp`, { maxAge: '1h' })
    app.get(`${urlPath}/*`, function (req, res, next) {
        let filePath = path.relative(`${urlPath}/`, req.path)
        cache.get(filePath).then(stat => {
            if (!stat || !stat.localFilePath) return next()
            res.sendFile(stat.localFilePath)
        })
    })
    app.listen(port, () => console.log(`Test app listening on port ${port}!`))

    return timeout('3s').then(r => {
        return fetch(`http://localhost:${port}/@test/get/b.txt`).then(r => r.text()).then(r => {   
            expect(r).toBe('Hi this is b')
        })
    }).then(r => {
        return storage.putObject('bucket-001', 'folder1/b.txt', 'Hi this is m')
    }).then(r => {
        return fetch(`http://localhost:${port}/@test/get/b.txt`).then(r => r.text()).then(r => {
            expect(r).toBe('Hi this is b')
            clock.tick(duration('1.1h'));
        })
    }).then(r => {
        return fetch(`http://localhost:${port}/@test/get/b.txt`).then(r => r.text()).then(r => {
            expect(r).toBe('Hi this is m')
        })
    })
})
