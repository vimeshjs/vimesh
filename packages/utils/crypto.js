const _ = require('lodash')
const crypto = require('crypto')
const crc = require('crc')
const { v4: uuidv4 } = require('uuid')

function getCRC16(str) {
    return crc.crc16ccitt(str)
}

function getCRC32(str) {
    return crc.crc32(str)
}

function fromBase64(data, enc = 'utf8') {
    let buff = Buffer.from(data, 'base64')
    return buff.toString(enc)
}

function toBase64(data) {
    let buff = Buffer.isBuffer(data) ? data : new Buffer.from(data);
    return buff.toString('base64')
}

function toUrlSafeBase64(unencoded) {
    var encoded = toBase64(unencoded)
    return encoded.replace('+', '-').replace('/', '_').replace(/=+$/, '')
}

function fromUrlSafeBase64(encoded, enc = 'utf8') {
    encoded = encoded.replace('-', '+').replace('_', '/')
    while (encoded.length % 4)
        encoded += '='
    return fromBase64(encoded)
}

function xor(str, key) {
    key = key ? key.toString() : ''
    var output = ''
    var count = key.length
    for (var i = 0; i < str.length; ++i) {
        output += String.fromCharCode(key.charCodeAt(i % count) ^ str.charCodeAt(i))
    }
    return output
}

function getMD5(content) {
    if (Buffer.isBuffer(content))
        return crypto.createHash('md5').update(content).digest('hex');
    else
        return crypto.createHash('md5').update(_.isString(content) ? content : content + "", 'utf8').digest('hex');
}

function getUUID(options) {
    return uuidv4()
}
module.exports = {
    getCRC16,
    getCRC32,
    fromBase64,
    toBase64,
    toUrlSafeBase64,
    fromUrlSafeBase64,
    xor,
    getMD5,
    getUUID
}