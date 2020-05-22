const _ = require('lodash')
function setup(options){
    return {
        login(username, password){
            let user = _.find(options.users, u => u.username == username && u.password == password)
            return Promise.resolve(user != null)
        }
    }
}

module.exports = {
    setup
}