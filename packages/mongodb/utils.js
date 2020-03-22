const _ = require('lodash')
const { ObjectID, Timestamp } = require('mongodb')

function getObjectID() {
    return ObjectID();
}

function toObjectID(id) {
    if (id instanceof ObjectID)
        return id;
    else {
        var re;
        try {
            re = ObjectID(id);
        } catch (e) {
            re = id;
        }
        return re;
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

module.exports = {
    getObjectID,
    toObjectID,
    toTimestamp,
    getTimestamp
}