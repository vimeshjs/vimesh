const { xor, fromBase64, toBase64, fromUrlSafeBase64, toUrlSafeBase64, getCRC16, getCRC32, getMD5, getFileChecksum } = require('..')
const _ = require('lodash')
const fs = require('fs')
test('xor', function () {

    let str = 'xjzhang'
    let key = '12345'
    let a = xor(str, key)
    let c = toBase64(a)
    let d = fromBase64(c)
    let b = xor(d, key)
    console.log(str, a, c, d, b)
    expect(d).toBe(a)
    expect(b).toBe(str)


    str = '你好'
    key = '12345'
    a = xor(str, key)
    c = toBase64(a)
    d = fromBase64(c)
    b = xor(d, key)
    console.log(str, a, c, d, b)
    expect(d).toBe(a)
    expect(b).toBe(str)

    str = '你好'
    key = '世界'
    a = xor(str, key)
    c = toBase64(a)
    d = fromBase64(c)
    b = xor(d, key)
    console.log(str, a, c, d, b)
    expect(d).toBe(a)
    expect(b).toBe(str)


    str = 'admin'
    key = 'admin'
    a = xor(str, key)
    c = toBase64(a)
    d = fromBase64(c)
    b = xor(d, key)
    console.log(str, a, c, d, b)
    expect(d).toBe(a)
    expect(b).toBe(str)


})

test('crc', () => {
    let c1 = getCRC32('account')
    let c2 = getCRC16('account')
    console.log(c1, 10000 + (c1 % 10000))
    console.log(c2, 10000 + (c2 % 10000))
})

test('md5', () => {
    let fn = `${__dirname}/crypto.test.js`
    let md5 = getMD5(fs.readFileSync(fn))
    console.log(md5)
    return getFileChecksum(fn).then(fmd5 => {
        expect(fmd5).toBe(md5)
    })
})

test('url safe base64', function () {

    let str = 'xjzhang'
    let a = toBase64(str)
    let b = fromBase64(a)

    let c = toUrlSafeBase64(str)
    let d = fromUrlSafeBase64(c)

    console.log(a, b, c, d)
    expect(b).toBe(str)
    expect(d).toBe(str)


    str = '你好'
    a = toBase64(str)
    b = fromBase64(a)

    c = toUrlSafeBase64(str)
    d = fromUrlSafeBase64(c)

    console.log(a, b, c, d)
    expect(b).toBe(str)
    expect(d).toBe(str)

    str = 'subjects?_d=1'
    a = toBase64(str)
    b = fromBase64(a)

    c = toUrlSafeBase64(str)
    d = fromUrlSafeBase64(c)

    console.log(a, b, c, d)
    expect(b).toBe(str)
    expect(d).toBe(str)

})
