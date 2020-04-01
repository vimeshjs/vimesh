
const _ = require('lodash')
const { getJwtSecret } = require('./_lib/utils')
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportJWT = require('passport-jwt');
const JWTStrategy = passportJWT.Strategy;

function setup({ app, config }) {
    const jwtSecret = getJwtSecret(config)

    passport.use(new LocalStrategy({
        usernameField: 'login',
        passwordField: 'password',
    }, function (username, password, callback) {
        $mock.users.authenticate(username, password).then(user => {
            callback(null, _.pick(user, '_id', 'email', 'name', 'mobile'))
        }).catch(ex => {
            $logger.error('Fails to login ', ex)
            callback('Fails to login ')
        })
    }))

    passport.use(new JWTStrategy({
        jwtFromRequest: function(req){
            return req.cookies.jwt
        } ,
        secretOrKey: jwtSecret,
    }, function (jwtPayload, callback) {
        if (Date.now() > jwtPayload.expires) {
            return callback('jwt expired');
        }
        return callback(null, jwtPayload);
    }))
}

const jwt = passport.authenticate('jwt', {session: false})

function auth(req, res, next) {
    console.log('Auth : ' , req.path , req.user)
    next()
}
module.exports = {
    setup,
    before: [jwt, auth]
}