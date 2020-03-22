
module.exports = {
    findAll: ({ Roles }, cond) => {
        return Roles.find(cond).toArray()
    },
    findOne: ({ Roles}, cond) => {
        return Roles.findOne(cond)
    },
    findAllByPager: ({ Roles }, { skip, size, sort }) => {
        return Roles.find({}).skip(skip).sort(sort).limit(size).toArray()
    },
    count: ({ Roles }) => {
        return Roles.countDocuments()
    },
    findById: ({ Roles }, _id) => {
        return Roles.findOne({ '_id': _id })
    },
    save: ({ Roles }, role) => {
        return Roles.insertOne(role)
    },
    update: ({ Roles }, { roleId, role }) => {
        delete role._id
        return Roles.updateOne({ _id: roleId }, { '$set': role })
    }
}