
const { setupComponents } = require('./components')

function component(name, options) {
    let isDev = 'development' === process.env.NODE_ENV
    let fn = `${name}${isDev ? '' : '.min'}.js`
    return `<script src="${options.data.root._urlPrefix || ''}/_/${fn}"></script>`
}

module.exports = (portlet) => {
    portlet.registerHbsHelpers({ component })
    setupComponents(portlet)
}
