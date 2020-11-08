
const _ = require('lodash')
const fs = require('graceful-fs')
const { createStorage } = require('..')
const Promise = require('bluebird')

const { setupLogger } = require('@vimesh/logger')
setupLogger()

const PREFIX = 'vimesh.'
let storage = null
beforeAll(() => {
    storage = createStorage({
        type: 's3',
        options: {
            bucketPrefix: PREFIX,
            region: 'ap-southeast-1',
            accessKey: 'AKIATGZ3IMMJIYMYHZOE',
            secretKey: '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'
        }
    })
    return storage.listObjects('bucket-001').then(fs => {
        return fs && Promise.each(fs, f => {
            return storage.deleteObject('bucket-001', f.path)
        })
    }).catch(ex => { }).then(r => {
        return storage.listObjects('bucket-002').then(fs => {
            return fs && Promise.each(fs, f => {
                return storage.deleteObject('bucket-002', f.path)
            })
        })
    }).catch(ex => { }).then(r => {
        return Promise.all([
            storage.deleteBucket('bucket-001'),
            storage.deleteBucket('bucket-002')
        ])
    }).catch(ex => { })
}, 1000 * 60)

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
}, 1000 * 60)

test('list buckets', function () {
    return storage.listBuckets().then(rs => {
        expect(rs).toEqual(expect.arrayContaining([PREFIX + 'bucket-001', PREFIX + 'bucket-002']))
    })
}, 1000 * 60)

test('get and put object', function () {
    return storage.putObject('bucket-001', 'folder1/a.txt', 'Hi this is a').then(r => {
        return storage.getObjectAsString('bucket-001', 'folder1/a.txt').then(r => {
            expect(r).toBe('Hi this is a')
            expect(storage.getObject('bucket-003', 'folder1/a.txt')).rejects.toThrow()
            expect(storage.getObject('bucket-002', 'folder1/a.txt')).rejects.toThrow()
            expect(storage.getPartialObjectAsString('bucket-001', 'folder1/a.txt', 3, 7)).resolves.toBe('this is')
            expect(storage.getPartialObjectAsString('bucket-001', 'folder1/a.txt', 3)).resolves.toBe('this is a')
        })
    })
}, 1000 * 60)

test('list, delete, stat object', function () {

    return Promise.all([
        storage.putObject('bucket-001', 'folder1/b.txt', 'Hi this is b'),
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
}, 1000 * 60)

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
}, 1000 * 60)

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
}, 1000 * 60)
