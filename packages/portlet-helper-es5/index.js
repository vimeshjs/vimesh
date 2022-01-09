const _ = require('lodash')
const path = require('path')
const babel = require("@babel/core")

function es5(options) {
    let code = options.fn(this)
    let fullpath = path.join(options.data.root._rootDir, 'node_modules', '@babel/preset-env')
    let result = babel.transformSync(code, { presets: [fullpath] })
    return `${result.code}`
}

module.exports = (portlet) => {
    portlet.registerHbsHelpers({ es5 })
}