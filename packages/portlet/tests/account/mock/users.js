const _ = require('lodash')
let mockUsers = []
for (let i = 0; i < 1000; i++) {
    let id = i + 1000
    mockUsers.push({
        _id: id,
        name: 'name ' + id,
        email: id + '@vimesh.org',
        mobile: '888-' + id
    })
}
let lastUserId = 100
function add(user){
    mockUsers.push(user)
    mockUsers = _.sortBy(mockUsers, item => item._id)
}
function get(id) {
    id = +id
    return _.find(mockUsers, u => u._id === id)
}
function set(user) {
    if (!user) return Promise.resolve()
    if (!user._id) {
        user._id = lastUserId++
        add(user)
    } else {
        let index = _.findIndex(mockUsers, u => u._id === user._id)
        if (index >= 0)
            mockUsers[index] = user
        else
            add(user)
    }
    return Promise.resolve()
}
function select({ cond, skip, limit }) {
    return Promise.resolve({
        data: mockUsers.slice(skip, skip + limit),
        count: mockUsers.length
    })
}
function recycle(id){
    id = +id
    let index = _.findIndex(mockUsers, u => u._id === id)
    mockUsers.splice(index, 1)
    return Promise.resolve()
}
module.exports = {
    get,
    set,
    recycle,
    select
}