const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const { glob } = require('glob')
const { getFullUrl } = require('@vimesh/utils')
const express = require('express')
const { createStorage, createScopedStorage, createCacheForScopedStorage } = require('..')
const { setupLogger } = require('@vimesh/logger')
const sinon = require('sinon')
const sharp = require('sharp')
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

test('create buckets', function () {
    return storage.createBucket('bucket-image', {}).then(() => {
        return storage.hasBucket('bucket-image').then(r => {
            expect(r).toBeTruthy()
        })
    })
})

test('image middleware', function () {
    const app = express()
    const port = 3001

    app.get('/', (req, res) => res.send('Storage Image Tests!'))

    let urlPath = '/@test/get'
    let scopedStorage = createScopedStorage(storage, 'bucket-image', 'avatar/')
    let cache = createCacheForScopedStorage(scopedStorage, `${__dirname}/tmp`, { maxAge: '1h' })
    app.get(`${urlPath}/*`, function (req, res, next) {
        let filePath = getFullUrl(path.relative(`${urlPath}/`, req.path), req.query)
        cache.get(filePath).then(stat => {
            if (!stat || !stat.localFilePath) return next()
            let type = _.get(stat, 'meta.type')
            if (type) res.set('Content-Type', type)
            res.sendFile(stat.localFilePath)
        })
    })
    app.listen(port, () => console.log(`Test app listening on port ${port}!`))
    return Promise.all([
        scopedStorage.putObjectAsFile('avatar.jpg', `${__dirname}/avatar.jpg`),
        scopedStorage.putObjectAsFile('river.jpeg', `${__dirname}/river.jpeg`)
    ]).then(r => {
        return fetch(`http://localhost:${port}/@test/get/avatar.jpg`).then(r => r.blob()).then(r => r.arrayBuffer())
            .then(r => {
                return sharp(Buffer.from(r, 'binary')).metadata().then(metadata => {
                    expect(metadata.width).toBe(1200)
                    expect(metadata.height).toBe(1200)
                })
            }).then(r => {
                return fetch(`http://localhost:${port}/@test/get/avatar.jpg?cmd=image.info`).then(r => r.json())
            }).then(r => {
                let metadata = r
                expect(metadata.format).toBe('jpeg')
                expect(metadata.width).toBe(1200)
                expect(metadata.height).toBe(1200)
                return fetch(`http://localhost:${port}/@test/get/avatar.jpg?s=128`).then(r => r.blob()).then(r => r.arrayBuffer())
            }).then(r => {
                return sharp(Buffer.from(r, 'binary')).metadata().then(metadata => {
                    expect(metadata.width).toBe(128)
                    expect(metadata.height).toBe(128)
                }).then(r => {
                    return fetch(`http://localhost:${port}/@test/get/river.jpeg?s=128&fit=inside`).then(r => r.blob()).then(r => r.arrayBuffer())
                })
            }).then(r => {
                return sharp(Buffer.from(r, 'binary')).metadata().then(metadata => {
                    expect(metadata.width).toBe(128)
                    expect(metadata.height).toBe(96)
                }).then(r => {
                    return fetch(`http://localhost:${port}/@test/get/river.jpeg?w=500`).then(r => r.blob()).then(r => r.arrayBuffer())
                })
            }).then(r => {
                return sharp(Buffer.from(r, 'binary')).metadata().then(metadata => {
                    expect(metadata.width).toBe(500)
                    expect(metadata.height).toBe(375)
                })
            })
    })
})