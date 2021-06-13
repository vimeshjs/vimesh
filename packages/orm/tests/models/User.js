const _ = require('lodash')
const crypto = require('crypto')

function generateEncryptedPassword(password, id) {
    return password == null ? null :
        crypto.createHash('md5').update(password).update('with').update(id).digest("hex");
}

module.exports = {
    setPlainPassword({ }, id, password) {
        password = generateEncryptedPassword(password, id)
        return this.set({ id, password })
    },
    async authenticate({ }, id, password) {
        let user = await this.get(id)
        var encPassword = generateEncryptedPassword(password, id)
        return user.password == encPassword
    }
}
