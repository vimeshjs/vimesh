const _ = require('lodash')
const moment = require('moment')

module.exports = {
    getDao({ }, name, dt) {
        return this._(`${name}_${moment(dt).format('YYYYMMDD')}`)
    },
    async listAllEventNames({ }) {
        let all = await this.listAllWithAffix()
        let nameMap = {}
        _.each(all, item => {
            let pos = _.lastIndexOf(item, '_')
            if (pos != -1) nameMap[item.substring(0, pos)] = 1
        })
        return _.sortBy(_.keys(nameMap))
    },
    async listAllEventDates({ }) {
        let all = await this.listAllWithAffix()
        let dateMap = {}
        _.each(all, item => {
            let pos = _.lastIndexOf(item, '_')
            if (pos != -1) {
                let ev = item.substring(0, pos)
                let ed = item.substring(pos + 1)
                if (!dateMap[ed])
                    dateMap[ed] = [ev]
                else
                    dateMap[ed].push(ev)
            }
        })
        return dateMap
    }
}