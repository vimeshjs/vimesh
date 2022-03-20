const _ = require('lodash')
const moment = require('moment')
const { ObjectId, Timestamp } = require('mongodb')

function getObjectID() {
    return ObjectId();
}

function toObjectID(id) {
    if (id instanceof ObjectId) {
        return id
    } else {
        try {
            return ObjectId(_.isDate(id) ? id.valueOf() / 1000 : id);
        } catch (e) {
            return id
        }
    }
}

function toTimestamp(ts) {
    if (ts instanceof Timestamp)
        return ts;
    else
        return _.isString(ts) ? Timestamp.fromString(ts) : Timestamp.fromNumber(ts);
}

var tsIndex = 0;
var lastT = 0;
function getTimestamp(dt) {
    dt = dt ? (dt instanceof Date ? dt.getTime() : dt) : Date.now();
    var t = Math.floor(dt / 1000);
    if (lastT == t)
        tsIndex++
    else {
        tsIndex = 0;
        lastT = t;
    }
    return new Timestamp((dt % 1000) * 100000 + tsIndex, t);
}

function extractDate(dt) {
    if (dt instanceof ObjectId)
        dt = dt.getTimestamp()
    if (dt instanceof Timestamp)
        return new Date(dt.getHighBits() * 1000)
    return moment(dt).toDate();
}

module.exports = {
    extractDate,
    getObjectID,
    toObjectID,
    toTimestamp,
    getTimestamp
}