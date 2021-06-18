const _ = require('lodash')
const crypto = require('crypto')

function generateEncryptedPassword(password, id) {
    return password == null ? null :
        crypto.createHash('md5').update(password).update('with').update('diagnostics').digest("hex");
}

module.exports = {
    async $setup() {
        const adminId = 'admin'
        let admin = await this.get({ login: adminId })
        if (!admin) {
            $logger.info('Create admin user')
            let admin = await this.add({
                login: adminId,
                name: 'Administrator',
                password: generateEncryptedPassword(adminId),
                //isAdmin: true,
                //blocked: false
            })
            console.log(admin)
        }
    },
    setWithPlainPassword: function ({ }, user) {
        if (user.password) {
            user.password = generateEncryptedPassword(user.password)
        }
        console.log(user)
        return user.id ? this.set(user) : this.add(user)
    },
    async authenticate({ }, login, password) {
        let user = await this.get({login})
        var encPassword = generateEncryptedPassword(password)
        return user.password == encPassword ? user : null
    },
    getAvatarUrl({ }, user) {
        if (!user || !user.avatar) return '/avatar.png'
        return `/users/avatar/${user.avatar}?s=48` 
    }
}
