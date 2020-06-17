
const _ = require('lodash')
const { formatDate } = require('@vimesh/utils')
const { getJwtSecret, getPermissions } = require('./_lib/utils')
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportJWT = require('passport-jwt');
const JWTStrategy = passportJWT.Strategy;
let portletServer
function setup(server) {
    const jwtSecret = getJwtSecret(server.config)
    portletServer = server

    passport.use(new LocalStrategy({
        usernameField: 'login',
        passwordField: 'password',
    }, function (username, password, callback) {
        $mock.users.authenticate(username, password).then(user => {
            let payload = {
                id: user._id,
                name: user.name,
                avatar: user.avatar,
                account: user.account_id
            }
            callback(null, payload)
        }).catch(ex => {
            $logger.error('Fails to login ', ex)
            callback('Fails to login ')
        })
    }))

    passport.use(new JWTStrategy({
        jwtFromRequest: req => req.cookies.jwt || req.query.jwt || req.headers.jwt,
        secretOrKey: jwtSecret,
    }, function (jwtPayload, callback) {
        if (Date.now() > jwtPayload.expires) {
            $logger.warn(`JWT token is expired (${JSON.stringify(jwtPayload)} @ ${formatDate(jwtPayload.expires)}) `)
            return callback(null, null);
        }
        return callback(null, jwtPayload);
    }))
}

const jwt = passport.authenticate('jwt', {
    session: false,
    failureRedirect: '/login'
})

function auth(req, res, next) {
    res.locals.$user = req.user
    getPermissions(req.user.id, portletServer.allPermissions).then(perms => {
        res.locals.$permissions = perms
        next()
    })
}
module.exports = {
    setup,
    beforeAll: [jwt, auth]
}