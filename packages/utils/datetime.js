const _ = require('lodash')
const moment = require('moment-timezone')

function toDate(dt){
	return moment(dt).toDate();
}

function formatDate(dt, format) {
	return moment(dt).format(format ? format : 'YYYY-MM-DD HH:mm:ss')
}

function duration(interval){
	if (!interval) return 0
	if (_.isString(interval)){
		let unit = interval.substring(interval.length - 1)
		let val = +interval.substring(0, interval.length - 1)
		if ('d' === unit)
			unit = 1000 * 60 * 60 * 24
		else if ('h' === unit)
			unit = 1000 * 60 * 60
		else if ('m' === unit)
			unit = 1000 * 60
		else if ('s' === unit)
			unit = 1000
		else 
			return +interval
		return val * unit
	} else {
		return +interval
	}
}

module.exports = {
    toDate,
	formatDate, 
	duration
}