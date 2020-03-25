const _ = require('lodash')
const sinon = require('sinon')
const fs = require('fs')
const { setupLogger } = require('@vimesh/logger')
const Promise = require('bluebird')
clock = sinon.useFakeTimers({
    now: new Date(),
    shouldAdvanceTime: true
})

const { duration, pretty } = require('@vimesh/utils')
const { createMemoryCache } = require('..')
const readdirAsync = Promise.promisify(fs.readdir)
setupLogger()

test('Cache One', () => {

    let contents1 = {
        k1: 100,
        k2: 200
    }
    let cache1 = createMemoryCache({
        maxAge: '10s',
        stale: true,
        onRefresh: function (key) {
            $logger.info('Fetching ' + key)
            return contents1[key]
        }
    })

    return cache1.get('k1').then(v => {
        expect(v).toBe(100)
        return cache1.get('k2')
    }).then(v => {
        expect(v).toBe(200)
        contents1.k2 = 500
        clock.tick(duration('11s'))
        return cache1.get('k2')
    }).then(v => {
        expect(v).toBe(200) // get stale value
        return cache1.get('k2')
    }).then(v => {
        expect(v).toBe(500)
    })

})


test('Cache Two', () => {

    let cache2 = createMemoryCache({
        maxAge: '1h',
        stale : false,
        onRefresh: function (key) {
            let file = __dirname + '/' + key.type + key.no + '.json'
            $logger.info(`Fetching ${pretty(key)} @ ${file}`)
            return new Promise((resolve, reject) => {
                fs.readFile(file, (err, data) => {
                    if (err)
                        reject(err)
                    else
                        resolve(JSON.parse(data.toString()))
                })
            })
        }
    })

    let key1 = { type: 'file', no: 1 }
    let key2 = { type: 'file', no: 2 }
    return cache2.get(key1).then(v => {
        expect(v.name).toBe('file1')
        return cache2.get(key2)
    }).then(v => {
        expect(v.name).toBe('file2')
        expect(v.content).toBe("this is content 2")
        clock.tick(duration('2h'))
        return cache2.get({ no: 1, type: 'file' })
    }).then(v => {
        expect(v.name).toBe('file1')
        expect(v.content).toBe("this is content 1")
    })
})

test('Cache Enumberate', () => {
    let cache3 = createMemoryCache({
        maxAge: '1h',
        enumInterval : '10m',
        onEnumerate: _.bind(readdirAsync, null, __dirname),
        onRefresh: function (key) {
            let file = __dirname + '/' + key 
            $logger.info(`Fetching ${key} @ ${file}`)
            return new Promise((resolve, reject) => {
                fs.readFile(file, (err, data) => {
                    if (err)
                        reject(err)
                    else
                        resolve(data.toString())
                })
            })
        }
    })
    return cache3.enumerate(false).then(all => {
        expect(_.keys(all)).toEqual([ 'cache.test.js', 'file1.json', 'file2.json' ])
        //console.log(cache3.get('file1.json'))
        cache3.get('file1.json').then(r => {
            expect(r).toEqual({
                "content" : "this is content 1",
                "name" : "file1"
            })
        })
    })
})