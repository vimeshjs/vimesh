const _ = require('lodash')
const { icon } = require('@fortawesome/fontawesome-svg-core')
const solidIcons = require('@fortawesome/free-solid-svg-icons')
const regularIcons = require('@fortawesome/free-regular-svg-icons')
const brandsIcons = require('@fortawesome/free-brands-svg-icons')
const allIcons = _.merge({}, solidIcons, regularIcons, brandsIcons)
function fontAwesomeIcon(name, options) {
    if (!_.isString(name)) return
    let icons = allIcons
    if (_.startsWith(name, 'fas-')) {
        name = name.substring(4)
        icons = solidIcons
    } else if (_.startsWith(name, 'far-')) {
        name = name.substring(4)
        icons = regularIcons
    } else if (_.startsWith(name, 'fab-')) {
        name = name.substring(4)
        icons = brandsIcons
    }
    let iconName = _.camelCase(_.startsWith(name, 'fa-') ? name : 'fa-' + name)
    if (icons[iconName]) {
        let svg = icon(icons[iconName]).html[0]
        let size = options.hash.size
        let klass = options.hash.class
        if (!size && !klass) size = 16
        if (klass) svg = svg.replace('svg-inline--fa', klass)
        if (size) svg = [svg.substring(0, 4), `style="width:${size}px;height:${size}px;"`, svg.substring(4)].join(' ')
        return svg
    } else {
        $logger.warn(`Icon ${name} does not exist!`)
    }
}

module.exports = (portlet) => {
    portlet.registerHbsHelpers({
        fontAwesomeIcon,
        faIcon: fontAwesomeIcon
    })
}