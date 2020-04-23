
const _ = require('lodash')
const { formatDate } = require('@vimesh/utils')
const { getJwtSecret } = require('./_lib/utils')
const passport = require('passport');
const passportJWT = require('passport-jwt');
const JWTStrategy = passportJWT.Strategy;

function setup({ app, config }) {
    const jwtSecret = getJwtSecret(config)

    passport.use(new JWTStrategy({
        jwtFromRequest: req => req.cookies.jwt,
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
    console.log('Auth : ', req.path, req.user)
    next()
}
module.exports = {
    setup,
    before: [jwt, auth]
}