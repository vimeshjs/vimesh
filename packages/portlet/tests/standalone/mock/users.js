const _ = require('lodash')
const crypto = require('crypto')

let allIds = []
let allUsers = {}

let admin = 'admin'
allUsers[admin] = {
    _id : admin,
    name: 'Administrator',
    email: 'jacky@vimesh.org',
    mobile: '888-8888',
    password : generateEncryptedPassword(admin, admin)
}
allIds.push('admin')

for (let i = 0; i < 1000; i++) {
    let id = i + 1000
    let login = 'user' + id
    let user = {
        _id: login,
        name: 'name ' + id,
        email: id + '@vimesh.org',
        mobile: '888-' + id,
        password : generateEncryptedPassword('pass' + id, login)
    }
    allUsers[user._id] = user
    allIds.push(user._id)
}

function generateEncryptedPassword(password, salt) {
	return password == null ? null :
		crypto.createHash('md5').update(password).update('with').update(salt || 'salt').digest("hex");
}

function checkPassword(user, password) {
    if (!user || !user.password) return false;
    var encPassword = generateEncryptedPassword(password, user._id)
    return user.password === encPassword
}

function get(id) {
    return Promise.resolve(allUsers[id])
}
function add(user){
    if (!user) return Promise.reject(Error('User could not be empty'))
    if (!user._id) {
        return Promise.reject(Error('Login could not be empty'))
    } else {
        if (allUsers[user._id]) return Promise.reject(Error('User is already existed'))
        return set(user)
    }
}
function set(user) {
    if (!user) return Promise.reject(Error('User could not be empty'))
    if (!user._id) {
        return Promise.reject(Error('Login could not be empty'))
    } else {
        if (!allUsers[user._id]){
            allIds.push(user._id)
            allIds = _.sortBy(allIds, id => id)
        }
        allUsers[user._id] = user
    }
    return Promise.resolve()
}
function select({ cond, skip, limit }) {
    return Promise.resolve({
        data: _.map(allIds.slice(skip, skip + limit), id => allUsers[id]),
        count: allIds.length
    })
}
function recycle(idToRemove){
    let index = _.findIndex(allIds, id => id === idToRemove)
    allIds.splice(index, 1)
    delete allUsers[idToRemove]
    return Promise.resolve()
}
function authenticate(login, password){
    let user = allUsers[login]
    if (!user) return Promise.reject(Error('User could not be found!'))
    if (!checkPassword(user, password)) return Promise.reject(Error('Wrong password!'))
    return Promise.resolve(user)
}
module.exports = {
    get,
    add,
    set,
    recycle,
    select,
    authenticate
}