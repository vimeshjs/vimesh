const _ = require('lodash')
const {toObjectID} = require('../..')
module.exports = {
    addSubDep: function ({ Departments }, id, subDepIds) {
        if (!_.isArray(subDepIds)) subDepIds = [subDepIds]
        return Departments.updateOne({ _id: id }, { $addToSet: { sub_deps: { $each: subDepIds } } }).then(r => {
            return !!r.result.ok
        })
    },
    getTree: function () {
        return this.getAll().then(all => {
            let map = {}
            let roots = []
            _.each(all, item => {
                map[item._id] = item
            })
            _.each(all, item => {
                if (!item.pid) {
                    roots.push(item)
                } else {
                    item.parent = map[item.pid]
                    delete item.pid
                    item.root = map[item.rid]
                    delete item.rid
                }
                item.sub_deps = _.map(item.sub_deps, sdid => {
                    return map[sdid]
                })
            })
            return roots
        })
    },
    getAll: function ({ Departments, Companies }, { company_cond = {}, department_cond = {}}) {
        company_cond['type'] = '@';
        return Promise.all([
            Companies.find(company_cond).toArray(),
            Departments.find(department_cond).toArray()
        ]).then(rs => {
            let map = {}
            let cs = rs[0] || []
            let csMap = {}
            let ds = rs[1] || []
            let all = cs.concat(ds)
            _.each(all, (d) => {
                map[d._id] = d
            })
            _.each(all, (d) => {
                _.each(d.sub_deps, (sdid) => {
                    if (map[sdid]) map[sdid].pid = d._id
                })
            })
            function setRootId(sub_deps, rid) {
                _.each(sub_deps, (sdid) => {
                    let d = map[sdid]
                    if (d) {
                        d.rid = rid
                        setRootId(d.sub_deps, rid)
                    }
                })
            }
            _.each(cs, c => {
                setRootId(c.sub_deps, c._id)
            })
            _.each(cs, c => {
                csMap[c._id] = c
            })
            return _.filter(all, item => item.rid || csMap[item._id])
        })
    },
    findAll: function ({ Departments }) {
        return Departments.find({}).toArray()
    },
    deleteOne: function ({ Departments }, id) {
        return Departments.deleteOne({ _id: id });
    },
    updateDepartment: function({Users }, {_id, body}) {
        const i_d = _id;
        _id = toObjectID(_id);
        var collection = $dao.Departments;
        if (body['is_company']) {
            collection = $dao.Companies;
        }
        return Promise.resolve().then(() => {
            if (body['depName']) {
                return collection.set(_id, { name: body['depName'] }).then(() => {
                    return { name: body['depName'] }
                })
            }
            else if (body['sub_deps']) {
                return collection.set(_id, { sub_deps: body['sub_deps'] }).then(() => {
                    return { sub_deps: body['sub_deps'] };
                })
            } else if (body['positions']) {
                if(body['current_position']) {
                    return Users.find({departments: {$elemMatch : {id: i_d, position: body['old_position']}}}).toArray().then(users => {
                        const tasks = [];
                        _.each(users, user => {
                            const departments = _.map(user.departments, department => {
                                if(department.position === body.old_position) {
                                    department.position = body['current_position'];
                                }
                                return department;
                            });
                            tasks.push(
                                $dao.Users.set({_id: user._id, departments: departments})
                            )
                        })
                        tasks.push(
                            collection.set(_id, { positions: body['positions'] }).then(() => {
                                return { positions: body['positions'] };
                            })
                        )
                        return Promise.all(tasks);
                    });
                } else {
                    return  collection.set(_id, { positions: body['positions'] }).then(() => {
                        return { positions: body['positions'] };
                    })
                }
               
            } else  {
                return {}
            }

        })
    }
}