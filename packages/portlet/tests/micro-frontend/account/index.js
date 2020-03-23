'use strict';
const { loadConfigs } = require('@vimesh/utils')
const { setupLogger } = require('@vimesh/logger')
const { setupViewServer } = require('../../..')
let context = {
    configsDir: __dirname + '/configs'
}
let configs = loadConfigs(context, 'common', process.env.NODE_ENV)
setupLogger(configs.logger)
setupViewServer({
    port: process.env.HTTP_PORT || process.env.PORT || configs.portlet.port,
    portlet: process.env.PORTLET || configs.portlet.name || 'portlet',
    layout: process.env.LAYOUT || configs.portlet.layout,
    mockDir: configs.portlet.mock ? __dirname + '/mock' : null,
})
