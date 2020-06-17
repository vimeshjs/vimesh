const _ = require('lodash')
const { getJwtSecret } = require('./_lib/utils')
const { duration } = require('@vimesh/utils')
const passport = require('passport')
const jwt = require('jsonwebtoken')
const LocalStrategy = require('passport-local').Strategy

let jwtExpiration = 1000 * 60 * 60
let jwtSecret = 'vimesh'

function setup({ config }) {
    jwtExpiration = duration(_.get(config, 'passport.jwt.expiration') || '1h')
    jwtSecret = getJwtSecret(config)
}

function get(req, res, next) {
    let data = {
        i18n: res.i18n('pages.login;common')
    }
    res.show(data)
}

function post(req, res, next) {
    passport.authenticate('local', { session: false },
        function (error, user) {
            if (error || !user) {
                return res.error(error);
            }
            const payload = {
                ...user,
                expires: Date.now() + jwtExpiration,
            }
            req.login(payload, { session: false }, (error) => {
                if (error) {
                    res.error(error)
                } else {
                    const token = jwt.sign(payload, jwtSecret)
                    if (req.query.tokenIn === 'json') {
                        res.json({ token })
                    } else {
                        res.cookie('jwt', token, { httpOnly: true })
                        res.ok(res.i18n('pages.login.ok_login'))
                    }
                }
            })
        })(req, res)
}
module.exports = {
    setup,
    get: {
        before: ['|'],
        handler: get
    },
    post: {
        before: ['|'],
        handler: post
    }
}