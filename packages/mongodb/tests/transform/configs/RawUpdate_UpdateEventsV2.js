const _ = require('lodash')
const { toObjectID } = require('@vimesh/mongodb')
module.exports = (item) => {
    let all = []
    if (!item.session || !item.session.resp || !item.session.params) return all
    _.each(item.data, (ecuItem, index) => {
        let ecus = item.session.params.ecus
        if (_.isPlainObject(ecus)) ecus = _.values(ecus)
        if (!_.isArray(ecus)) return all
        let name = ecuItem.ecu
        if (!name && item.data.length == 1 && ecus.length == 1) name = ecus[0].name
        if (name) {
            let evt = {
                _id: item._id + '-' + index,
                ecu: name,
                state: ecuItem.state,
                vin: item.session.vin || item.session.resp.vin || item.session.params.vin,
                usid: item.session._id,
                vmid: item.session.vmid,
                sch_id: item.session.scheduleId,
                cmp_id: item.session.campaignId,
                mode: item.session.resp.mode,
                _at: item._at,
                s_at: item.s_at,
                all: ecus.length
            }
            if (!item.session.ups) {
                _.each(_.get(item, 'session.params.vehicleModel.ecus', ecu => {
                    if (name === ecu.ecu_name) {
                        evt.emid = ecu._id
                    }
                }))
                _.each(ecus, (ecu, index) => {
                    if (name === ecu.name) {
                        evt.no = index
                    }
                })
            } else {
                _.each(item.session.ups, (up, index) => {
                    if (name === (up.ecu && up.ecu.ecu_name)) {
                        evt.pkg_id = toObjectID(up._id)
                        evt.emid = up.emid
                        evt.no = index
                    }
                })
            }
            all.push(evt)
        }
    })
    return all
}