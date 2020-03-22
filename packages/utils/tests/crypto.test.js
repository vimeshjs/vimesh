const {xor, fromBase64, toBase64, getCRC16, getCRC32} = require('..')
const _ = require('lodash')
test('xor', function () {

    let str = 'xjzhang'
    let key = '12345'
    let a = xor(str, key)
    let c = toBase64(a)
    let d = fromBase64(c)
    let b = xor(d, key)
    console.log(str, a, c, d,  b)
    expect(d).toBe(a)
    expect(b).toBe(str)


    str = '你好'
    key = '12345'
    a = xor(str, key)
    c = toBase64(a)
    d = fromBase64(c)
    b = xor(d, key)
    console.log(str, a, c, d,  b)
    expect(d).toBe(a)
    expect(b).toBe(str)

    str = '你好'
    key = '世界'
    a = xor(str, key)
    c = toBase64(a)
    d = fromBase64(c)
    b = xor(d, key)
    console.log(str, a, c, d,  b)
    expect(d).toBe(a)
    expect(b).toBe(str)
    
        
    str = 'admin'
    key = 'admin'
    a = xor(str, key)
    c = toBase64(a)
    d = fromBase64(c)
    b = xor(d, key)
    console.log(str, a, c, d,  b)
    expect(d).toBe(a)
    expect(b).toBe(str)


})

test('crc', () => {
    let c1 = getCRC32('account')
    let c2 = getCRC16('account')
    console.log(c1, 10000 + (c1 % 10000))
    console.log(c2, 10000 + (c2 % 10000))
})